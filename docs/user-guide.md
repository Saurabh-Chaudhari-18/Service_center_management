# User Guide

This guide explains the system features from the perspective of each staff role.

---

## Getting Started (All Roles)

### Logging in
1. Open the app in your browser (e.g., `http://localhost:3000`)
2. Enter your email address and password
3. You are taken to the Dashboard

### Switching branches (multi-location businesses)
If you are assigned to multiple branches:
1. Click the branch name shown in the top navigation bar
2. Select the branch you want to work in
3. All pages now show data for that branch only

### Dark mode
Click the sun/moon icon in the top navigation bar to toggle dark/light mode.

---

## Role: Receptionist

The Receptionist is responsible for device intake, customer registration, and pickup coordination.

### Creating a new customer
1. Go to **Customers** → **New Customer**
2. Fill in:
   - First Name, Last Name (required)
   - Mobile number (required — must be unique per branch)
   - Email, address (optional)
   - GST number, Company name (for B2B customers)
3. Click **Save**

> The mobile number is the primary identifier. If the customer already exists, the system will show a match when you type the number.

### Creating a job card (device intake)
1. Go to **Jobs** → **New Job**
2. **Search for the customer** by typing their mobile number
   - If found: select from dropdown
   - If new: click "Create customer" to register them first
3. Fill in device details:
   - Device type (Laptop, Desktop, Printer, etc.)
   - Brand and model
   - Serial number (optional)
4. Enter the **Customer's complaint** in their own words
5. Select the **Physical condition** (checkboxes — scratches, dents, etc.)
6. Note accessories received (charger, bag, mouse, etc.)
7. Enter the device password if provided (stored encrypted)
8. Mark **Urgent** if customer needs it back quickly
9. Click **Create Job Card**

A job number is auto-generated (e.g., `JC/2425/MUM/00089`). Share this with the customer for tracking.

### Creating a pickup request
1. Go to **Pickups** → **New Pickup**
2. Select/create the customer
3. Fill in device details and the customer's address
4. Set pickup date and preferred time slot
5. Click **Create Pickup**

A manager or owner will then assign a technician to the pickup.

### Tracking pickups
- Go to **Pickups** to see all pending pickups
- Each pickup shows current status, assigned technician, and pickup date
- Click a pickup to see full details and update the status

---

## Role: Technician

The Technician handles diagnosis, repair, and delivery.

### Viewing assigned jobs
- Go to **My Jobs** to see jobs assigned to you (excludes delivered/cancelled)
- Jobs marked 🔴 are **urgent**
- Click any job to open the full detail page

### Adding a diagnosis
1. Open a job card (status: RECEIVED or DIAGNOSIS)
2. Click **Add Diagnosis**
3. Fill in:
   - Diagnosis notes (what you found)
   - Estimated cost (optional)
   - Estimated completion date
   - Parts needed (name, price, quantity, warranty months)
4. Click **Save**

The job automatically moves to **DIAGNOSIS** status. Parts are listed as a cost estimate for the customer.

### Requesting parts from inventory
1. Open the job card
2. Scroll to **Part Requests**
3. Click **Request Part**
4. Enter part name, quantity, and notes
5. The manager or owner will approve the request

When approved, the part is automatically deducted from inventory stock.

### Updating job status
1. Open the job card
2. Click the status badge or **Update Status** button
3. Select the new status from the dropdown
4. Add notes (required for some transitions)

Allowed transitions:
```
RECEIVED → DIAGNOSIS → ESTIMATE_SHARED → APPROVED → WAITING_FOR_PARTS
                                                   → REPAIR_IN_PROGRESS → READY_FOR_DELIVERY → DELIVERED
```

### Accessing device password
1. Open the job card
2. Click **View Password** (if the device has one)
3. Enter a reason (required for audit trail)
4. The password is shown for 30 seconds

### Delivering a device
1. Job must be in **READY FOR DELIVERY** status
2. Click **Deliver Device**
3. The customer receives an OTP on their registered mobile
4. Enter the OTP to confirm delivery (or collect a digital signature)
5. Add delivery notes
6. Click **Confirm Delivery**

