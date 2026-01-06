# Service Center Management System - Backend Implementation

## Architecture Overview

This Django REST Framework backend implements a multi-tenant service center management system for Indian computer & laptop service centers with:

- **Branch-level data isolation** - Each branch operates independently with its own data
- **Role-Based Access Control (RBAC)** - Five roles with distinct permissions
- **GST Compliance** - Full support for Indian GST (CGST+SGST and IGST)
- **Audit Trail** - Immutable logs for all critical operations
- **Encrypted Sensitive Data** - Device passwords encrypted at rest

---

## FRD Compliance Checklist

### 1. Domain Models ✅

| Model                   | Status | Notes                                                        |
| ----------------------- | ------ | ------------------------------------------------------------ |
| Organization            | ✅     | Multi-tenant root entity                                     |
| Branch (Service Center) | ✅     | Branch-level isolation, GSTIN, invoice series                |
| User                    | ✅     | Custom user model with RBAC                                  |
| Role                    | ✅     | Owner, Manager, Receptionist, Technician, Accountant         |
| Customer                | ✅     | Per-branch customers, same mobile allowed across branches    |
| JobCard                 | ✅     | Complete lifecycle, accessories, photos, encrypted passwords |
| JobStatusHistory        | ✅     | Immutable audit trail for status changes                     |
| InventoryItem           | ✅     | Per-branch stock, auto-deduct, low-stock alerts              |
| JobPartUsage            | ✅     | Links jobs to inventory with pricing snapshot                |
| Invoice                 | ✅     | GST-compliant, branch-scoped numbering                       |
| InvoiceLineItem         | ✅     | Services and parts with GST breakdown                        |
| Payment                 | ✅     | Partial/full, multiple methods                               |
| NotificationLog         | ✅     | SMS/WhatsApp logging with status                             |
| DevicePasswordAccessLog | ✅     | Security audit for password access                           |
| AuditLog                | ✅     | Generic immutable audit log                                  |

### 2. API Design ✅

| API Endpoint          | Status | Notes                                            |
| --------------------- | ------ | ------------------------------------------------ |
| Organization CRUD     | ✅     | `/api/core/organizations/`                       |
| Branch CRUD           | ✅     | `/api/core/branches/`                            |
| User Management       | ✅     | `/api/core/users/`                               |
| Branch Assignment     | ✅     | `/api/core/branches/{id}/assign_user/`           |
| Customer CRUD         | ✅     | `/api/customers/customers/`                      |
| Customer Search       | ✅     | `/api/customers/customers/search_by_mobile/`     |
| Service History       | ✅     | `/api/customers/customers/{id}/service_history/` |
| Job Card CRUD         | ✅     | `/api/jobs/jobs/`                                |
| Status Transitions    | ✅     | `/api/jobs/jobs/{id}/update_status/`             |
| Technician Assignment | ✅     | `/api/jobs/jobs/{id}/assign_technician/`         |
| Diagnosis Entry       | ✅     | `/api/jobs/jobs/{id}/add_diagnosis/`             |
| Part Requests         | ✅     | `/api/jobs/jobs/{id}/request_part/`              |
| Inventory CRUD        | ✅     | `/api/inventory/items/`                          |
| Stock Management      | ✅     | `add_stock/`, `deduct_stock/`, `adjust_stock/`   |
| Low Stock Alerts      | ✅     | `/api/inventory/items/low_stock/`                |
| Invoice Generation    | ✅     | `/api/billing/invoices/`                         |
| Payment Recording     | ✅     | `/api/billing/invoices/{id}/record_payment/`     |
| PDF Generation        | ✅     | `/api/billing/invoices/{id}/download_pdf/`       |
| Notifications         | ✅     | Auto-triggered + manual send                     |
| Reports               | ✅     | Revenue, jobs, productivity, inventory, GST      |
| Excel Export          | ✅     | `/api/reports/export_excel/`                     |

### 3. Permissions & Security ✅

