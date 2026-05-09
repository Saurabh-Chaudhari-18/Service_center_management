# API Reference

**Base URL:** `http://127.0.0.1:8000/api` (dev) · `https://your-domain.com/api` (prod)  
**Auth:** `Authorization: Bearer <access_token>` on all protected routes  
**Branch context:** `X-Branch-ID: <branch_uuid>` (or `?branch=<uuid>` query param)  
**Content-Type:** `application/json` (except file uploads: `multipart/form-data`)

**All error responses follow this envelope:**
```json
{
  "success": false,
  "error": {
    "code": "string",
    "message": "Human-readable message",
    "status_code": 400,
    "field_errors": { "field_name": ["Error message"] }
  }
}
```

**Paginated list responses:**
```json
{
  "count": 142,
  "next": "https://api/.../jobs/?page=3",
  "previous": "https://api/.../jobs/?page=1",
  "results": [...]
}
```

---

## Authentication

### POST /api/auth/token/
Obtain JWT tokens. No auth required.

**Request:**
```json
{ "email": "owner@center.com", "password": "secret" }
```

**Response 200:**
```json
{
  "access": "<JWT — 5 min TTL>",
  "refresh": "<JWT — 7 day TTL>"
}
```

**Response 401:**
```json
{ "detail": "No active account found with the given credentials" }
```

---

### POST /api/auth/token/refresh/
Get a new access token using a valid refresh token.

**Request:**
```json
{ "refresh": "<refresh_token>" }
```

**Response 200:**
```json
{ "access": "<new_access_token>" }
```

---

### POST /api/auth/token/verify/
Verify a token is valid.

**Request:**
```json
{ "token": "<access_or_refresh_token>" }
```

**Response 200:** `{}` (empty body = valid)  
**Response 401:** Token invalid/expired

---

## Core — Users

### GET /api/core/users/me/
Returns the authenticated user's full profile with permissions and branches.

**Response 200:**
```json
{
  "id": "uuid",
  "email": "user@center.com",
  "first_name": "Ravi",
  "last_name": "Sharma",
  "phone": "+919876543210",
  "role": "OWNER",
  "organization": { "id": "uuid", "name": "Tech Fix Pvt Ltd" },
  "current_branch": { "id": "uuid", "name": "Mumbai Main" },
  "accessible_branches": [
    { "id": "uuid", "name": "Mumbai Main", "code": "MUM" }
  ],
  "permissions": {
    "canViewDashboard": true,
    "canViewJobCards": true,
    "canCreateJobCards": true,
    "canEditJobCards": true,
    "canViewInventory": true,
    "canManageInventory": true,
    "canViewBilling": true,
    "canCreateInvoices": true,
    "canViewReports": true,
    "canManageBranches": true,
    "canManageUsers": true,
    "canViewPickups": true
  }
}
```

---

### GET /api/core/users/my_branches/
Returns all branches the authenticated user can access.

**Response 200:** Array of Branch objects.

---

### POST /api/core/users/set_current_branch/
Set the user's active branch context (stored in session).

**Request:** `{ "branch_id": "uuid" }`  
**Response 200:** `{ "message": "Branch context updated." }`

---

### POST /api/core/users/change_password/
**Request:**
```json
{ "old_password": "current", "new_password": "new-secure-password" }
```
**Response 200:** `{ "message": "Password changed successfully." }`

---

### GET /api/core/users/
List all users in the organization. Requires `canManageUsers`.

**Query params:** `role`, `branch`, `page`, `search`

**Response 200:** Paginated list of user objects.

---

### POST /api/core/users/
Create a new staff user. Requires `canManageUsers`.

**Request:**
```json
{
  "email": "tech@center.com",
  "first_name": "Anil",
  "last_name": "Kumar",
  "phone": "+919000000001",
  "role": "TECHNICIAN",
  "password": "secure-password",
  "branch": "uuid"
}
```

---

### PATCH /api/core/users/{id}/
Update user. Requires `canManageUsers`.

---

### POST /api/core/users/{id}/assign_branches/
Assign a user to multiple branches.

**Request:** `{ "branch_ids": ["uuid1", "uuid2"] }`  
**Response 200:** `{ "message": "Branches assigned.", "branch_count": 2 }`

