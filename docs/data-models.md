# Data Models Reference

All models extend `TimeStampedModel` (abstract) unless noted, which adds:
- `created_at`: DateTimeField, auto_now_add=True, db_index=True
- `updated_at`: DateTimeField, auto_now=True

Primary keys are UUID unless stated otherwise.

---

## Core App

### Organization

**Table:** `core_organization`

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | UUIDField | PK, auto | |
| name | CharField(255) | | Display name |
| legal_name | CharField(255) | | For invoices/legal docs |
| email | EmailField | | |
| phone | CharField(15) | regex: E.164 | |
| website | URLField | blank | |
| address_line1 | CharField(255) | | |
| address_line2 | CharField(255) | blank | |
| city | CharField(100) | | |
| state | CharField(100) | | |
| pincode | CharField(6) | regex: 6 digits | |
| country | CharField(100) | default='India' | |
| pan_number | CharField(10) | regex: PAN format | |
| logo | ImageField | blank, null, upload_to='organization_logos/' | |
| tagline | CharField | blank | For invoice header |
| primary_color | CharField | blank | Hex color for branding |
| favicon | ImageField | blank, null | |
| invoice_terms | TextField | blank | Default terms on invoices |
| notes | TextField | blank | |
| bank_name | CharField | blank | |
| account_number | CharField | blank | |
| ifsc | CharField | blank | |
| branch (bank) | CharField | blank | Bank branch name |
| upi_id | CharField | blank | |
| authorized_signatory | CharField | blank | Name on invoice |
| jobcard_terms | TextField | blank | Default terms on job cards |
| warranty_text | TextField | blank | Default warranty clause |
| is_active | BooleanField | default=True | |

**Indexes:** `[name]`, `[is_active]`

---

### Branch

**Table:** `core_branch`

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | UUIDField | PK, auto | |
| organization | ForeignKey(Organization) | on_delete=PROTECT | |
| name | CharField | | Branch display name |
| code | CharField | unique within org | Short code (e.g. "MUM") |
| email | EmailField | blank | |
| phone | CharField(15) | regex: E.164, blank | |
| address_line1/2 | CharField | | |
| city/state/pincode | CharField | | |
| gstin | CharField(15) | blank, regex: GSTIN format | 15-char GST number |
| state_code | CharField(2) | blank, regex: 2 digits | Used for interstate GST |
| invoice_prefix | CharField | default='INV' | Prefix for invoice numbers |
| current_invoice_number | PositiveIntegerField | default=0 | Legacy — use BranchSequence |
| jobcard_prefix | CharField | default='JC' | Prefix for job-card numbers |
| current_jobcard_number | PositiveIntegerField | default=0 | Legacy — use BranchSequence |
| sms_enabled | BooleanField | default=True | |
| whatsapp_enabled | BooleanField | default=True | |
| default_gst_rate | DecimalField(5,2) | default=18.00 | |
| is_active | BooleanField | default=True | |

**Unique together:** `[organization, code]`  
**Indexes:** `[organization, is_active]`, `[code]`, `[gstin]`

**Key methods:**
- `get_current_financial_year()` → `"2425"` (April start, Indian FY)
- `get_next_invoice_number()` → `"INV/2425/MUM/00142"` (uses BranchSequence row-lock)
- `get_next_jobcard_number()` → `"JC/2425/MUM/00089"`

---

### BranchSequence

**Table:** `core_branchsequence`

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | AutoField | PK | Integer, not UUID |
| branch | ForeignKey(Branch) | on_delete=CASCADE | |
| kind | CharField(10) | choices: invoice, jobcard | |
| last_value | PositiveIntegerField | default=0 | |

**Unique together:** `[branch, kind]`  
Used with `select_for_update()` to prevent duplicate sequence numbers under concurrency.

---

### Role (Enum)

| Value | Display |
|-------|---------|
| SUPER_ADMIN | Super Admin |
| OWNER | Owner |
| MANAGER | Manager |
| RECEPTIONIST | Receptionist |
| TECHNICIAN | Technician |
| ACCOUNTANT | Accountant |

---

### RolePermission

