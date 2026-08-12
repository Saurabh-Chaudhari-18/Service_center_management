/** Domain type definitions. */
import type { JobStatus, DeviceType, AccessoryType, BaseEntity } from "./core";
import type { Invoice } from "./billing";

export interface Customer extends BaseEntity {
  branch: string;
  branch_name?: string;
  first_name: string;
  last_name: string;
  email: string;
  mobile: string;
  alternate_mobile: string;
  address_line1: string;
  address_line2: string;
  city: string;
  state: string;
  pincode: string;
  state_code: string;
  gstin: string;
  company_name: string;
  sms_enabled: boolean;
  whatsapp_enabled: boolean;
  notes: string;
  is_active: boolean;
  full_name?: string;
  pending_jobs_count?: number;
  total_spent?: number;
}

// =====================================================
// Job Card
// =====================================================

export interface JobAccessory {
  id: string;
  accessory_type: AccessoryType;
  description: string;
  condition: string;
  is_present: boolean;
}

export interface JobPhoto {
  id: string;
  photo: string;
  photo_type: "INTAKE" | "DAMAGE" | "REPAIR" | "COMPLETED";
  description: string;
  uploaded_by: string;
  created_at: string;
}

export interface JobNote {
  id: string;
  note: string;
  created_by: string;
  created_by_name?: string;
  is_internal: boolean;
  created_at: string;
}

export interface JobStatusHistoryItem {
  id: string;
  from_status: JobStatus;
  to_status: JobStatus;
  changed_by: string;
  changed_by_name?: string;
  notes: string;
  is_override: boolean;
  created_at: string;
}

export interface PartRequest {
  id: string;
  job: string;
  requested_by: string;
  requested_by_name?: string;
  inventory_item: string | null;
  part_name: string;
  quantity: number;
  status: "PENDING" | "APPROVED" | "REJECTED" | "USED";
  approved_by: string | null;
  rejection_reason: string;
  notes: string;
  created_at: string;
}

export interface DiagnosisPart {
  id: string;
  name: string;
  price: number;
  warranty_months: number;
  quantity: number;
}

// =====================================================
// Pickup & Drop Types
// =====================================================

export type PickupRequestStatus =
  | "REQUESTED"
  | "ASSIGNED"
  | "EN_ROUTE"
  | "PICKED_UP"
  | "DELIVERED_TO_CENTER"
  | "COMPLETED"
  | "CANCELLED";

export interface PickupRequest extends BaseEntity {
  branch: string;
  branch_name?: string;
  pickup_number: string;
  customer?: Customer;
  customer_id?: string;
  job?: string | null;
  job_number?: string | null;
  status: PickupRequestStatus;
  status_display?: string;
  allowed_transitions?: { value: string; label: string }[];
  assigned_technician?: string | null;
  assigned_technician_name?: string | null;
  device_type: DeviceType;
  device_type_display?: string;
  brand: string;
  model_name: string;
  customer_complaint: string;
  pickup_address: string;
  pickup_date: string;
  pickup_time_slot: string;
  contact_number: string;
  notes: string;
  is_urgent: boolean;
  created_by?: string;
  created_by_name?: string;
  customer_name?: string;
  customer_mobile?: string;
}

export interface JobCard extends BaseEntity {
  branch: string;
  branch_name?: string;
  job_number: string;
  /** Public tracking PIN (staff-only in API) */
  tracking_pin?: string;
  customer?: Customer;
  customer_id?: string;
  customer_name?: string;
  customer_mobile?: string;
  device_type: DeviceType;
  brand: string;
  model: string;
  serial_number: string;
  customer_complaint: string;
  /** JSON field: { selected: string[]; other_text?: string } or legacy plain string */
  physical_condition: { selected: string[]; other_text?: string } | string | null;
  physical_condition_display?: string;
  /** JSON field: { selected: string[]; other_text?: string } or legacy plain string */
  engineer_diagnosis?: { selected: string[]; other_text?: string } | string | null;
  engineer_diagnosis_display?: string;
  status: JobStatus;
  allowed_transitions?: { value: string; label: string }[];
  is_readonly?: boolean;
  assigned_technician: string | null;
  assigned_technician_name?: string;
  received_by: string;
  received_by_name?: string;
  diagnosis_notes: string;
  estimated_cost: number | null;
  estimated_completion_date: string | null;
  customer_approval_date: string | null;
  customer_rejection_reason: string;
  completion_notes: string;
  actual_completion_date: string | null;
  delivery_date: string | null;
  delivered_by: string | null;
  is_urgent: boolean;
  is_warranty_repair: boolean;
  warranty_details: string;
  additional_comments?: string;
  total_parts_cost?: number;
  accessories?: JobAccessory[];
  photos?: JobPhoto[];
  notes_list?: JobNote[];
  status_history?: JobStatusHistoryItem[];
  part_requests?: PartRequest[];
  diagnosis_parts?: DiagnosisPart[];
  invoices?: Invoice[];
  received_date?: string;
  outsourced_repairs?: OutsourcedRepair[];
}

export interface OutsourceVendor extends BaseEntity {
  branch?: string | null;
  name: string;
  contact_person?: string;
  phone: string;
  alternate_phone?: string;
  address?: string;
  city?: string;
  specialization?: string;
  notes?: string;
  is_active?: boolean;
}

export type OutsourcedRepairStatus = "SENT" | "RETURNED" | "CANCELLED";
export type RepairOutcome = "REPAIRED" | "PARTIALLY_REPAIRED" | "NOT_REPAIRED";

export interface OutsourcedRepair extends BaseEntity {
  job?: string | null;
  job_number?: string;
  inventory_item?: string | null;
  item_name?: string;
  serial_number?: string;
  is_warranty_repair?: boolean;
  customer_name?: string;
  customer_mobile?: string;
  device_summary?: string;
  branch: string;
  vendor: string;
  vendor_name: string;
  vendor_phone?: string;
  vendor_city?: string;
  reason: string;
  sent_date: string;
  estimated_cost?: number | null;
  expected_return_date?: string | null;
  notes?: string;
  sent_by: string;
  sent_by_name: string;
  status: OutsourcedRepairStatus;
  status_display: string;
  return_date?: string | null;
  actual_cost?: number | null;
  repair_outcome?: RepairOutcome | null;
  repair_outcome_display?: string | null;
  vendor_notes?: string;
  vendor_invoice_number?: string;
  received_by?: string | null;
  received_by_name?: string | null;
}

export interface CreateJobCardData {
  branch: string | null;
  customer_id: string;
  device_type: DeviceType;
  brand: string;
  model: string;
  serial_number?: string;
  customer_complaint: string;
  physical_condition: { selected: string[]; other_text?: string };
  engineer_diagnosis?: { selected: string[]; other_text?: string };
  additional_comments?: string;
  device_password?: string;
  diagnosis_notes?: string;
  estimated_cost?: number;
  is_urgent?: boolean;
  is_warranty_repair?: boolean;
  warranty_details?: string;
  accessories?: Array<{
    accessory_type: AccessoryType;
    is_present: boolean;
    condition?: string;
    description?: string;
  }>;
  received_date?: string;
}

// =====================================================
// Inventory
// =====================================================
