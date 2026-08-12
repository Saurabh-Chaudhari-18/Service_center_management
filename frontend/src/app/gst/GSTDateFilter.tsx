"use client";
import { useState, useEffect, useRef } from "react";
import { Calendar, ChevronDown } from "lucide-react";
import {
  startOfMonth, endOfMonth, subMonths,
  startOfYear, endOfYear, subYears,
  format,
} from "date-fns";
import { Button, Input } from "@/components/ui";

export type DateRange = { from: string; to: string };

interface Preset {
  label: string;
  key: string;
  getRange: () => DateRange;
}

const PRESETS: Preset[] = [
  {
    key: "this_month",
    label: "This Month",
    getRange: () => {
      const now = new Date();
      return { from: format(startOfMonth(now), "yyyy-MM-dd"), to: format(endOfMonth(now), "yyyy-MM-dd") };
    },
  },
  {
    key: "last_month",
    label: "Last Month",
    getRange: () => {
      const last = subMonths(new Date(), 1);
      return { from: format(startOfMonth(last), "yyyy-MM-dd"), to: format(endOfMonth(last), "yyyy-MM-dd") };
    },
  },
  {
    key: "this_year",
    label: "This Year",
    getRange: () => {
      const now = new Date();
      return { from: format(startOfYear(now), "yyyy-MM-dd"), to: format(endOfYear(now), "yyyy-MM-dd") };
    },
  },
  {
    key: "last_year",
    label: "Last Year",
    getRange: () => {
      const last = subYears(new Date(), 1);
      return { from: format(startOfYear(last), "yyyy-MM-dd"), to: format(endOfYear(last), "yyyy-MM-dd") };
    },
  },
  {
    key: "custom",
    label: "Custom",
    getRange: () => {
      const now = new Date();
      return { from: format(startOfMonth(now), "yyyy-MM-dd"), to: format(endOfMonth(now), "yyyy-MM-dd") };
    },
  },
];

interface GSTDateFilterProps {
  onChange: (range: DateRange) => void;
  /** Human-readable suffix shown in the label, e.g. "May 2026 – May 2026" */
  showLabel?: boolean;
}

export function GSTDateFilter({ onChange, showLabel = true }: GSTDateFilterProps) {
  const [active, setActive] = useState<string>("this_month");
  const [range, setRange] = useState<DateRange>(PRESETS[0].getRange());
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  // Emit initial value
  useEffect(() => {
    onChange(range);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectPreset = (preset: Preset) => {
    const r = preset.getRange();
    setActive(preset.key);
    setRange(r);
    onChange(r);
    if (preset.key !== "custom") setOpen(false);
  };

  const handleCustomChange = (field: "from" | "to", value: string) => {
    const updated = { ...range, [field]: value };
    setRange(updated);
    onChange(updated);
  };

  const activePreset = PRESETS.find((p) => p.key === active);

  const formatLabel = () => {
    if (active !== "custom") return activePreset?.label ?? "";
    return `${range.from} → ${range.to}`;
  };

  return (
    <div className="relative inline-block" ref={containerRef}>
      {/* Trigger button */}
      <Button
        type="button"
        variant="secondary"
        onClick={() => setOpen((o) => !o)}
        leftIcon={<Calendar className="w-4 h-4 text-primary-600" />}
        rightIcon={<ChevronDown className={`w-3.5 h-3.5 text-neutral-400 transition-transform ${open ? "rotate-180" : ""}`} />}
      >
        {showLabel && <span>{formatLabel()}</span>}
      </Button>

      {/* Dropdown */}
      {open && (
        <>
          <div className="absolute left-0 top-full mt-2 z-40 bg-white border border-neutral-200 rounded-2xl shadow-2xl overflow-hidden min-w-[260px]">
            {/* Preset pills */}
            <div className="p-3 border-b border-neutral-100">
              <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-2 px-1">Quick Select</p>
              <div className="grid grid-cols-2 gap-1.5">
                {PRESETS.map((preset) => (
                  <button
                    key={preset.key}
                    onClick={() => selectPreset(preset)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all text-left ${
                      active === preset.key
                        ? "bg-primary-600 text-white shadow-sm"
                        : "bg-neutral-50 text-neutral-600 hover:bg-neutral-100"
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom date inputs — always visible when custom is selected */}
            {active === "custom" && (
              <div className="p-3 space-y-2">
                <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-1 px-1">Custom Range</p>
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <Input
                      label="From"
                      type="date"
                      value={range.from}
                      onChange={(e) => handleCustomChange("from", e.target.value)}
                    />
                  </div>
                  <span className="text-neutral-300 text-xs mt-4">→</span>
                  <div className="flex-1">
                    <Input
                      label="To"
                      type="date"
                      value={range.to}
                      onChange={(e) => handleCustomChange("to", e.target.value)}
                    />
                  </div>
                </div>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => setOpen(false)}
                  className="mt-1 w-full"
                >
                  Apply Range
                </Button>
              </div>
            )}

            {/* Period summary */}
            <div className="px-4 py-2 bg-neutral-50 border-t border-neutral-100">
              <p className="text-[10px] text-neutral-400">
                {range.from} → {range.to}
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
