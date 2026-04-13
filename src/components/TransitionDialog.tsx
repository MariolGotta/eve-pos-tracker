"use client";
import { useState, useTransition } from "react";
import {
  TransitionAction,
  actionLabel,
  requiresTimer,
} from "@/lib/state-machine";
import { StructureState } from "@prisma/client";

interface Props {
  structureId: string;
  currentState: StructureState;
  actions: TransitionAction[];
  onSuccess: () => void;
}

export default function TransitionDialog({
  structureId,
  actions,
  onSuccess,
}: Props) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<TransitionAction | null>(null);
  const [expiresAt, setExpiresAt] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function openDialog() {
    setSelected(null);
    setExpiresAt("");
    setError("");
    setOpen(true);
  }

  async function submit() {
    if (!selected) return;
    setError("");

    if (requiresTimer(selected) && !expiresAt) {
      setError("Please set a timer expiry date/time.");
      return;
    }

    startTransition(async () => {
      const res = await fetch(`/api/structures/${structureId}/transition`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: selected,
          ...(expiresAt ? { expiresAt: new Date(expiresAt).toISOString() } : {}),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Transition failed");
        return;
      }

      setOpen(false);
      onSuccess();
    });
  }

  return (
    <>
      <button onClick={openDialog} className="btn-primary">
        Update State
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
          <div className="card w-full max-w-md space-y-4">
            <h2 className="text-lg font-semibold text-white">Update Structure State</h2>

            <div className="space-y-2">
              {actions.map((action) => (
                <button
                  key={action}
                  onClick={() => {
                    setSelected(action);
                    setExpiresAt("");
                    setError("");
                  }}
                  className={`w-full text-left px-4 py-2 rounded-md border text-sm transition-colors ${
                    selected === action
                      ? "border-eve-accent bg-eve-accent/20 text-white"
                      : "border-eve-border text-gray-300 hover:border-eve-accent/50"
                  }`}
                >
                  {actionLabel(action)}
                </button>
              ))}
            </div>

            {selected && requiresTimer(selected) && (
              <div>
                <label htmlFor="expiresAt">
                  Timer Expiry (when the window opens)
                </label>
                <input
                  id="expiresAt"
                  type="datetime-local"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                  className="w-full"
                />
              </div>
            )}

            {error && (
              <p className="text-red-400 text-sm">{error}</p>
            )}

            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setOpen(false)}
                className="btn-ghost"
                disabled={isPending}
              >
                Cancel
              </button>
              <button
                onClick={submit}
                className="btn-primary"
                disabled={!selected || isPending}
              >
                {isPending ? "Saving…" : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
