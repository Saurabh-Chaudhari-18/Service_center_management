"""
Comprehensive demo / QA seed data (idempotent).

Covers core CRM, inventory, purchases, GST records, pickups, enquiries,
expenses, job extras (notes, diagnosis parts, part requests), billing payment,
marketing configs, dropdown options, supplier + PO skeleton.

Usage:
    python manage.py seed_demo
    python manage.py seed_demo --password MyDemoPass
    DEMO_PASSWORD=secret python manage.py seed_demo   # env override when --password omitted
    python manage.py seed_demo --core-only           # lighter: skips extended modules
    python manage.py seed_demo --skip-invoice        # no sample invoice line items

Extended data is omitted when --core-only is set (faster/smaller DB footprint).

Effective password is --password if set; otherwise DEMO_PASSWORD env; otherwise
demo12345. Each run applies it to demo-*@scm.local accounts so printed login
matches even if users already existed.
"""

import os
from datetime import timedelta
from decimal import Decimal

from django.core.management import call_command
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from billing.models import Invoice, InvoiceLineItem, InvoiceStatus, Payment
from core.models import Branch, Organization, Role, RolePermission, User
from customers.models import Customer
from enquiries.models import Enquiry, EnquiryNote, EnquiryStatus, LeadSource
from expenses.models import Expense, ExpenseCategory
from gst.models import GSTPayment, GSTReturnStatus, HSNCode
from inventory.models import (
    InventoryCategory,
    InventoryItem,
    Purchase,
    PurchaseItem,
    PurchasePayment,
    PurchaseStatus,
    UnitType,
)
from jobs.models import (
    DeviceType,
    DiagnosisPart,
    JobCard,
    JobNote,
    JobStatus,
    PartRequest,
    PickupRequest,
    PickupRequestStatus,
    DropdownCategory,
    DropdownOption,
)
from marketing.models import CustomerLedgerEntry, ReminderConfig, ReviewConfig
from suppliers.models import PurchaseOrder, PurchaseOrderItem, Supplier

# --- Identifiers (stable for idempotent re-runs) ---

SEED_ORG_EMAIL = "demo-seed-org@scm.local"
SEED_BRANCH_CODE = "SEED"
SEED_JOB_MARK = "[DEMO SEED]"
SEED_TAG_PURCHASE_NOTE = "[DEMO SEED PURCHASE]"
SEED_TAG_EXPENSE_TITLE = "[DEMO SEED EXPENSE]"
SEED_TAG_ENQUIRY_PROBLEM = "[DEMO SEED ENQUIRY]"
SEED_TAG_PICKUP_NOTE = "[DEMO SEED PICKUP]"
SEED_PURCHASE_INV = "DEMO-VENDOR-BILL-SEED"

ROLE_PERMISSION_ROWS = {
    Role.OWNER: dict(
        can_view_dashboard=True,
        can_view_job_cards=True,
        can_create_job_cards=True,
        can_edit_job_cards=True,
        can_view_inventory=True,
        can_manage_inventory=True,
        can_view_billing=True,
        can_create_invoices=True,
        can_view_reports=True,
        can_manage_branches=True,
        can_manage_users=True,
        can_view_pickups=True,
    ),
    Role.MANAGER: dict(
        can_view_dashboard=True,
        can_view_job_cards=True,
        can_create_job_cards=True,
        can_edit_job_cards=True,
        can_view_inventory=True,
        can_manage_inventory=True,
        can_view_billing=True,
        can_create_invoices=True,
        can_view_reports=True,
        can_manage_branches=True,
        can_manage_users=False,
        can_view_pickups=True,
    ),
    Role.TECHNICIAN: dict(
        can_view_dashboard=True,
        can_view_job_cards=True,
        can_create_job_cards=False,
        can_edit_job_cards=True,
        can_view_inventory=False,
        can_manage_inventory=False,
        can_view_billing=False,
        can_create_invoices=False,
        can_view_reports=False,
        can_manage_branches=False,
        can_manage_users=False,
        can_view_pickups=True,
    ),
    Role.ACCOUNTANT: dict(
        can_view_dashboard=True,
        can_view_job_cards=False,
        can_create_job_cards=False,
        can_edit_job_cards=False,
        can_view_inventory=False,
        can_manage_inventory=False,
        can_view_billing=True,
        can_create_invoices=True,
        can_view_reports=True,
        can_manage_branches=False,
        can_manage_users=False,
        can_view_pickups=False,
    ),
    Role.RECEPTIONIST: dict(
        can_view_dashboard=True,
        can_view_job_cards=True,
        can_create_job_cards=True,
        can_edit_job_cards=True,
        can_view_inventory=False,
        can_manage_inventory=False,
        can_view_billing=False,
        can_create_invoices=False,
        can_view_reports=False,
        can_manage_branches=False,
        can_manage_users=False,
        can_view_pickups=True,
    ),
    Role.SUPER_ADMIN: dict(
        can_view_dashboard=True,
        can_view_job_cards=True,
        can_create_job_cards=True,
        can_edit_job_cards=True,
        can_view_inventory=True,
        can_manage_inventory=True,
        can_view_billing=True,
        can_create_invoices=True,
        can_view_reports=True,
        can_manage_branches=True,
        can_manage_users=True,
        can_view_pickups=True,
    ),
}

