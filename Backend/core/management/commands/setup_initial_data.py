from django.core.management.base import BaseCommand
from django.db import transaction
from core.models import Organization, Branch, User, Role
from django.conf import settings

class Command(BaseCommand):
    help = 'Sets up initial data including Organization, Branch, and Users with different roles.'

    def handle(self, *args, **options):
        self.stdout.write(self.style.SUCCESS('Starting initial data setup...'))

        with transaction.atomic():
            # 1. Create Organization
            org, created = Organization.objects.get_or_create(
                email='info@techfix.com',
                defaults={
                    'name': 'TechFix Solutions',
                    'legal_name': 'TechFix Solutions Pvt Ltd',
                    'phone': '9876543210',
                    'address_line1': '123, Tech Park',
                    'city': 'Mumbai',
                    'state': 'Maharashtra',
                    'pincode': '400001',
                    'pan_number': 'ABCDE1234F',
                    'is_active': True
                }
            )
            if created:
                self.stdout.write(self.style.SUCCESS(f'Created Organization: {org.name}'))
            else:
                self.stdout.write(self.style.WARNING(f'Organization already exists: {org.name}'))

            # 2. Create Branch
            branch, created = Branch.objects.get_or_create(
                code='MUM01',
                organization=org,
                defaults={
                    'name': 'Mumbai Main Branch',
                    'email': 'mumbai@techfix.com',
                    'phone': '022-12345678',
                    'address_line1': 'Ground Floor, Tech Plaza',
                    'city': 'Mumbai',
                    'state': 'Maharashtra',
                    'pincode': '400001'
                }
            )
            if created:
                self.stdout.write(self.style.SUCCESS(f'Created Branch: {branch.name}'))
            else:
                self.stdout.write(self.style.WARNING(f'Branch already exists: {branch.name}'))

            # 3. Create Users
            users_to_create = [
                {
                    'email': 'owner@techfix.com',
                    'first_name': 'Rahul',
                    'last_name': 'Sharma',
                    'role': Role.OWNER,
                    'is_superuser': True,
                    'is_staff': True
                },
                {
                    'email': 'manager@techfix.com',
                    'first_name': 'Amit',
                    'last_name': 'Verma',
                    'role': Role.MANAGER,
                    'is_superuser': False,
                    'is_staff': False
                },
                {
                    'email': 'technician@techfix.com',
                    'first_name': 'Suresh',
                    'last_name': 'Patel',
                    'role': Role.TECHNICIAN,
                    'is_superuser': False,
                    'is_staff': False
                },
                {
                    'email': 'reception@techfix.com',
                    'first_name': 'Priya',
                    'last_name': 'Singh',
                    'role': Role.RECEPTIONIST,
                    'is_superuser': False,
                    'is_staff': False
                },
                {
                    'email': 'accounts@techfix.com',
                    'first_name': 'Vikram',
                    'last_name': 'Malhotra',
                    'role': Role.ACCOUNTANT,
                    'is_superuser': False,
                    'is_staff': False
                }
            ]

            default_password = 'password123'

            for user_data in users_to_create:
                email = user_data['email']
                role = user_data['role']
                
                # Check if user exists
                if not User.objects.filter(email=email).exists():
                    user = User.objects.create_user(
                        email=email,
                        password=default_password,
                        first_name=user_data['first_name'],
                        last_name=user_data['last_name'],
                        organization=org,
                        role=role,
                        is_staff=user_data.get('is_staff', False),
                        is_superuser=user_data.get('is_superuser', False)
                    )
                    
                    # Assign branch if not owner (Owner has access to all by default, but we can assign anyway if needed, 
                    # though model methods handle 'is_owner' logic. 
                    # Model says: "Branches this user has access to (Owners have access to all)"
                    # So explicit assignment is good for clarity or if they need specific filtered views)
                    if role != Role.OWNER:
                        user.branches.add(branch)
                    
                    self.stdout.write(self.style.SUCCESS(f'Created User: {email} ({role})'))
                else:
                    self.stdout.write(self.style.WARNING(f'User already exists: {email}'))

        self.stdout.write(self.style.SUCCESS('------------------------------------------------'))
        self.stdout.write(self.style.SUCCESS(f'Setup Complete! Default password: {default_password}'))
        self.stdout.write(self.style.SUCCESS('------------------------------------------------'))
