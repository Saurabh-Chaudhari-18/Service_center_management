"""
Core utility functions and encryption helpers.
"""

from django.conf import settings
from cryptography.fernet import Fernet
from django.utils import timezone
import base64
import hashlib


def get_encryption_key():
    """
    Get or generate encryption key for sensitive data.
    Uses ENCRYPTION_KEY from settings, or generates from SECRET_KEY.
    """
    key = getattr(settings, 'ENCRYPTION_KEY', '')
    if not key:
        # Derive key from SECRET_KEY
        secret = settings.SECRET_KEY.encode()
        key_bytes = hashlib.sha256(secret).digest()
        key = base64.urlsafe_b64encode(key_bytes)
    elif isinstance(key, str):
        key = key.encode()
    return key


def encrypt_data(data: str) -> str:
    """
    Encrypt sensitive data (like device passwords).
    Returns base64-encoded encrypted string.
    """
    if not data:
        return ''
    
    key = get_encryption_key()
    f = Fernet(key)
    encrypted = f.encrypt(data.encode())
    return encrypted.decode()


def decrypt_data(encrypted_data: str) -> str:
    """
    Decrypt encrypted data.
    Returns original string.
    """
    if not encrypted_data:
        return ''
    
    key = get_encryption_key()
    f = Fernet(key)
    decrypted = f.decrypt(encrypted_data.encode())
    return decrypted.decode()


def get_current_financial_year():
    """
    Get current financial year in format YYYY-YY.
    Indian financial year runs from April to March.
    """
    today = timezone.now().date()
    fy_start_month = getattr(settings, 'FINANCIAL_YEAR_START_MONTH', 4)
    
    if today.month >= fy_start_month:
        start_year = today.year
    else:
        start_year = today.year - 1
    
    end_year_short = str(start_year + 1)[-2:]
    return f"{start_year}-{end_year_short}"


def calculate_gst(base_amount, gst_rate, is_interstate=False):
    """
    Calculate GST components for an amount.
    
    For intrastate: Split into CGST + SGST (each = GST_RATE / 2)
    For interstate: Full IGST
    
    Returns dict with:
    - cgst_rate, cgst_amount
    - sgst_rate, sgst_amount  
    - igst_rate, igst_amount
    - total_tax
    - total_amount (base + tax)
    """
    from decimal import Decimal, ROUND_HALF_UP
    
    base = Decimal(str(base_amount))
    rate = Decimal(str(gst_rate))
    
    two_places = Decimal('0.01')
    
    if is_interstate:
        # Interstate: Full IGST
        igst_rate = rate
        igst_amount = (base * rate / Decimal('100')).quantize(two_places, ROUND_HALF_UP)
        return {
            'cgst_rate': Decimal('0'),
            'cgst_amount': Decimal('0'),
            'sgst_rate': Decimal('0'),
            'sgst_amount': Decimal('0'),
            'igst_rate': igst_rate,
            'igst_amount': igst_amount,
            'total_tax': igst_amount,
            'total_amount': (base + igst_amount).quantize(two_places, ROUND_HALF_UP),
        }
    else:
        # Intrastate: CGST + SGST (split equally)
        half_rate = rate / Decimal('2')
        cgst_amount = (base * half_rate / Decimal('100')).quantize(two_places, ROUND_HALF_UP)
        sgst_amount = (base * half_rate / Decimal('100')).quantize(two_places, ROUND_HALF_UP)
        total_tax = cgst_amount + sgst_amount
        
        return {
            'cgst_rate': half_rate,
            'cgst_amount': cgst_amount,
            'sgst_rate': half_rate,
            'sgst_amount': sgst_amount,
            'igst_rate': Decimal('0'),
            'igst_amount': Decimal('0'),
            'total_tax': total_tax,
            'total_amount': (base + total_tax).quantize(two_places, ROUND_HALF_UP),
        }


def is_interstate_supply(branch_state_code: str, customer_state_code: str) -> bool:
    """
    Determine if a supply is interstate (different states).
    Used to determine CGST+SGST vs IGST.
    """
    if not branch_state_code or not customer_state_code:
        return False
    return branch_state_code.strip() != customer_state_code.strip()


def format_indian_currency(amount):
    """
    Format amount in Indian numbering system.
    e.g., 1,23,456.78
    """
    from decimal import Decimal
    
    if isinstance(amount, (int, float)):
        amount = Decimal(str(amount))
    
    amount_str = str(abs(amount))
    
    if '.' in amount_str:
        integer_part, decimal_part = amount_str.split('.')
    else:
        integer_part = amount_str
        decimal_part = '00'
    
    # Format with Indian numerals (last 3 digits, then groups of 2)
    if len(integer_part) <= 3:
        formatted = integer_part
    else:
        formatted = integer_part[-3:]
        remaining = integer_part[:-3]
        while remaining:
            if len(remaining) > 2:
                formatted = remaining[-2:] + ',' + formatted
                remaining = remaining[:-2]
            else:
                formatted = remaining + ',' + formatted
                remaining = ''
    
    result = f"₹{formatted}.{decimal_part[:2]}"
    if amount < 0:
        result = f"-{result}"
    
    return result


def validate_gstin(gstin: str) -> bool:
    """
    Validate GSTIN format.
    Format: 2 digits (state) + 10 char PAN + 1 digit + Z + 1 alphanumeric
    """
    import re
    pattern = r'^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$'
    return bool(re.match(pattern, gstin.upper()))


def validate_pan(pan: str) -> bool:
    """Validate PAN format."""
    import re
    pattern = r'^[A-Z]{5}\d{4}[A-Z]$'
    return bool(re.match(pattern, pan.upper()))


def generate_otp(length=6):
    """Generate a numeric OTP."""
    import random
    return ''.join([str(random.randint(0, 9)) for _ in range(length)])