DEMO_USERS = [
    {
        "email": "demo-owner@scm.local",
        "first_name": "Demo",
        "last_name": "Owner",
        "role": Role.OWNER,
        "is_staff": True,
        "is_superuser": False,
        "assign_branch": False,
    },
    {
        "email": "demo-tech@scm.local",
        "first_name": "Demo",
        "last_name": "Technician",
        "role": Role.TECHNICIAN,
        "is_staff": False,
        "is_superuser": False,
        "assign_branch": True,
    },
    {
        "email": "demo-reception@scm.local",
        "first_name": "Demo",
        "last_name": "Reception",
        "role": Role.RECEPTIONIST,
        "is_staff": False,
        "is_superuser": False,
        "assign_branch": True,
    },
    {
        "email": "demo-accounts@scm.local",
        "first_name": "Demo",
        "last_name": "Accountant",
        "role": Role.ACCOUNTANT,
        "is_staff": False,
        "is_superuser": False,
        "assign_branch": True,
    },
]

CUSTOMER_SEEDS = [
    {
        "mobile": "+919800010011",
        "first_name": "Arjun",
        "last_name": "Mehta",
        "email": "arjun.mehta@example.com",
        "city": "Mumbai",
    },
    {
        "mobile": "+919800010022",
        "first_name": "Neha",
        "last_name": "Kulkarni",
        "email": "neha.k@example.com",
        "city": "Pune",
    },
    {
        "mobile": "+919800010033",
        "first_name": "Ravi",
        "last_name": "Iyer",
        "email": "",
        "city": "Thane",
    },
]


