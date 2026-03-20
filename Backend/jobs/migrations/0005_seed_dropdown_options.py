"""
Seed dropdown options for Physical Condition and Engineer Diagnosis.
"""

from django.db import migrations


def seed_dropdown_options(apps, schema_editor):
    DropdownOption = apps.get_model('jobs', 'DropdownOption')

    options = []

    # =====================================================
    # PHYSICAL CONDITION (applies to all device types)
    # =====================================================
    physical_conditions = [
        ('Some scratches', 10, False),
        ('Body damage', 20, False),
        ('Hinges damage', 30, False),
        ('Keys missing', 40, False),
        ('Others', 50, True),
    ]

    for label, order, has_text in physical_conditions:
        options.append(DropdownOption(
            category='PHYSICAL_CONDITION',
            device_type=None,
            label=label,
            display_order=order,
            is_active=True,
            has_text_input=has_text,
        ))

    # =====================================================
    # ENGINEER DIAGNOSIS - Laptop, Desktop, All-in-One
    # =====================================================
    laptop_desktop_diagnoses = [
        ('Dead', 10, False),
        ('Power on no display', 20, False),
        ('Fabrication need', 30, False),
        ('Charging issue', 40, False),
        ('HDD or SSD not detected', 50, False),
        ('HDD or SSD replace', 60, False),
        ('Motherboard repairing', 70, False),
        ('Heating issue', 80, False),
        ('Battery replace', 90, False),
        ('Need servicing', 100, False),
        ('Installation with data backup', 110, False),
        ('Installation without data backup', 120, False),
        ('Water damage', 130, False),
        ('Antivirus', 140, False),
        ('Others', 150, True),
    ]

    for device_type in ['LAPTOP', 'DESKTOP', 'ALL_IN_ONE']:
        for label, order, has_text in laptop_desktop_diagnoses:
            options.append(DropdownOption(
                category='ENGINEER_DIAGNOSIS',
                device_type=device_type,
                label=label,
                display_order=order,
                is_active=True,
                has_text_input=has_text,
            ))

    # =====================================================
    # ENGINEER DIAGNOSIS - Printer
    # =====================================================
    printer_diagnoses = [
        ('Need servicing', 10, False),
        ('Paper pickup issue', 20, False),
        ('Toner cartridge refilling', 30, False),
        ('Toner cartridge replace', 40, False),
        ('Paper jam', 50, False),
        ('Others', 60, True),
    ]

    for label, order, has_text in printer_diagnoses:
        options.append(DropdownOption(
            category='ENGINEER_DIAGNOSIS',
            device_type='PRINTER',
            label=label,
            display_order=order,
            is_active=True,
            has_text_input=has_text,
        ))

    # =====================================================
    # ENGINEER DIAGNOSIS - Monitor
    # =====================================================
    monitor_diagnoses = [
        ('Dead', 10, False),
        ('No display', 20, False),
        ('Others', 30, True),
    ]

    for label, order, has_text in monitor_diagnoses:
        options.append(DropdownOption(
            category='ENGINEER_DIAGNOSIS',
            device_type='MONITOR',
            label=label,
            display_order=order,
            is_active=True,
            has_text_input=has_text,
        ))

    # =====================================================
    # ENGINEER DIAGNOSIS - UPS
    # =====================================================
    ups_diagnoses = [
        ('Dead', 10, False),
        ('Battery not charging', 20, False),
        ('Battery replace', 30, False),
        ('Others', 40, True),
    ]

    for label, order, has_text in ups_diagnoses:
        options.append(DropdownOption(
            category='ENGINEER_DIAGNOSIS',
            device_type='UPS',
            label=label,
            display_order=order,
            is_active=True,
            has_text_input=has_text,
        ))

    DropdownOption.objects.bulk_create(options)


def reverse_seed(apps, schema_editor):
    DropdownOption = apps.get_model('jobs', 'DropdownOption')
    DropdownOption.objects.all().delete()


class Migration(migrations.Migration):

    dependencies = [
        ('jobs', '0004_add_dropdown_option_and_json_fields'),
    ]

    operations = [
        migrations.RunPython(seed_dropdown_options, reverse_seed),
    ]