The job status moves to **DELIVERED** and becomes read-only.

### Adding notes
1. Open any job card
2. Scroll to **Notes**
3. Click **Add Note**
4. Toggle **Internal** if it's for staff only (not shown on customer-facing views)

### Uploading photos
1. Open the job card
2. Go to the **Photos** section
3. Click **Upload Photo**
4. Select photo type: Intake / Damage / Repair / Completed
5. Add a description and upload

---

## Role: Manager

The Manager has all Receptionist and Technician capabilities plus inventory management, reporting, and technician assignment.

### Assigning technicians to jobs
1. Open a job card
2. Click **Assign Technician**
3. Select a technician from the dropdown (only shows technicians assigned to this branch)
4. Add notes if needed (e.g., expertise required)
5. Click **Assign**

The technician receives a notification.

### Approving part requests
1. Go to **Jobs** and open a job with pending part requests
2. Scroll to **Part Requests**
3. Click **Approve** or **Reject**
4. When approved, stock is automatically deducted from inventory

### Inventory management
- **View stock:** Go to **Inventory** — items highlighted in orange/red are at low stock
- **Add stock:** Click item → **Add Stock** → enter quantity and reason
- **Adjust stock:** Click item → **Adjust Stock** → enter correct quantity (physical count)
- **Add item:** Click **New Item** to add a product to the catalog

### Viewing reports
1. Go to **Reports**
2. Select a report type:
   - **Revenue** — Invoice totals, GST collected, daily breakdown
   - **Pending Jobs** — Overdue jobs, by-status counts, aging analysis
   - **Technician Productivity** — Jobs completed per technician
   - **Inventory Consumption** — Parts used, top-consumed items
   - **Customer Analysis** — New customers, top customers, spend analysis
3. Set date range and (optionally) filter by branch
4. Click **Generate** or **Export to Excel**

### Overriding job status
In cases where a job needs to be moved to a non-sequential status (e.g., reverting from DELIVERED after a dispute):
1. Open the job card
2. Click **Update Status**
3. Select the target status
4. Enable **Override** toggle
5. Add a mandatory reason note

---

## Role: Accountant

The Accountant has billing and financial reporting access only. They cannot see job cards or inventory.

### Creating an invoice
1. Go to **Billing** → **New Invoice**
2. Select **customer** or **job** to pre-fill customer data
3. Add line items:
   - Service / Part / Labour / Other
   - Description, quantity, unit price
   - GST rate (18%, 12%, 5%, 0%)
   - HSN/SAC code (for GST compliance)
