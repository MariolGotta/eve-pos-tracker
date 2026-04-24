"use client";

import { useState } from "react";

export function InGameLink({ killId }: { killId: string }) {
  const [copied, setCopied] = useState(false);
  const link = `<touch func="show_km_detail" kill_id="${killId}">Killmail`;

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback for browsers without clipboard API
      const el = document.createElement("textarea");
      el.value = link;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <div className="bg-eve-panel border border-eve-border rounded p-4">
      <p className="text-xs text-eve-muted mb-2">
        To check this killmail in-game, copy and paste in chat:
      </p>
      <div className="flex items-center gap-3">
        <code className="flex-1 text-xs text-eve-accent font-mono bg-eve-bg border border-eve-border rounded px-3 py-2 break-all select-all">
          {link}
        </code>
        <button
          onClick={handleCopy}
          className="text-xs px-3 py-2 border border-eve-border text-eve-muted hover:text-white hover:border-eve-accent rounded transition-colors whitespace-nowrap"
        >
          {copied ? "✓ Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}
