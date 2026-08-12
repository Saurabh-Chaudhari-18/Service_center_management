"use client";

import { useState } from "react";
import { Modal, Button, Checkbox, Input, Radio } from "@/components/ui";
import type { Branch } from "@/types";
import { Building2, MapPin } from "lucide-react";

interface PrintInvoiceOptionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Called with the selected branch object (or null for custom-name-only mode) and optional custom name */
  onConfirm: (selectedBranch: Branch | null, customName?: string) => void;
  /** The branch the invoice belongs to */
  branchDetails?: Branch | null;
  /** All branches accessible to the current user — so they can print any branch's header */
  allBranches?: Branch[];
}

export function PrintInvoiceOptionsModal({
  isOpen,
  onClose,
  onConfirm,
  branchDetails = null,
  allBranches = [],
}: PrintInvoiceOptionsModalProps) {
  // Default: select the invoice's own branch
  const defaultBranchId = branchDetails?.id ?? "";
  const [selectedBranchId, setSelectedBranchId] = useState<string>(defaultBranchId);
  const [useCustomName, setUseCustomName] = useState(false);
  const [customName, setCustomName] = useState("");

  // Merge: always include the invoice's branch even if not in allBranches
  const branches: Branch[] = allBranches.length
    ? allBranches
    : branchDetails
    ? [branchDetails]
    : [];

  const selectedBranch = branches.find((b) => b.id === selectedBranchId) ?? branchDetails;

  const handlePrint = () => {
    if (useCustomName) {
      // Custom name overrides only the shop name; keep other header from selected branch
      onConfirm(selectedBranch ?? null, customName.trim() || selectedBranch?.name);
    } else {
      onConfirm(selectedBranch ?? null);
    }
    onClose();
  };

  const printDisabled = useCustomName && !customName.trim();

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Print Invoice — Header Options"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handlePrint} disabled={printDisabled}>
            Print
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <p className="text-sm text-neutral-600 dark:text-neutral-300">
          Choose which branch header to print on the invoice. The shop name, address, phone
          number, and GSTIN will all be taken from the selected branch.
        </p>

        {/* Branch selector */}
        {branches.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
              Select Branch Header
            </p>
            <div className="space-y-2">
              {branches.map((branch) => {
                const isSelected = selectedBranchId === branch.id;
                return (
                  <Radio
                    key={branch.id}
                    containerClassName={`rounded-lg border p-3 transition-colors ${
                      isSelected
                        ? "border-primary-500 bg-primary-50 dark:bg-primary-900/20 dark:border-primary-400"
                        : "border-neutral-200 dark:border-slate-700 hover:bg-neutral-50 dark:hover:bg-slate-800"
                    }`}
                    name="branchOption"
                    checked={isSelected}
                    onChange={() => {
                      setSelectedBranchId(branch.id);
                      setUseCustomName(false);
                    }}
                    label={<div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5 text-primary-500 flex-shrink-0" />
                        <span className="text-sm font-semibold text-neutral-800 dark:text-neutral-100 truncate">
                          {branch.name}
                        </span>
                        {branch.id === branchDetails?.id && (
                          <span className="text-[10px] bg-primary-100 text-primary-700 dark:bg-primary-800 dark:text-primary-200 px-1.5 py-0.5 rounded font-medium flex-shrink-0">
                            Invoice’s Branch
                          </span>
                        )}
                      </div>
                      {(branch.address_line1 || branch.city) && (
                        <div className="flex items-start gap-1 mt-0.5">
                          <MapPin className="w-3 h-3 text-neutral-400 mt-0.5 flex-shrink-0" />
                          <span className="text-xs text-neutral-500 leading-snug">
                            {[branch.address_line1, branch.city, branch.state, branch.pincode]
                              .filter(Boolean)
                              .join(", ")}
                          </span>
                        </div>
                      )}
                      {branch.phone && (
                        <p className="text-xs text-neutral-500 mt-0.5 ml-4">
                          📞 {branch.phone}
                        </p>
                      )}
                      {branch.gstin && (
                        <p className="text-xs text-neutral-400 mt-0.5 ml-4 font-mono">
                          GSTIN: {branch.gstin}
                        </p>
                      )}
                    </div>}
                  />
                );
              })}
            </div>
          </div>
        )}

        {/* Optional: override just the printed name */}
        <div className="border-t border-neutral-100 dark:border-slate-700 pt-4 space-y-3">
          <Checkbox
            label="Override shop name only"
            description="Keep the address and GSTIN from the selected branch"
            checked={useCustomName}
            onChange={(e) => setUseCustomName(e.target.checked)}
          />

          {useCustomName && (
            <Input
              type="text"
              placeholder="Enter custom shop name to print"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              required
              className="w-full"
              autoFocus
            />
          )}
        </div>
      </div>
    </Modal>
  );
}