| Requirement                | Status | Implementation                                |
| -------------------------- | ------ | --------------------------------------------- |
| Strict RBAC                | ✅     | Custom permission classes per operation       |
| Branch-scoped filtering    | ✅     | `BranchScopedMixin` on all ViewSets           |
| Encrypted device passwords | ✅     | Fernet encryption in JobCard model            |
| Password access logging    | ✅     | DevicePasswordAccessLog model                 |
| Immutable billing logs     | ✅     | AuditLog for invoice/payment operations       |
| Immutable inventory logs   | ✅     | InventoryAdjustment is immutable              |
| Immutable status changes   | ✅     | JobStatusHistory is immutable                 |
| No cross-branch data leaks | ✅     | All querysets filtered by accessible branches |

### 4. Business Rules ✅

| Rule                              | Status | Implementation                     |
| --------------------------------- | ------ | ---------------------------------- |
| Sequential job status transitions | ✅     | `ALLOWED_STATUS_TRANSITIONS` dict  |
| Delivered jobs are read-only      | ✅     | `is_terminal_status()` check       |
| Invoice numbers never reused      | ✅     | Unique constraint + atomic counter |
| Inventory cannot go negative      | ✅     | `InsufficientInventory` exception  |
| OTP/signature for delivery        | ✅     | `JobDeliverySerializer` validation |
| GST calculation deterministic     | ✅     | `calculate_gst()` utility function |
| Status override requires Manager+ | ✅     | `CanOverrideStatus` permission     |

### 5. Non-Functional Requirements ✅

| Requirement          | Status | Implementation                         |
| -------------------- | ------ | -------------------------------------- |
| Idempotent APIs      | ✅     | Unique constraints, atomic operations  |
| Transactional safety | ✅     | `@transaction.atomic` on all mutations |
| Database indexing    | ✅     | Strategic indexes on all models        |
| Clear error messages | ✅     | Custom exception handler               |
| SaaS-ready           | ✅     | Organization → Branch multi-tenancy    |

---

## API Endpoints Reference

### Authentication

```
POST /api/auth/token/           # Obtain JWT token
POST /api/auth/token/refresh/   # Refresh JWT token
POST /api/auth/token/verify/    # Verify JWT token
```

### Core

```
GET/POST   /api/core/organizations/
GET/PUT    /api/core/organizations/{id}/
GET/POST   /api/core/branches/
GET/PUT    /api/core/branches/{id}/
POST       /api/core/branches/{id}/assign_user/
GET/POST   /api/core/users/
GET/PUT    /api/core/users/{id}/
GET        /api/core/users/me/
POST       /api/core/users/change_password/
GET        /api/core/users/my_branches/
POST       /api/core/users/set_current_branch/
```

### Customers

```
GET/POST   /api/customers/customers/
GET/PUT    /api/customers/customers/{id}/
GET        /api/customers/customers/search_by_mobile/?mobile=
GET        /api/customers/customers/{id}/service_history/
GET        /api/customers/customers/{id}/pending_jobs/
GET        /api/customers/customers/{id}/invoices/
```

### Jobs

```
GET/POST   /api/jobs/jobs/
GET/PUT    /api/jobs/jobs/{id}/
POST       /api/jobs/jobs/{id}/update_status/
POST       /api/jobs/jobs/{id}/assign_technician/
POST       /api/jobs/jobs/{id}/add_diagnosis/
POST       /api/jobs/jobs/{id}/share_estimate/
POST       /api/jobs/jobs/{id}/record_customer_response/
POST       /api/jobs/jobs/{id}/mark_ready/
POST       /api/jobs/jobs/{id}/deliver/
POST       /api/jobs/jobs/{id}/access_device_password/
POST       /api/jobs/jobs/{id}/request_part/
GET        /api/jobs/jobs/{id}/timeline/
GET        /api/jobs/jobs/pending/
GET        /api/jobs/jobs/my_jobs/
```

### Inventory

