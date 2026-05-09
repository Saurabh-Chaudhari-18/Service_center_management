# GST Compliance Guide

This document covers how the system implements Indian GST (Goods and Services Tax) rules.

---

## GST Fundamentals Implemented

### Tax types

| Tax | When applied | Rate |
|-----|-------------|------|
| CGST + SGST | Supplier and customer in **same state** (intrastate) | GST rate ÷ 2 each |
| IGST | Supplier and customer in **different states** (interstate) | Full GST rate |

**Determining supply type:**  
The system compares `branch.state_code` (2-digit state code, e.g. `27` for Maharashtra) with `customer.state_code`.  
- Same state code → intrastate → CGST + SGST  
- Different state codes → interstate → IGST

This is computed in `core/utils.py`:
```python
def is_interstate_supply(branch_state_code: str, customer_state_code: str) -> bool:
    if not branch_state_code or not customer_state_code:
        return True   # default to interstate when state code is missing
    return branch_state_code.strip() != customer_state_code.strip()
```

### GST rates in use

The system supports any rate — common ones for service centers:

| Rate | Typical use |
|------|-------------|
| 0% | Exempt items |
| 5% | Certain repair services |
| 12% | Some electronic components |
| 18% | Most repair services and parts (default) |
| 28% | Luxury goods |

Default GST rate configured per Branch (`default_gst_rate`, default 18%).

---

## Invoice GST Calculation

### Line-item level

For each `InvoiceLineItem`:

```
amount = unit_price × quantity × (1 - discount_percent/100)

# Intrastate:
cgst_rate = gst_rate / 2
sgst_rate = gst_rate / 2
cgst_amount = amount × cgst_rate / 100
sgst_amount = amount × sgst_rate / 100
igst_rate = 0
igst_amount = 0

# Interstate:
igst_rate = gst_rate
igst_amount = amount × igst_rate / 100
cgst_rate = 0
cgst_amount = 0
sgst_rate = 0
sgst_amount = 0
```

The `calculate_gst()` utility in `core/utils.py` returns a dict with all six fields.

### Invoice totals

`Invoice.calculate_totals()` runs a single DB aggregate:
```python
totals = self.line_items.aggregate(
    subtotal=Sum('amount'),
    cgst_total=Sum('cgst_amount'),
    sgst_total=Sum('sgst_amount'),
    igst_total=Sum('igst_amount'),
)
self.total_tax = cgst_total + sgst_total + igst_total
self.total_amount = subtotal + total_tax - discount_amount
```

### Rounding

All tax amounts are rounded to 2 decimal places (`Decimal.quantize(Decimal('0.01'))`).

---

## GSTIN Validation

Both GSTIN formats (Organization, Branch, Customer) are validated using a regex:
```
^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$
```

The first 2 digits of a GSTIN are the state code. The system does not verify GSTINs against the GST portal in real time — manual verification is required.

---

## HSN/SAC Codes

Every invoice line item has a `hsn_sac_code` field:
- **HSN** (Harmonized System of Nomenclature) — for goods/parts
- **SAC** (Services Accounting Code) — for services

These codes appear on the invoice and are required for GSTR-1 filing.

Common codes for service centers:

| Code | Category |
|------|----------|
| 998713 | Maintenance and repair services of computers |
| 998719 | Maintenance and repair — other electronic equipment |
| 84734000 | Parts for computer printers |
| 85177090 | Parts for mobile phones |

The system includes an HSN code management page (`/gst/hsn`) where staff can maintain their code list.

---

## GSTR-1 (Outward Supplies Return)

### What it covers
All sales invoices (finalized, non-cancelled) for the reporting period.

### Generating GSTR-1
1. Go to **GST** → **GSTR-1**
2. Select the reporting period (month/quarter)
3. The system groups invoices as:
   - **B2B** — Customer has a GSTIN (supply to registered dealer)
   - **B2C Large** — Invoice value > ₹2.5 lakh, no GSTIN
   - **B2C Small** — Invoice value ≤ ₹2.5 lakh, no GSTIN (can be summarized)
4. Review the data on screen
5. Click **Download JSON** to get the GSTR-1 JSON file for portal upload

### Filing deadline
GSTR-1 is due by the 11th of the following month (monthly filers) or 13th for quarterly filers (QRMP scheme).

The system shows each period's filing status on the GSTR-1 page. Mark a period as filed after uploading to the GST portal.

---

## GSTR-3B (Monthly Summary Return)