**Table:** `core_rolepermission`

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | AutoField | PK | |
| role | CharField(20) | unique, choices=Role | One row per role |
| can_view_dashboard | BooleanField | default=False | |
| can_view_job_cards | BooleanField | default=False | |
| can_create_job_cards | BooleanField | default=False | |
| can_edit_job_cards | BooleanField | default=False | |
| can_view_inventory | BooleanField | default=False | |
| can_manage_inventory | BooleanField | default=False | |
| can_view_billing | BooleanField | default=False | |
| can_create_invoices | BooleanField | default=False | |
| can_view_reports | BooleanField | default=False | |
| can_manage_branches | BooleanField | default=False | |
| can_manage_users | BooleanField | default=False | |
| can_view_pickups | BooleanField | default=False | |
| updated_at | DateTimeField | auto_now=True | |

**Cache:** Permissions cached in Redis at key `scm:1:role_perms_{role}` for 300 seconds. Cache cleared on `save()`.

---

### User

**Table:** `core_user`  
Extends `AbstractBaseUser` + `PermissionsMixin`. Authentication field: `email`.

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | UUIDField | PK | |
| email | EmailField | unique | Login credential |
| first_name | CharField(150) | | |
| last_name | CharField(150) | blank | |
| phone | CharField(15) | blank, regex: E.164 | |
| organization | ForeignKey(Organization) | null, blank, on_delete=PROTECT | Null for SUPER_ADMIN |
| role | CharField(20) | choices=Role, default=TECHNICIAN | |
| branches | ManyToManyField(Branch) | blank | Branches this user can access |
| is_active | BooleanField | default=True | |
| is_staff | BooleanField | default=False | Django admin access |
| last_latitude | DecimalField(9,6) | null, blank | For live tracking |
| last_longitude | DecimalField(9,6) | null, blank | |
| last_location_updated | DateTimeField | null, blank | |
| last_login | DateTimeField | null | |
| date_joined | DateTimeField | auto | |

**Indexes:** `[organization, role]`, `[email]`, `[is_active]`

**Key methods:**
- `get_accessible_branches()` — All org branches for OWNER/SUPER_ADMIN; assigned branches for others
- `has_branch_access(branch)` — Boolean check
- `is_owner/is_manager/is_technician/is_receptionist/is_accountant()` — Role check properties

---

### UserSession

**Table:** `core_usersession`

| Field | Type | Constraints |
|-------|------|-------------|
| id | UUIDField | PK |
| user | ForeignKey(User) | on_delete=CASCADE |
| current_branch | ForeignKey(Branch) | null, on_delete=SET_NULL |
| ip_address | GenericIPAddressField | null |
| user_agent | TextField | blank |
| is_active | BooleanField | default=True |

---

## Jobs App

### JobStatus (Enum)

| Value | Display | Terminal? |
|-------|---------|-----------|
| RECEIVED | Received | No |
| DIAGNOSIS | Under Diagnosis | No |
| ESTIMATE_SHARED | Estimate Shared | No |
| APPROVED | Customer Approved | No |
| REJECTED | Customer Rejected | Yes |
| WAITING_FOR_PARTS | Waiting for Parts | No |
| REPAIR_IN_PROGRESS | Repair in Progress | No |
| READY_FOR_DELIVERY | Ready for Delivery | No |
| DELIVERED | Delivered | Yes |
| CANCELLED | Cancelled | Yes |

### DeviceType (Enum)
LAPTOP, DESKTOP, ALL_IN_ONE, MONITOR, PRINTER, UPS, OTHER

### AccessoryType (Enum)
CHARGER, BATTERY, BAG, MOUSE, KEYBOARD, POWER_CABLE, USB_CABLE, HDMI_CABLE, RAM, HDD, SSD, OTHER

---

### JobCard

