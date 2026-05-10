"use client";

import { Button, Input } from "@/components/ui";
import { Camera, Trash2, Upload } from "lucide-react";

interface JobDiagnosisPhotosSectionProps {
  damagePhotos: File[];
  photoDescriptions: string[];
  onDescriptionChange: (index: number, value: string) => void;
  onRemove: (index: number) => void;
  onFileSelected: (file: File) => void;
}

export function JobDiagnosisPhotosSection({
  damagePhotos,
  photoDescriptions,
  onDescriptionChange,
  onRemove,
  onFileSelected,
}: JobDiagnosisPhotosSectionProps) {
  return (
    <div className="space-y-3 pt-4 border-t border-gray-100">
      <h4 className="font-medium text-neutral-900 flex items-center gap-2">
        <Camera className="w-4 h-4" /> Diagnosis Photos
      </h4>
      <p className="text-xs text-neutral-500">
        Upload images of any physical damage found during diagnosis. These may be
        visible to the customer.
      </p>
      <div className="space-y-3">
        {damagePhotos.map((photo, index) => (
          <div
            key={`${photo.name}-${index}`}
            className="flex items-start gap-3 bg-neutral-50 p-2 rounded-lg border border-neutral-100"
          >
            <div className="flex-1 space-y-2">
              <div className="text-sm font-medium px-1 truncate">{photo.name}</div>
              <Input
                placeholder="Description (e.g. Scratched screen)"
                value={photoDescriptions[index] || ""}
                onChange={(e) => onDescriptionChange(index, e.target.value)}
              />
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="text-red-500 hover:text-red-600 hover:bg-red-50 mt-7"
              type="button"
              onClick={() => onRemove(index)}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        ))}

        <div className="flex items-center gap-2">
          <input
            type="file"
            accept="image/*"
            className="hidden"
            id="damage-photo-upload"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                onFileSelected(file);
                e.target.value = "";
              }
            }}
          />
          <Button
            variant="secondary"
            size="sm"
            onClick={() =>
              document.getElementById("damage-photo-upload")?.click()
            }
            leftIcon={<Upload className="w-4 h-4" />}
            type="button"
          >
            Add Photo
          </Button>
        </div>
      </div>
    </div>
  );
}