---

### POST /api/core/users/update_location/
Update technician's current GPS coordinates (for live tracking).

**Request:** `{ "latitude": 19.0760, "longitude": 72.8777 }`  
**Response 200:** `{ "message": "Location updated." }`

---

### GET /api/core/roles/
Returns all available role choices.

**Response 200:**
```json
[
  { "value": "OWNER", "label": "Owner" },
  { "value": "TECHNICIAN", "label": "Technician" }
]
```

---

## Core — Organizations

### GET /api/core/organizations/
List organizations (SUPER_ADMIN sees all; others see their own).

### GET /api/core/organizations/{id}/
Get organization details.

### PATCH /api/core/organizations/{id}/
Update organization. Requires OWNER or SUPER_ADMIN.

### GET /api/core/organizations/branding/
Returns branding config (logo, colors, name) for the current user's organization. Used by the frontend on login.

---

## Core — Branches

### GET /api/core/branches/
List branches in the current user's organization. Requires `canManageBranches` for write; all authenticated users can read.

### POST /api/core/branches/
Create a branch. Requires `canManageBranches`.

**Request:**
```json
{
  "name": "Delhi Branch",
  "code": "DEL",
  "gstin": "07AABCT1332L1ZV",
  "state_code": "07",
  "address_line1": "123 Ring Road",
  "city": "New Delhi",
  "state": "Delhi",
  "pincode": "110001",
  "invoice_prefix": "INV",
  "jobcard_prefix": "JC"
}
```

### POST /api/core/branches/{id}/assign_user/
Assign a user to a branch.

**Request:** `{ "user_id": "uuid" }`

---

## Jobs — Job Cards

### GET /api/jobs/jobs/
List job cards. Automatically scoped to current branch.

**Query params:**
| Param | Type | Description |
|-------|------|-------------|
| `branch` | uuid | Filter by specific branch |
| `status` | string | Filter by status (e.g. `DIAGNOSIS`) |
| `customer` | uuid | Filter by customer |
| `technician` | uuid | Filter by assigned technician |
| `search` | string | Search job number, customer name, device |
| `is_urgent` | bool | Filter urgent jobs |
| `page` | int | Page number (default 1) |
| `page_size` | int | Results per page (default 25, max 100) |

**Response 200 (item shape):**
```json
{
  "id": "uuid",
  "job_number": "JC/2425/MUM/00089",
  "branch": "uuid",
  "branch_name": "Mumbai Main",
  "customer": { "id": "uuid", "name": "Suresh Patel", "mobile": "+919876543210" },
  "device_type": "LAPTOP",
  "brand": "Dell",
  "model": "Inspiron 15",
  "status": "DIAGNOSIS",
  "is_urgent": false,
  "assigned_technician": { "id": "uuid", "name": "Anil Kumar" },
  "estimated_completion_date": "2025-05-15",
  "created_at": "2025-05-09T10:30:00Z"
}
```

---

### POST /api/jobs/jobs/
Create a new job card. Requires `canCreateJobCards`.

**Request:**
```json
{
  "customer_id": "uuid",
  "device_type": "LAPTOP",
  "brand": "HP",
  "model": "Pavilion 14",
  "serial_number": "CND1234567",
  "customer_complaint": "Screen flickering and battery draining fast",
  "physical_condition": {
    "selected": ["uuid-scratches", "uuid-dents"],
    "other_text": "Small crack near charging port"
  },
  "device_password": "MyPass@123",
  "is_urgent": false,
  "accessories": [
    { "accessory_type": "CHARGER", "is_present": true, "condition": "Good" },
    { "accessory_type": "BAG", "is_present": false }
  ]
}
```

**Response 201:** Full JobCard object

---

### GET /api/jobs/jobs/{id}/
Get full job card detail including accessories, photos, notes, status history, diagnosis parts.