class Command(BaseCommand):
    help = (
        "Seed demo data across modules (orgs, RBAC, stock, CRM, billing, GST, pickups, purchases, ..."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--password",
            default=None,
            help="Password for demo users (default: $DEMO_PASSWORD or demo12345)",
        )
        parser.add_argument(
            "--skip-invoice",
            action="store_true",
            help="Skip the sample GST invoice.",
        )
        parser.add_argument(
            "--core-only",
            action="store_true",
            help="Only seed org, users, categories, baseline stock, customers, jobs (+ optional invoice).",
        )

    def handle(self, *args, **options):
        password = options["password"] or os.environ.get(
            "DEMO_PASSWORD", "demo12345"
        )
        skip_invoice = options["skip_invoice"]
        core_only = options["core_only"]

        self.stdout.write(self.style.MIGRATE_HEADING("Seeding demo data..."))

        with transaction.atomic():
            org, branch = self._ensure_org_and_branch()
            self._ensure_role_permissions()
            owner, technician, reception = self._ensure_users(org, branch, password)
            call_command("seed_categories", branch=str(branch.pk))
            inventory_by_sku = self._ensure_inventory_items(branch)
            customers = self._ensure_customers(branch)
            self._ensure_jobs(branch, owner, technician, reception, customers)
            invoice = None
            if not skip_invoice:
                invoice = self._ensure_sample_invoice(branch, owner, customers[0])

            if not core_only:
                items = list(inventory_by_sku.values())
                diag_job = self._find_job(branch, "Liquid spill")
                repair_job = self._find_job(branch, "SSD upgrade")
                recv_job = self._find_job(branch, "not powering")
                self._seed_dropdown_options()
                self._seed_hsn_master()
                self._seed_supplier_and_po(branch, owner, items)
                ram = inventory_by_sku.get("SEED-RAM-DDR4-8G")
                self._seed_purchase_with_stock(branch, owner, ram)
                self._seed_expenses(branch, owner)
                self._seed_enquiries(branch, owner, technician, reception, customers, diag_job)
                self._seed_pickups(branch, owner, technician, reception, customers, recv_job)
                self._seed_job_collateral(
                    diag_job, repair_job, technician, reception, owner, ram
                )
                self._seed_gst_records(branch, owner)
                self._seed_marketing(branch, recv_job, customers[0])
                inv = invoice or Invoice.objects.filter(
                    branch=branch, notes__startswith="[DEMO SEED INVOICE]"
                ).first()
                if inv and inv.balance_due > 0:
                    if Payment.objects.filter(invoice=inv, reference="DEMO-UPI-SEED").exists():
                        self.stdout.write("Demo invoice payment already recorded; skipping.")
                    else:
                        try:
                            inv.record_payment(
                                Decimal("2000.00"),
                                "UPI",
                                owner,
                                reference="DEMO-UPI-SEED",
                                notes="Seed partial payment against demo invoice.",
                            )
                            self.stdout.write(
                                self.style.SUCCESS(
                                    f"Recorded partial payment on {inv.invoice_number}; balance {inv.balance_due}"
                                )
                            )
                        except Exception as exc:
                            self.stdout.write(
                                self.style.WARNING(
                                    f"Could not seed invoice payment ({exc}); continuing."
                                )
                            )
                self._seed_ledger(branch, owner, customers[0])

        self.stdout.write("")
        self.stdout.write(self.style.SUCCESS("Done."))
        mode = "(core-only mode)" if core_only else "(full module seed)"
        self.stdout.write(mode)
        self.stdout.write(self.style.WARNING(f"Demo login password (--password): {password}"))
        self.stdout.write("  Owner:        demo-owner@scm.local")
        self.stdout.write("  Technician:   demo-tech@scm.local")
        self.stdout.write("  Reception:    demo-reception@scm.local")
        self.stdout.write("  Accountant:   demo-accounts@scm.local")
        self.stdout.write(f"  Organization: {org.name} ({SEED_ORG_EMAIL})")
        self.stdout.write(f"  Branch code:  {branch.code}")

    def _ensure_org_and_branch(self):
        org, org_created = Organization.objects.get_or_create(
            email=SEED_ORG_EMAIL,
            defaults={
                "name": "Demo Service Center Pvt Ltd",
                "legal_name": "Demo Service Center Private Limited",
                "phone": "+919876543200",
                "address_line1": "101, MG Road",
                "city": "Mumbai",
                "state": "Maharashtra",
                "pincode": "400001",
                "pan_number": "AABCD1234E",
                "is_active": True,
            },
        )
        if org_created:
            self.stdout.write(self.style.SUCCESS(f"Created organization {org.name}"))

        branch, br_created = Branch.objects.get_or_create(
            organization=org,
            code=SEED_BRANCH_CODE,
            defaults={
                "name": "Seed Branch - Mumbai",
                "email": "seed-branch@scm.local",
                "phone": "+919876543211",
                "address_line1": "201, Electronics Market",
                "city": "Mumbai",
                "state": "Maharashtra",
                "pincode": "400001",
                "gstin": "27AABCT1332L1ZV",
                "state_code": "27",
                "invoice_prefix": "INV",
                "jobcard_prefix": "JC",
                "is_active": True,
            },
        )
        if br_created:
            self.stdout.write(self.style.SUCCESS(f"Created branch {branch.name}"))

        return org, branch

    def _ensure_role_permissions(self):
        for role, perms in ROLE_PERMISSION_ROWS.items():
            RolePermission.objects.update_or_create(role=role, defaults=perms)
        self.stdout.write(self.style.SUCCESS("Role permissions synced"))

    def _ensure_users(self, org: Organization, branch: Branch, password: str):
        owner_user = technician_user = reception_user = None

        for spec in DEMO_USERS:
            user, created = User.objects.get_or_create(
                email=spec["email"],
                defaults={
                    "first_name": spec["first_name"],
                    "last_name": spec["last_name"],
                    "organization": org,
                    "role": spec["role"],
                    "is_staff": spec["is_staff"],
                    "is_superuser": spec["is_superuser"],
                    "phone": "+919876554400",
                    "is_active": True,
                },
            )
            user.set_password(password)
            user.save(update_fields=["password"])
            if created:
                self.stdout.write(self.style.SUCCESS(f"Created user {spec['email']}"))

            if spec["assign_branch"] and not user.branches.filter(pk=branch.pk).exists():
                user.branches.add(branch)

            if spec["role"] == Role.OWNER:
                owner_user = user
            elif spec["role"] == Role.TECHNICIAN:
                technician_user = user
            elif spec["role"] == Role.RECEPTIONIST:
                reception_user = user

        if owner_user is None or technician_user is None or reception_user is None:
            raise RuntimeError("Failed to resolve demo owner / technician / reception users")

        return owner_user, technician_user, reception_user

    def _ensure_inventory_items(self, branch: Branch):
        ram_cat = InventoryCategory.objects.filter(branch=branch, name="RAM").first()
        ssd_cat = InventoryCategory.objects.filter(branch=branch, name="SSD").first()
        charger_cat = InventoryCategory.objects.filter(branch=branch, name="Charger").first()

        specs = [
            {
                "sku": "SEED-RAM-DDR4-8G",
                "name": "DDR4 SO-DIMM 8GB 3200MHz",
                "category": ram_cat,
                "cost_price": Decimal("2200"),
                "selling_price": Decimal("3499"),
                "quantity": 12,
                "hsn_code": "84733020",
            },
            {
                "sku": "SEED-NVME-512",
                "name": "NVMe SSD 512GB Gen3",
                "category": ssd_cat,
                "cost_price": Decimal("2800"),
                "selling_price": Decimal("4299"),
                "quantity": 8,
                "hsn_code": "84717010",
            },
            {
                "sku": "SEED-CHARGER-65W-USBC",
                "name": "USB-C 65W laptop adapter (universal)",
                "category": charger_cat,
                "cost_price": Decimal("890"),
                "selling_price": Decimal("1699"),
                "quantity": 15,
                "hsn_code": "85044010",
            },
        ]

        by_sku: dict[str, InventoryItem] = {}
        for row in specs:
            item, created = InventoryItem.objects.get_or_create(
                branch=branch,
                sku=row["sku"],
                defaults={
                    "name": row["name"],
                    "category": row["category"],
                    "description": "Seeded demo item",
                    "cost_price": row["cost_price"],
                    "selling_price": row["selling_price"],
                    "gst_rate": Decimal("18.00"),
                    "hsn_code": row["hsn_code"],
                    "quantity": row["quantity"],
                    "unit": UnitType.PIECES,
                    "location": "Rack A1",
                    "vendor_name": "Demo Distributor",
                    "low_stock_threshold": 3,
                },
            )
            by_sku[row["sku"]] = item
            if created:
                self.stdout.write(self.style.SUCCESS(f"Inventory item {row['sku']}"))
        return by_sku

    def _ensure_customers(self, branch: Branch):
        out = []
        for c in CUSTOMER_SEEDS:
            customer, created = Customer.objects.get_or_create(
                branch=branch,
                mobile=c["mobile"],
                defaults={
                    "first_name": c["first_name"],
                    "last_name": c["last_name"],
                    "email": c["email"],
                    "city": c["city"],
                    "state": "Maharashtra",
                    "pincode": "400001",
                    "address_line1": "Demo address (seeded)",
                    "is_active": True,
                },
            )
            if created:
                self.stdout.write(self.style.SUCCESS(f"Customer {customer.get_full_name()}"))
            out.append(customer)
        return out

    def _ensure_jobs(self, branch, owner, technician, reception, customers):
        scenarios = [
            {
                "customer": customers[0],
                "status": JobStatus.RECEIVED,
                "complaint": f"{SEED_JOB_MARK} Laptop not powering on — adapter LED blinks.",
                "brand": "Dell",
                "model": "Latitude 5420",
            },
            {
                "customer": customers[1],
                "status": JobStatus.DIAGNOSIS,
                "complaint": f"{SEED_JOB_MARK} Liquid spill near keyboard — random keys failing.",
                "brand": "HP",
                "model": "Victus 15",
                "assigned": technician,
                "notes": "Open upper case, inspect membrane and trackpad ribbon.",
                "estimate": Decimal("5500"),
            },
            {
                "customer": customers[2],
                "status": JobStatus.REPAIR_IN_PROGRESS,
                "complaint": f"{SEED_JOB_MARK} SSD upgrade requested + OS reinstall.",
                "brand": "Lenovo",
                "model": "ThinkPad E14 Gen 4",
                "assigned": technician,
                "notes": "Imaging complete; cloning user data overnight.",
                "estimate": Decimal("2800"),
            },
        ]

        for spec in scenarios:
            exists = JobCard.objects.filter(
                branch=branch,
                customer_complaint=spec["complaint"],
            ).exists()
            if exists:
                continue

            job = JobCard(
                branch=branch,
                customer=spec["customer"],
                device_type=DeviceType.LAPTOP,
                brand=spec["brand"],
                model=spec["model"],
                customer_complaint=spec["complaint"],
                status=spec["status"],
                received_by=reception if reception else owner,
                assigned_technician=spec.get("assigned"),
                physical_condition={"selected": [], "other_text": ""},
            )
            if spec.get("notes"):
                job.diagnosis_notes = spec["notes"]
            if spec.get("estimate") is not None:
                job.estimated_cost = spec["estimate"]

            job.save()
            self.stdout.write(self.style.SUCCESS(f"Job {job.job_number} ({spec['status']})"))

    def _ensure_sample_invoice(self, branch: Branch, owner: User, customer: Customer):
        inv_label = "[DEMO SEED INVOICE]"
        existing = Invoice.objects.filter(
            branch=branch,
            notes__startswith=inv_label,
        ).first()
        if existing:
            self.stdout.write("Sample demo invoice already exists; skipping invoice creation.")
            return existing

        inv = Invoice(
            branch=branch,
            job=None,
            customer_name=customer.get_full_name(),
            customer_mobile=customer.mobile,
            customer_email=customer.email or "",
            customer_address=", ".join(
                filter(None, [customer.address_line1, customer.city, customer.state, customer.pincode])
            ),
            customer_gstin="",
            customer_state_code=customer.state_code or "27",
            is_interstate=False,
            status=InvoiceStatus.DRAFT,
            notes=f"{inv_label} Sample GST intrastate draft.",
            created_by=owner,
        )
        inv.save()

        InvoiceLineItem.objects.create(
            invoice=inv,
            item_type="SERVICE",
            description="Diag & labour — laptop motherboard inspection",
            hsn_sac_code="998716",
            quantity=1,
            unit="NOS",
            unit_price=Decimal("1500.00"),
            amount=Decimal("1500.00"),
            gst_rate=Decimal("18.00"),
        )
        InvoiceLineItem.objects.create(
            invoice=inv,
            item_type="PART",
            description="DDR4 RAM 8GB (replacement)",
            hsn_sac_code="84733020",
            quantity=1,
            unit="PCS",
            unit_price=Decimal("3500.00"),
            amount=Decimal("3500.00"),
            gst_rate=Decimal("18.00"),
        )

        inv.refresh_from_db()
        self.stdout.write(
            self.style.SUCCESS(
                f"Sample invoice {inv.invoice_number} (total {inv.total_amount} INR, status {inv.status})"
            )
        )
        return inv

    # ----- Extended helpers -------------------------------------------------

    def _find_job(self, branch: Branch, complaint_substr: str):
        return (
            JobCard.objects.filter(branch=branch, customer_complaint__icontains=complaint_substr)
            .order_by("-created_at")
            .first()
        )

    def _seed_dropdown_options(self):
        pairs = [
            (DropdownCategory.PHYSICAL_CONDITION, None, "[SEED] Screen cracks / bezel damage"),
            (DropdownCategory.PHYSICAL_CONDITION, DeviceType.LAPTOP, "[SEED] Missing charger"),
            (DropdownCategory.ENGINEER_DIAGNOSIS, DeviceType.LAPTOP, "[SEED] Suspect motherboard PMIC"),
        ]
        for cat, dt, label in pairs:
            _, created = DropdownOption.objects.get_or_create(
                category=cat,
                device_type=dt if dt else None,
                label=label,
                defaults={"display_order": 99, "is_active": True},
            )
            if created:
                self.stdout.write(self.style.SUCCESS(f"DropdownOption: {label[:40]}..."))

    def _seed_hsn_master(self):
        specs = [
            ("84733020", "HSN", "Automatic data processing machines - parts"),
            ("84717010", "HSN", "Solid state drives"),
            ("85044010", "HSN", "Static converters (adapters)"),
            ("998716", "SAC", "Information technology consultancy"),
        ]
        for code, ctype, desc in specs:
            _, created = HSNCode.objects.get_or_create(
                code=code,
                defaults={
                    "code_type": ctype,
                    "description": desc,
                    "default_gst_rate": Decimal("18"),
                    "is_active": True,
                },
            )
            if created:
                self.stdout.write(self.style.SUCCESS(f"HSN/SAC master {code}"))

    def _seed_supplier_and_po(self, branch: Branch, owner: User, items: list[InventoryItem]):
        supplier, created = Supplier.objects.get_or_create(
            branch=branch,
            name="Demo Wholesale Components",
            defaults={
                "contact_person": "Sanjay Rao",
                "email": "sales@demo-wholesale.local",
                "phone": "+919811122233",
                "address": "IT hardware market row 44",
                "city": "Mumbai",
                "state": "Maharashtra",
                "pincode": "400068",
                "gstin": "27AABCT1332L1ZV",
                "payment_terms": "NET_30",
                "categories": "RAM,SSD,Adapters",
            },
        )
        if created:
            self.stdout.write(self.style.SUCCESS(f"Supplier {supplier.name}"))
        ram = next((x for x in items if x.sku == "SEED-RAM-DDR4-8G"), None)
        if not ram:
            return
        if PurchaseOrder.objects.filter(po_number="DEMO-PO-SEED").exists():
            self.stdout.write("Purchase order DEMO-PO-SEED exists; skipping PO.")
            return
        po = PurchaseOrder.objects.create(
            branch=branch,
            supplier=supplier,
            po_number="DEMO-PO-SEED",
            order_date=timezone.now().date(),
            expected_delivery_date=timezone.now().date() + timedelta(days=5),
            status="SENT",
            created_by=owner,
            notes="[DEMO SEED] PO awaiting GRN linkage.",
            subtotal=Decimal("6998"),
            tax_amount=Decimal("1259.64"),
            total_amount=Decimal("8257.64"),
        )
        PurchaseOrderItem.objects.create(
            purchase_order=po,
            inventory_item=ram,
            description=ram.name,
            quantity=2,
            unit_price=Decimal("3499"),
            total_price=Decimal("6998"),
        )
        self.stdout.write(self.style.SUCCESS(f"Purchase order {po.po_number}"))

    def _seed_purchase_with_stock(self, branch: Branch, owner: User, ram: InventoryItem | None):
        if ram is None:
            return
        if Purchase.objects.filter(branch=branch, invoice_number=SEED_PURCHASE_INV).exists():
            self.stdout.write("Demo purchase invoice already seeded; skipping stock purchase.")
            return
        p = Purchase.objects.create(
            branch=branch,
            vendor_name="IT Parts Bazaar",
            vendor_gstin="27AABCT1332L1ZV",
            invoice_number=SEED_PURCHASE_INV,
            purchase_date=timezone.now().date(),
            notes=f"{SEED_TAG_PURCHASE_NOTE} Intrastate stock receipt.",
            total_amount=Decimal("0"),
            paid_amount=Decimal("0"),
        )
        qty = 4
        unit_cost = Decimal("1900")
        line_total = unit_cost * qty
        tax = (line_total * Decimal("18") / Decimal("100")).quantize(Decimal("0.01"))
        cgst = (tax / 2).quantize(Decimal("0.01"))
        sgst = tax - cgst
        PurchaseItem.objects.create(
            purchase=p,
            inventory_item=ram,
            quantity=qty,
            unit_price=unit_cost,
            total_price=line_total,
            gst_rate=Decimal("18"),
            taxable_amount=line_total,
            cgst_amount=cgst,
            sgst_amount=sgst,
        )
        ram.add_stock(
            qty,
            reason=f"[SEED] Purchase {SEED_PURCHASE_INV}",
            user=owner,
        )
        p.taxable_amount = line_total
        p.cgst_amount = cgst
        p.sgst_amount = sgst
        p.total_gst = tax
        p.total_amount = line_total + tax
        p.save()

        partial = (p.total_amount / 2).quantize(Decimal("0.01"))
        PurchasePayment.objects.create(
            purchase=p,
            amount=partial,
            payment_method="UPI",
            reference="SEED-UPI-VENDOR-PART",
            paid_by=owner,
        )
        p.paid_amount = partial
        p.save()
        self.stdout.write(
            self.style.SUCCESS(
                f"Purchase + stock (+{qty} RAM), status={p.status} balance={p.balance_due}"
            )
        )

    def _seed_expenses(self, branch: Branch, owner: User):
        rows = [
            (ExpenseCategory.INTERNET, "Fiber plan - March cycle", Decimal("899.00"), False),
            (ExpenseCategory.SALARY, "Helper stipend advance", Decimal("3500"), False),
            (
                ExpenseCategory.MISCELLANEOUS,
                SEED_TAG_EXPENSE_TITLE + " ITC-eligible stationery",
                Decimal("5900"),
                True,
            ),
        ]
        for cat, title, amount, itc in rows:
            exists = Expense.objects.filter(branch=branch, title=title).exists()
            if exists:
                continue
            e = Expense.objects.create(
                branch=branch,
                category=cat,
                title=title,
                description="Automated QA seed expense.",
                amount=amount,
                expense_date=timezone.now().date(),
                vendor_name="Utility Vendor Pvt Ltd",
                created_by=owner,
            )
            if itc:
                e.is_itc_eligible = True
                e.vendor_gstin = "27AABCT1332L1ZV"
                e.vendor_invoice_number = "VEN-INV-SEED"
                base = (amount * Decimal("100") / Decimal("118")).quantize(Decimal("0.01"))
                gst_half = ((amount - base) / 2).quantize(Decimal("0.01"))
                e.taxable_amount = base
                e.gst_rate = Decimal("18")
                e.cgst_amount = gst_half
                e.sgst_amount = amount - base - gst_half
                e.save(
                    update_fields=[
                        "is_itc_eligible",
                        "vendor_gstin",
                        "vendor_invoice_number",
                        "taxable_amount",
                        "gst_rate",
                        "cgst_amount",
                        "sgst_amount",
                    ]
                )
            self.stdout.write(self.style.SUCCESS(f"Expense {title[:48]}"))

    def _seed_enquiries(
        self,
        branch: Branch,
        owner,
        technician,
        reception,
        customers,
        diag_job: JobCard | None,
    ):
        if Enquiry.objects.filter(problem_description__startswith=SEED_TAG_ENQUIRY_PROBLEM).exists():
            self.stdout.write("Demo enquiries exist; skipping.")
            return
        e1 = Enquiry.objects.create(
            branch=branch,
            customer=customers[2],
            customer_name=customers[2].get_full_name(),
            customer_mobile=customers[2].mobile,
            customer_email="",
            device_type="LAPTOP",
            brand="Acer",
            model_name="Aspire Lite",
            problem_description=f"{SEED_TAG_ENQUIRY_PROBLEM} Blue screen twice a day.",
            source=LeadSource.WHATSAPP,
            status=EnquiryStatus.CONTACTED,
            assigned_to=technician,
            created_by=reception or owner,
            follow_up_date=timezone.now().date() + timedelta(days=2),
            notes="Quoted OS reinstall + diagnostics.",
            quoted_price=Decimal("2499"),
        )
        EnquiryNote.objects.create(
            enquiry=e1,
            note="Seed call log: Customer will confirm pickup slot tomorrow.",
            created_by=reception or owner,
        )
        Enquiry.objects.create(
            branch=branch,
            customer_name="Walk-in Prospect",
            customer_mobile="+919810099877",
            problem_description=f"{SEED_TAG_ENQUIRY_PROBLEM} Screen flicker MacBook.",
            source=LeadSource.WALK_IN,
            status=EnquiryStatus.CONVERTED,
            converted_job=diag_job,
            created_by=reception or owner,
        )
        self.stdout.write(self.style.SUCCESS("Seed enquiries + follow-up notes"))

    def _seed_pickups(
        self,
        branch: Branch,
        owner,
        technician,
        reception,
        customers,
        linked_job: JobCard | None,
    ):
        if PickupRequest.objects.filter(notes__icontains=SEED_TAG_PICKUP_NOTE).exists():
            self.stdout.write("Pickup seed exists; skipping.")
            return
        PickupRequest.objects.create(
            branch=branch,
            customer=customers[0],
            job=linked_job,
            assigned_technician=technician,
            device_type=DeviceType.LAPTOP,
            brand="Dell",
            model_name="Inspiron 15",
            customer_complaint=f"{SEED_JOB_MARK} Home pickup diagnostic visit.",
            pickup_address=f"{customers[0].address_line1}, {customers[0].city}",
            pickup_date=timezone.now().date(),
            pickup_time_slot="14:00-17:00",
            contact_number=customers[0].mobile,
            status=PickupRequestStatus.ASSIGNED,
            notes=SEED_TAG_PICKUP_NOTE,
            is_urgent=False,
            created_by=reception or owner,
        )
        self.stdout.write(self.style.SUCCESS("Pickup request seeded"))

    def _seed_job_collateral(
        self,
        diag: JobCard | None,
        repair: JobCard | None,
        technician,
        reception,
        owner: User,
        ram: InventoryItem | None,
    ):
        actor = reception or owner
        wrote = False
        if diag:
            if not JobNote.objects.filter(
                job=diag, note__startswith="[SEED] Customer approved"
            ).exists():
                JobNote.objects.create(
                    job=diag,
                    note="[SEED] Customer approved rough estimate verbally on call.",
                    created_by=actor,
                    is_internal=True,
                )
                wrote = True
            if not diag.diagnosis_parts.filter(name__startswith="[SEED]").exists():
                DiagnosisPart.objects.create(
                    job=diag,
                    name="[SEED] Replacement keyboard membrane",
                    price=Decimal("1200"),
                    warranty_months=3,
                    quantity=1,
                )
                wrote = True
        if repair and ram:
            _, pr_created = PartRequest.objects.get_or_create(
                job=repair,
                inventory_item=ram,
                part_name=ram.name,
                defaults={
                    "requested_by": technician,
                    "quantity": 1,
                    "status": "PENDING",
                    "notes": "[SEED] Awaiting inventory approval.",
                },
            )
            if pr_created:
                wrote = True
        if wrote:
            self.stdout.write(self.style.SUCCESS("Job notes / diagnosis parts / part request"))

    def _seed_gst_records(self, branch: Branch, owner: User):
        month_start = timezone.now().date().replace(day=1)
        if not GSTPayment.objects.filter(branch=branch, period_month=month_start).exists():
            gst_pay = GSTPayment.objects.create(
                branch=branch,
                period_month=month_start,
                cgst_paid=Decimal("1200"),
                sgst_paid=Decimal("1200"),
                payment_date=timezone.now().date(),
                challan_number="DEMO-CHALLAN-GST",
                payment_method="NEFT",
                notes="[DEMO SEED] Liability payment stub.",
                created_by=owner,
            )
            self.stdout.write(self.style.SUCCESS(f"GSTPayment {gst_pay.period_month}"))

        ret, rc = GSTReturnStatus.objects.get_or_create(
            branch=branch,
            period_month=month_start,
            defaults={
                "gstr1_filed": True,
                "gstr3b_filed": True,
                "filed_by": owner,
                "notes": "[DEMO SEED] Filing record",
            },
        )
        if rc:
            self.stdout.write(self.style.SUCCESS("GSTReturnStatus seeded"))

    def _seed_marketing(self, branch: Branch, recv_job: JobCard | None, customer: Customer):
        ReminderConfig.objects.get_or_create(
            branch=branch,
            defaults={
                "reminder_1_days": 45,
                "reminder_message": "Hi {customer_name}, time for tune-up ({branch_name}).",
                "send_whatsapp": False,
            },
        )
        ReviewConfig.objects.get_or_create(
            branch=branch,
            defaults={
                "google_review_link": "https://maps.google.com/?q=demo-shop",
                "send_after_hours": 12,
                "send_whatsapp": False,
            },
        )
        self.stdout.write(self.style.SUCCESS("Reminder + review config seeded"))
        # Optional ServiceReminder skeleton if delivered job existed
        _ = recv_job  # retained for future when a delivered seed job ships

    def _seed_ledger(self, branch: Branch, owner: User, customer: Customer):
        ref = "[DEMO SEED LEDGER]"
        if CustomerLedgerEntry.objects.filter(description__startswith=ref).exists():
            return
        CustomerLedgerEntry.objects.create(
            branch=branch,
            customer=customer,
            entry_type="CREDIT",
            amount=Decimal("1500"),
            description=f"{ref} Opening Khata memo (demo)",
            reference_type="ADJUSTMENT",
            reference_id="SEED-KHATA-OPEN",
            entry_date=timezone.now().date(),
            running_balance=Decimal("1500"),
            created_by=owner,
        )
        self.stdout.write(self.style.SUCCESS("Customer ledger opening entry"))
