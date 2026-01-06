"""
Custom exception handling for consistent API error responses.
"""

from rest_framework.views import exception_handler
from rest_framework.exceptions import APIException
from rest_framework import status
from django.utils.translation import gettext_lazy as _


def custom_exception_handler(exc, context):
    """
    Custom exception handler providing consistent error format.
    """
    response = exception_handler(exc, context)
    
    if response is not None:
        error_payload = {
            'success': False,
            'error': {
                'code': getattr(exc, 'default_code', 'error'),
                'message': str(exc.detail) if hasattr(exc, 'detail') else str(exc),
                'status_code': response.status_code,
            }
        }
        
        # Include field errors for validation errors
        if hasattr(exc, 'detail') and isinstance(exc.detail, dict):
            error_payload['error']['field_errors'] = exc.detail
        
        response.data = error_payload
    
    return response


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
