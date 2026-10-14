#!/usr/bin/env bash
# Hands edupilot.infinitycloudlabs.com to EduPilot's own nginx site file by removing the placeholder blocks
# ("# EduPilot: own name so it never falls through to the LMS.") from the end of /etc/nginx/sites-available/default.
# Backs up both files first, refuses if anything else is in that range, and restores both if `nginx -t` fails.
# Run ON the server:  sudo bash switch-nginx.sh
set -e
F=/etc/nginx/sites-available/default
S=/etc/nginx/sites-available/edupilot
TS=$(date +%Y%m%d-%H%M%S)
cp -p $F /root/nginx-default.bak-$TS
cp -p $S /root/nginx-edupilot.bak-$TS
START=$(grep -n "^# EduPilot: own name so it never falls through to the LMS." $F | cut -d: -f1)
[ -n "$START" ] || { echo "No placeholder found: nothing to do."; exit 0; }
TAIL=$(tail -n +$START $F)
if echo "$TAIL" | grep "server_name" | grep -vq "edupilot.infinitycloudlabs.com"; then echo "ABORT: other sites in the placeholder range"; exit 1; fi
if [ "$(echo "$TAIL" | grep -c "server_name edupilot.infinitycloudlabs.com")" != "2" ]; then echo "ABORT: unexpected placeholder shape"; exit 1; fi
head -n $((START - 1)) $F > /tmp/default.new && cat /tmp/default.new > $F && rm /tmp/default.new
# Certificate renewal answers its challenge from /var/www/letsencrypt (see /etc/letsencrypt/renewal/edupilot.*.conf).
sed -i "s#/var/www/edupilot-acme#/var/www/letsencrypt#" $S
grep -q "options-ssl-nginx.conf" $S || sed -i "s#    ssl_certificate_key /etc/letsencrypt/live/edupilot.infinitycloudlabs.com/privkey.pem;#&\n    include /etc/letsencrypt/options-ssl-nginx.conf;#" $S
if nginx -t 2>/tmp/nginx-test.log; then
  systemctl reload nginx
  echo "Done: nginx reloaded. Backups: /root/nginx-default.bak-$TS and /root/nginx-edupilot.bak-$TS"
else
  cp -p /root/nginx-default.bak-$TS $F; cp -p /root/nginx-edupilot.bak-$TS $S
  echo "nginx test FAILED, both files restored:"; cat /tmp/nginx-test.log; exit 1
fi