**Table:** `jobs_jobcard`

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | UUIDField | PK | |
| branch | ForeignKey(Branch) | null, blank, on_delete=PROTECT | |
| job_number | CharField(50) | unique | Auto-generated on save |
| customer | ForeignKey(Customer) | on_delete=PROTECT | |
| device_type | CharField(20) | choices=DeviceType | |
| brand | CharField | | e.g. "Apple" |
| model | CharField | | e.g. "MacBook Pro 16" |
| serial_number | CharField | blank | |
| _device_password | TextField | blank | **Encrypted** — access via property |
| _bios_password | TextField | blank | **Encrypted** — access via property |
| customer_complaint | TextField | | Customer-reported issue |
| physical_condition | JSONField | | `{selected: [uuid,...], other_text: ""}` |
| engineer_diagnosis | JSONField | null | Same structure |
| additional_comments | TextField | blank | |
| status | CharField(20) | choices=JobStatus, db_index=True | |
| assigned_technician | ForeignKey(User) | null, blank, on_delete=SET_NULL | limit_choices_to role=TECHNICIAN |
| received_by | ForeignKey(User) | on_delete=PROTECT, related='received_jobs' | Staff who received device |
| diagnosis_notes | TextField | blank | |
| estimated_cost | DecimalField(10,2) | null, blank | |
| estimated_completion_date | DateField | null, blank | |
| customer_approval_date | DateTimeField | null, blank | |
| customer_rejection_reason | TextField | blank | |
| completion_notes | TextField | blank | |
| actual_completion_date | DateTimeField | null, blank | |
| delivery_date | DateTimeField | null, blank | |
| delivery_otp | CharField(6) | blank | |
| delivery_signature | ImageField | null, blank, upload_to='signatures/' | |
| delivered_by | ForeignKey(User) | null, blank, on_delete=SET_NULL | |
| is_urgent | BooleanField | default=False | |
| is_warranty_repair | BooleanField | default=False | |
| warranty_details | TextField | blank | |

**Indexes:** `[branch, status]`, `[branch, status, created_at]`, `[branch, job_number]`, `[customer]`, `[assigned_technician, status]`, `[created_at]`

**Properties:**
- `device_password` (get/set) — Transparent encrypt/decrypt via `core.utils`
- `bios_password` (get/set) — Same

**Key methods:**
- `is_terminal_status()` → `status in [DELIVERED, CANCELLED, REJECTED]`
- `can_transition_to(new_status)` → Boolean — checks `ALLOWED_STATUS_TRANSITIONS`
- `transition_status(new_status, user, notes, is_override=False)` — Creates `JobStatusHistory`, raises on invalid
- `generate_delivery_otp()` → Generates 6-digit OTP, triggers customer notification
- `verify_delivery_otp(otp)` → Boolean comparison
- `get_total_parts_cost()` → Sum of `diagnosis_parts` prices × quantities

---

### JobStatusHistory

**Table:** `jobs_jobstatushistory` (immutable — save() raises if updating)

| Field | Type | Constraints |
|-------|------|-------------|
| id | UUIDField | PK |
| job | ForeignKey(JobCard) | on_delete=CASCADE |
| from_status | CharField(20) | choices=JobStatus, blank (null for initial) |
| to_status | CharField(20) | choices=JobStatus |
| changed_by | ForeignKey(User) | on_delete=PROTECT |
| notes | TextField | blank |
| is_override | BooleanField | default=False |

---

### JobAccessory

**Table:** `jobs_jobaccessory`

| Field | Type | Constraints |
|-------|------|-------------|
| id | UUIDField | PK |
| job | ForeignKey(JobCard) | on_delete=CASCADE |
| accessory_type | CharField(20) | choices=AccessoryType |
| description | CharField(255) | blank |
| condition | CharField(255) | blank |
| is_present | BooleanField | default=True |

**Unique together:** `[job, accessory_type]`

---

### JobPhoto

**Table:** `jobs_jobphoto`

| Field | Type | Constraints |
|-------|------|-------------|
| id | UUIDField | PK |
| job | ForeignKey(JobCard) | on_delete=CASCADE |
| photo | ImageField | upload_to='job_photos/' |
| photo_type | CharField(20) | choices: INTAKE, DAMAGE, REPAIR, COMPLETED |
| description | CharField | blank |
| uploaded_by | ForeignKey(User) | null, on_delete=SET_NULL |

**Ordering:** `-created_at`

---

### JobNote

**Table:** `jobs_jobnote`

| Field | Type | Constraints |
|-------|------|-------------|
| id | UUIDField | PK |
| job | ForeignKey(JobCard) | on_delete=CASCADE |
| note | TextField | |
| created_by | ForeignKey(User) | on_delete=PROTECT |
| is_internal | BooleanField | default=True |

---

### DiagnosisPart

**Table:** `jobs_diagnosispart`

