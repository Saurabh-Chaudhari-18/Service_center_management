#!/bin/bash
# EC2 initial setup for Service Center Management (Ubuntu 22.04)
# Run as root (e.g. sudo bash ec2-setup.sh)
# Prerequisites: EC2 instance with Ubuntu 22.04, security group allows 80, 443, 22

set -e

APP_USER="${APP_USER:-ubuntu}"
APP_DIR="${APP_DIR:-/home/$APP_USER/Service_center_management}"
REPO_URL="${REPO_URL:-}"  # Set via env if private repo, e.g. https://USER:TOKEN@github.com/org/repo.git

echo "==> Updating system..."
apt-get update -y
apt-get upgrade -y

echo "==> Installing dependencies..."
apt-get install -y \
    software-properties-common \
    curl \
    git \
    nginx \
    postgresql \
    postgresql-contrib \
    python3.11 \
    python3.11-venv \
    python3-pip \
    build-essential \
    libpq-dev

# Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

echo "==> Configuring PostgreSQL..."
sudo -u postgres psql -c "CREATE USER scm_app WITH PASSWORD 'CHANGE_ME_in_production';" 2>/dev/null || true
sudo -u postgres psql -c "CREATE DATABASE service_center_db OWNER scm_app;" 2>/dev/null || true
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE service_center_db TO scm_app;"
sudo -u postgres psql -c "ALTER DATABASE service_center_db SET timezone TO 'Asia/Kolkata';"

echo "==> Preparing application directory..."
if [ -n "$REPO_URL" ]; then
    sudo -u "$APP_USER" git clone "$REPO_URL" "$APP_DIR" 2>/dev/null || (cd "$APP_DIR" && sudo -u "$APP_USER" git pull)
else
    mkdir -p "$APP_DIR"
    chown -R "$APP_USER:$APP_USER" "$APP_DIR"
fi
[ -d "$APP_DIR/Backend" ] && [ -d "$APP_DIR/frontend" ] || { echo "Error: Backend and frontend not found in $APP_DIR. Clone the repo there first (see DEPLOYMENT.md)."; exit 1; }

echo "==> Creating Python venv and installing backend deps..."
sudo -u "$APP_USER" python3.11 -m venv "$APP_DIR/Backend/venv"
sudo -u "$APP_USER" "$APP_DIR/Backend/venv/bin/pip" install --upgrade pip
sudo -u "$APP_USER" "$APP_DIR/Backend/venv/bin/pip" install -r "$APP_DIR/Backend/requirements.txt"

echo "==> Installing frontend deps..."
sudo -u "$APP_USER" bash -c "cd $APP_DIR/frontend && npm ci"

echo "==> Deploy configs (update paths in these if APP_DIR differs)..."
NGINX_CONF="/etc/nginx/sites-available/scm"
SYSD_BACKEND="/etc/systemd/system/scm-backend.service"
SYSD_FRONTEND="/etc/systemd/system/scm-frontend.service"

sed "s|/home/ubuntu/Service_center_management|$APP_DIR|g" "$APP_DIR/deploy/nginx/scm.conf" > "$NGINX_CONF"
sed -e "s|/home/ubuntu/Service_center_management|$APP_DIR|g" \
    -e "s|User=ubuntu|User=$APP_USER|g" \
    -e "s|Group=ubuntu|Group=$APP_USER|g" \
    "$APP_DIR/deploy/systemd/scm-backend.service" > "$SYSD_BACKEND"
sed -e "s|/home/ubuntu/Service_center_management|$APP_DIR|g" \
    -e "s|User=ubuntu|User=$APP_USER|g" \
    -e "s|Group=ubuntu|Group=$APP_USER|g" \
    "$APP_DIR/deploy/systemd/scm-frontend.service" > "$SYSD_FRONTEND"

ln -sf "$NGINX_CONF" /etc/nginx/sites-enabled/scm
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

systemctl daemon-reload
# Don't enable/start app services until .env and migrations are done (see deploy.sh / docs)

echo "==> EC2 setup complete."
echo "    Next: 1) cp deploy/env.backend.production.example Backend/.env"
echo "          2) Edit Backend/.env: DATABASE_URL, SECRET_KEY, ENCRYPTION_KEY, ALLOWED_HOSTS, CORS_ALLOWED_ORIGINS"
echo "          3) cp frontend/.env.production.example frontend/.env.production (ensure NEXT_PUBLIC_API_URL=/api)"
echo "          4) Run ./deploy/scripts/deploy.sh as $APP_USER, then createsuperuser."
