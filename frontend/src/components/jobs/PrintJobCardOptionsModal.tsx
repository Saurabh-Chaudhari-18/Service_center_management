"use client";

import { useState } from "react";
import { Modal, Button, Input } from "@/components/ui";
import type { Branch } from "@/types";
import { Building2, MapPin } from "lucide-react";

interface PrintJobCardOptionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Called with the selected branch object (or null for custom-name-only mode) and optional custom name */
  onConfirm: (selectedBranch: Branch | null, customName?: string) => void;
  /** The branch the job belongs to */
  branchDetails: Branch | null;
  /** All branches accessible to the current user — so they can print any branch's header */
  allBranches?: Branch[];
}

export function PrintJobCardOptionsModal({
  isOpen,
  onClose,
  onConfirm,
  branchDetails,
  allBranches = [],
}: PrintJobCardOptionsModalProps) {
  // Default: select the job's own branch
  const defaultBranchId = branchDetails?.id ?? "";
  const [selectedBranchId, setSelectedBranchId] = useState<string>(defaultBranchId);
  const [useCustomName, setUseCustomName] = useState(false);
  const [customName, setCustomName] = useState("");

  // Merge: always include the job's branch even if not in allBranches
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
      title="Print Job Card — Header Options"
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
          Choose which branch header to print. The shop name, address, phone
          number and GSTIN will all be taken from the selected branch.
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
                  <label
                    key={branch.id}
                    className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                      isSelected
                        ? "border-primary-500 bg-primary-50 dark:bg-primary-900/20 dark:border-primary-400"
                        : "border-neutral-200 dark:border-slate-700 hover:bg-neutral-50 dark:hover:bg-slate-800"
                    }`}
                  >
                    <input
                      type="radio"
                      name="branchOption"
                      checked={isSelected}
                      onChange={() => {
                        setSelectedBranchId(branch.id);
                        setUseCustomName(false);
                      }}
                      className="h-4 w-4 mt-0.5 text-primary-600 border-neutral-300 flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5 text-primary-500 flex-shrink-0" />
                        <span className="text-sm font-semibold text-neutral-800 dark:text-neutral-100 truncate">
                          {branch.name}
                        </span>
                        {branch.id === branchDetails?.id && (
                          <span className="text-[10px] bg-primary-100 text-primary-700 dark:bg-primary-800 dark:text-primary-200 px-1.5 py-0.5 rounded font-medium flex-shrink-0">
                            Job’s Branch
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
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
        )}

        {/* Optional: override just the printed name */}
        <div className="border-t border-neutral-100 dark:border-slate-700 pt-4 space-y-3">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={useCustomName}
              onChange={(e) => setUseCustomName(e.target.checked)}
              className="h-4 w-4 text-primary-600 border-neutral-300 rounded"
            />
            <span className="text-sm font-medium text-neutral-700 dark:text-neutral-200">
              Override shop name only (keep address/GSTIN from selected branch)
            </span>
          </label>

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
