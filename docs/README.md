# Service Center Management System — Documentation

A multi-tenant, GST-compliant service center ERP for Indian repair businesses. Manages the full lifecycle from device intake to delivery — with job cards, billing, inventory, customer tracking, staff roles, and GST reporting.

---

## Documentation Index

| Document | Audience | Contents |
|----------|----------|----------|
| [Architecture](architecture.md) | Developers, Tech Leads | System design, tech stack, design decisions |
| [API Reference](api-reference.md) | Developers, QA, Integration teams | Every endpoint, request/response shapes |
| [Data Models](data-models.md) | Developers, DBAs | Every table, field, constraint, index |
| [RBAC & Permissions](rbac.md) | Developers, Admins | Role matrix, permission gates, access rules |
| [User Guide](user-guide.md) | End Users, Trainers, Clients | Role-by-role feature walkthrough |
| [Developer Guide](developer-guide.md) | Developers | Setup, conventions, testing, contributing |
| [GST Compliance](gst-compliance.md) | Accountants, Auditors | GST rules implemented, GSTR-1, ITC, retention |
| [Deployment Guide](deployment.md) | DevOps, Admins | Docker, environment variables, production ops |

---

## Quick Overview

### What the system does

```
Customer arrives with device
        │
        ▼
Receptionist creates Job Card ──► Device password encrypted at rest
        │                          Job number auto-generated (branch-scoped)
        ▼
Technician diagnoses ──────────► Diagnosis notes + estimated cost saved
        │                          Parts requested from inventory
        ▼
Estimate shared with customer ──► SMS/WhatsApp notification sent
        │
    ┌───┴───┐
Approved   Rejected
    │
    ▼
Repair in progress ────────────► Inventory auto-deducted (stock-locked)
        │
        ▼
Ready for delivery ────────────► OTP generated, customer notified
        │
        ▼
Delivered ─────────────────────► Invoice finalized, GST recorded
                                   Job becomes read-only
```

### Technology Stack

| Layer | Technology |
|-------|-----------|
| Backend | Django 6 + Django REST Framework |
| Database | PostgreSQL (via psycopg3) |
| Cache / Queue broker | Redis |
| Async tasks | Celery |
| Frontend | Next.js 14 (App Router), TypeScript |
| Auth | JWT (SimpleJWT — access + refresh tokens) |
| Notifications | TextBee (SMS), WhatsApp Cloud API, SMTP |
| Error tracking | Sentry (backend + frontend) |
| Media storage | Local filesystem (dev) / S3-compatible (prod) |

### Tenant model

```
Organization (1)
    └── Branch (many)
            └── Users, Customers, Jobs, Invoices, Inventory
```

All data is scoped to a Branch. Users can be assigned to one or more branches. Owners and Super Admins see across all branches in their organization.

---

## Quickstart (local development)

```bash
# Clone and enter the repo
git clone <repo>
cd Service_center_management

# Backend
cd Backend
python -m venv .venv && .venv\Scripts\activate   # Windows
pip install -r requirements.txt
cp .env.example .env                              # edit DATABASE_URL, SECRET_KEY
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver                        # http://127.0.0.1:8000

# Frontend (separate terminal)
cd ../frontend
npm install
cp .env.local.example .env.local                 # set NEXT_PUBLIC_API_URL
npm run dev                                       # http://localhost:3000

# Celery worker (separate terminal, for notifications)
cd Backend
celery -A config worker -l info
```

Default superuser role: `SUPER_ADMIN`. After first login, create an Organization, then a Branch, then invite users.
