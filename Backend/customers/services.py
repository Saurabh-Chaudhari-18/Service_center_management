"""
Customer data lifecycle — anonymisation for right-to-erasure requests.

Hard deletes are avoided so invoice/job FK integrity and GST retention stay valid.
"""

import uuid

from django.db import transaction


def anonymise_customer(customer) -> None:
    """Replace PII with placeholders while keeping the customer row linked to history."""
    with transaction.atomic():
        anon_tag = uuid.uuid4().hex[:8]
        suffix = abs(int(anon_tag, 16)) % 10**9
        customer.first_name = f'deleted_{anon_tag}'
        customer.last_name = ''
        customer.email = ''
        customer.mobile = f'9{suffix:09d}'
        customer.alternate_mobile = ''
        customer.address_line1 = ''
        customer.address_line2 = ''
        customer.city = ''
        customer.state = ''
        customer.pincode = '000000'
        customer.state_code = ''
        customer.gstin = ''
        customer.company_name = ''
        customer.notes = ''
        customer.is_active = False
        customer.save()