| Field | Type | Constraints |
|-------|------|-------------|
| id | UUIDField | PK |
| job | ForeignKey(JobCard) | on_delete=CASCADE |
| name | CharField | |
| price | DecimalField(10,2) | |
| warranty_months | PositiveIntegerField | default=0 |
| quantity | PositiveIntegerField | default=1 |

---

### PartRequest

**Table:** `jobs_partrequest`

| Field | Type | Constraints |
|-------|------|-------------|
| id | UUIDField | PK |
| job | ForeignKey(JobCard) | on_delete=CASCADE |
| requested_by | ForeignKey(User) | on_delete=PROTECT |
| inventory_item | ForeignKey(InventoryItem) | null, blank, on_delete=SET_NULL |
| part_name | CharField(255) | |
| quantity | PositiveIntegerField | default=1 |
| status | CharField(20) | choices: PENDING, APPROVED, REJECTED, USED |
| approved_by | ForeignKey(User) | null, blank, on_delete=SET_NULL |
| rejection_reason | TextField | blank |
| notes | TextField | blank |

**Method:** `approve(user)` — checks stock availability, deducts inventory, updates status

---

### PickupRequest

**Table:** `jobs_pickuprequest`

| Field | Type | Constraints |
|-------|------|-------------|
| id | UUIDField | PK |
| branch | ForeignKey(Branch) | on_delete=PROTECT |
| pickup_number | CharField(50) | unique, auto-generated |
| customer | ForeignKey(Customer) | on_delete=PROTECT |
| job | ForeignKey(JobCard) | null, blank, on_delete=SET_NULL |
| status | CharField(25) | choices=PickupRequestStatus, db_index |
| assigned_technician | ForeignKey(User) | null, blank, on_delete=SET_NULL |
| device_type | CharField | choices=DeviceType |
| brand | CharField | |
| model_name | CharField | |
| customer_complaint | TextField | |
| pickup_address | TextField | |
| pickup_date | DateField | |
| pickup_time_slot | CharField | blank |
| contact_number | CharField | |
| notes | TextField | blank |
| is_urgent | BooleanField | default=False |
| created_by | ForeignKey(User) | on_delete=PROTECT |

**PickupRequestStatus:** REQUESTED → ASSIGNED → EN_ROUTE → PICKED_UP → DELIVERED_TO_CENTER → COMPLETED (or CANCELLED from any)

**Indexes:** `[branch, status]`, `[assigned_technician, status]`, `[customer]`, `[pickup_date]`

---

### DropdownOption

**Table:** `jobs_dropdownoption`

| Field | Type | Constraints |
|-------|------|-------------|
| id | UUIDField | PK |
| category | CharField(30) | choices: PHYSICAL_CONDITION, ENGINEER_DIAGNOSIS |
| device_type | CharField(20) | null, blank — null means applies to all device types |
| label | CharField(255) | |
| display_order | IntegerField | default=0 |
| is_active | BooleanField | default=True |
| has_text_input | BooleanField | default=False |

**Indexes:** `[category, device_type, is_active]`

---

## Billing App

### InvoiceStatus (Enum)
DRAFT → PENDING → PARTIAL → PAID (CANCELLED from any non-PAID)

### PaymentMethod (Enum)
CASH, UPI, CARD, NEFT, CHEQUE, WALLET, OTHER

---

### Invoice

**Table:** `billing_invoice`

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | UUIDField | PK | |
| branch | ForeignKey(Branch) | null, blank, on_delete=PROTECT | |
| invoice_number | CharField(50) | unique | Auto-generated |
| job | ForeignKey(JobCard) | null, blank, on_delete=SET_NULL | Optional job link |
| customer_name | CharField | | Snapshot at invoice time |
| customer_mobile | CharField | | Snapshot |
| customer_email | EmailField | blank | Snapshot |
| customer_address | TextField | blank | Snapshot |
| customer_gstin | CharField | blank | Snapshot |
| customer_state_code | CharField(2) | blank | For IGST determination |
| invoice_date | DateField | default=today | |
| due_date | DateField | null, blank | |
| is_interstate | BooleanField | default=False | IGST if True, CGST+SGST if False |
| subtotal | DecimalField(12,2) | default=0 | Sum of line item amounts before tax |
| cgst_total | DecimalField(12,2) | default=0 | |
| sgst_total | DecimalField(12,2) | default=0 | |
| igst_total | DecimalField(12,2) | default=0 | |
| discount_amount | DecimalField(12,2) | default=0 | Invoice-level discount |
| total_tax | DecimalField(12,2) | default=0 | cgst+sgst+igst |
| total_amount | DecimalField(12,2) | default=0 | subtotal + total_tax - discount |
| status | CharField(20) | choices=InvoiceStatus | |
| paid_amount | DecimalField(12,2) | default=0 | |
| is_finalized | BooleanField | default=False | Read-only after True |
| finalized_at | DateTimeField | null | |
| finalized_by | ForeignKey(User) | null, on_delete=SET_NULL | |
| notes | TextField | blank | |
| terms_and_conditions | TextField | blank | |
| created_by | ForeignKey(User) | on_delete=PROTECT | |

