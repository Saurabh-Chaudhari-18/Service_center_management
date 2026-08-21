"use client";

import React, {
  useEffect,
  useRef,
  useState,
  startTransition,
} from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Modal, Button, Input, Textarea } from "@/components/ui";
import { DollarSign } from "lucide-react";
import { jobsApi } from "@/lib/api";
import type { JobCard } from "@/types";
import {
  JobDiagnosisPartsSection,
  type DiagnosisPartFormRow,
} from "./JobDiagnosisPartsSection";
import { JobDiagnosisPhotosSection } from "./JobDiagnosisPhotosSection";

export interface JobDiagnosisModalProps {
  isOpen: boolean;
  onClose: () => void;
  jobId: string;
  initialData?: JobCard;
}

export function JobDiagnosisModal({
  isOpen,
  onClose,
  jobId,
  initialData,
}: JobDiagnosisModalProps) {
  const queryClient = useQueryClient();
  const [diagnosis, setDiagnosis] = useState("");
  const [estimatedCost, setEstimatedCost] = useState("");
  const [estimatedDate, setEstimatedDate] = useState("");
  const [parts, setParts] = useState<DiagnosisPartFormRow[]>([
    { name: "", price: "", warranty_months: "0", quantity: "1" },
  ]);
  const [damagePhotos, setDamagePhotos] = useState<File[]>([]);
  const [photoDescriptions, setPhotoDescriptions] = useState<string[]>([]);
  const prevIsOpenRef = useRef(false);

  useEffect(() => {
    if (isOpen && !prevIsOpenRef.current) {
      if (initialData) {
        startTransition(() => {
          setDiagnosis(initialData.diagnosis_notes || "");
          setEstimatedCost(
            initialData.estimated_cost
              ? String(initialData.estimated_cost)
              : "",
          );
          setEstimatedDate(initialData.estimated_completion_date || "");
          const existingParts =
            initialData.diagnosis_parts && initialData.diagnosis_parts.length > 0
              ? initialData.diagnosis_parts.map((p) => ({
                  name: p.name,
                  price: String(p.price),
                  warranty_months: String(p.warranty_months),
                  quantity: String(p.quantity),
                }))
              : [{ name: "", price: "", warranty_months: "0", quantity: "1" }];
          setParts(existingParts);
        });
      } else {
        // Fresh open — start with one blank row so the combobox is visible
        startTransition(() => {
          setParts([{ name: "", price: "", warranty_months: "0", quantity: "1" }]);
        });
      }
    } else if (!isOpen && prevIsOpenRef.current) {
      startTransition(() => {
        setDiagnosis("");
        setEstimatedCost("");
        setEstimatedDate("");
        setParts([{ name: "", price: "", warranty_months: "0", quantity: "1" }]);
        setDamagePhotos([]);
        setPhotoDescriptions([]);
      });
    }
    prevIsOpenRef.current = isOpen;
  }, [isOpen, initialData]);


  const totalPartsPrice = parts
    .filter((p) => p.name && p.name.trim().length > 0)
    .reduce((sum, part) => {
      return sum + (parseFloat(part.price) || 0) * (parseInt(part.quantity) || 1);
    }, 0);

  const handleAddPart = () => {
    setParts((prev) => {
      if (prev.length > 0 && !prev[prev.length - 1].name.trim()) {
        return prev;
      }
      return [
        ...prev,
        { name: "", price: "", warranty_months: "0", quantity: "1" },
      ];
    });
  };

  const handleRemovePart = (index: number) => {
    setParts((prev) => {
      const next = prev.filter((_, i) => i !== index);
      return next.length === 0
        ? [{ name: "", price: "", warranty_months: "0", quantity: "1" }]
        : next;
    });
  };

  const handlePartChange = (
    index: number,
    field: keyof DiagnosisPartFormRow,
    value: string,
  ) => {
    const newParts = [...parts];
    newParts[index][field] = value;
    setParts(newParts);
  };

  const { mutate, isPending } = useMutation({
    mutationFn: () =>
      jobsApi.addDiagnosis(
        jobId,
        diagnosis,
        estimatedCost ? parseFloat(estimatedCost) : undefined,
        estimatedDate || undefined,
        parts
          .filter((p) => p.name && p.name.trim().length > 0)
          .map((p) => ({
            name: p.name.trim(),
            price: parseFloat(p.price) || 0,
            warranty_months: parseInt(p.warranty_months) || 0,
            quantity: parseInt(p.quantity) || 1,
          })),
      ),
    onSuccess: async () => {
      if (damagePhotos.length > 0) {
        try {
          for (let i = 0; i < damagePhotos.length; i++) {
            if (damagePhotos[i]) {
              await jobsApi.uploadPhoto(
                jobId,
                damagePhotos[i],
                "DAMAGE",
                photoDescriptions[i] || "Damage during diagnosis",
              );
            }
          }
        } catch (e) {
          console.error("Failed to upload damage photos", e);
        }
      }
      queryClient.invalidateQueries({ queryKey: ["job", jobId] });
      onClose();
    },
  });

  const onPhotoDescriptionChange = (index: number, value: string) => {
    const next = [...photoDescriptions];
    next[index] = value;
    setPhotoDescriptions(next);
  };

  const onPhotoRemove = (index: number) => {
    setDamagePhotos(damagePhotos.filter((_, i) => i !== index));
    setPhotoDescriptions(photoDescriptions.filter((_, i) => i !== index));
  };

  const onPhotoAdd = (file: File) => {
    setDamagePhotos([...damagePhotos, file]);
    setPhotoDescriptions([...photoDescriptions, ""]);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Add Diagnosis"
      size="2xl"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => mutate()}
            isLoading={isPending}
            disabled={!diagnosis}
          >
            Save Diagnosis
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Textarea
          label="Diagnosis Notes"
          placeholder="Describe the issue found and recommended repairs..."
          value={diagnosis}
          onChange={(e) => setDiagnosis(e.target.value)}
          required
          rows={4}
        />
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Estimated Cost (₹)"
            type="number"
            placeholder="0.00"
            value={estimatedCost}
            onChange={(e) => setEstimatedCost(e.target.value)}
            leftIcon={<DollarSign className="w-4 h-4" />}
          />
          <Input
            label="Estimated Completion Date"
            type="date"
            value={estimatedDate}
            onChange={(e) => setEstimatedDate(e.target.value)}
          />
        </div>

        <JobDiagnosisPhotosSection
          damagePhotos={damagePhotos}
          photoDescriptions={photoDescriptions}
          onDescriptionChange={onPhotoDescriptionChange}
          onRemove={onPhotoRemove}
          onFileSelected={onPhotoAdd}
        />

        <JobDiagnosisPartsSection
          parts={parts}
          totalPartsPrice={totalPartsPrice}
          onAddPart={handleAddPart}
          onRemovePart={handleRemovePart}
          onPartChange={handlePartChange}
        />
      </div>
    </Modal>
  );
}
