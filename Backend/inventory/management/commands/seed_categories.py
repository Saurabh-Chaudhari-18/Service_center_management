"""
Management command to seed default inventory categories for all branches.
Creates standard service part categories that appear as permanent icon cards.
"""

from django.core.management.base import BaseCommand
from core.models import Branch
from inventory.models import InventoryCategory


# Pre-defined categories for a computer/laptop service center
DEFAULT_CATEGORIES = [
    {"name": "RAM", "description": "DDR4 / DDR5 memory modules — 4GB, 8GB, 16GB, 32GB"},
    {"name": "SSD", "description": "Solid State Drives — SATA & NVMe — 128GB to 2TB"},
    {"name": "HDD", "description": "Hard Disk Drives — 500GB, 1TB, 2TB"},
    {"name": "Screen", "description": "Laptop/Desktop display panels — 13.3\", 14\", 15.6\", 17.3\""},
    {"name": "Battery", "description": "Laptop batteries — by brand and model"},
    {"name": "Keyboard", "description": "Internal & external keyboards — by brand and model"},
    {"name": "Charger", "description": "Power adapters — 45W, 65W, 90W, Type-C"},
    {"name": "Motherboard", "description": "Laptop / Desktop motherboards — by brand and model"},
    {"name": "Fan", "description": "CPU & GPU cooling fans"},
    {"name": "Trackpad", "description": "Trackpad / Touchpad modules — by brand and model"},
    {"name": "Speaker", "description": "Internal speaker modules"},
    {"name": "Camera", "description": "Webcam / camera modules"},
    {"name": "Other", "description": "Miscellaneous parts & accessories"},
]


class Command(BaseCommand):
    help = "Seed default inventory categories for all branches"

    def add_arguments(self, parser):
        parser.add_argument(
            "--branch",
            type=str,
            help="Seed categories for a specific branch ID only",
        )

    def handle(self, *args, **options):
        branch_id = options.get("branch")

        if branch_id:
            branches = Branch.objects.filter(id=branch_id)
            if not branches.exists():
                self.stderr.write(self.style.ERROR(f"Branch {branch_id} not found."))
                return
        else:
            branches = Branch.objects.all()

        total_created = 0
        for branch in branches:
            self.stdout.write(f"\nSeeding categories for: {branch.name}")
            for cat in DEFAULT_CATEGORIES:
                obj, created = InventoryCategory.objects.get_or_create(
                    branch=branch,
                    name=cat["name"],
                    defaults={"description": cat["description"]},
                )
                if created:
                    total_created += 1
                    self.stdout.write(self.style.SUCCESS(f"  ✔ Created: {cat['name']}"))
                else:
                    self.stdout.write(f"  — Already exists: {cat['name']}")

        self.stdout.write(
            self.style.SUCCESS(f"\nDone! Created {total_created} new categories.")
        )
