"use client";

import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { AppLayout, Header } from "@/components/layout/Layout";
import { Alert, Button, Card, LoadingState } from "@/components/ui";
import { ProtectedRoute } from "@/context/AuthContext";
import { customersApi } from "@/lib/api";
import { CustomerCreateForm } from "../../CustomerCreateForm";

export default function EditCustomerPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: customer, isLoading, error } = useQuery({
    queryKey: ["customer", id],
    queryFn: () => customersApi.get(id),
    enabled: Boolean(id),
  });

  return (
    <ProtectedRoute requiredRoles={["OWNER", "MANAGER", "RECEPTIONIST"]}>
      <AppLayout>
        <Header
          title="Edit Customer"
          subtitle={customer ? `${customer.first_name} ${customer.last_name}`.trim() : "Update customer details"}
          breadcrumbs={[
            { label: "Customers", href: "/customers" },
            { label: customer ? `${customer.first_name} ${customer.last_name}`.trim() : "Customer", href: `/customers/${id}` },
            { label: "Edit" },
          ]}
          actions={
            <Button
              variant="ghost"
              leftIcon={<ArrowLeft className="h-4 w-4" />}
              onClick={() => router.push(`/customers/${id}`)}
            >
              Back to customer
            </Button>
          }
        />

        <div className="max-w-3xl p-6">
          {isLoading ? (
            <LoadingState message="Loading customer…" />
          ) : error || !customer ? (
            <Alert variant="error">Unable to load this customer.</Alert>
          ) : (
            <Card padding="lg">
              <CustomerCreateForm
                customerId={id}
                initialBranchId={customer.branch}
                initialValues={{
                  first_name: customer.first_name,
                  last_name: customer.last_name,
                  mobile: customer.mobile.replace(/\D/g, "").slice(-10),
                  alternate_mobile: customer.alternate_mobile?.replace(/\D/g, "").slice(-10) || "",
                  email: customer.email,
                  address_line1: customer.address_line1,
                  address_line2: customer.address_line2,
                  city: customer.city,
                  state: customer.state,
                  pincode: customer.pincode,
                  state_code: customer.state_code,
                  company_name: customer.company_name,
                  gstin: customer.gstin,
                  sms_enabled: customer.sms_enabled,
                  whatsapp_enabled: customer.whatsapp_enabled,
                  notes: customer.notes,
                }}
                onSuccess={() => router.push(`/customers/${id}`)}
                actionsMode="page"
              />
            </Card>
          )}
        </div>
      </AppLayout>
    </ProtectedRoute>
  );
}
