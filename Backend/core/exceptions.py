"""
Domain exceptions and REST API exception subclasses.

Unified HTTP error envelope is implemented in ``core.error_handlers``.
"""

from rest_framework.exceptions import APIException
from rest_framework import status
from django.utils.translation import gettext_lazy as _


class BusinessRuleViolation(APIException):
    """Exception for business rule violations."""
    status_code = status.HTTP_400_BAD_REQUEST
    default_detail = _('A business rule was violated.')
    default_code = 'business_rule_violation'


class InvalidStatusTransition(BusinessRuleViolation):
    """Exception for invalid job status transitions."""
    default_detail = _('Invalid status transition.')
    default_code = 'invalid_status_transition'


class InsufficientInventory(BusinessRuleViolation):
    """Exception for insufficient inventory."""
    default_detail = _('Insufficient inventory for this operation.')
    default_code = 'insufficient_inventory'


class JobReadOnlyError(BusinessRuleViolation):
    """Exception when trying to modify a delivered/closed job."""
    default_detail = _('This job has been delivered and cannot be modified.')
    default_code = 'job_readonly'


class InvoiceNumberConflict(BusinessRuleViolation):
    """Exception for invoice number conflicts."""
    default_detail = _('Invoice number already exists.')
    default_code = 'invoice_number_conflict'


class DeliveryRequirementError(BusinessRuleViolation):
    """Exception when delivery requirements (OTP/signature) are not met."""
    default_detail = _('Delivery requirements not satisfied.')
    default_code = 'delivery_requirements'


class BranchAccessDenied(APIException):
    """Exception for branch access violations."""
    status_code = status.HTTP_403_FORBIDDEN
    default_detail = _('You do not have access to this branch.')
    default_code = 'branch_access_denied'


class OrganizationMismatch(APIException):
    """Exception when accessing resources from different organization."""
    status_code = status.HTTP_403_FORBIDDEN
    default_detail = _('Resource belongs to a different organization.')
    default_code = 'organization_mismatch'


class ProtectedResourceError(APIException):
    """Raised when a delete is blocked by a PROTECT FK constraint."""
    status_code = status.HTTP_409_CONFLICT
    default_detail = _(
        'Cannot delete: this record is referenced by other data. '
        'Archive or cancel it instead.'
    )
    default_code = 'protected_resource'