**Computed properties:**
- `balance_due` = `total_amount - paid_amount`
- `is_fully_paid` = `balance_due <= 0`

**Indexes:** `[branch, invoice_number]`, `[branch, status]`, `[branch, invoice_date]`, `[job]`, `[invoice_date]`

**Key methods:**
- `calculate_totals()` — Aggregates `Sum()` from all line items, calls `_update_payment_status()`
- `finalize(user)` — Sets `is_finalized=True`, creates Khata entry, triggers notification
- `record_payment(amount, method, user, reference, notes)` — Creates Payment, updates `paid_amount`

---

### InvoiceLineItem

**Table:** `billing_invoicelineitem`

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | UUIDField | PK | |
| invoice | ForeignKey(Invoice) | on_delete=CASCADE | |
| item_type | CharField(20) | choices: SERVICE, PART, LABOUR, OTHER | |
| description | CharField | | |
| hsn_sac_code | CharField | blank | For GST filing |
| quantity | PositiveIntegerField | default=1 | |
| unit | CharField | blank | e.g. "pcs", "hrs" |
| unit_price | DecimalField(10,2) | | |
| amount | DecimalField(10,2) | | `unit_price × quantity × (1 - discount/100)` |
| gst_rate | DecimalField(5,2) | | e.g. 18.00 |
| cgst_rate | DecimalField(5,2) | | gst_rate / 2 if intrastate |
| cgst_amount | DecimalField(10,2) | | |
| sgst_rate | DecimalField(5,2) | | gst_rate / 2 if intrastate |
| sgst_amount | DecimalField(10,2) | | |
| igst_rate | DecimalField(5,2) | | gst_rate if interstate |
| igst_amount | DecimalField(10,2) | | |
| discount_percent | DecimalField(5,2) | default=0 | Per-line discount |
| inventory_item | ForeignKey(InventoryItem) | null, blank, on_delete=SET_NULL | |
| job_part_usage | ForeignKey(JobPartUsage) | null, blank, on_delete=SET_NULL | |

**`save()`** recalculates amount, applies discount, calls `calculate_gst()`, then recalculates parent invoice totals.

---

### Payment

**Table:** `billing_payment`

| Field | Type | Constraints |
|-------|------|-------------|
| id | UUIDField | PK |
| invoice | ForeignKey(Invoice) | on_delete=PROTECT |
| amount | DecimalField(12,2) | min_value=0.01 |
| payment_method | CharField(20) | choices=PaymentMethod |
| payment_date | DateTimeField | default=now |
| reference | CharField | blank |
| notes | TextField | blank |
| received_by | ForeignKey(User) | on_delete=PROTECT |
| is_verified | BooleanField | default=True |

---

### CreditNote

**Table:** `billing_creditnote`

| Field | Type | Constraints |
|-------|------|-------------|
| id | UUIDField | PK |
| branch | ForeignKey(Branch) | on_delete=PROTECT |
| credit_note_number | CharField(50) | unique |
| invoice | ForeignKey(Invoice) | on_delete=PROTECT |
| amount | DecimalField(12,2) | |
| cgst_amount | DecimalField(12,2) | |
| sgst_amount | DecimalField(12,2) | |
| igst_amount | DecimalField(12,2) | |
| total_amount | DecimalField(12,2) | |
| reason | TextField | |
| created_by | ForeignKey(User) | on_delete=PROTECT |

---

### InvoiceEditHistory

**Table:** `billing_invoiceedithistory` (immutable — save() raises if updating)

