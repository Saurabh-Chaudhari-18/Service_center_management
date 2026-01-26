# Deploying Service Center Management

This guide covers **local deployment** (Docker Compose) for testing and **AWS EC2** deployment (bare metal or Docker).

---

## Deploy locally for testing (Docker Compose)

Run the full stack (PostgreSQL, Django, Next.js, Nginx) on your machine with Docker to test a production-like setup.

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/) and [Docker Compose](https://docs.docker.com/compose/install/) installed.

### Steps

1. **Clone the repo** (if needed) and go to the project root:

   ```bash
   cd Service_center_management
   ```

2. **Create backend env** from the Docker example:

   ```bash
   cp deploy/env.docker.example .env
   ```

3. **Edit `.env`** and set at least:

   - `SECRET_KEY` – e.g. `python -c "import secrets; print(secrets.token_urlsafe(50))"`
   - `ENCRYPTION_KEY` – `python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"`

   Leave `DATABASE_URL` as-is (Compose overrides it to use the `postgres` service).

4. **Build and start**:

   ```bash
   docker compose up --build -d
   ```

5. **Create a superuser**:

   ```bash
   docker compose exec backend python manage.py createsuperuser
   ```

6. **Optional – seed data**:

   ```bash
   docker compose exec backend python manage.py setup_initial_data
   ```

### Verify

- **App**: [http://localhost](http://localhost)
- **Health**: [http://localhost/health](http://localhost/health) → `ok`
- **API docs**: [http://localhost/api/docs/](http://localhost/api/docs/)
- **Django admin**: [http://localhost/admin/](http://localhost/admin/)

### Useful commands

| Task | Command |
|------|---------|
| View logs | `docker compose logs -f` |
| Stop | `docker compose down` |
| Rebuild after code changes | `docker compose up --build -d` |
| Django shell | `docker compose exec backend python manage.py shell` |

---

## Deploy on AWS EC2 (bare metal)

Deploy on an **Ubuntu 22.04** EC2 instance with **Nginx**, **Gunicorn**, and **PostgreSQL** installed directly on the host.

---

## Architecture

- **Nginx**: Listens on 80 (and 443 with SSL). Proxies `/api/` and `/admin/` to Gunicorn; `/static/`, `/media/` from Django; everything else to Next.js.
- **Gunicorn**: Django app on `127.0.0.1:8001`.
- **Next.js**: Production server on `127.0.0.1:3000`.
- **PostgreSQL**: Local on EC2 (or use **Amazon RDS** for production).

---

## Prerequisites

- **AWS account** and **EC2** access.
- **Ubuntu 22.04** AMI.
- **Security group**: allow **22** (SSH), **80** (HTTP), **443** (HTTPS).
- **Key pair** for SSH.
- Code in a **Git** repo (GitHub, GitLab, etc.) that EC2 can clone.

---

## 1. Launch EC2 Instance

1. In **EC2** → **Launch instance**:
   - **Name**: `scm-production` (or any).
   - **AMI**: Ubuntu Server 22.04 LTS.
   - **Instance type**: e.g. `t3.small` (or larger).
   - **Key pair**: Create or select one.
   - **Network**: Default VPC or your choice.
   - **Storage**: 20–30 GB.

2. **Security group** (create or edit):
   - **Inbound**:
     - SSH, port 22, your IP.
     - HTTP, port 80, `0.0.0.0/0` (or your LB).
     - HTTPS, port 443, `0.0.0.0/0` (optional; enable after SSL).

3. Launch, then **Connect** via SSH (browser or `ssh -i your-key.pem ubuntu@<public-ip>`).

---

## 2. Initial Server Setup (ec2-setup.sh)

On the EC2 instance:

```bash
# Clone the repo first (if not using REPO_URL below)
sudo apt-get update -y && sudo apt-get install -y git
sudo -u ubuntu git clone https://github.com/YOUR_ORG/Service_center_management.git /home/ubuntu/Service_center_management
```

If using a **private repo**, set `REPO_URL` (e.g. `https://USER:TOKEN@github.com/org/repo.git`) and optionally `APP_DIR`:

```bash
export REPO_URL="https://YOUR_USER:YOUR_TOKEN@github.com/YOUR_ORG/Service_center_management.git"
export APP_DIR="/home/ubuntu/Service_center_management"
```

Run the setup script **as root**:

```bash
cd /home/ubuntu/Service_center_management
sudo bash deploy/scripts/ec2-setup.sh
```

This installs **Python 3.11**, **Node 20**, **PostgreSQL**, **Nginx**, creates the `service_center_db` database and `scm_app` user, sets up venv, installs backend and frontend deps, and installs Nginx + systemd configs.  
**Important**: The setup script uses a placeholder DB password (`CHANGE_ME_in_production`). Before going live, either change the PostgreSQL password for `scm_app` and set `DATABASE_URL` accordingly, or use RDS (see below).

---

## 3. Configure Backend Environment

```bash
cd /home/ubuntu/Service_center_management
cp deploy/env.backend.production.example Backend/.env
nano Backend/.env   # or vim
```

Set at least:

| Variable | Description |
|----------|-------------|
| `DEBUG` | `False` |
| `SECRET_KEY` | Strong random key (e.g. `python -c "import secrets; print(secrets.token_urlsafe(50))"`) |
| `DATABASE_URL` | `postgres://scm_app:YOUR_DB_PASSWORD@localhost:5432/service_center_db` (use the password you set for `scm_app` in PostgreSQL; the setup script uses `CHANGE_ME_in_production` by default) |
| `ALLOWED_HOSTS` | `localhost,127.0.0.1,YOUR_EC2_PUBLIC_IP` (and domain if you use one) |
| `CORS_ALLOWED_ORIGINS` | `http://YOUR_EC2_PUBLIC_IP` or `https://yourdomain.com` |
| `ENCRYPTION_KEY` | From `python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"` |

If you changed the DB password in PostgreSQL, use that same value in `DATABASE_URL`.

---

## 4. Configure Frontend Build (API URL)

The frontend talks to the API at `/api` when served behind the same Nginx. Create:

```bash
cp frontend/.env.production.example frontend/.env.production
```

Ensure `frontend/.env.production` contains:

```env
NEXT_PUBLIC_API_URL=/api
```

This is used at **build time** (`npm run build`). If you serve frontend from another domain, set `NEXT_PUBLIC_API_URL` to the full API base URL instead.

---

## 5. First Deploy and Migrations

Run the deploy script (as `ubuntu` or as root; it will re-run as `ubuntu`):

```bash
cd /home/ubuntu/Service_center_management
./deploy/scripts/deploy.sh
```

This will:

- `git pull`
- Backend: `pip install -r requirements.txt`, `migrate`, `collectstatic`
- Frontend: `npm ci`, `npm run build` (using `NEXT_PUBLIC_API_URL` from `.env.production`)
- Restart `scm-backend` and `scm-frontend` systemd units

Create a superuser:

```bash
cd /home/ubuntu/Service_center_management/Backend
./venv/bin/python manage.py createsuperuser
```

Optional: run seed data if you have a management command:

```bash
./venv/bin/python manage.py setup_initial_data
```

---

## 6. Enable and Start Services

If you haven’t already:

```bash
sudo systemctl enable scm-backend scm-frontend
sudo systemctl start scm-backend scm-frontend
sudo systemctl status scm-backend scm-frontend
```

Check Nginx:

```bash
sudo nginx -t && sudo systemctl reload nginx
```

---

## 7. Verify Deployment

- **Frontend**: `http://YOUR_EC2_PUBLIC_IP/`
- **API health**: `http://YOUR_EC2_PUBLIC_IP/health` → `ok`
- **API docs**: `http://YOUR_EC2_PUBLIC_IP/api/docs/`
- **Django admin**: `http://YOUR_EC2_PUBLIC_IP/admin/` (use `createsuperuser` credentials)

Log in via the app and confirm jobs, billing, etc. work.

---

## 8. HTTPS with Let’s Encrypt (Optional)

1. Point a **domain** (e.g. `app.yourdomain.com`) to the EC2 public IP (A record).

2. Install **Certbot**:

   ```bash
   sudo apt-get install -y certbot python3-certbot-nginx
   sudo certbot --nginx -d app.yourdomain.com
   ```

3. Update **Backend** `.env`:
   - `ALLOWED_HOSTS`: add `app.yourdomain.com`
   - `CORS_ALLOWED_ORIGINS`: add `https://app.yourdomain.com`

4. Update **Nginx** `server_name` in `deploy/nginx/scm.conf` to `app.yourdomain.com`, then:

   ```bash
   sudo cp deploy/nginx/scm.conf /etc/nginx/sites-available/scm
   sudo nginx -t && sudo systemctl reload nginx
   ```

5. Re-run **deploy** so frontend is built with the correct API URL if you change it, then restart services.

6. Certbot will add HTTPS and typically set up auto-renewal.

---

## 9. Updating the App

After pushing changes:

```bash
cd /home/ubuntu/Service_center_management
./deploy/scripts/deploy.sh
```

This pulls, installs deps, runs migrations, builds frontend, and restarts backend and frontend.

**Note**: The deploy script runs `sudo systemctl restart scm-backend scm-frontend`. Allow passwordless sudo for the deploy user, e.g.:

```bash
echo 'ubuntu ALL=(ALL) NOPASSWD: /bin/systemctl restart scm-backend, /bin/systemctl restart scm-frontend' | sudo tee /etc/sudoers.d/scm-deploy
sudo chmod 440 /etc/sudoers.d/scm-deploy
```

---

## 10. Useful Commands

| Task | Command |
|------|---------|
| Backend logs | `sudo journalctl -u scm-backend -f` |
| Frontend logs | `sudo journalctl -u scm-frontend -f` |
| Nginx logs | `sudo tail -f /var/log/nginx/access.log` / `error.log` |
| Restart backend | `sudo systemctl restart scm-backend` |
| Restart frontend | `sudo systemctl restart scm-frontend` |
| Django shell | `cd Backend && ../Backend/venv/bin/python manage.py shell` |

---

## 11. Using Amazon RDS Instead of Local PostgreSQL

1. Create an **RDS** PostgreSQL instance (same VPC as EC2, or ensure connectivity).
2. Note **endpoint**, **port**, **database name**, **user**, **password**.
3. Set `DATABASE_URL` in `Backend/.env`:

   ```env
   DATABASE_URL=postgres://USER:PASSWORD@RDS_ENDPOINT:5432/DATABASE_NAME
   ```

4. Ensure EC2 security group can reach RDS on port 5432.
5. Re-run migrations:

   ```bash
   cd /home/ubuntu/Service_center_management/Backend
   venv/bin/python manage.py migrate
   ```

---

## 12. File Layout Reference

```
Service_center_management/
├── docker-compose.yml               # Docker Compose (local + optional EC2)
├── .env                             # From deploy/env.docker.example (Docker)
├── Backend/
│   ├── Dockerfile
│   └── .dockerignore
├── frontend/
│   ├── Dockerfile
│   └── .dockerignore
└── deploy/
    ├── env.backend.production.example   # → Backend/.env (EC2 bare metal)
    ├── env.docker.example               # → .env (Docker Compose)
    ├── nginx/
    │   ├── scm.conf                     # EC2: /etc/nginx/sites-available/scm
    │   └── scm-docker.conf              # Docker: mounted into nginx container
    ├── systemd/
    │   ├── scm-backend.service
    │   └── scm-frontend.service
    └── scripts/
        ├── ec2-setup.sh
        └── deploy.sh
```

---

## Troubleshooting

**Docker Compose (local):**

- **Backend exits or won’t start**: Ensure `SECRET_KEY` and `ENCRYPTION_KEY` are set in `.env`. Generate `ENCRYPTION_KEY` with `python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"`.
- **Frontend build fails**: Confirm `NEXT_PUBLIC_API_URL` is `/api` (default in `docker-compose.yml` build args).
- **Database connection refused**: Wait for Postgres to be healthy (`depends_on` + `healthcheck`). Use `docker compose logs postgres` to verify.

**EC2 (bare metal):**

- **502 Bad Gateway**: Backend or frontend not running. Check `systemctl status scm-backend` / `scm-frontend` and `journalctl -u scm-backend -n 50`.
- **Static/admin 404**: Run `collectstatic` and ensure Nginx `alias` paths in `scm.conf` point to `Backend/staticfiles` and `Backend/media`.
- **CORS errors**: Confirm `CORS_ALLOWED_ORIGINS` in `Backend/.env` includes the exact URL the browser uses (including scheme and port).
- **DB connection errors**: Check `DATABASE_URL`, RDS/Postgres security groups, and that the DB and user exist.

---

For local development, see the main [README](README.md).
