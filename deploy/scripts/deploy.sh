#!/bin/bash
# Deploy or update Service Center Management on EC2
# Run from project root: ./deploy/scripts/deploy.sh
# Uses APP_USER/APP_DIR if set; otherwise APP_DIR = directory containing deploy/

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_USER="${APP_USER:-ubuntu}"
APP_DIR="${APP_DIR:-$(cd "$SCRIPT_DIR/../.." && pwd)}"

# If running as root, execute as APP_USER
if [ "$(id -u)" -eq 0 ]; then
    echo "==> Running deploy as $APP_USER..."
    exec sudo -u "$APP_USER" env APP_USER="$APP_USER" APP_DIR="$APP_DIR" "$0" "$@"
fi

cd "$APP_DIR"

echo "==> Pulling latest code..."
git pull

echo "==> Backend: venv, deps, migrate, collectstatic..."
cd "$APP_DIR/Backend"
"$APP_DIR/Backend/venv/bin/pip" install -r requirements.txt --quiet
"$APP_DIR/Backend/venv/bin/python" manage.py migrate --noinput
"$APP_DIR/Backend/venv/bin/python" manage.py collectstatic --noinput

echo "==> Frontend: install, build..."
cd "$APP_DIR/frontend"
npm ci
# Build with production API URL (relative /api when served behind same Nginx)
if [ -f .env.production ]; then
  set -a && . ./.env.production && set +a
fi
export NEXT_PUBLIC_API_URL="${NEXT_PUBLIC_API_URL:-/api}"
npm run build

echo "==> Restarting services..."
sudo systemctl restart scm-backend scm-frontend || true

echo "==> Deploy complete."
