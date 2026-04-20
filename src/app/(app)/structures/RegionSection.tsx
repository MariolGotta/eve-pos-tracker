"use client";
import { useState } from "react";

interface Props {
  region: string;
  systemCount: number;
  structureCount: number;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

export default function RegionSection({
  region,
  systemCount,
  structureCount,
  defaultOpen = true,
  children,
}: Props) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="space-y-4">
      {/* Region header — click to collapse */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 text-left group"
      >
        <span className={`text-xs transition-transform duration-150 text-eve-muted ${open ? "rotate-90" : ""}`}>
          ▶
        </span>
        <h2 className="text-sm font-bold uppercase tracking-widest text-eve-gold group-hover:text-yellow-300 transition-colors">
          {region}
        </h2>
        <span className="text-xs text-eve-muted">
          {systemCount} system{systemCount !== 1 ? "s" : ""} · {structureCount} structure{structureCount !== 1 ? "s" : ""}
        </span>
        <div className="flex-1 border-t border-eve-border/40 ml-2" />
      </button>

      {open && <div className="space-y-6 pl-4 border-l border-eve-border/30">{children}</div>}
    </div>
  );
}
