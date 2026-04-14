"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import SYSTEMS from "@/lib/eve-systems.json";

const ALL_SYSTEMS: string[] = SYSTEMS as string[];
const MAX_RESULTS = 12;

interface Props {
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  id?: string;
  placeholder?: string;
  className?: string;
}

export default function SystemAutocomplete({
  value,
  onChange,
  required,
  id,
  placeholder = "e.g. Jita",
  className = "",
}: Props) {
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Filter: prefix matches first, then contains
  const suggestions = useCallback((): string[] => {
    if (!value.trim()) return [];
    const q = value.trim().toUpperCase();
    const prefix: string[] = [];
    const contains: string[] = [];
    for (const s of ALL_SYSTEMS) {
      const u = s.toUpperCase();
      if (u.startsWith(q)) prefix.push(s);
      else if (u.includes(q)) contains.push(s);
      if (prefix.length + contains.length >= MAX_RESULTS * 3) break;
    }
    return [...prefix, ...contains].slice(0, MAX_RESULTS);
  }, [value]);

  const items = suggestions();

  // Close on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  // Reset cursor when list changes
  useEffect(() => { setCursor(0); }, [items.length]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || items.length === 0) {
      if (e.key === "ArrowDown" && items.length > 0) setOpen(true);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setCursor((c) => Math.min(c + 1, items.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setCursor((c) => Math.max(c - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (items[cursor]) {
        onChange(items[cursor]);
        setOpen(false);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  function select(s: string) {
    onChange(s);
    setOpen(false);
    inputRef.current?.focus();
  }

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <input
        ref={inputRef}
        id={id}
        value={value}
        required={required}
        placeholder={placeholder}
        autoComplete="off"
        spellCheck={false}
        className="w-full"
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
          setCursor(0);
        }}
        onFocus={() => { if (items.length > 0) setOpen(true); }}
        onKeyDown={handleKeyDown}
      />

      {open && items.length > 0 && (
        <ul className="absolute z-50 left-0 right-0 mt-1 bg-eve-panel border border-eve-border rounded-md shadow-xl max-h-60 overflow-y-auto text-sm">
          {items.map((s, i) => (
            <li
              key={s}
              onMouseDown={(e) => { e.preventDefault(); select(s); }}
              onMouseEnter={() => setCursor(i)}
              className={`px-3 py-1.5 cursor-pointer select-none ${
                i === cursor
                  ? "bg-eve-accent/20 text-white"
                  : "text-gray-300 hover:bg-eve-accent/10"
              }`}
            >
              {s}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