**Response 200 (full shape):**
```json
{
  "id": "uuid",
  "job_number": "JC/2425/MUM/00089",
  "status": "DIAGNOSIS",
  "allowed_transitions": ["ESTIMATE_SHARED", "CANCELLED"],
  "is_readonly": false,
  "customer": { ... },
  "device_type": "LAPTOP",
  "brand": "Dell",
  "model": "Inspiron 15",
  "serial_number": "",
  "customer_complaint": "Screen not working",
  "physical_condition": { "selected": [...], "other_text": "" },
  "engineer_diagnosis": null,
  "diagnosis_notes": "",
  "estimated_cost": null,
  "estimated_completion_date": null,
  "is_urgent": false,
  "assigned_technician": { "id": "uuid", "name": "Anil Kumar" },
  "received_by": { "id": "uuid", "name": "Priya Singh" },
  "accessories": [ { "accessory_type": "CHARGER", "is_present": true } ],
  "photos": [],
  "notes_list": [],
  "status_history": [
    {
      "from_status": null,
      "to_status": "RECEIVED",
      "changed_by": { "name": "Priya Singh" },
      "notes": "Device received",
      "created_at": "2025-05-09T10:30:00Z"
    }
  ],
  "diagnosis_parts": [],
  "created_at": "2025-05-09T10:30:00Z",
  "updated_at": "2025-05-09T11:00:00Z"
}
```

---

### PATCH /api/jobs/jobs/{id}/
Update job card fields. Requires `canEditJobCards`.

---

### DELETE /api/jobs/jobs/{id}/
Delete a job card. Returns 409 if job has linked parts usage or invoices.

---

### POST /api/jobs/jobs/{id}/update_status/
Transition the job to a new status.

**Request:**
```json
{
  "new_status": "DIAGNOSIS",
  "notes": "Started inspection",
  "is_override": false
}
```
`is_override=true` allows skipping the transition map (Owner/Manager only).

**Response 200:**
```json
{
  "message": "Status updated to Under Diagnosis.",
  "status": "DIAGNOSIS",
  "status_display": "Under Diagnosis"
}
```

**Errors:**
- 400 `invalid_status_transition` — Invalid transition
- 400 `job_readonly` — Job is in terminal status
- 403 — `is_override=true` without Owner/Manager role

---

### POST /api/jobs/jobs/{id}/assign_technician/
Assign a technician to the job.

**Request:**
```json
{
  "technician_id": "uuid",
  "notes": "Experienced with Dell laptops",
  "estimated_completion_date": "2025-05-12"
}
```

**Response 200:**
```json
{
  "message": "Technician Anil Kumar assigned to job.",
  "technician": { "id": "uuid", "name": "Anil Kumar" }
}
```

---

### POST /api/jobs/jobs/{id}/add_diagnosis/
Add or update diagnosis notes and parts.

**Request:**
```json
{
  "diagnosis_notes": "LCD panel damaged, motherboard intact.",
  "estimated_cost": 4500.00,
  "estimated_completion_date": "2025-05-14",
  "parts": [
    { "name": "LCD Panel 14 inch", "price": 3500.00, "quantity": 1, "warranty_months": 3 }
  ]
}
```

**Response 200:**
```json
{
  "message": "Diagnosis updated successfully.",
  "status": "DIAGNOSIS",
  "status_display": "Under Diagnosis",
  "diagnosis_parts_count": 1
}
```

If job was in `RECEIVED` status, it auto-transitions to `DIAGNOSIS`.

---

### POST /api/jobs/jobs/{id}/share_estimate/
Move job to `ESTIMATE_SHARED` status and send customer notification.

**Response 200:** Status update confirmation + notification sent

---

### POST /api/jobs/jobs/{id}/record_customer_response/
Record customer's approval or rejection of the estimate.

**Request:**
```json
{
  "approved": true,
  "rejection_reason": ""
}
```

**Response 200:** Status transitions to `APPROVED` or `REJECTED`

---

### POST /api/jobs/jobs/{id}/mark_ready/
Mark job as ready for delivery.

**Request:** `{ "completion_notes": "All issues fixed and tested." }`

---

### POST /api/jobs/jobs/{id}/deliver/
Mark job as delivered. Requires OTP or digital signature.

**Request (OTP-based):**
```json
{ "otp": "483921", "notes": "Customer collected the device." }
```

**Request (signature-based, multipart):**
```
otp: (omit)
signature: <image file>
notes: Customer collected the device.
```