```
GET/POST   /api/inventory/items/
GET/PUT    /api/inventory/items/{id}/
POST       /api/inventory/items/{id}/add_stock/
POST       /api/inventory/items/{id}/deduct_stock/
POST       /api/inventory/items/{id}/adjust_stock/
GET        /api/inventory/items/{id}/adjustments/
GET        /api/inventory/items/low_stock/
GET        /api/inventory/items/stats/
```

### Billing

```
GET/POST   /api/billing/invoices/
GET/PUT    /api/billing/invoices/{id}/
POST       /api/billing/invoices/{id}/finalize/
POST       /api/billing/invoices/{id}/add_line_item/
POST       /api/billing/invoices/{id}/record_payment/
GET        /api/billing/invoices/{id}/download_pdf/
GET        /api/billing/invoices/stats/
GET        /api/billing/invoices/pending/
```

### Notifications

```
GET/POST   /api/notifications/templates/
GET        /api/notifications/logs/
GET        /api/notifications/alerts/
POST       /api/notifications/send/send/
```

### Reports

```
GET        /api/reports/revenue/
GET        /api/reports/pending_jobs/
GET        /api/reports/technician_productivity/
GET        /api/reports/inventory_consumption/
GET        /api/reports/low_stock/
GET        /api/reports/customer_analysis/
GET        /api/reports/gst_summary/
GET        /api/reports/export_excel/?report=revenue
```

### Audit

```
GET        /api/audit/logs/
GET        /api/audit/password-access/
GET        /api/audit/logins/
GET        /api/audit/exports/
```

---

## Role Permissions Matrix

| Action                  | Owner | Manager | Receptionist | Technician | Accountant |
| ----------------------- | ----- | ------- | ------------ | ---------- | ---------- |
| All branches access     | ✅    | ❌      | ❌           | ❌         | ❌         |
| Manage users            | ✅    | ❌      | ❌           | ❌         | ❌         |
| Create branches         | ✅    | ❌      | ❌           | ❌         | ❌         |
| Create jobs             | ✅    | ✅      | ✅           | ❌         | ❌         |
| Assign technicians      | ✅    | ✅      | ❌           | ❌         | ❌         |
| Add diagnosis           | ✅    | ✅      | ❌           | ✅         | ❌         |
| Access device passwords | ✅    | ✅      | ❌           | ✅         | ❌         |
| Override status         | ✅    | ✅      | ❌           | ❌         | ❌         |
| Manage inventory        | ✅    | ✅      | ❌           | ❌         | ✅         |
| Manual stock adjust     | ✅    | ✅      | ❌           | ❌         | ❌         |
| Create invoices         | ✅    | ✅      | ❌           | ❌         | ✅         |
| Record payments         | ✅    | ✅      | ❌           | ❌         | ✅         |
| View reports            | ✅    | ✅      | ❌           | ❌         | ✅         |
| View audit logs         | ✅    | ❌      | ❌           | ❌         | ❌         |

---

## Database Migrations

Run migrations in order:

```bash
python manage.py makemigrations core
python manage.py makemigrations customers
python manage.py makemigrations jobs
python manage.py makemigrations inventory
python manage.py makemigrations billing
python manage.py makemigrations notifications
python manage.py makemigrations audit
python manage.py makemigrations reports
python manage.py migrate
```

Create superuser:

```bash
python manage.py createsuperuser
```

---

## Testing

Run tests:

```bash
pytest
```

With coverage:

```bash
pytest --cov=. --cov-report=html
```

---

## Production Deployment Notes

1. **Set secure SECRET_KEY** - Generate a new key for production
2. **Set ENCRYPTION_KEY** - Required for device password encryption
3. **Configure database** - Use production PostgreSQL instance
4. **Configure SMS/WhatsApp** - Add API keys for notifications
5. **Set DEBUG=False** - Disable debug mode
6. **Configure ALLOWED_HOSTS** - Add production domain
7. **Set up HTTPS** - Required for production
8. **Configure static files** - Run `collectstatic`
9. **Set up logging** - Configure production logging
10. **Database backups** - Set up regular backups
