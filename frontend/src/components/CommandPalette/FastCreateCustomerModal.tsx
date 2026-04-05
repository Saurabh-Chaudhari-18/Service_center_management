"use client";

import React from "react";
import { Modal } from "@/components/ui";
import { CustomerCreateForm } from "@/app/customers/CustomerCreateForm";

interface FastCreateCustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  branchId: string;
}

export function FastCreateCustomerModal({
  isOpen,
  onClose,
  branchId,
}: FastCreateCustomerModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Quick Add Customer"
      size="xl"
    >
      <div className="p-2">
        <CustomerCreateForm
          initialBranchId={branchId}
          onSuccess={onClose}
          onCancel={onClose}
          actionsMode="modal"
        />
      </div>
    </Modal>
  );
}