**Errors:** 400 `delivery_requirement` — Neither OTP nor signature provided

---

### POST /api/jobs/jobs/{id}/resend_delivery_otp/
Regenerate and resend the delivery OTP to the customer.

---

### POST /api/jobs/jobs/{id}/access_device_password/
Retrieve the decrypted device password. Requires TECHNICIAN role or above. Access is logged.

**Request:** `{ "reason": "Checking boot-time password for BIOS update" }`

**Response 200:** `{ "password": "MyPass@123" }`

---

### POST /api/jobs/jobs/{id}/add_note/
Add an internal or customer-visible note.

**Request:** `{ "note": "Customer called asking for update.", "is_internal": true }`

---

### POST /api/jobs/jobs/{id}/upload_photo/
Upload a photo (intake, damage, repair, or completed). Multipart form.

**Form fields:** `photo` (file), `photo_type` (INTAKE|DAMAGE|REPAIR|COMPLETED), `description` (optional)

---

### POST /api/jobs/jobs/{id}/request_part/
Request a part from inventory.

**Request:** `{ "part_name": "Screen hinge", "quantity": 1, "notes": "" }`

---

### GET /api/jobs/jobs/{id}/timeline/
Get chronological event timeline for the job.

**Response 200:**
```json
[
  {
    "timestamp": "2025-05-09T10:30:00Z",
    "event_type": "status_change",
    "description": "Status changed to Received",
    "user_name": "Priya Singh"
  }
]
```

---

### GET /api/jobs/jobs/pending/
Get all pending jobs for the current branch (non-terminal, ordered by urgency then age).

---

### GET /api/jobs/jobs/my_jobs/
Get jobs assigned to the authenticated technician. Technician role only.

---

### GET /api/jobs/jobs/stats/
Get per-status job counts for the current branch.

**Response 200:**
```json
{
  "total": 47,
  "by_status": {
    "RECEIVED": 5,
    "DIAGNOSIS": 8,
    "REPAIR_IN_PROGRESS": 12,
    "READY_FOR_DELIVERY": 3
  }
}
```

---

