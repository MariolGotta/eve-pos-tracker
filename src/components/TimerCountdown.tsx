"use client";
import { useEffect, useState } from "react";

interface Props {
  expiresAt: string; // ISO string
  className?: string;
}

function formatDuration(ms: number): string {
  if (ms <= 0) return "EXPIRED";
  const totalSeconds = Math.floor(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return [
    h > 0 ? String(h).padStart(2, "0") : null,
    String(m).padStart(2, "0"),
    String(s).padStart(2, "0"),
  ]
    .filter(Boolean)
    .join(":");
}

export default function TimerCountdown({ expiresAt, className = "" }: Props) {
  const [remaining, setRemaining] = useState(
    new Date(expiresAt).getTime() - Date.now()
  );

  useEffect(() => {
    const interval = setInterval(() => {
      setRemaining(new Date(expiresAt).getTime() - Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  const isExpired = remaining <= 0;
  const isUrgent = remaining > 0 && remaining < 15 * 60_000; // < 15 min

  return (
    <span
      className={`font-mono tabular-nums text-sm ${
        isExpired
          ? "text-red-400 font-bold"
          : isUrgent
          ? "text-orange-400"
          : "text-gray-300"
      } ${className}`}
    >
      {formatDuration(remaining)}
    </span>
  );
}
