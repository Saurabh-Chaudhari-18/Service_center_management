# Business Flows

All flows are documented at code-execution level: every DB write, notification dispatch, cache operation, error condition, and side effect is listed in the order it happens.

**Legend**
- **DB write** — row created or updated
- **DB read** — SELECT or aggregate query
- **LOCK** — `select_for_update()` row-level lock
- **🔔 Notification** — async Celery task queued to deliver SMS / WhatsApp / Email
- **🔔 Alert** — `InternalAlert` row created (visible in the bell icon)
- **🗄 Cache** — Redis read or write
- **📋 Audit** — immutable audit record created
- **⚠ Error** — exception raised; request returns non-2xx

---

## Table of Contents

1. [Authentication & Session](#1-authentication--session)
2. [Job Card Lifecycle](#2-job-card-lifecycle)
3. [Pickup Request Lifecycle](#3-pickup-request-lifecycle)
4. [Part Request Lifecycle](#4-part-request-lifecycle)
5. [Billing & Invoice Lifecycle](#5-billing--invoice-lifecycle)
6. [Inventory Stock Flows](#6-inventory-stock-flows)
7. [Purchase & Accounts Payable](#7-purchase--accounts-payable)
8. [Customer Management](#8-customer-management)
9. [Notification Dispatch Pipeline](#9-notification-dispatch-pipeline)
10. [User & Access Management](#10-user--access-management)
11. [Enquiry / Lead Management](#11-enquiry--lead-management)
12. [GST Reporting Flows](#12-gst-reporting-flows)
13. [Reports & Exports](#13-reports--exports)
14. [Error Flows](#14-error-flows)

---

## 1. Authentication & Session

### 1.1 Login

**Trigger:** User submits email + password on `/login` page.

```
Frontend                          Backend                           DB / Cache
────────                          ───────                           ──────────
POST /api/auth/token/
  { email, password }
                          ──────►  SimpleJWT validates credentials
                                   DB read: User WHERE email=X        core_user
                                   check is_active=True
                                   verify password hash
                          ◄──────  200 { access, refresh }

Store access → localStorage('scm_access_token')
Store refresh → localStorage('scm_refresh_token')

GET /api/core/users/me/
  Authorization: Bearer <access>
                          ──────►  Decode JWT → user.id
                                   DB read: User + org + branches    core_user
                                   🗄 Cache read: role_perms_{role}  Redis
                                   (cache miss → DB read             core_rolepermission
                                    + cache.set TTL 300s)
                          ◄──────  200 { user, permissions, branches }

Store currentBranch → localStorage('scm_current_branch')
Redirect → /dashboard
```

**Errors:**
- ⚠ 401 — invalid credentials or inactive account
- ⚠ 403 — account suspended (`is_active=False`)

---

### 1.2 Token Refresh (automatic, background)

**Trigger:** Any API call returns 401.

```
Axios response interceptor detects 401
  → if refresh in flight: queue request, wait
  → else:
      POST /api/auth/token/refresh/  { refresh: <token> }
                          ──────►  Validate refresh token signature + expiry
                          ◄──────  200 { access: <new_token> }
      Store new access → localStorage('scm_access_token')
      Retry all queued requests with new token
```

**Errors:**
- ⚠ 401 on refresh → `localStorage.clear()` → redirect to `/login`

---

### 1.3 Branch Switching

**Trigger:** User selects a different branch from the branch switcher.

```
POST /api/core/users/set_current_branch/
  { branch_id: "uuid" }
                          ──────►  DB read: Branch WHERE pk=uuid       core_branch
                                   user.has_branch_access(branch)
                                     → checks user.branches M2M
                                       or user.role in [OWNER, SUPER_ADMIN]
                                   DB write: Django Session             django_session
                          ◄──────  200 { message, branch }

localStorage('scm_current_branch') = branch_id
All subsequent requests add header: X-Branch-ID: <branch_id>
Page reloads (full navigation reset)
```

**Errors:**
- ⚠ 403 `branch_access_denied` — user not assigned to this branch

---

### 1.4 Password Change

**Trigger:** User submits current + new password.

```
POST /api/core/users/change_password/
  { old_password, new_password }
                          ──────►  user.check_password(old_password)
                                   user.set_password(new_password)    core_user
                                   user.save()
                          ◄──────  200 { message }
```

**Errors:**
- ⚠ 400 — old password incorrect
- ⚠ 400 — new password fails Django validators (length, common password)

---

## 2. Job Card Lifecycle

### 2.1 Device Intake (Create Job Card)

**Trigger:** Receptionist/Owner/Manager submits the new job form.

**Pre-condition:** Customer must exist. Branch must be selected.

```
POST /api/jobs/jobs/
  { customer_id, device_type, brand, model, customer_complaint,
    physical_condition: { selected: [uuid...], other_text },
    device_password, accessories: [...] }

─── BEGIN transaction.atomic() ───────────────────────────────────────────────

1. BranchScopedMixin resolves branch from X-Branch-ID header
2. DB read: Customer WHERE pk=customer_id, branch accessible         customers_customer
3. DB read: Branch (for job number generation)                       core_branch
4. Encrypt device_password → stored as _device_password             [Fernet AES-128]
5. Encrypt bios_password (if provided) → stored as _bios_password
6. DB read+LOCK: BranchSequence WHERE branch=X AND kind='jobcard'    core_branchsequence
   UPDATE last_value = last_value + 1
   job_number = "{prefix}/{FY}/{branch_code}/{last_value:05d}"
   e.g. "JC/2425/MUM/00089"
7. DB write: JobCard                                                 jobs_jobcard
   { branch, job_number, customer, device_type, brand, model,
     serial_number, _device_password, customer_complaint,
     physical_condition (JSON), status=RECEIVED,
     received_by=request.user }
8. DB write: JobStatusHistory (initial record)                       jobs_jobstatushistory
   { job, from_status=None, to_status=RECEIVED,
     changed_by=request.user, notes="Device received" }
9. For each accessory in request:
   DB write: JobAccessory                                            jobs_jobaccessory
   { job, accessory_type, is_present, condition, description }

─── END transaction.atomic() ─────────────────────────────────────────────────

10. 🔔 NotificationService.on_job_created(job)
    → Generates job card PDF (optional)
    → DB write: NotificationLog (status=PENDING)                     notifications_notificationlog
    → Celery: deliver_sms.delay(log_id)  [if SMS enabled]
    → Celery: deliver_whatsapp.delay(log_id)  [if WA enabled]
    → Celery: deliver_email.delay(log_id, email, subject)  [if email set]

Return 201:
{ id, job_number: "JC/2425/MUM/00089", status: "RECEIVED", ... }
```

**Errors:**
- ⚠ 400 — customer_id invalid or not in accessible branch
- ⚠ 400 — device_type not in choices
- ⚠ 400 — required fields missing (brand, customer_complaint, physical_condition)
- ⚠ 403 — user lacks `canCreateJobCards` permission

---

### 2.2 Assign Technician

**Trigger:** Manager/Owner clicks "Assign Technician" on a job card.

```
POST /api/jobs/jobs/{id}/assign_technician/
  { technician_id: "uuid", notes: "Experienced with Dell", estimated_completion_date }

1. DB read: JobCard (BranchScopedMixin verifies branch access)       jobs_jobcard
2. Check: job.is_terminal_status() → if True and not Owner → ⚠ 400
3. DB read: User WHERE pk=technician_id, role=TECHNICIAN, is_active=True  core_user
4. Validate: technician in request.user.get_accessible_branches()
   (technician must have access to the job's branch)

─── BEGIN transaction.atomic() ───────────────────────────────────────────────
5. DB write: JobCard                                                 jobs_jobcard
   { assigned_technician=technician, updated_at=now }
6. DB write: JobNote (internal)                                      jobs_jobnote
   { job, note="Technician assigned: {name}. {notes}",
     created_by=request.user, is_internal=True }
7. 🔔 Alert: NotificationService.on_technician_assigned(job, technician)
   DB write: InternalAlert                                           notifications_internalalert
   { alert_type='SYSTEM', priority='MEDIUM',
     message="New job assigned: JC/2425/MUM/00089 – {complaint[:50]}",
     related_model='jobs.JobCard', related_object_id=job.id }
─── END transaction.atomic() ─────────────────────────────────────────────────

Return 200: { message, technician: { id, name } }
```

**State change:** `JobCard.assigned_technician` set. No status change.

**Errors:**
- ⚠ 404 — technician not found or not in branch
- ⚠ 400 — job is terminal and user is not Owner

---

### 2.3 Add Diagnosis

**Trigger:** Technician submits diagnosis form (notes, estimated cost, parts).

**Pre-condition:** Job must not be terminal (unless user is Owner).

```
POST /api/jobs/jobs/{id}/add_diagnosis/
  { diagnosis_notes, estimated_cost, estimated_completion_date,
    parts: [{ name, price, quantity, warranty_months }] }

1. DB read: JobCard                                                  jobs_jobcard
2. Check: terminal + not Owner → ⚠ 400

─── BEGIN transaction.atomic() ───────────────────────────────────────────────
3. DB write: JobCard                                                 jobs_jobcard
   { diagnosis_notes, estimated_cost (if provided),
     estimated_completion_date (if provided), updated_at=now }
4. If 'parts' in request:
   DB delete: DiagnosisPart WHERE job=job                           jobs_diagnosispart
   DB write: DiagnosisPart × N (bulk_create)                        jobs_diagnosispart
   [{ job, name, price, warranty_months, quantity }]

5. Auto-transition: if job.status == RECEIVED:
   DB write: JobCard.status = DIAGNOSIS                             jobs_jobcard
   DB write: JobStatusHistory                                        jobs_jobstatushistory
   { from_status=RECEIVED, to_status=DIAGNOSIS,
     changed_by=request.user, notes="Diagnosis completed" }
   🔔 NotificationService.on_job_status_change(job, RECEIVED, DIAGNOSIS)
      → DB write: NotificationLog (if customer notifications enabled)
      → Celery tasks queued for SMS/WhatsApp/Email
─── END transaction.atomic() ─────────────────────────────────────────────────

Return 200: { message, status, status_display, diagnosis_parts_count }
```

**State change:** `JobCard.diagnosis_notes` updated. If was RECEIVED → auto-transitions to DIAGNOSIS.

**Errors:**
- ⚠ 400 — job is terminal and user is not Owner

---

### 2.4 Share Estimate with Customer

**Trigger:** Manager/Owner clicks "Share Estimate" button.

**Pre-condition:** `job.status == DIAGNOSIS` AND `job.estimated_cost` must be set.

```
POST /api/jobs/jobs/{id}/share_estimate/

1. DB read: JobCard
2. Check: job.status != DIAGNOSIS → ⚠ 400 "Job must be in DIAGNOSIS status"
3. Check: not job.estimated_cost → ⚠ 400 "Set an estimated cost first"

─── BEGIN transaction.atomic() ───────────────────────────────────────────────
4. DB write: JobCard.status = ESTIMATE_SHARED                       jobs_jobcard
   DB write: JobStatusHistory                                        jobs_jobstatushistory
   { from=DIAGNOSIS, to=ESTIMATE_SHARED,
     notes="Estimate of ₹{cost} shared with customer" }

5. 🔔 NotificationService.send_estimate(job)
   context = { customer_name, job_number, branch_name, device, amount=estimated_cost }
   → For each enabled channel (SMS/WA/Email):
     Fetch NotificationTemplate (notification_type=ESTIMATE_SHARED, channel, branch)
     DB write: NotificationLog (status=PENDING)                     notifications_notificationlog
     Celery: deliver_{channel}.delay(log_id)
─── END transaction.atomic() ─────────────────────────────────────────────────

Return 200: { message, status: "ESTIMATE_SHARED" }
```

**State change:** `DIAGNOSIS → ESTIMATE_SHARED`.

**Errors:**
- ⚠ 400 — wrong current status
- ⚠ 400 — no estimated_cost set

---

### 2.5 Record Customer Response (Approval / Rejection)

**Trigger:** Staff records customer's verbal/written response.

**Pre-condition:** `job.status == ESTIMATE_SHARED`.

```
POST /api/jobs/jobs/{id}/record_customer_response/
  { approved: true/false, rejection_reason: "Too expensive" }

1. DB read: JobCard
2. Check: job.status != ESTIMATE_SHARED → ⚠ 400

─── BEGIN transaction.atomic() ───────────────────────────────────────────────
IF approved == True:
  3a. DB write: JobCard.customer_approval_date = now()              jobs_jobcard
  4a. DB write: JobCard.status = APPROVED
      DB write: JobStatusHistory { from=ESTIMATE_SHARED, to=APPROVED,
                notes="Customer approved estimate" }

IF approved == False:
  3b. rejection_reason required → ⚠ 400 if missing
  4b. DB write: JobCard.customer_rejection_reason = reason          jobs_jobcard
  5b. DB write: JobCard.status = REJECTED
      DB write: JobStatusHistory { from=ESTIMATE_SHARED, to=REJECTED,
                notes="Customer rejected: {reason}" }
─── END transaction.atomic() ─────────────────────────────────────────────────

Return 200: { message, status }
```

**State changes:**
- Approved: `ESTIMATE_SHARED → APPROVED`
- Rejected: `ESTIMATE_SHARED → REJECTED` (terminal — job is now read-only)

**Errors:**
- ⚠ 400 — wrong current status
- ⚠ 400 — rejected but no reason given

---

### 2.6 Repair Progress Updates

**Trigger:** Technician or Manager updates job status manually.

```
POST /api/jobs/jobs/{id}/update_status/
  { new_status: "REPAIR_IN_PROGRESS", notes: "Started screen replacement", is_override: false }

1. DB read: JobCard
2. Check: job.is_terminal_status() → if True and not Owner → ⚠ 400 (JobReadOnlyError)
3. Validate: new_status in choices
4. if is_override:
     Check: user.role in [SUPER_ADMIN, OWNER, MANAGER] → ⚠ 403 if not

─── BEGIN (DB stored procedure: transition_job_status) ───────────────────────
5. Validate transition:
   if not is_override:
     allowed = ALLOWED_STATUS_TRANSITIONS[job.status]
     if new_status not in allowed → ⚠ 400 (InvalidStatusTransition)
       "Cannot transition from {current} to {new}. Allowed: {list}"
6. DB write: JobCard.status = new_status                            jobs_jobcard
   DB write: JobCard.updated_at = now()
7. DB write: JobStatusHistory                                        jobs_jobstatushistory
   { job, from_status=old, to_status=new_status,
     changed_by=request.user, notes, is_override }
─── END stored procedure ─────────────────────────────────────────────────────

8. Refresh job from DB
9. 🔔 NotificationService.on_job_status_change(job, old_status, new_status)
   Notification fired for: DIAGNOSIS, ESTIMATE_SHARED, READY_FOR_DELIVERY, DELIVERED
   → DB write: NotificationLog (per channel)
   → Celery tasks queued

Return 200: { message, status, status_display }
```

**Valid transitions reference:**

| From | To (allowed values) |
|------|---------------------|
| RECEIVED | DIAGNOSIS, CANCELLED |
| DIAGNOSIS | ESTIMATE_SHARED, CANCELLED |
| ESTIMATE_SHARED | APPROVED, REJECTED, CANCELLED |
| APPROVED | WAITING_FOR_PARTS, REPAIR_IN_PROGRESS, CANCELLED |
| WAITING_FOR_PARTS | REPAIR_IN_PROGRESS, CANCELLED |
| REPAIR_IN_PROGRESS | WAITING_FOR_PARTS, READY_FOR_DELIVERY, CANCELLED |
| READY_FOR_DELIVERY | DELIVERED, REPAIR_IN_PROGRESS |
| DELIVERED | _(terminal)_ |
| REJECTED | _(terminal)_ |
| CANCELLED | _(terminal)_ |

**Errors:**
- ⚠ 400 `invalid_status_transition` — transition not in allowed map
- ⚠ 400 `job_readonly` — job is in terminal status and user is not Owner
- ⚠ 403 — `is_override=true` without Owner/Manager role

---

### 2.7 Mark Ready for Delivery

**Trigger:** Technician clicks "Mark Ready" after completing repair.

**Pre-condition:** `job.status in [REPAIR_IN_PROGRESS, WAITING_FOR_PARTS]`.

```
POST /api/jobs/jobs/{id}/mark_ready/
  { completion_notes: "Screen replaced and tested. Battery at 98%." }

1. DB read: JobCard
2. Check: status not in allowed → ⚠ 400

─── BEGIN transaction.atomic() ───────────────────────────────────────────────
3. DB write: JobCard                                                 jobs_jobcard
   { completion_notes, actual_completion_date=now(), updated_at=now() }
4. DB write: JobCard.status = READY_FOR_DELIVERY
   DB write: JobStatusHistory { from=REPAIR_IN_PROGRESS, to=READY_FOR_DELIVERY,
             notes=completion_notes }

5. job.generate_delivery_otp():
   otp = random 6-digit string
   DB write: JobCard.delivery_otp = otp                             jobs_jobcard

6. 🔔 NotificationService.send_delivery_otp(job)
   context = { customer_name, job_number, branch_name, device, otp }
   → DB write: NotificationLog (status=PENDING)
   → Celery: deliver_sms.delay(log_id)   [priority: highest — OTP must reach customer]
   → Celery: deliver_whatsapp.delay(log_id)
─── END transaction.atomic() ─────────────────────────────────────────────────

Return 200: { message: "Job marked ready. OTP sent to customer." }
```

**State change:** `REPAIR_IN_PROGRESS → READY_FOR_DELIVERY`. OTP generated and sent.

**Errors:**
- ⚠ 400 — job not in REPAIR_IN_PROGRESS or WAITING_FOR_PARTS

---

### 2.8 Resend Delivery OTP

**Trigger:** Customer didn't receive OTP; staff clicks "Resend OTP".

```
POST /api/jobs/jobs/{id}/resend_delivery_otp/

1. DB read: JobCard
2. Check: status != READY_FOR_DELIVERY → ⚠ 400

3. otp = random 6-digit string (new OTP replaces old)
4. DB write: JobCard.delivery_otp = otp                             jobs_jobcard

5. 🔔 NotificationService.send_delivery_otp(job)
   → DB write: NotificationLog
   → Celery: deliver_sms.delay / deliver_whatsapp.delay

Return 200: { message: "OTP resent." }
  (OTP masked as '******' for Receptionist/Technician roles;
   visible as plain text for Owner/Manager for manual sharing)
```

---

### 2.9 Deliver Device

**Trigger:** Customer presents OTP or signs digitally at counter.

**Pre-condition:** `job.status == READY_FOR_DELIVERY`.

```
POST /api/jobs/jobs/{id}/deliver/
  { otp: "483921", notes: "Customer collected." }
  — OR —
  multipart: { signature: <image file>, notes: "Signature collected." }

1. DB read: JobCard
2. Check: status != READY_FOR_DELIVERY → ⚠ 400

3. Validate with JobDeliverySerializer:
   — if otp provided: verify otp == job.delivery_otp → ⚠ 400 if mismatch
   — if signature provided: validate image file
   — if neither: ⚠ 400 (DeliveryRequirementError) "Provide OTP or signature"

─── BEGIN transaction.atomic() ───────────────────────────────────────────────
4. If signature file: DB write: JobCard.delivery_signature (ImageField)
5. DB write: JobCard                                                 jobs_jobcard
   { delivery_date=now(), delivered_by=request.user, updated_at=now() }
6. DB write: JobCard.status = DELIVERED
   DB write: JobStatusHistory                                        jobs_jobstatushistory
   { from=READY_FOR_DELIVERY, to=DELIVERED,
     notes="Device delivered to customer" }
─── END transaction.atomic() ─────────────────────────────────────────────────

7. 🔔 NotificationService.on_job_status_change(job, READY_FOR_DELIVERY, DELIVERED)
   → notification_type = JOB_DELIVERED
   → DB write: NotificationLog × channels
   → Celery tasks queued

Return 200: { message: "Device delivered successfully." }
```

**State change:** `READY_FOR_DELIVERY → DELIVERED` (terminal — job is now permanently read-only).

**Errors:**
- ⚠ 400 — OTP mismatch
- ⚠ 400 `delivery_requirement` — no OTP and no signature
- ⚠ 400 — wrong current status

---

### 2.10 Access Device Password

**Trigger:** Technician/Manager clicks "View Password" on job card.

```
POST /api/jobs/jobs/{id}/access_device_password/
  { reason: "Performing BIOS update — need password to bypass lock" }

1. Permission: role in [SUPER_ADMIN, OWNER, MANAGER, TECHNICIAN] → ⚠ 403 if not
2. DB read: JobCard
3. Validate: reason required (min length enforced)

4. 📋 DB write: DevicePasswordAccessLog (audit)                    audit_devicepasswordaccesslog
   { job, accessed_by=request.user, reason, accessed_at=now(),
     ip_address (from request), user_agent }

5. Decrypt: core.utils.decrypt_data(job._device_password) → plaintext
   Decrypt: core.utils.decrypt_data(job._bios_password) → plaintext

Return 200:
{ device_password: "MyPass@123",
  bios_password: "",
  warning: "This access has been logged." }
```

**Side effects:** Every access is permanently logged — `accessed_by`, `reason`, timestamp, IP. Cannot be deleted.

**Errors:**
- ⚠ 403 — Receptionist or Accountant role
- ⚠ 400 — reason not provided

---

### 2.11 Add Note to Job

**Trigger:** Any staff member adds a note on the job detail page.

```
POST /api/jobs/jobs/{id}/add_note/
  { note: "Customer called asking for status.", is_internal: true }

1. DB read: JobCard (branch access check)
2. DB write: JobNote                                                 jobs_jobnote
   { job, note, created_by=request.user, is_internal }

Return 201: serialized JobNote
```

`is_internal=True` → visible to staff only. `is_internal=False` → can be shown in customer-facing views.

---

### 2.12 Upload Job Photo

**Trigger:** Staff uploads intake/damage/repair/completion photos.

```
POST /api/jobs/jobs/{id}/add_photo/   [multipart/form-data]
  photo: <file>, photo_type: "INTAKE", description: "Front view of device"

1. DB read: JobCard
2. Validate: photo_type in [INTAKE, DAMAGE, REPAIR, COMPLETED]
3. File saved to: media/job_photos/{uuid}_{filename}
4. DB write: JobPhoto                                                jobs_jobphoto
   { job, photo=<path>, photo_type, description,
     uploaded_by=request.user }

Return 201: { id, photo_url, photo_type, description, uploaded_by_name }
```

---

### 2.13 Job Cancellation

**Trigger:** Manager/Owner cancels a job.

```
POST /api/jobs/jobs/{id}/update_status/
  { new_status: "CANCELLED", notes: "Customer decided not to repair." }

(Same flow as 2.6 — CANCELLED is a valid target from all non-terminal states)

State → CANCELLED (terminal — read-only)
```

**Note:** If parts were already deducted from inventory (via JobPartUsage), the Manager must manually add stock back using the inventory adjust flow. The system does not auto-reverse inventory on cancellation.

---

## 3. Pickup Request Lifecycle

### 3.1 Create Pickup Request

**Trigger:** Receptionist receives a call/walk-in from a customer requesting home pickup.

```
POST /api/jobs/pickups/
  { customer_id, device_type, brand, model_name, customer_complaint,
    pickup_address, pickup_date, pickup_time_slot, contact_number, is_urgent }

1. BranchScopedMixin resolves branch
2. DB read: Customer (branch access check)
3. DB read+LOCK: BranchSequence (kind='pickup' or separate counter)   core_branchsequence
   pickup_number = "PU/{FY}/{branch_code}/{seq:05d}"
4. DB write: PickupRequest                                            jobs_pickuprequest
   { branch, pickup_number, customer, device_type, brand, model_name,
     customer_complaint, pickup_address, pickup_date, pickup_time_slot,
     contact_number, is_urgent, status=REQUESTED, created_by=request.user }

Return 201: serialized PickupRequest
```

---

### 3.2 Full Pickup Status Flow

```
REQUESTED ──► ASSIGNED ──► EN_ROUTE ──► PICKED_UP ──► DELIVERED_TO_CENTER ──► COMPLETED
                                    └──► CANCELLED (from any non-terminal state)
```

Each step uses `POST /api/jobs/pickups/{id}/update_status/ { new_status, notes }`:

```
1. DB read: PickupRequest
2. Check: pickup.can_transition_to(new_status) per ALLOWED_PICKUP_TRANSITIONS
   → ⚠ 400 if invalid ("Allowed next statuses: [...]")
3. DB write: PickupRequest.status = new_status                      jobs_pickuprequest
4. If notes: PickupRequest.notes += "\n" + notes
5. DB write: PickupRequest.updated_at = now()

Return 200: serialized PickupRequest
```

---

### 3.3 Assign Technician to Pickup

**Trigger:** Manager assigns a technician to go collect the device.

```
POST /api/jobs/pickups/{id}/assign_technician/
  { technician_id: "uuid" }

1. DB read: PickupRequest
2. DB read: User WHERE pk=technician_id, role=TECHNICIAN, is_active=True → ⚠ 404 if not found
3. DB write: PickupRequest.assigned_technician = technician          jobs_pickuprequest
4. If pickup.status == REQUESTED:
   DB write: PickupRequest.status = ASSIGNED  (auto-transition)
5. DB write: PickupRequest.updated_at = now()

Return 200: serialized PickupRequest
```

---

### 3.4 Live Technician Tracking (during EN_ROUTE)

**Trigger:** Technician's browser/app sends location updates (background component).

```
POST /api/core/users/update_location/
  { latitude: 19.0760, longitude: 72.8777 }

DB write: User.last_latitude, User.last_longitude,
          User.last_location_updated = now()                        core_user

Customer (or Manager) can poll:
GET /api/jobs/pickups/{id}/track/
  → DB read: PickupRequest.assigned_technician
    → DB read: User.last_latitude, last_longitude, last_location_updated
  Return: { latitude, longitude, last_updated }
```

---

### 3.5 Convert Pickup to Job Card

**Trigger:** Device arrives at the service center; staff converts the pickup to a job card.

**Pre-condition:** `pickup.status in [DELIVERED_TO_CENTER, COMPLETED]`

```
POST /api/jobs/pickups/{id}/convert_to_job/

1. DB read: PickupRequest
2. Check: status not in [DELIVERED_TO_CENTER, COMPLETED] → ⚠ 400
3. Check: pickup.job already set → ⚠ 400 "Already converted to job {job_number}"

─── BEGIN transaction.atomic() ───────────────────────────────────────────────
4. DB read+LOCK: BranchSequence (kind='jobcard')                    core_branchsequence
   Generate job_number = "JC/{FY}/{code}/{seq:05d}"

5. DB write: JobCard                                                 jobs_jobcard
   { branch=pickup.branch, customer=pickup.customer,
     device_type=pickup.device_type, brand=pickup.brand or 'Unknown',
     model=pickup.model_name or 'Unknown',
     customer_complaint=pickup.customer_complaint,
     physical_condition='Received via pickup',
     is_urgent=pickup.is_urgent,
     received_by=request.user, status=RECEIVED }

6. DB write: JobStatusHistory (initial record)                       jobs_jobstatushistory
   { job=new_job, from_status=None, to_status=RECEIVED,
     changed_by=request.user,
     notes="Created from pickup request {pickup.pickup_number}" }

7. DB write: PickupRequest.job = new_job                            jobs_pickuprequest
8. If pickup.status == DELIVERED_TO_CENTER:
   DB write: PickupRequest.status = COMPLETED
9. DB write: PickupRequest.updated_at = now()
─── END transaction.atomic() ─────────────────────────────────────────────────

10. 🔔 NotificationService.on_job_created(job)  [customer notified of intake]
    → DB write: NotificationLog
    → Celery tasks queued

Return 201: { message, job_id, job_number, pickup_number }
```

**State changes:**
- `PickupRequest.job` set → `PickupRequest.status → COMPLETED`
- New `JobCard` created with `status=RECEIVED`

**Errors:**
- ⚠ 400 — pickup in wrong status
- ⚠ 400 — already converted

---

## 4. Part Request Lifecycle

### 4.1 Technician Requests a Part

```
POST /api/jobs/jobs/{id}/request_part/
  { part_name: "14-inch LCD Panel", quantity: 1, notes: "Check Samsung brand first" }

1. DB read: JobCard
2. Check: terminal + not Owner → ⚠ 400
3. DB write: PartRequest                                             jobs_partrequest
   { job, requested_by=request.user, part_name, quantity,
     notes, status=PENDING }

Return 201: serialized PartRequest
```

---

### 4.2 Manager Approves Part Request

```
POST /api/jobs/part-requests/{id}/approve/

1. Permission: role in [OWNER, MANAGER] → ⚠ 403 if not
2. DB read: PartRequest
3. DB write: PartRequest                                             jobs_partrequest
   { status=APPROVED, approved_by=request.user, approved_at=now() }

Return 200: { message: "Part request approved." }
```

**Note:** Approval does **not** automatically deduct inventory. The physical part must be issued separately via the inventory deduct flow (§6.2), which creates the `JobPartUsage` record linking it to the job.

---

### 4.3 Manager Rejects Part Request

```
POST /api/jobs/part-requests/{id}/reject/
  { rejection_reason: "Not available — use substitute part" }

1. Permission: role in [OWNER, MANAGER] → ⚠ 403 if not
2. rejection_reason required → ⚠ 400 if missing
3. DB write: PartRequest                                             jobs_partrequest
   { status=REJECTED, rejection_reason }

Return 200: { message }
```

---

## 5. Billing & Invoice Lifecycle

### 5.1 Create Invoice (Linked to Job)

**Trigger:** Accountant/Owner creates an invoice after repair completion.

```
POST /api/billing/invoices/
  { job_id: "uuid", due_date: "2025-05-16", notes: "...",
    line_items: [
      { item_type: "SERVICE", description: "LCD Replacement",
        quantity: 1, unit_price: "3813.56", gst_rate: "18.00",
        hsn_sac_code: "998719" },
      { item_type: "LABOUR", description: "Labour charges",
        quantity: 1, unit_price: "500.00", gst_rate: "18.00" }
    ] }

1. Permission: canCreateInvoices → ⚠ 403 if not
2. DB read: JobCard (to snapshot customer data)
3. DB read: Customer (name, mobile, email, address, gstin, state_code)
4. is_interstate = is_interstate_supply(branch.state_code, customer.state_code)

─── BEGIN transaction.atomic() ───────────────────────────────────────────────
5. DB read+LOCK: BranchSequence (kind='invoice')                    core_branchsequence
   invoice_number = "INV/{FY}/{branch_code}/{seq:05d}"

6. DB write: Invoice                                                 billing_invoice
   { branch, invoice_number, job, customer_name (snapshot),
     customer_mobile (snapshot), customer_email (snapshot),
     customer_address (snapshot), customer_gstin (snapshot),
     customer_state_code (snapshot), invoice_date=today,
     due_date, is_interstate, status=DRAFT, is_finalized=False,
     notes, created_by=request.user }

7. For each line_item:
   Compute GST (based on is_interstate and gst_rate):
   — Intrastate: cgst_rate = gst_rate/2, sgst_rate = gst_rate/2, igst_rate=0
   — Interstate: igst_rate = gst_rate, cgst_rate=0, sgst_rate=0
   amount = unit_price × quantity × (1 - discount_percent/100)
   cgst_amount = amount × cgst_rate/100
   sgst_amount = amount × sgst_rate/100
   igst_amount = amount × igst_rate/100

   DB write: InvoiceLineItem                                         billing_invoicelineitem
   { invoice, item_type, description, hsn_sac_code,
     quantity, unit_price, amount, gst_rate,
     cgst_rate, cgst_amount, sgst_rate, sgst_amount,
     igst_rate, igst_amount, discount_percent }

8. DB write: InvoiceEditHistory                                      billing_invoiceedithistory
   { invoice, edited_by=request.user, edit_type=CREATED,
     summary="Invoice created with {N} line items" }
─── END transaction.atomic() ─────────────────────────────────────────────────

Return 201: full Invoice object (status=DRAFT, is_finalized=False)
```

**Note:** Invoice is in DRAFT at this point — not finalized, no customer notification yet, no ledger entry yet.

---

### 5.2 Finalize Invoice

**Trigger:** Accountant clicks "Finalize" to lock the invoice and notify the customer.

**Pre-condition:** `invoice.is_finalized == False` AND at least one line item.

```
POST /api/billing/invoices/{id}/finalize/

1. DB read: Invoice + line_items
2. Check: is_finalized → ⚠ 400 "Invoice already finalized"
3. Check: line_items.count() == 0 → ⚠ 400 "Add at least one line item"

─── BEGIN transaction.atomic() ───────────────────────────────────────────────
4. Recalculate totals from DB (single aggregate query):
   subtotal = Sum(line_items.amount)
   cgst_total = Sum(line_items.cgst_amount)
   sgst_total = Sum(line_items.sgst_amount)
   igst_total = Sum(line_items.igst_amount)
   total_tax = cgst_total + sgst_total + igst_total
   total_amount = subtotal + total_tax - discount_amount

5. DB write: Invoice                                                 billing_invoice
   { subtotal, cgst_total, sgst_total, igst_total, total_tax, total_amount,
     is_finalized=True, finalized_at=now(), finalized_by=request.user,
     status=PENDING }

6. 📋 DB write: InvoiceEditHistory                                   billing_invoiceedithistory
   { edit_type=STATUS_CHANGED, summary="Invoice finalized by {user}" }

7. 📋 AuditLogService.log(action='INVOICE_FINALIZED', user, invoice)

8. Khata (customer ledger) entry:
   DB read: last CustomerLedgerEntry for customer → running_balance
   DB write: CustomerLedgerEntry                                     marketing_customerledgerentry
   { customer, entry_type=CREDIT, amount=invoice.balance_due,
     running_balance = old_balance + balance_due,
     reference_type='INVOICE', reference_id=invoice.id,
     description=f"Invoice {invoice_number}" }

9. 🔔 NotificationService.on_invoice_created(invoice)
   context = { customer_name, job_number, invoice_number, branch_name }
   → For each channel: DB write NotificationLog → Celery task queued
─── END transaction.atomic() ─────────────────────────────────────────────────

Return 200: { message, invoice_number, total_amount }
```

**State change:** `DRAFT → PENDING`. Invoice is now immutable.

**Errors:**
- ⚠ 400 — already finalized
- ⚠ 400 — no line items

---

### 5.3 Record Payment

**Trigger:** Customer pays (cash/UPI/card/etc.). Accountant records the payment.

```
POST /api/billing/invoices/{id}/record_payment/
  { amount: "4500.00", payment_method: "UPI",
    reference: "UPI-TXN-20250509-001", notes: "PhonePe" }

1. Permission: canCreateInvoices → ⚠ 403 if not
2. DB read: Invoice
3. Validate: amount > 0 → ⚠ 400 if not
4. Validate: invoice.status != CANCELLED → ⚠ 400 if cancelled
5. Validate: amount <= invoice.balance_due (serializer validates)

─── BEGIN transaction.atomic() ───────────────────────────────────────────────
6. DB write: Payment                                                 billing_payment
   { invoice, amount, payment_method, payment_date=now(),
     reference, notes, received_by=request.user, is_verified=True }

7. invoice.paid_amount += amount
8. invoice._update_payment_status():
   — If balance_due <= 0: status = PAID
   — Elif paid_amount > 0: status = PARTIAL
   — Else: status = PENDING
9. DB write: Invoice (update_fields=['paid_amount', 'status', 'updated_at']) billing_invoice

10. 📋 AuditLogService.log(action='PAYMENT_RECORDED', user, invoice, payment)

11. Khata DEBIT entry (customer's outstanding decreases):
    DB read: last CustomerLedgerEntry → running_balance
    DB write: CustomerLedgerEntry                                    marketing_customerledgerentry
    { entry_type=DEBIT, amount=payment.amount,
      running_balance = old_balance - payment.amount,
      reference_type='PAYMENT', reference_id=payment.id }
─── END transaction.atomic() ─────────────────────────────────────────────────

12. 🔔 NotificationService.on_payment_received(invoice, payment)
    context = { customer_name, invoice_number, amount, branch_name }
    → Celery tasks queued

Return 200: { message, payment: {...}, balance_due, status }
```

**Status transitions after payment:**
- `PENDING → PARTIAL` (partial payment)
- `PARTIAL → PAID` (balance settled)
- `PENDING → PAID` (full payment in one shot)

**Errors:**
- ⚠ 400 — amount exceeds balance_due
- ⚠ 400 — invoice is CANCELLED

---

### 5.4 Cancel Invoice

**Trigger:** Manager/Owner cancels a draft/pending invoice (no payments yet).

**Pre-condition:** `invoice.paid_amount == 0`.

```
POST /api/billing/invoices/{id}/cancel/
  { reason: "Customer cancelled repair." }

1. Permission: IsOwnerOrManager → ⚠ 403 if not
2. DB read: Invoice + line_items
3. Check: paid_amount > 0 → ⚠ 400 "Cannot cancel a partially paid invoice. Issue a credit note."
4. reason required → ⚠ 400 if missing

─── BEGIN transaction.atomic() ───────────────────────────────────────────────
5. For each line_item WHERE inventory_item IS NOT NULL AND job_part_usage IS NULL:
   (Restore stock for items that were directly added to invoice, not via job parts)
   inventory_item.add_stock(quantity=item.quantity,
     reason=f"Invoice {invoice_number} cancelled",
     user=request.user)
   → DB write: InventoryItem.quantity ++                            inventory_inventoryitem
   → DB write: InventoryAdjustment (type=ADD)                       inventory_inventoryadjustment

6. DB write: Invoice                                                 billing_invoice
   { status=CANCELLED,
     notes = invoice.notes + "\n\nCANCELLED: {reason}" }

7. 📋 DB write: InvoiceEditHistory                                   billing_invoiceedithistory
   { edit_type=CANCELLED, summary="Invoice cancelled: {reason}" }

8. 📋 AuditLogService.log(action='INVOICE_CANCELLED', user, invoice)
─── END transaction.atomic() ─────────────────────────────────────────────────

Return 200: { message: "Invoice cancelled." }
```

**Note:** Hard deletion is **not allowed** (GST 8-year retention). Status is permanently set to CANCELLED.

**Errors:**
- ⚠ 400 — invoice has payments (use credit note instead)
- ⚠ 400 — no cancellation reason

---

### 5.5 Add / Remove Line Item (Pre-finalization)

```
POST /api/billing/invoices/{id}/add_line_item/
  { item_type, description, quantity, unit_price, gst_rate, hsn_sac_code }

1. Check: invoice.is_finalized → ⚠ 400 "Cannot edit a finalized invoice"
2. Compute GST (same logic as §5.1 step 7)
3. DB write: InvoiceLineItem                                         billing_invoicelineitem
4. DB write: InvoiceEditHistory { edit_type=LINE_ITEM_ADDED }
Return 201: serialized InvoiceLineItem

────────────────────────────────────────────────────────────────────────

DELETE /api/billing/invoices/{id}/line-items/{item_id}/

1. Check: invoice.is_finalized → ⚠ 400
2. If item.inventory_item AND NOT item.job_part_usage:
   inventory_item.add_stock(quantity, reason="Line item removed")
   → DB write: InventoryItem.quantity                               inventory_inventoryitem
   → DB write: InventoryAdjustment                                   inventory_inventoryadjustment
3. DB delete: InvoiceLineItem
4. invoice.calculate_totals() → re-aggregate + DB write: Invoice totals
5. DB write: InvoiceEditHistory { edit_type=LINE_ITEM_REMOVED }
Return 200: { message }
```

---

### 5.6 Invoice PDF Download

```
GET /api/billing/invoices/{id}/download_pdf/

1. DB read: Invoice + line_items + payments
2. Generate PDF:
   — Header: org logo, legal_name, branch address, GSTIN
   — Customer details (snapshot from invoice fields)
   — Line items table with HSN/SAC codes
   — GST breakdown (CGST/SGST or IGST)
   — Payment status and balance due
   — Terms and conditions
   — Authorized signatory
3. Return HTTP response: Content-Type=application/pdf
   Content-Disposition: attachment; filename="{invoice_number}.pdf"

POST /api/billing/invoices/{id}/log_download/  (called by frontend after download)
   DB write: InvoiceEditHistory { edit_type=DOWNLOADED,
             summary="Invoice PDF downloaded by {user}" }
```

---

## 6. Inventory Stock Flows

### 6.1 Add Stock (Purchase Received)

**Trigger:** Staff adds stock when a purchase delivery is received.

```
POST /api/inventory/items/{id}/add_stock/
  { quantity: 10, reason: "New stock from Tech Parts India — Invoice TPI/001" }

1. Permission: canManageInventory → ⚠ 403 if not
2. DB read: InventoryItem

─── BEGIN transaction.atomic() ───────────────────────────────────────────────
3. DB read+LOCK: InventoryItem (select_for_update())               inventory_inventoryitem
   (prevents concurrent double-additions)
4. old_quantity = item.quantity
5. DB write: InventoryItem.quantity += quantity                     inventory_inventoryitem
   DB write: InventoryItem.updated_at = now()

6. DB write: InventoryAdjustment (immutable audit)                  inventory_inventoryadjustment
   { item, adjustment_type=ADD, quantity,
     old_quantity, new_quantity, reason,
     adjusted_by=request.user, is_manual_adjustment=False }
─── END transaction.atomic() ─────────────────────────────────────────────────

Return 200: { message, new_quantity: X }
```

---

### 6.2 Deduct Stock (Linked to Job)

**Trigger:** Technician uses a part for a repair; Manager links it to the job.

```
POST /api/inventory/items/{id}/deduct_stock/
  { quantity: 1, reason: "Used for JC/2425/MUM/00089", job_id: "uuid" }

1. Permission: canManageInventory → ⚠ 403 if not
2. DB read: InventoryItem
3. DB read: JobCard (if job_id provided)

─── BEGIN transaction.atomic() ───────────────────────────────────────────────
4. DB read+LOCK: InventoryItem (select_for_update())
5. Re-check quantity (post-lock): if item.quantity < requested → ⚠ 400 InsufficientInventory
   "Requested: {qty}, Available: {item.quantity}"
6. old_quantity = item.quantity
7. DB write: InventoryItem.quantity -= quantity                     inventory_inventoryitem

8. DB write: InventoryAdjustment                                     inventory_inventoryadjustment
   { adjustment_type=DEDUCT, quantity,
     old_quantity, new_quantity=old_quantity - quantity,
     reason, adjusted_by=request.user }

9. If job provided:
   DB write: JobPartUsage                                            inventory_jobpartusage
   { job, inventory_item, quantity,
     unit_price=item.cost_price, total_price=quantity × cost_price,
     adjustment=above_adjustment, notes=reason }

10. if item.is_low_stock (quantity <= low_stock_threshold):
    🔔 Alert: NotificationService.send_low_stock_alert(item)
    DB write: InternalAlert                                          notifications_internalalert
    { alert_type=LOW_STOCK, priority=HIGH,
      message="Low stock: {name} (Current: {qty}, Threshold: {threshold})" }
    DB write: NotificationLog (type=LOW_STOCK_ALERT, channel=INTERNAL)
─── END transaction.atomic() ─────────────────────────────────────────────────

Return 200: { message, new_quantity }
```

**Errors:**
- ⚠ 400 `insufficient_inventory` — not enough stock

---

### 6.3 Manual Stock Adjustment (Physical Count Correction)

**Trigger:** Owner/Manager corrects stock after a physical inventory count.

```
POST /api/inventory/items/{id}/adjust_stock/
  { new_quantity: 8, reason: "Physical count — 2 units found damaged" }

1. Permission: IsOwnerOrManager → ⚠ 403 if not
2. DB read: InventoryItem

─── BEGIN transaction.atomic() ───────────────────────────────────────────────
3. DB read+LOCK: InventoryItem (select_for_update())
4. old_quantity = item.quantity
5. quantity_diff = new_quantity - old_quantity
6. DB write: InventoryItem.quantity = new_quantity                  inventory_inventoryitem

7. DB write: InventoryAdjustment                                     inventory_inventoryadjustment
   { adjustment_type = MANUAL (if diff ≥ 0) or CORRECTION (if diff < 0),
     quantity=abs(quantity_diff), old_quantity, new_quantity=new_quantity,
     reason, adjusted_by=request.user, is_manual_adjustment=True }
─── END transaction.atomic() ─────────────────────────────────────────────────

8. 📋 AuditLogService.log(action='MANUAL_STOCK_ADJUSTMENT',
   details={ item_name, old_quantity, new_quantity, reason }, user)

Return 200: { old_quantity, new_quantity }
```

---

### 6.4 Low Stock Alert Flow

```
Triggered by: deduct_stock() when item.quantity <= low_stock_threshold

NotificationService.send_low_stock_alert(item):
  DB write: InternalAlert
  { branch=item.branch, alert_type=LOW_STOCK, priority=HIGH,
    message="Low stock alert: {name} (Current: {qty}, Threshold: {threshold})" }

  DB write: NotificationLog
  { notification_type=LOW_STOCK_ALERT, channel=INTERNAL,
    status=SENT (immediate — no async needed for internal) }

Frontend: Bell icon badge count increments
         Alert appears in the notifications dropdown
         Highlighted in orange on the Inventory page
```

---

## 7. Purchase & Accounts Payable

### 7.1 Create Purchase

**Trigger:** Manager/Accountant records a stock purchase from a vendor.

```
POST /api/inventory/purchases/
  { vendor_name, vendor_gstin, invoice_number, purchase_date, notes,
    items: [{ inventory_item: "uuid", quantity: 10, unit_price: "2800.00", gst_rate: "18.00" }] }

─── BEGIN transaction.atomic() ───────────────────────────────────────────────
1. DB write: Purchase                                                inventory_purchase
   { branch, vendor_name, vendor_gstin, invoice_number, purchase_date,
     status=PENDING, paid_amount=0, notes }

2. For each item:
   taxable_amount = quantity × unit_price
   cgst_amount = taxable_amount × (gst_rate/2) / 100
   sgst_amount = taxable_amount × (gst_rate/2) / 100
   total_price = taxable_amount + cgst_amount + sgst_amount

   DB write: PurchaseItem                                            inventory_purchaseitem
   { purchase, inventory_item, quantity, unit_price, total_price,
     gst_rate, taxable_amount, cgst_amount, sgst_amount }

3. purchase.calculate_gst_totals():
   taxable_amount = Sum(items.taxable_amount)
   cgst_amount = Sum(items.cgst_amount)
   sgst_amount = Sum(items.sgst_amount)
   total_gst = cgst_amount + sgst_amount
   total_amount = taxable_amount + total_gst
   DB write: Purchase (totals)
─── END transaction.atomic() ─────────────────────────────────────────────────

NOTE: Stock is NOT added automatically on purchase creation.
      Staff must separately call add_stock() per item after physical receipt.
      (The purchase records the financial liability; add_stock records the physical receipt.)

Return 201: serialized Purchase
```

---

### 7.2 Record Purchase Payment (Accounts Payable)

```
POST /api/inventory/purchases/{id}/record_payment/
  { amount: "28000.00", payment_method: "NEFT", notes: "Bank transfer to TPI" }

─── BEGIN transaction.atomic() ───────────────────────────────────────────────
1. DB write: PurchasePayment                                         inventory_purchasepayment
   { purchase, amount, payment_method, notes, paid_by=request.user }

2. purchase.paid_amount += amount
3. purchase._update_payment_status():
   — paid_amount >= total_amount: status = PAID
   — paid_amount > 0: status = PARTIAL
   — else: status = PENDING
4. DB write: Purchase (paid_amount, status)
─── END transaction.atomic() ─────────────────────────────────────────────────

Return 200: { message, paid_amount, balance_due, status }
```

---

### 7.3 Excel Import (Bulk Purchase)

**Trigger:** Staff uploads an Excel file with multiple inventory items from a vendor invoice.

```
POST /api/inventory/purchases/import_excel/  [multipart/form-data]
  { file: .xlsx, vendor_name, invoice_number, purchase_date,
    paid_amount (optional), payment_method (optional) }

1. Parse Excel file (openpyxl):
   Expected columns: [Item Name/SKU, Quantity, Unit Price, GST Rate]
2. For each row:
   DB read: InventoryItem WHERE sku=row_sku OR name=row_name (fuzzy match)
   If not found: ⚠ 400 "Item '{name}' not found in inventory"

3. Create Purchase + PurchaseItems (same as §7.1)

4. If paid_amount provided:
   Create PurchasePayment (same as §7.2)

Return 200: { message, purchase_id, total_amount }
```

---

## 8. Customer Management

### 8.1 Search Customer by Mobile

**Trigger:** Staff types mobile number in job creation form — real-time search.

```
GET /api/customers/customers/search_by_mobile/?mobile=9876543210

1. DB read: Customer WHERE mobile LIKE %9876543210%, branch accessible
   (icontains search on mobile field, scoped to branch)

Return 200: Array of Customer objects (may be empty)
```

If empty, staff clicks "Create Customer" → flow §8.2.

---

### 8.2 Create Customer

```
POST /api/customers/customers/
  { first_name, last_name, mobile, email, city, state, state_code }

1. Permission: role in [OWNER, MANAGER, RECEPTIONIST] → ⚠ 403 if not
2. Validate: mobile is unique within branch
   DB read: Customer WHERE branch=X AND mobile=Y
   → ⚠ 400 "Customer with this mobile already exists in this branch" (unique_together)
3. DB write: Customer                                                 customers_customer
   { branch, first_name, last_name, mobile, email, city, state,
     state_code, sms_enabled=True, whatsapp_enabled=True, is_active=True }

Return 201: serialized Customer
```

---

### 8.3 Customer Service History

```
GET /api/customers/customers/{id}/service_history/

1. DB read: Customer
2. DB read: JobCard WHERE customer=X ORDER BY -created_at
   (branch-scoped — only shows jobs from branches the requesting user can access)

Return 200: Array of JobCard objects (lightweight serializer)
```

---

## 9. Notification Dispatch Pipeline

This is the full internal flow for every notification sent by the system.

### 9.1 Dispatch Decision

```
NotificationService._send_customer_notification(job, notification_type, context, ...)

Step 1: Determine channels to try
  channels = []
  if branch.whatsapp_enabled AND customer.whatsapp_enabled:
      channels.append(WHATSAPP)
  if branch.sms_enabled AND customer.sms_enabled:
      channels.append(SMS)
  if customer.email:
      channels.append(EMAIL)

Step 2: For each channel:
  DB read: NotificationTemplate WHERE
    channel=channel AND notification_type=notification_type
    AND branch=branch AND is_active=True
  → If found: message = template.render(context)
  → If not found: message = _get_default_message(notification_type, context)

  DB write: NotificationLog                                          notifications_notificationlog
  { branch, notification_type, channel, status=PENDING,
    recipient_name=customer.name, recipient_mobile=customer.mobile,
    message, job, invoice (if applicable) }

  Queue async Celery task:
    deliver_whatsapp.delay(log.id)  OR
    deliver_sms.delay(log.id)       OR
    deliver_email.delay(log.id, email, subject, html)

  If WhatsApp task sent: remove SMS from remaining channels
  (avoids duplicate mobile notifications — prefer WhatsApp over SMS)
  EMAIL always sent regardless of SMS/WhatsApp outcome
```

---

### 9.2 SMS Delivery (TextBee)

```
Celery task: deliver_sms(self, log_id)

1. DB read: NotificationLog WHERE id=log_id, status=PENDING
2. Check status == PENDING (idempotency guard — skip if already sent)

3. Call NotificationService._send_sms(mobile, message, log):
   HTTP POST → https://api.textbee.dev/api/v1/gateway/devices/{device_id}/send-sms
   Headers: { x-api-key: TEXTBEE_API_KEY }
   Payload: { recipients: ["+91{mobile}"], message: message }

   On 200 OK:
     DB write: NotificationLog.status = SENT                        notifications_notificationlog
     DB write: NotificationLog.provider_response = { provider: 'textbee', response }

   On timeout (requests.Timeout):
     DB write: NotificationLog.status = FAILED
     DB write: NotificationLog.error_message = "TextBee API request timed out"
     raise exception → Celery retries (max 3, delay 60s)

   On HTTP error (4xx/5xx):
     DB write: NotificationLog.status = FAILED
     DB write: NotificationLog.error_message = "TextBee API error: {status} {text}"
     raise exception → Celery retries

   On missing credentials:
     log.warning("TextBee not configured")
     DB write: NotificationLog.status = FAILED
     (no retry — misconfiguration, not transient)
```

---

### 9.3 WhatsApp Delivery (Cloud API)

```
Celery task: deliver_whatsapp(self, log_id)

1. DB read: NotificationLog
2. Determine provider from settings.WHATSAPP_PROVIDER ('cloud' or 'twilio')

IF 'cloud':
  HTTP POST → https://graph.facebook.com/v21.0/{phone_number_id}/messages
  Auth: Bearer {WHATSAPP_CLOUD_TOKEN}
  Payload: { messaging_product: "whatsapp", to: "+91{mobile}",
             type: "text", text: { body: message } }

  On 200 OK: extract message_id from response
    DB write: NotificationLog.status = SENT
    DB write: NotificationLog.provider_response = { provider: 'wa_cloud', id: msg_id }

  On error: mark FAILED, raise for retry (max 3)

IF 'twilio':
  twilio.Client.messages.create(
    to="whatsapp:+91{mobile}", from_="whatsapp:{from_number}", body=message)
  DB write: NotificationLog.status = SENT
  provider_response = { provider: 'twilio', status, sid }
```

---

### 9.4 Email Delivery (Django SMTP)

```
Celery task: deliver_email(self, log_id, email_address, subject, html_message=None)

1. DB read: NotificationLog
2. Build email: EmailMultiAlternatives(subject, message, from, [email_address])
3. If html_message: attach_alternative(html_message, 'text/html')
4. If invoice in context: generate PDF → attach as "{invoice_number}.pdf"
5. If job_pdf provided: attach with job_pdf_filename
6. email.send(fail_silently=False)

On success:
  DB write: NotificationLog.status = SENT
  provider_response = { provider: 'django_smtp', status: 'sent' }

On SMTPException:
  DB write: NotificationLog.status = FAILED
  error_message = str(e)
  raise → retry (max 3)

On missing EMAIL_HOST_USER:
  log.warning("Email not configured")
  DB write: NotificationLog.status = FAILED
  (no retry)
```

---

## 10. User & Access Management

### 10.1 Create Staff User

```
POST /api/core/users/
  { email, first_name, last_name, phone, role, password }

1. Permission: canManageUsers → ⚠ 403 if not
2. Validate: email unique globally → ⚠ 400 if duplicate
3. Validate: password meets Django validators
4. DB write: User                                                     core_user
   { email, first_name, last_name, phone, role,
     organization=request.user.organization,
     is_active=True, password=hashed }

Note: User has no branch access until explicitly assigned.
Return 201: serialized User
```

---

### 10.2 Assign User to Branches

```
POST /api/core/users/{id}/assign_branches/
  { branch_ids: ["uuid1", "uuid2"] }

1. Permission: IsOwner → ⚠ 403 if not
2. DB read: Branch WHERE pk IN [uuid1, uuid2]
   AND organization=request.user.organization
   Count must match len(branch_ids) → ⚠ 400 if mismatch ("One or more branches not found")
3. DB write: User.branches = [branch1, branch2]  (ManyToMany — replaces all)  core_user_branches

Return 200: { message, branch_count: 2 }
```

---

### 10.3 Change Role Permissions (Permission Matrix Edit)

```
Django Admin: /admin/core/rolepermission/
  → Admin selects role → toggles checkboxes → clicks Save

1. DB write: RolePermission (UPDATE)                                 core_rolepermission
   { can_view_billing=True, can_create_invoices=False, ... }

2. RolePermission.save() signal:
   🗄 Cache: cache.delete('role_perms_{role}')                      Redis
   (5-minute TTL on stale cache still allows in-flight requests; next request gets fresh data)

Effective: Next API request by a user with this role re-reads from DB
           and re-caches for 300s.
```

---

## 11. Enquiry / Lead Management

### 11.1 Create Enquiry

```
POST /api/enquiries/enquiries/
  { customer_name, customer_mobile, device_type, brand, model_name,
    problem_description, source, quoted_price, follow_up_date }

1. DB write: Enquiry                                                  enquiries_enquiry
   { branch, customer_name, customer_mobile, device_type, brand, model_name,
     problem_description, source, status=NEW,
     quoted_price (optional), follow_up_date (optional),
     assigned_to=request.user }

Return 201: serialized Enquiry
```

---

### 11.2 Enquiry Status Progression

```
PATCH /api/enquiries/enquiries/{id}/
  { status: "CONTACTED" }  or  { status: "QUOTED", quoted_price: "5000.00" }
  or  { status: "FOLLOW_UP", follow_up_date: "2025-05-14" }

Statuses: NEW → CONTACTED → FOLLOW_UP → INTERESTED → QUOTED → CONVERTED / LOST / CLOSED
(no enforced transition map — any status can be set)

DB write: Enquiry.status (+ relevant fields)
```

---

### 11.3 Convert Enquiry to Job Card

**Trigger:** Customer agrees to repair; staff converts lead to a job.

```
POST /api/enquiries/enquiries/{id}/convert_to_job/

1. DB read: Enquiry
2. Check: enquiry.converted_job is None → ⚠ 400 "Already converted to {job_number}"

─── BEGIN transaction.atomic() ───────────────────────────────────────────────
3. If enquiry.customer:
   customer = enquiry.customer
   Else (enquiry had no linked customer):
   DB write: Customer                                                 customers_customer
   { branch, first_name=enquiry.customer_name, mobile=enquiry.customer_mobile,
     email=enquiry.customer_email }

4. DB read+LOCK: BranchSequence (kind='jobcard')                    core_branchsequence
5. DB write: JobCard (same as §2.1 steps 5–8)                      jobs_jobcard
   { customer, device_type, brand=enquiry.brand, model=enquiry.model_name,
     customer_complaint=enquiry.problem_description,
     status=RECEIVED, received_by=request.user }
6. DB write: JobStatusHistory (initial)

7. DB write: Enquiry                                                  enquiries_enquiry
   { status=CONVERTED, converted_job=new_job }
─── END transaction.atomic() ─────────────────────────────────────────────────

8. 🔔 NotificationService.on_job_created(job)

Return 201: { message, job_id, job_number, customer_id }
```

---

### 11.4 Mark Enquiry as Lost

```
POST /api/enquiries/enquiries/{id}/mark_lost/
  { loss_reason: "Customer went to another shop" }

DB write: Enquiry { status=LOST, loss_reason }
Return 200: { message }
```

---

## 12. GST Reporting Flows

### 12.1 GSTR-1 Data Generation

```
GET /api/gst/gstr1_data/?from_date=2025-04-01&to_date=2025-04-30

1. DB read: Invoice WHERE
   branch accessible, is_finalized=True, status != CANCELLED,
   invoice_date BETWEEN from_date AND to_date

2. Classify each invoice:
   — B2B: customer_gstin IS NOT NULL AND != ''
   — B2C Large: total_amount > 250000 AND no GSTIN
   — B2C Small: total_amount <= 250000 AND no GSTIN

3. For B2B invoices: group by customer GSTIN → invoice list
4. For B2C Large: list individually
5. For B2C Small: aggregate by state + rate

6. Aggregate totals:
   total_taxable = Sum(subtotal)
   total_cgst = Sum(cgst_total)
   total_sgst = Sum(sgst_total)
   total_igst = Sum(igst_total)

Return 200: { b2b: [...], b2c_large: [...], b2c_small: [...], totals: {...} }
```

---

### 12.2 GSTR-1 JSON Download (for GST Portal)

```
GET /api/gst/gstr1_json/?from_date=...&to_date=...

1. Generate GSTR-1 data (same as §12.1)
2. Format as GST portal JSON schema:
   { gstin, fp: "042025", version: "GST3.0.4",
     b2b: [{ ctin, inv: [{ inum, idt, val, pos, rchrg, itms }] }],
     b2cs: [{ pos, typ, sgst, cgst, rt, txval }] }
3. Return: Content-Type=application/json
   Content-Disposition: attachment; filename="GSTR1_{gstin}_{period}.json"
```

---

### 12.3 Mark Return as Filed

```
POST /api/gst/mark_filed/
  { period_month: "2025-04", return_type: "gstr1" }

DB write: GSTReturn                                                   gst_gstreturn
{ branch, period_month, return_type, filed_at=now(), filed_by=request.user }

Return 200: { message: "GSTR-1 for April 2025 marked as filed." }
```

---

### 12.4 ITC Register

```
GET /api/gst/itc_register/?from_date=...&to_date=...

1. DB read: PurchaseItem + Purchase WHERE
   branch accessible, purchase_date BETWEEN range,
   purchase.status != CANCELLED
   JOIN: Purchase.vendor_gstin (only GST-registered vendors eligible for ITC)

2. Aggregate per purchase:
   taxable_amount, cgst_amount, sgst_amount, total_gst

Return 200: { items: [...], totals: { taxable, cgst, sgst, total_itc } }
```

---

## 13. Reports & Exports

### 13.1 Revenue Report

```
GET /api/reports/revenue/?from_date=2025-04-01&to_date=2025-04-30

DB aggregate query on Invoice WHERE:
  branch accessible, is_finalized=True, status != CANCELLED,
  invoice_date BETWEEN range

Aggregations:
  total_revenue = Sum(total_amount)
  total_invoices = Count(id)
  cgst_collected = Sum(cgst_total)
  sgst_collected = Sum(sgst_total)
  igst_collected = Sum(igst_total)

  By line item type:
  total_services = Sum(line_items.amount WHERE item_type=SERVICE)
  total_parts = Sum(line_items.amount WHERE item_type=PART)

  Daily breakdown (optional):
  GROUP BY invoice_date → [{ date, revenue, invoices }]

Return 200: revenue report object
```

---

### 13.2 Excel Export

```
GET /api/reports/export_excel/?report_type=revenue&from_date=...&to_date=...

1. Generate report data (same queries as corresponding API)
2. Build Excel workbook (openpyxl):
   Sheet 1: Summary
   Sheet 2: Detail rows
   Sheet 3: GST breakdown
3. DB write: ExportLog (audit)                                       audit_exportlog
   { user, report_type, exported_at=now(), row_count }
4. Return: Content-Type=application/vnd.openxmlformats...
   Content-Disposition: attachment; filename="{report}_{date}.xlsx"
```

---

## 14. Error Flows

### 14.1 Insufficient Stock on Deduction

```
Attempt: deduct_stock(quantity=5) when item.quantity=3

1. select_for_update() locks row
2. Re-check post-lock: 3 < 5
3. Raise InsufficientInventory("Requested: 5, Available: 3")
4. Transaction rolls back (no DB change)
5. 400 response: { error: { code: "insufficient_inventory",
                             message: "Requested: 5, Available: 3" } }
```

---

### 14.2 Invalid Status Transition

```
Attempt: update_status(job_id, new_status="DELIVERED")
When: job.status = "DIAGNOSIS"

1. ALLOWED_STATUS_TRANSITIONS["DIAGNOSIS"] = ["ESTIMATE_SHARED", "CANCELLED"]
2. "DELIVERED" not in allowed → Raise InvalidStatusTransition
3. 400 response: { error: { code: "invalid_status_transition",
                             message: "Cannot transition from DIAGNOSIS to DELIVERED.
                                       Allowed: ESTIMATE_SHARED, CANCELLED" } }
```

---

### 14.3 Protected Delete (FK Constraint)

```
Attempt: DELETE /api/jobs/jobs/{id}/ on a job with linked invoices

perform_destroy():
  instance.delete()
  → PostgreSQL raises IntegrityError (FK PROTECT on Invoice.job)
  → Django raises ProtectedError
  → Caught: raise ProtectedResourceError(
              "Cannot delete job: it has linked invoices. Cancel the job instead.")
  → 409 response: { error: { code: "protected_resource",
                               message: "Cannot delete job: ..." } }
```

---

### 14.4 Notification Delivery Failure & Retry

```
Celery task deliver_sms(log_id) → TextBee API timeout

1. Task raises exception
2. Celery retries after 60 seconds (attempt 2/3)
3. On 3rd failure:
   DB write: NotificationLog.status = FAILED                        notifications_notificationlog
   DB write: NotificationLog.error_message = "TextBee timeout after 3 retries"
4. Task marked as failed in Celery result backend

Staff can view failed notifications at:
GET /api/notifications/logs/?status=FAILED
And resend individually from the Notifications admin panel.
```

---

### 14.5 Stale Permission Cache

```
Scenario: Owner changes MANAGER permissions in Django Admin.
           Manager is mid-session with cached permissions.

1. RolePermission.save() fires
2. cache.delete('scm:1:role_perms_MANAGER')    ← Redis key deleted
3. Next API request from Manager:
   DRF permission class calls get_permissions_for_role('MANAGER')
   → cache.get('scm:1:role_perms_MANAGER') → cache miss
   → DB read: RolePermission WHERE role='MANAGER'
   → cache.set('scm:1:role_perms_MANAGER', fresh_dict, timeout=300)
4. Manager's next request uses updated permissions (within 1 request)
   (In-flight requests from before the save complete with old permissions —
    max 5-minute window of stale access.)
```

---

## Cross-Flow Reference

| Event | Triggers |
|-------|---------|
| Job created | Customer SMS/WA/Email (on_job_created) |
| Status → DIAGNOSIS | Customer SMS/WA/Email |
| Status → ESTIMATE_SHARED | Customer SMS/WA/Email with amount (send_estimate) |
| Status → READY_FOR_DELIVERY | OTP generated + sent to customer (send_delivery_otp) |
| Status → DELIVERED | Customer SMS/WA/Email (on_job_status_change → JOB_DELIVERED) |
| Technician assigned | InternalAlert to technician |
| Invoice finalized | Customer SMS/WA/Email + Khata CREDIT entry |
| Payment recorded | Customer SMS/WA/Email (on_payment_received) + Khata DEBIT entry |
| Stock deducted below threshold | InternalAlert (LOW_STOCK, HIGH priority) to Manager/Owner |
| Device password accessed | DevicePasswordAccessLog (permanent, cannot be deleted) |
| Pickup converted to job | Customer SMS/WA/Email (on_job_created) |
| Enquiry converted to job | Customer SMS/WA/Email (on_job_created) |
