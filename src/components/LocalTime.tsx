"use client";
import { useState, useEffect } from "react";

interface Props {
  expiresAt: string; // ISO string
  className?: string;
}

export default function LocalTime({ expiresAt, className = "" }: Props) {
  const [label, setLabel] = useState<string | null>(null);

  useEffect(() => {
    // Runs only on the client — uses the device's local timezone
    setLabel(
      new Date(expiresAt).toLocaleString(undefined, {
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      })
    );
  }, [expiresAt]);

  if (!label) return null; // avoid hydration mismatch

  return <span className={className}>{label}</span>;
}