### What it covers
Net tax liability after Input Tax Credit offset.

### Components shown:

| Section | Description |
|---------|-------------|
| Outward tax (3.1) | Total CGST/SGST/IGST collected from customers |
| ITC available (4) | CGST/SGST/IGST paid on purchases |
| Net tax payable | Outward tax − ITC |

### Generating GSTR-3B
1. Go to **GST** → **GSTR-3B**
2. Select the tax period
3. Review the pre-calculated summary
4. Download or copy values for manual portal entry

---

## Input Tax Credit (ITC)

### What it is
GST paid on business purchases can be offset against GST collected on sales.

### ITC register
Go to **GST** → **ITC Register** to see all purchase-linked tax credits:
- Vendor name, GSTIN, invoice number, date
- Taxable amount, CGST, SGST, IGST
- Cumulative ITC available

### ITC eligibility rules (not enforced by system, requires accountant judgment)
- Purchase must be from a GST-registered vendor
- Vendor must have filed their GSTR-1 (system cannot verify this automatically)
- Items must be used for business purposes
- Capital goods ITC may be taken in installments per GST rules

---

## Invoice Retention Policy (8-Year Rule)

**Regulation:** GST Rule 58 requires all GST invoices to be retained for **8 financial years** from the due date of the annual return.

**Implementation:**
- Invoices cannot be hard-deleted — the `DELETE` API endpoint returns `409 Conflict`
- Cancelled invoices remain in the database with `status=CANCELLED`
- The Django admin also blocks delete on Invoice records
- Periodic purging scripts must check the 8-year window before archiving

**Archive window:**
For invoices dated April 2025 (FY 2025-26), the retention expires after the GSTR-9 annual return due date for FY 2033-34 (approximately December 2034).

---

## GST Payments Tracking

Go to **GST** → **Payments** to record GST challan payments made to the portal.

Fields recorded:
- Tax period (e.g., April 2025)
- Amount paid (CGST, SGST, IGST separately)
- Challan number (BSR code + date + sequence)
- Payment date

This is a manual entry — the system does not integrate with the GST payment portal.

---

## Common GST Scenarios

### Intrastate repair invoice — 18% GST
Branch: Maharashtra (state code 27)  
Customer: Maharashtra address (state code 27)

| Item | Amount | CGST 9% | SGST 9% |
|------|--------|---------|---------|
| LCD Replacement | ₹3,813.56 | ₹343.22 | ₹343.22 |
| Labour | ₹500.00 | ₹45.00 | ₹45.00 |
| **Total** | **₹4,313.56** | **₹388.22** | **₹388.22** |
| **Invoice total** | | | **₹5,090.00** |

### Interstate repair invoice — 18% IGST
Branch: Maharashtra (state code 27)  
Customer: Delhi address (state code 07)

| Item | Amount | IGST 18% |
|------|--------|---------|
| LCD Replacement | ₹3,813.56 | ₹686.44 |
| **Total** | **₹3,813.56** | **₹686.44** |
| **Invoice total** | | **₹4,500.00** |

### Zero-rated service
Some services (export of services, SEZ supplies) are zero-rated. Set `gst_rate=0` on the line item. The invoice will show 0 CGST/SGST/IGST.

### Exempt services
If a service is GST-exempt (not zero-rated but exempt), set `gst_rate=0` and use the appropriate exemption note in `terms_and_conditions`.

---

## Accountant Checklist (Monthly)

- [ ] Verify all invoices for the month are finalized (no drafts left over)
- [ ] Check that all purchases have vendor GSTIN recorded (for ITC eligibility)
- [ ] Generate GSTR-1 data → review B2B vs B2C grouping
- [ ] Download GSTR-1 JSON → upload to GST portal → mark as filed in system
- [ ] Generate GSTR-3B summary → verify outward tax vs ITC
- [ ] Record GST challan payment in the Payments section
- [ ] Mark GSTR-3B as filed after portal submission
- [ ] Export ITC register → reconcile with purchase records

---

## Financial Year Settings

The system uses the Indian financial year (April 1 to March 31).

- FY 2024-25 is stored as `"2425"` in invoice/job-card numbers
- April is month 1 of the FY
- Configured via `FINANCIAL_YEAR_START_MONTH = 4` in settings.py

Invoice number format: `{PREFIX}/{FY}/{BRANCH_CODE}/{SEQUENCE}`  
Example: `INV/2425/MUM/00142` — Invoice number 142 for Mumbai branch in FY 2024-25