4. Review totals (CGST + SGST for intrastate, IGST for interstate — determined by customer's state vs branch state)
5. Click **Create Invoice**

### Finalizing an invoice
- Open an invoice → Click **Finalize**
- Finalized invoices are locked and cannot be edited
- Customer receives a notification with invoice details

### Recording a payment
1. Open a finalized invoice
2. Click **Record Payment**
3. Enter:
   - Amount received
   - Payment method (Cash / UPI / Card / NEFT / Cheque)
   - Transaction reference number (for UPI/NEFT)
4. Click **Save**

The invoice status updates automatically: PENDING → PARTIAL → PAID.

### Cancelling an invoice
1. Open an invoice (must not be PAID)
2. Click **Cancel Invoice**
3. Enter cancellation reason (required for audit)

> **Invoices cannot be deleted** — GST regulations require 8-year retention. Cancel instead.

### Downloading invoice PDF
- Open any invoice → Click **Download PDF**

### Managing purchases (accounts payable)
1. Go to **Purchases** → **New Purchase**
2. Enter vendor details, invoice number, purchase date
3. Add purchased items (links to inventory items)
4. GST (CGST/SGST) is calculated automatically from item rates
5. Click **Create Purchase**

To record payment against a purchase:
- Open the purchase → Click **Record Payment** → enter amount and method

### GST reports
Go to **GST** for:
- **Dashboard** — Current period tax liability
- **GSTR-1** — Outward supply return data (export to JSON for portal upload)
- **GSTR-3B** — Monthly summary return
- **ITC Register** — Input tax credit from purchases
- **Output Register** — Tax collected from invoices
- **HSN Codes** — Manage HSN/SAC codes for your services and parts
- **Payments** — Track GST payments made to the portal

---

## Role: Owner

The Owner has full access to all features. Additional capabilities beyond Manager:

### User management
1. Go to **Staff** (Users page)
2. Click **New Staff Member**
3. Fill in name, email, phone
4. Select role (Technician, Receptionist, etc.)
5. Set a temporary password (user should change on first login)
6. Click **Create**

To assign staff to branches:
1. Open the staff member's profile
2. Click **Assign Branches**
3. Select one or more branches
4. Click **Save**

### Branch management
1. Go to **Branches**
2. Click **New Branch** to add a service center location
3. Configure:
   - Name and short code (e.g., "DEL" for Delhi)
   - GSTIN and state code (critical for correct GST calculation)
   - Invoice and job card number prefixes
   - Default GST rate
   - SMS/WhatsApp notifications toggle

### Organization settings
1. Go to **Settings**
2. Update:
   - Legal name (appears on invoices)
   - Bank account details (for invoice payment section)
   - Authorized signatory name
   - Invoice terms and conditions
   - Job card terms and warranty text
   - Logo and branding

### Viewing across all branches
- Use the branch switcher to view any branch's data
- Reports can show consolidated or per-branch data using the branch filter

---

## Enquiries (Lead Management)

Available to: Owner, Manager, Receptionist

### Creating an enquiry
1. Go to **Enquiries** → **New Enquiry**
2. Fill in customer details and the device/problem description
3. Set **Source** (Walk-in, Phone, WhatsApp, Website, etc.)
4. Set a **Follow-up date** if needed
5. Click **Save**

### Managing enquiries
- **Contacted** → Mark when you've spoken to the customer
- **Quoted** → Record when you've shared a price estimate
- **Converted** → When the customer agrees to proceed, click **Convert to Job** — this creates a job card automatically
- **Lost** → Mark with a loss reason if the customer declined

### Follow-up alerts
The dashboard shows today's follow-up tasks. Overdue follow-ups are highlighted in red.

---

## Customer Tracking (Public)

Customers can check their repair status without logging in:

**URL:** `https://your-app.com/track/{job_number}`

They see:
- Current status and status description
- Estimated completion date (if set)
- Branch contact phone number

---

## Notifications

The system sends automatic notifications at key events:

| Event | Channel | Recipient |
|-------|---------|-----------|
| Job card created | SMS + WhatsApp | Customer |
| Estimate shared | SMS + WhatsApp | Customer |
| Customer approval recorded | Internal alert | Manager/Owner |
| Repair complete (ready for delivery) | SMS + WhatsApp | Customer |
| Delivery OTP | SMS | Customer |
| Low stock alert | Internal alert | Manager/Owner |
| Technician assigned | Internal alert | Technician |

Notifications can be disabled per customer (sms_enabled, whatsapp_enabled flags on the Customer record).

---

## Frequently Asked Questions

**Q: Can I reopen a delivered job?**  
A: Delivered jobs are read-only. If a device needs to come back, create a new job card. An Owner/Manager can override the status if absolutely needed.

**Q: I deleted the device password by accident — can I recover it?**  
A: No — passwords are encrypted at rest and only accessible when deliberately requested with a reason. There is no admin backdoor.

**Q: Why can't I delete an invoice?**  
A: GST law (India) requires all invoices to be retained for 8 years. Cancel the invoice instead — it remains in the system for compliance but is marked as void.

**Q: The wrong branch is selected — how do I fix it?**  
A: Use the branch switcher in the top navigation. All data entry after switching applies to the new branch.

**Q: I got an "Access Denied" error.**  
A: Your role doesn't have permission for that feature. Contact your Owner or Manager to request access, or to change your role.

**Q: How do I change a staff member's password?**  
A: Have the staff member use the **Change Password** option in their profile menu. Owners can reset a password by editing the user and setting a new temporary password.