| Field | Type | Constraints |
|-------|------|-------------|
| id | UUIDField | PK |
| invoice | ForeignKey(Invoice) | on_delete=CASCADE |
| edited_by | ForeignKey(User) | null, on_delete=SET_NULL |
| edit_type | CharField(30) | choices: CREATED, LINE_ITEM_ADDED, LINE_ITEM_REMOVED, LINE_ITEM_UPDATED, AMOUNTS_UPDATED, DETAILS_UPDATED, STATUS_CHANGED, DOWNLOADED, CANCELLED |
| summary | CharField(500) | |
| old_values | JSONField | null |
| new_values | JSONField | null |

---

## Inventory App

### InventoryCategory

**Table:** `inventory_inventorycategory`

| Field | Type | Constraints |
|-------|------|-------------|
| id | UUIDField | PK |
| branch | ForeignKey(Branch) | null, blank, on_delete=CASCADE |
| name | CharField | |
| description | TextField | blank |

**Unique together:** `[branch, name]`

---

### InventoryItem

**Table:** `inventory_inventoryitem`

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | UUIDField | PK | |
| branch | ForeignKey(Branch) | null, blank, on_delete=PROTECT | |
| name | CharField | | |
| sku | CharField | | Stock-keeping unit |
| description | TextField | blank | |
| category | ForeignKey(InventoryCategory) | null, blank, on_delete=SET_NULL | |
| cost_price | DecimalField(10,2) | min=0 | Purchase price |
| selling_price | DecimalField(10,2) | min=0 | Default invoice price |
| gst_rate | DecimalField(5,2) | default=18 | |
| hsn_code | CharField(8) | blank | For GST filing |
| quantity | PositiveIntegerField | default=0 | Current stock |
| low_stock_threshold | PositiveIntegerField | default=5 | Alert trigger level |
| unit | CharField(20) | choices: PCS, NOS, MTR, SET, BOX, KG | |
| location | CharField | blank | Physical shelf/bin location |
| vendor_name | CharField | blank | |
| vendor_contact | CharField | blank | |
| warranty_period_months | PositiveIntegerField | default=0 | |
| is_active | BooleanField | default=True | |

**Indexes:** `[branch, name]`, `[branch, sku]`, `[quantity, low_stock_threshold]`

**Properties:**
- `is_low_stock` = `quantity <= low_stock_threshold`

**Key methods:**
- `add_stock(quantity, reason, user)` — select_for_update(), creates InventoryAdjustment
- `deduct_stock(quantity, reason, user, job)` — select_for_update(), checks availability, triggers low-stock alert
- `adjust_stock(new_quantity, reason, user)` — Manual correction with audit

---

### InventoryAdjustment

**Table:** `inventory_inventoryadjustment` (immutable — save() raises if updating)

| Field | Type | Constraints |
|-------|------|-------------|
| id | UUIDField | PK |
| item | ForeignKey(InventoryItem) | on_delete=CASCADE |
| adjustment_type | CharField(20) | choices: ADD, DEDUCT, MANUAL, CORRECTION, RETURN, DAMAGED |
| quantity | PositiveIntegerField | Change amount |
| old_quantity | PositiveIntegerField | Before |
| new_quantity | PositiveIntegerField | After |
| reason | TextField | |
| adjusted_by | ForeignKey(User) | null, on_delete=PROTECT |
| is_manual_adjustment | BooleanField | default=False |

---

### JobPartUsage

**Table:** `inventory_jobpartusage`

| Field | Type | Constraints |
|-------|------|-------------|
| id | UUIDField | PK |
| job | ForeignKey(JobCard) | on_delete=PROTECT |
| inventory_item | ForeignKey(InventoryItem) | on_delete=PROTECT |
| quantity | PositiveIntegerField | |
| unit_price | DecimalField(10,2) | Price at time of use |
| total_price | DecimalField(10,2) | |
| adjustment | ForeignKey(InventoryAdjustment) | null, on_delete=PROTECT |
| notes | TextField | blank |

**Property:**
- `warranty_expiry` — `created_at + (item.warranty_period_months × 30 days)`

---

### Purchase

**Table:** `inventory_purchase`

