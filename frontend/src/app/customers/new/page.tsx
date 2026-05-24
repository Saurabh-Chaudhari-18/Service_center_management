"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { ProtectedRoute, useAuth } from "@/context/AuthContext";
import { AppLayout, Header } from "@/components/layout/Layout";
import { Button, Card, Alert } from "@/components/ui";
import { ArrowLeft } from "lucide-react";
import { CustomerCreateForm } from "../CustomerCreateForm";

export default function NewCustomerPage() {
  const router = useRouter();
  const { currentBranch, hasPermission } = useAuth();

  const initialBranchId =
    currentBranch?.id ?? (hasPermission("canManageBranches") ? "universal" : "");

  if (!initialBranchId) {
    return (
      <ProtectedRoute requiredRoles={["OWNER", "MANAGER", "RECEPTIONIST"]}>
        <AppLayout>
          <div className="p-6">
            <Alert variant="error">
              Please select a branch to add a customer.
            </Alert>
          </div>
        </AppLayout>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute requiredRoles={["OWNER", "MANAGER", "RECEPTIONIST"]}>
      <AppLayout>
        <Header
          title="Add Customer"
          subtitle="Create a new customer record"
          breadcrumbs={[
            { label: "Customers", href: "/customers" },
            { label: "Add Customer" },
          ]}
          actions={
            <Button
              variant="ghost"
              leftIcon={<ArrowLeft className="w-4 h-4" />}
              onClick={() => router.push("/customers")}
            >
              Back to customers
            </Button>
          }
        />

        <div className="p-6 max-w-3xl">
          <Card padding="lg">
            <CustomerCreateForm
              initialBranchId={initialBranchId}
              onSuccess={() => router.push("/customers")}
              actionsMode="page"
            />
          </Card>
        </div>
      </AppLayout>
    </ProtectedRoute>
  );
}
