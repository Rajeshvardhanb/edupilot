#!/usr/bin/env bash
# Builds a self-contained release on this machine: .deploy/release.tar.gz holds server.js, the packages it
# uses, the static files, the pictures and the backup script. Nothing is built on the server.
# Usage: bash scripts/deploy/build.sh
set -euo pipefail
cd "$(dirname "$0")/../.."

DIST=.next-deploy
OUT=.deploy/release
rm -rf "$DIST" "$OUT" .deploy/release.tar.gz
mkdir -p .deploy

npx prisma generate >/dev/null
NEXT_OUTPUT=standalone NEXT_DIST_DIR="$DIST" npx next build

# The standalone folder has the server and its packages; static files, pictures and scripts are copied beside it.
cp -r "$DIST/standalone" "$OUT"
mkdir -p "$OUT/$DIST" "$OUT/scripts"
cp -r "$DIST/static" "$OUT/$DIST/static"
# Next puts a partial public/ in the bundle; replace it whole (copying onto it would nest it as public/public).
rm -rf "$OUT/public" && cp -r public "$OUT/public"
cp scripts/backup.mjs "$OUT/scripts/"
rm -f "$OUT/.env"   # the server keeps its own settings; never ship this machine's

# Every public file must sit where the app asks for it (the logo marks and the offline worker included).
for f in brand/mark-96.png brand/mark.png brand/logo.png sw.js; do test -f "$OUT/public/$f" || { echo "missing public/$f in the bundle"; exit 1; }; done
# The database engine must be in the bundle for Ubuntu (OpenSSL 3).
ls "$OUT"/node_modules/.prisma/client/libquery_engine-debian-openssl-3.0.x.so.node >/dev/null

git rev-parse --short HEAD 2>/dev/null > "$OUT/RELEASE" || date +%Y%m%d%H%M > "$OUT/RELEASE"
tar -czf .deploy/release.tar.gz -C "$OUT" .
echo "release ready: .deploy/release.tar.gz ($(du -h .deploy/release.tar.gz | cut -f1))"
