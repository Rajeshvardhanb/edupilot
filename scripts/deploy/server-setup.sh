#!/usr/bin/env bash
# One-time server setup for EduPilot, run ON the server with sudo. It only adds things of its own and never edits
# what is already there:
#   - MySQL: database `edupilot` and user `edupilot`@`localhost` with rights on that database only
#   - folder /opt/edupilot (releases, shared settings, backups) and a system user `edupilot` to run the app
#   - systemd service `edupilot` (port 3010 on 127.0.0.1 only)
#   - nginx: a separate site file for the subdomain; the config is tested before nginx is reloaded
#   - an HTTPS certificate for the subdomain only (certbot certonly: it does not edit nginx files)
#   - the app's settings file /opt/edupilot/shared/.env (written only if it does not exist yet)
# Inputs (environment): DOMAIN, PORT, MYSQL_ROOT_PASSWORD, APP_DB_PASSWORD, CERT_EMAIL, AUTH_SECRET
set -euo pipefail
: "${DOMAIN:?}" "${PORT:?}" "${MYSQL_ROOT_PASSWORD:?}" "${APP_DB_PASSWORD:?}" "${CERT_EMAIL:?}" "${AUTH_SECRET:?}"

echo "== MySQL: database and user for EduPilot only"
MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -h 127.0.0.1 -u root <<SQL
CREATE DATABASE IF NOT EXISTS edupilot CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'edupilot'@'localhost' IDENTIFIED BY '${APP_DB_PASSWORD}';
CREATE USER IF NOT EXISTS 'edupilot'@'127.0.0.1' IDENTIFIED BY '${APP_DB_PASSWORD}';
GRANT ALL PRIVILEGES ON edupilot.* TO 'edupilot'@'localhost';
GRANT ALL PRIVILEGES ON edupilot.* TO 'edupilot'@'127.0.0.1';
FLUSH PRIVILEGES;
SQL

echo "== folders and service user"
id edupilot >/dev/null 2>&1 || useradd --system --home /opt/edupilot --shell /usr/sbin/nologin edupilot
mkdir -p /opt/edupilot/releases /opt/edupilot/shared/backups
chown -R edupilot:edupilot /opt/edupilot
chmod 750 /opt/edupilot

echo "== app settings"
if [ ! -f /opt/edupilot/shared/.env ]; then
  cat > /opt/edupilot/shared/.env <<ENV
DATABASE_URL="mysql://edupilot:${APP_DB_PASSWORD}@127.0.0.1:3306/edupilot"
AUTH_SECRET="${AUTH_SECRET}"
APP_URL="https://${DOMAIN}"
AUTO_BACKUP="1"
SMTP_HOST=""
RAZORPAY_KEY_ID=""
RAZORPAY_KEY_SECRET=""
ENV
  chown edupilot:edupilot /opt/edupilot/shared/.env
  chmod 600 /opt/edupilot/shared/.env
fi

echo "== systemd service"
cat > /etc/systemd/system/edupilot.service <<UNIT
[Unit]
Description=EduPilot college management (Next.js)
After=network.target mysql.service

[Service]
User=edupilot
Group=edupilot
WorkingDirectory=/opt/edupilot/current
EnvironmentFile=/opt/edupilot/shared/.env
Environment=NODE_ENV=production PORT=${PORT} HOSTNAME=127.0.0.1 BACKUP_DIR=/opt/edupilot/shared/backups NODE_OPTIONS=--max-old-space-size=384
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=5
MemoryMax=600M

[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl enable edupilot >/dev/null 2>&1

echo "== certificate for ${DOMAIN} (webroot, no nginx edits by certbot)"
mkdir -p /var/www/letsencrypt
if [ ! -d "/etc/letsencrypt/live/${DOMAIN}" ]; then
  # A temporary plain-HTTP site answers the certificate challenge for this subdomain only.
  cat > /etc/nginx/sites-available/edupilot <<NGINX
server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN};
    location /.well-known/acme-challenge/ { root /var/www/letsencrypt; }
    location / { return 503; }
}
NGINX
  ln -sf /etc/nginx/sites-available/edupilot /etc/nginx/sites-enabled/edupilot
  nginx -t && systemctl reload nginx
  certbot certonly --webroot -w /var/www/letsencrypt -d "${DOMAIN}" --email "${CERT_EMAIL}" --agree-tos --non-interactive
fi

echo "== nginx site for ${DOMAIN}"
cat > /etc/nginx/sites-available/edupilot <<NGINX
# EduPilot — ${DOMAIN} → 127.0.0.1:${PORT}. Separate from the other sites on this server.
server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN};
    location /.well-known/acme-challenge/ { root /var/www/letsencrypt; }
    location / { return 301 https://\$host\$request_uri; }
}
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name ${DOMAIN};
    ssl_certificate /etc/letsencrypt/live/${DOMAIN}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/${DOMAIN}/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    client_max_body_size 10m;
    add_header Strict-Transport-Security "max-age=31536000" always;
    location / {
        proxy_pass http://127.0.0.1:${PORT};
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 120s;
    }
}
NGINX
ln -sf /etc/nginx/sites-available/edupilot /etc/nginx/sites-enabled/edupilot
nginx -t && systemctl reload nginx
echo "setup done"
