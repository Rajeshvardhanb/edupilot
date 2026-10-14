#!/usr/bin/env bash
# Ships .deploy/release.tar.gz to the server and switches EduPilot to it; the previous release is kept for rollback.
# Database changes are applied first, from this machine, through an SSH tunnel (no build tools needed on the server).
# Usage: bash scripts/deploy/deploy.sh            (after scripts/deploy/build.sh)
#        bash scripts/deploy/deploy.sh --rollback (switch back to the previous release)
set -euo pipefail
cd "$(dirname "$0")/../.."
set -a; . .deploy/server.env; . .deploy/app.env; set +a
SSH=(ssh -i "$SSH_KEY" -o BatchMode=yes "$SSH_USER@$EC2_HOST")

if [ "${1:-}" = "--rollback" ]; then
  "${SSH[@]}" 'set -e; prev=$(sudo ls -1 /opt/edupilot/releases | sort | tail -2 | head -1); sudo ln -sfn /opt/edupilot/releases/$prev /opt/edupilot/current; sudo systemctl restart edupilot; echo "rolled back to $prev"'
  exit 0
fi

test -f .deploy/release.tar.gz || { echo "Run scripts/deploy/build.sh first."; exit 1; }
REL=$(date +%Y%m%d-%H%M%S)

echo "== database changes (through an SSH tunnel)"
SOCK=$(mktemp -u /tmp/edupilot-tunnel.XXXX)
ssh -i "$SSH_KEY" -o BatchMode=yes -o ExitOnForwardFailure=yes -M -S "$SOCK" -f -N -L 33306:127.0.0.1:3306 "$SSH_USER@$EC2_HOST"
trap 'ssh -S "$SOCK" -O exit "$SSH_USER@$EC2_HOST" 2>/dev/null || true' EXIT
DATABASE_URL="mysql://edupilot:${APP_DB_PASSWORD}@127.0.0.1:33306/edupilot" npx prisma migrate deploy

echo "== upload and switch to release $REL"
scp -i "$SSH_KEY" -o BatchMode=yes .deploy/release.tar.gz "$SSH_USER@$EC2_HOST:/tmp/edupilot-$REL.tar.gz"
"${SSH[@]}" "set -e
sudo mkdir -p /opt/edupilot/releases/$REL
sudo tar -xzf /tmp/edupilot-$REL.tar.gz -C /opt/edupilot/releases/$REL
rm -f /tmp/edupilot-$REL.tar.gz
sudo ln -sfn /opt/edupilot/shared/.env /opt/edupilot/releases/$REL/.env
sudo chown -R edupilot:edupilot /opt/edupilot/releases/$REL
sudo ln -sfn /opt/edupilot/releases/$REL /opt/edupilot/current
sudo systemctl restart edupilot
# keep the newest three releases
sudo bash -c 'cd /opt/edupilot/releases && ls -1 | sort | head -n -3 | xargs -r rm -rf'
for i in \$(seq 1 30); do curl -fsS -o /dev/null http://127.0.0.1:$PORT/login && break; sleep 2; done
curl -fsS -o /dev/null -w 'app answers locally: HTTP %{http_code}\n' http://127.0.0.1:$PORT/login"
echo "deployed release $REL → https://$DOMAIN"