### GET /api/jobs/jobs/next_number/
Preview what the next job number will be (doesn't consume it).

**Query:** `?branch=<uuid>`  
**Response 200:** `{ "next_number": "JC/2425/MUM/00090" }`

---

### GET /api/jobs/public/track/{job_number}/
**Public endpoint — no auth required.** Customer-facing job status tracker.

**Response 200:**
```json
{
  "job_number": "JC/2425/MUM/00089",
  "status": "REPAIR_IN_PROGRESS",
  "status_display": "Repair in Progress",
  "device": "Dell Inspiron 15",
  "estimated_completion_date": "2025-05-14",
  "branch_name": "Mumbai Main",
  "branch_phone": "+912212345678"
}
```

---

## Jobs — Pickups

### GET /api/jobs/pickups/
List pickup requests. Filtered by branch.

**Query params:** `status`, `assigned_technician`, `pickup_date`, `page`

### POST /api/jobs/pickups/
Create a pickup request.

**Request:**
```json
{
  "customer_id": "uuid",
  "device_type": "LAPTOP",
  "brand": "Lenovo",
  "model_name": "ThinkPad",
  "customer_complaint": "Not turning on",
  "pickup_address": "Flat 4B, Sunrise Apartments, Andheri West",
  "pickup_date": "2025-05-11",
  "pickup_time_slot": "10:00 AM - 12:00 PM",
  "contact_number": "9876543210",
  "is_urgent": false
}
```

### POST /api/jobs/pickups/{id}/assign_technician/
**Request:** `{ "technician_id": "uuid" }`

### POST /api/jobs/pickups/{id}/update_status/
**Request:** `{ "new_status": "EN_ROUTE", "notes": "Technician left the center." }`

### POST /api/jobs/pickups/{id}/convert_to_job/
Convert a completed pickup into a job card.

**Response 200:**
```json
{
  "message": "Pickup converted to job.",
  "job_id": "uuid",
  "job_number": "JC/2425/MUM/00090",
  "pickup_number": "PU/2425/MUM/00012"
}
```

### GET /api/jobs/pickups/{id}/track/
Get live GPS location of assigned technician.

**Response 200:**
```json
{
  "latitude": 19.0760,
  "longitude": 72.8777,
  "last_updated": "2025-05-09T14:22:00Z"
}
```

### GET /api/jobs/pickups/stats/
**Response 200:**
```json
{
  "total": 24, "requested": 5, "assigned": 3,
  "en_route": 2, "picked_up": 4, "delivered_to_center": 6,
  "completed": 3, "cancelled": 1, "pending": 14
}
```

---

## Jobs — Dropdown Options

### GET /api/jobs/dropdown-options/
Get dropdown options for physical condition and engineer diagnosis.

**Query params:** `category` (PHYSICAL_CONDITION|ENGINEER_DIAGNOSIS), `device_type`, `is_active`

---

## Billing — Invoices

### GET /api/billing/invoices/
List invoices. Requires `canViewBilling`.

**Query params:** `status`, `customer_name`, `invoice_date_after`, `invoice_date_before`, `search`, `page`

**Response 200 (item shape):**
```json
{
  "id": "uuid",
  "invoice_number": "INV/2425/MUM/00142",
  "job_number": "JC/2425/MUM/00089",
  "customer_name": "Suresh Patel",
  "customer_mobile": "9876543210",
  "invoice_date": "2025-05-09",
  "total_amount": "4500.00",
  "paid_amount": "0.00",
  "balance_due": "4500.00",
  "status": "PENDING",
  "is_finalized": false,
  "total_tax": "686.44"
}
```

---

### POST /api/billing/invoices/
Create an invoice. Requires `canCreateInvoices`.

**Request (linked to a job):**
```json
{
  "job_id": "uuid",
  "due_date": "2025-05-16",
  "notes": "Payment due in 7 days.",
  "line_items": [
    {
      "item_type": "SERVICE",
      "description": "LCD Panel Replacement",
      "quantity": 1,
      "unit_price": "3813.56",
      "gst_rate": "18.00",
      "hsn_sac_code": "998719"
    },
    {
      "item_type": "LABOUR",
      "description": "Labour charges",
      "quantity": 1,
      "unit_price": "500.00",
      "gst_rate": "18.00"
    }
  ]
}
```

**Request (standalone, no job):**
```json
{
  "customer_id": "uuid",
  "line_items": [...]
}
```

**Response 201:** Full Invoice object with calculated totals.

---

### GET /api/billing/invoices/{id}/
Get full invoice with line items and payment history.

---

### PATCH /api/billing/invoices/{id}/
Update invoice (draft only — cannot edit finalized invoices).

**Request:**
```json
{
  "due_date": "2025-05-20",
  "notes": "Updated terms.",
  "line_items": [
    { "id": "uuid", "quantity": 2 },
    { "description": "New item", "quantity": 1, "unit_price": "200.00", "gst_rate": "18.00" }
  ]
}
```

---

### POST /api/billing/invoices/{id}/add_line_item/
Add a single line item to an existing (non-finalized) invoice.

---

### POST /api/billing/invoices/{id}/finalize/
Lock the invoice for payment. Triggers customer notification.

**Response 200:**
```json
{
  "message": "Invoice finalized.",
  "invoice_number": "INV/2425/MUM/00142",
  "total_amount": "4500.00"
}
```

---

### POST /api/billing/invoices/{id}/record_payment/
Record a payment against the invoice.

**Request:**
```json
{
  "amount": "4500.00",
  "payment_method": "UPI",
  "reference": "UPI-TXN-2025-0501",
  "notes": "Paid via PhonePe"
}
```

**Response 200:** Updated Invoice with new `paid_amount` and `status`.

**Errors:** 400 — Amount exceeds `balance_due`

---

### POST /api/billing/invoices/{id}/cancel/
Cancel an invoice. Sets status to CANCELLED and creates an edit history entry.

**Request:** `{ "reason": "Customer cancelled the repair." }`

---

### GET /api/billing/invoices/{id}/download_pdf/
Download the invoice as PDF.  
**Response:** `Content-Type: application/pdf` file download.

---

### POST /api/billing/invoices/{id}/log_download/
Log that the invoice PDF was downloaded (for audit trail).

---

### GET /api/billing/invoices/{id}/edit_history/
Get the complete edit history for an invoice.

---

### GET /api/billing/invoices/stats/
Get billing statistics for the current branch.

**Query params:** `from_date`, `to_date`, `branch`

**Response 200:**
```json
{
  "total_invoiced": "145000.00",
  "total_paid": "122000.00",
  "total_pending": "23000.00",
  "invoice_count": 47
}
```

---

### GET /api/billing/invoices/pending/
Get all unpaid/partially-paid invoices.

---

## Inventory — Items

### GET /api/inventory/items/
List inventory items.

**Query params:** `search`, `low_stock` (bool), `category`, `page`, `limit`

**Response 200 (item shape):**
```json
{
  "id": "uuid",
  "name": "Samsung 14\" LCD Panel",
  "sku": "LCD-SAM-14-001",
  "quantity": 3,
  "low_stock_threshold": 5,
  "is_low_stock": true,
  "cost_price": "2800.00",
  "selling_price": "3500.00",
  "gst_rate": "18.00",
  "unit": "PCS",
  "category": { "id": "uuid", "name": "Display Parts" }
}
```

---

### POST /api/inventory/items/
Create an inventory item.

**Request:**
```json
{
  "name": "Dell 14\" LCD Panel",
  "sku": "LCD-DEL-14-001",
  "cost_price": "3200.00",
  "selling_price": "4000.00",
  "gst_rate": "18.00",
  "hsn_code": "84734000",
  "quantity": 5,
  "low_stock_threshold": 3,
  "unit": "PCS",
  "category": "uuid"
}
```

---

### POST /api/inventory/items/{id}/add_stock/
Add stock to an item.

**Request:** `{ "quantity": 10, "reason": "New purchase received from vendor" }`

**Response 200:** Updated InventoryItem

---

### POST /api/inventory/items/{id}/deduct_stock/
Deduct stock (manual — use part requests for job-linked deductions).

**Request:** `{ "quantity": 2, "reason": "Damaged during handling" }`

**Errors:** 400 `insufficient_inventory` — Requested quantity exceeds stock

---

### POST /api/inventory/items/{id}/adjust_stock/
Manually correct stock level (for physical count reconciliation).

**Request:** `{ "new_quantity": 8, "reason": "Physical count correction" }`

---

### GET /api/inventory/items/low_stock/
Get all items at or below their low-stock threshold.

### GET /api/inventory/items/out_of_stock/
Get all items with quantity = 0.

### GET /api/inventory/items/stats/
**Response 200:**
```json
{
  "total_items": 142,
  "total_value": "285000.00",
  "low_stock_count": 12,
  "out_of_stock_count": 3
}
```

---

## Inventory — Purchases

### POST /api/inventory/purchases/
Record a purchase from a vendor.

**Request:**
```json
{
  "vendor_name": "Tech Parts India",
  "vendor_gstin": "27AABCT1332L1ZV",
  "invoice_number": "TPI/2025/1234",
  "purchase_date": "2025-05-09",
  "notes": "Q1 stock replenishment",
  "items": [
    {
      "inventory_item": "uuid",
      "quantity": 10,
      "unit_price": "2800.00",
      "gst_rate": "18.00"
    }
  ]
}
```

---

### POST /api/inventory/purchases/import_excel/
Import a purchase from an Excel file. Multipart form.

**Form fields:** `file` (.xlsx), `vendor_name`, `invoice_number`, `purchase_date`, `paid_amount` (optional), `payment_method` (optional)

**Response 200:**
```json
{
  "message": "Purchase imported successfully.",
  "purchase_id": "uuid",
  "total_amount": "28000.00"
}
```

---

### POST /api/inventory/purchases/{id}/record_payment/
Record payment for a purchase (accounts payable).

**Request:** `{ "amount": "28000.00", "payment_method": "NEFT", "notes": "" }`

---

## Customers

### GET /api/customers/customers/
List customers for the current branch.

**Query params:** `search`, `page`

### POST /api/customers/customers/
Create a customer.

**Request:**
```json
{
  "first_name": "Suresh",
  "last_name": "Patel",
  "mobile": "+919876543210",
  "email": "suresh@example.com",
  "city": "Mumbai",
  "state": "Maharashtra",
  "state_code": "27"
}
```

### GET /api/customers/customers/search_by_mobile/
Search by mobile number (used during job creation).

**Query:** `?mobile=9876543210`  
**Response 200:** Array of matching Customer objects.

### GET /api/customers/customers/{id}/service_history/
Returns all job cards for this customer.

---

## Reports

All report endpoints require `canViewReports`.

### GET /api/reports/revenue/
**Query params:** `from_date` (required), `to_date` (required), `branch`

**Response 200:**
```json
{
  "period": "2025-04-01 to 2025-04-30",
  "total_revenue": "145000.00",
  "total_invoices": 47,
  "total_services": "90000.00",
  "total_parts": "55000.00",
  "cgst_collected": "11016.95",
  "sgst_collected": "11016.95",
  "igst_collected": "0.00",
  "daily_breakdown": [
    { "date": "2025-04-01", "revenue": "5200.00", "invoices": 3 }
  ]
}
```

---

### GET /api/reports/pending_jobs/
**Response 200:**
```json
{
  "total_pending": 18,
  "urgent_count": 3,
  "overdue_count": 5,
  "by_status": [ { "status": "DIAGNOSIS", "count": 4 } ],
  "by_age": { "0-3 days": 8, "4-7 days": 6, "8+ days": 4 }
}
```

---

### GET /api/reports/technician_productivity/
**Query params:** `from_date`, `to_date`, `branch`

### GET /api/reports/inventory_consumption/
**Query params:** `from_date`, `to_date`, `branch`

### GET /api/reports/customer_analysis/
**Query params:** `from_date`, `to_date`, `branch`

### GET /api/reports/gst_summary/
**Query params:** `from_date`, `to_date`, `branch`

### GET /api/reports/net_profit/
**Query params:** `from_date`, `to_date`, `branch`

### GET /api/reports/export_excel/
Download a report as Excel. File download.

**Query params:** `report_type` (revenue|pending_jobs|inventory), `from_date`, `to_date`, `branch`

### GET /api/reports/gstr1_export/
Download GSTR-1 data as Excel. File download.

---

## GST

### GET /api/gst/dashboard/
GST liability overview for the current period.

### GET /api/gst/gstr1_data/
GSTR-1 return data (outward supplies by invoice).

### GET /api/gst/gstr1_json/
Download GSTR-1 in JSON format (for GST portal upload). File download.

### GET /api/gst/gstr3b_summary/
GSTR-3B monthly summary (net tax payable).

### GET /api/gst/itc_register/
Input Tax Credit register (from purchases).

### GET /api/gst/output_register/
Output tax register (from invoices).

### GET /api/gst/hsn_codes/
List/search HSN codes. `?q=<search_term>`

### POST /api/gst/mark_filed/
Mark a return as filed.

**Request:** `{ "period_month": "2025-04", "return_type": "gstr1" }`

---

## Notifications

### GET /api/notifications/logs/
List notification delivery logs.

**Query params:** `status` (PENDING|SENT|FAILED), `channel` (SMS|WHATSAPP|EMAIL), `page`

### GET /api/notifications/alerts/
List internal system alerts (low stock, overdue jobs, etc.).

### GET /api/notifications/alerts/unread_count/
**Response 200:** `{ "count": 5 }`

### POST /api/notifications/alerts/mark_all_read/
Mark all alerts as read.

### POST /api/notifications/send/send/
Send a custom one-off notification.

**Request:**
```json
{
  "channel": "SMS",
  "recipient_mobile": "9876543210",
  "recipient_name": "Suresh Patel",
  "message": "Your device is ready for pickup at Tech Fix."
}
```

---

## System

### GET /api/healthz/
Health check (no auth). Used by load balancer.

**Response 200:** `{ "status": "ok", "db": "ok", "cache": "ok" }`

### GET /api/schema/
OpenAPI schema (YAML). No auth.

### GET /api/docs/
Swagger UI. No auth.

### GET /api/redoc/
ReDoc UI. No auth.
