import { z } from "zod";

export const createJobSchema = z.object({
  customer_id: z.string().min(1, "Please select a customer"),
  device_type: z.string().min(1, "Device type is required"),
  brand: z.string().min(1, "Brand is required"),
  model: z.string().min(1, "Model is required"),
  serial_number: z.string().optional(),
  customer_complaint: z.string().min(10, "Please describe the issue in detail"),
  physical_condition: z.object({
    selected: z.array(z.string()),
    other_text: z.string().optional(),
  }).optional(),
  engineer_diagnosis: z.object({
    selected: z.array(z.string()),
    other_text: z.string().optional(),
  }).optional(),
  device_password: z.string().optional(),
  is_urgent: z.boolean().optional(),
  is_warranty_repair: z.boolean().optional(),
  warranty_details: z.string().optional(),
  diagnosis_notes: z.string().optional(),
  additional_comments: z.string().optional(),
  received_date: z.string().min(1, "Received date is required"),
});

export type CreateJobFormData = z.infer<typeof createJobSchema>;

// Fields that must be valid before advancing to Step 2
export const STEP1_FIELDS = [
  "customer_id",
  "device_type",
  "brand",
  "model",
  "customer_complaint",
] as const;

// =====================================================
// Step Indicator
// =====================================================
