"use client";

// Focused interactive island below the server route boundary.

import React from "react";
import { useRouter } from "next/navigation";
import { ProtectedRoute, useAuth } from "@/context/AuthContext";
import { AppLayout, Header } from "@/components/layout/Layout";
import { Button, Card, Alert } from "@/components/ui";
import { ArrowLeft } from "lucide-react";
import { CustomerCreateForm } from "../CustomerCreateForm";
import { PageShell } from "@/components/shell";

export default function NewCustomerPage() {
  const router = useRouter();
  const { currentBranch, hasPermission } = useAuth();

  const initialBranchId =
    currentBranch?.id ?? (hasPermission("canManageBranches") ? "universal" : "");

  if (!initialBranchId) {
    return (
      <ProtectedRoute requiredRoles={["OWNER", "MANAGER", "RECEPTIONIST"]}>
        <AppLayout>
          <Header title="Add Customer" subtitle="Create a new customer record" />
          <PageShell width="wizard">
            <Alert variant="error">
              Please select a branch to add a customer.
            </Alert>
          </PageShell>
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

        <PageShell width="wizard">
          <Card padding="lg">
            <CustomerCreateForm
              initialBranchId={initialBranchId}
              onSuccess={() => router.push("/customers")}
              actionsMode="page"
            />
          </Card>
        </PageShell>
      </AppLayout>
    </ProtectedRoute>
  );
}
