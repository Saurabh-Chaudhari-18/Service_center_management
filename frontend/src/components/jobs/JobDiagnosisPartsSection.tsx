"use client";

import { Button, Input } from "@/components/ui";
import { Plus, Trash2 } from "lucide-react";

export type DiagnosisPartFormRow = {
  name: string;
  price: string;
  warranty_months: string;
  quantity: string;
};

interface JobDiagnosisPartsSectionProps {
  parts: DiagnosisPartFormRow[];
  totalPartsPrice: number;
  onAddPart: () => void;
  onRemovePart: (index: number) => void;
  onPartChange: (
    index: number,
    field: keyof DiagnosisPartFormRow,
    value: string,
  ) => void;
}

export function JobDiagnosisPartsSection({
  parts,
  totalPartsPrice,
  onAddPart,
  onRemovePart,
  onPartChange,
}: JobDiagnosisPartsSectionProps) {
  return (
    <div className="space-y-3 pt-4 border-t border-neutral-100">
      <div className="flex items-center justify-between">
        <h4 className="font-medium text-neutral-900">Spare Parts</h4>
        <Button
          size="sm"
          variant="secondary"
          leftIcon={<Plus className="w-4 h-4" />}
          onClick={onAddPart}
          type="button"
        >
          Add Part
        </Button>
      </div>

      <div className="space-y-3">
        {parts.length > 0 && (
          <div className="grid grid-cols-[1fr_6rem_5rem_8rem_2.5rem] gap-3 text-sm font-medium text-neutral-500 px-1 mb-2">
            <div>Part Name</div>
            <div>Price</div>
            <div>Qty</div>
            <div>Warranty</div>
            <div />
          </div>
        )}
        {parts.map((part, index) => (
          <div
            key={index}
            className="grid grid-cols-[1fr_6rem_5rem_8rem_2.5rem] gap-3 items-start"
          >
            <div>
              <Input
                placeholder="Part Name"
                value={part.name}
                onChange={(e) =>
                  onPartChange(index, "name", e.target.value)
                }
                className="h-9"
              />
            </div>
            <div>
              <Input
                type="number"
                placeholder="Price"
                value={part.price}
                onChange={(e) =>
                  onPartChange(index, "price", e.target.value)
                }
                className="h-9"
              />
            </div>
            <div>
              <Input
                type="number"
                placeholder="Qty"
                value={part.quantity}
                onChange={(e) =>
                  onPartChange(index, "quantity", e.target.value)
                }
                className="h-9"
              />
            </div>
            <div>
              <Input
                type="number"
                placeholder="0"
                value={part.warranty_months}
                onChange={(e) =>
                  onPartChange(index, "warranty_months", e.target.value)
                }
                className="h-9"
              />
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="p-2 text-red-500 hover:text-red-600 hover:bg-red-50"
              type="button"
              onClick={() => onRemovePart(index)}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        ))}
        {parts.length === 0 && (
          <p className="text-sm text-neutral-500 text-center py-2 bg-neutral-50 rounded-lg border border-dashed border-neutral-200">
            No parts added. Click &quot;Add Part&quot; to include spares.
          </p>
        )}

        {parts.length > 0 && (
          <div className="flex justify-end pt-2">
            <p className="text-sm font-medium">
              Total Parts Cost:{" "}
              <span className="text-green-600">
                ₹{totalPartsPrice.toFixed(2)}
              </span>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
