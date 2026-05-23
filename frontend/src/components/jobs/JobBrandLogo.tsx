"use client";

interface JobBrandLogoProps {
  brand: string;
}

/** Match known OEM marks case-insensitively; other brands show initials. */
function normalizedBrand(brand: string): string {
  return brand.trim().toUpperCase();
}

export function JobBrandLogo({ brand }: JobBrandLogoProps) {
  const key = normalizedBrand(brand);

  switch (key) {
    case "HP":
      return (
        <svg viewBox="0 0 100 100" className="w-8 h-8">
          <circle cx="50" cy="50" r="45" fill="#0096D6" />
          <text
            x="50"
            y="65"
            fontSize="40"
            fontWeight="bold"
            fill="white"
            textAnchor="middle"
            className="italic font-serif"
          >
            hp
          </text>
        </svg>
      );
    case "DELL":
      return (
        <svg viewBox="0 0 100 100" className="w-8 h-8">
          <circle
            cx="50"
            cy="50"
            r="48"
            fill="none"
            stroke="#007DB8"
            strokeWidth="4"
          />
          <text
            x="50"
            y="60"
            fontSize="24"
            fontWeight="bold"
            fill="#007DB8"
            textAnchor="middle"
            fontFamily="sans-serif"
          >
            DELL
          </text>
        </svg>
      );
    case "ASUS":
      return (
        <svg viewBox="0 0 100 30" className="w-12 h-6">
          <text
            x="50"
            y="22"
            fontSize="24"
            fontWeight="bold"
            fill="#00539B"
            textAnchor="middle"
            className="tracking-widest"
          >
            ASUS
          </text>
        </svg>
      );
    case "LENOVO":
      return (
        <svg viewBox="0 0 100 40" className="w-16 h-8">
          <rect width="100" height="40" fill="#E2231A" />
          <text
            x="50"
            y="28"
            fontSize="20"
            fontWeight="bold"
            fill="white"
            textAnchor="middle"
            fontFamily="sans-serif"
          >
            Lenovo
          </text>
        </svg>
      );
    default: {
      const initials =
        key.length >= 2 ? key.slice(0, 2) : key.length === 1 ? key : "?";
      return (
        <div className="w-8 h-8 shrink-0 rounded-full bg-neutral-200 flex items-center justify-center text-xs font-bold text-neutral-600">
          {initials}
        </div>
      );
    }
  }
}