| Field | Type | Constraints |
|-------|------|-------------|
| id | UUIDField | PK |
| branch | ForeignKey(Branch) | null, blank, on_delete=CASCADE |
| vendor_name | CharField(255) | |
| vendor_gstin | CharField(15) | blank |
| invoice_number | CharField(100) | blank |
| purchase_date | DateField | |
| total_amount | DecimalField(12,2) | |
| paid_amount | DecimalField(12,2) | default=0 |
| status | CharField(20) | choices: PENDING, PARTIAL, PAID, CANCELLED |
| taxable_amount | DecimalField | |
| cgst_amount | DecimalField | |
| sgst_amount | DecimalField | |
| total_gst | DecimalField | |
| notes | TextField | blank |

**Properties:** `balance_due`, `is_fully_paid`

---

### PurchaseItem

**Table:** `inventory_purchaseitem`

| Field | Type | Constraints |
|-------|------|-------------|
| id | UUIDField | PK |
| purchase | ForeignKey(Purchase) | on_delete=CASCADE |
| inventory_item | ForeignKey(InventoryItem) | on_delete=PROTECT |
| quantity | PositiveIntegerField | |
| unit_price | DecimalField | |
| total_price | DecimalField | |
| gst_rate | DecimalField | |
| taxable_amount | DecimalField | |
| cgst_amount | DecimalField | |
| sgst_amount | DecimalField | |

---

## Customers App

### Customer

**Table:** `customers_customer`

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | UUIDField | PK | |
| branch | ForeignKey(Branch) | null, blank, on_delete=PROTECT | |
| first_name | CharField(150) | | |
| last_name | CharField(150) | blank | |
| email | EmailField | blank | |
| mobile | CharField(15) | regex: E.164, db_index | Primary identifier |
| alternate_mobile | CharField(15) | blank | |
| address_line1/2 | CharField | blank | |
| city/state/pincode | CharField | blank | |
| state_code | CharField(2) | blank | GST supply type determination |
| gstin | CharField | blank | For B2B customers |
| company_name | CharField | blank | |
| sms_enabled | BooleanField | default=True | |
| whatsapp_enabled | BooleanField | default=True | |
| notes | TextField | blank | |
| is_active | BooleanField | default=True | |

**Unique together:** `[branch, mobile]`  
**Indexes:** `[branch, mobile]`, `[mobile]`, `[branch, first_name, last_name]`

**Key methods:**
- `get_full_name()` → `"{first_name} {last_name}"`
- `get_service_history()` → JobCards ordered newest first
- `get_pending_jobs()` → Open (non-terminal) jobs
- `get_total_spent()` → Sum of PAID invoice amounts

---

### CustomerDocument

**Table:** `customers_customerdocument`

| Field | Type | Constraints |
|-------|------|-------------|
| id | UUIDField | PK |
| customer | ForeignKey(Customer) | on_delete=CASCADE |
| document_type | CharField(50) | choices: AADHAR, PAN, DRIVING_LICENSE, PASSPORT, VOTER_ID, OTHER |
| document_number | CharField(50) | blank |
| file | FileField | upload_to='customer_documents/' |
| notes | TextField | blank |

---

## Custom Exceptions

All defined in `core/exceptions.py`. All extend DRF `APIException`.

| Class | HTTP Status | Code | When raised |
|-------|-------------|------|-------------|
| `BusinessRuleViolation` | 400 | `business_rule_violation` | Base class for business logic violations |
| `InvalidStatusTransition` | 400 | `invalid_status_transition` | Job/pickup status move not allowed |
| `InsufficientInventory` | 400 | `insufficient_inventory` | Stock deduction would go negative |
| `JobReadOnlyError` | 400 | `job_readonly` | Modifying a terminal-status job |
| `InvoiceNumberConflict` | 400 | `invoice_number_conflict` | Duplicate invoice number |
| `DeliveryRequirementError` | 400 | `delivery_requirement` | Missing OTP or signature for delivery |
| `BranchAccessDenied` | 403 | `branch_access_denied` | User lacks access to branch |
| `OrganizationMismatch` | 403 | `organization_mismatch` | Cross-org data access attempt |
| `ProtectedResourceError` | 409 | `protected_resource` | FK PROTECT violation on delete |

All errors are wrapped by `custom_exception_handler` in the format:
```json
{
  "success": false,
  "error": {
    "code": "invalid_status_transition",
    "message": "Cannot transition from DELIVERED to DIAGNOSIS.",
    "status_code": 400,
    "field_errors": {}
  }
}
```
