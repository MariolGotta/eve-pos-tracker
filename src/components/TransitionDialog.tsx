"use client";
import { useState, useTransition } from "react";
import { TransitionAction, actionLabel } from "@/lib/state-machine";
import { StructureState } from "@prisma/client";

interface Props {
  structureId: string;
  currentState: StructureState;
  actions: TransitionAction[];
  /** When true, dialog opens immediately in "what happened?" mode (post 12-min window) */
  autoOpen?: boolean;
  onSuccess: () => void;
  onClose?: () => void;
}

// ── Duration input (hours + minutes, for SHIELD_DOWN) ────────────────────────
function ShieldDurationInput({
  hours,
  minutes,
  onChange,
}: {
  hours: number;
  minutes: number;
  onChange: (h: number, m: number) => void;
}) {
  return (
    <div>
      <label>Time until armor window opens</label>
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <input
            type="number"
            min={0}
            max={47}
            value={hours}
            onChange={(e) => onChange(Math.max(0, parseInt(e.target.value) || 0), minutes)}
            className="w-full text-center"
          />
          <p className="text-xs text-eve-muted text-center mt-0.5">hours</p>
        </div>
        <span className="text-2xl font-bold text-eve-muted pb-4">:</span>
        <div className="flex-1">
          <input
            type="number"
            min={0}
            max={59}
            value={minutes}
            onChange={(e) => {
              const m = Math.max(0, Math.min(59, parseInt(e.target.value) || 0));
              onChange(hours, m);
            }}
            className="w-full text-center"
          />
          <p className="text-xs text-eve-muted text-center mt-0.5">minutes</p>
        </div>
      </div>
      {(hours > 0 || minutes > 0) && (
        <p className="text-xs text-eve-muted mt-1">
          Window opens at:{" "}
          <span className="text-gray-300">
            {new Date(Date.now() + hours * 3_600_000 + minutes * 60_000).toUTCString()}
          </span>
        </p>
      )}
    </div>
  );
}

// ── Hull timer input (days + hours + minutes, for ARMOR_DOWN) ─────────────────
function HullDurationInput({
  days,
  hours,
  minutes,
  onChange,
}: {
  days: number;
  hours: number;
  minutes: number;
  onChange: (d: number, h: number, m: number) => void;
}) {
  const totalMs = days * 86_400_000 + hours * 3_600_000 + minutes * 60_000;
  return (
    <div>
      <label>Time until hull window opens</label>
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <input
            type="number"
            min={0}
            max={8}
            value={days}
            onChange={(e) => onChange(Math.max(0, Math.min(8, parseInt(e.target.value) || 0)), hours, minutes)}
            className="w-full text-center"
          />
          <p className="text-xs text-eve-muted text-center mt-0.5">days</p>
        </div>
        <span className="text-xl font-bold text-eve-muted pb-4">:</span>
        <div className="flex-1">
          <input
            type="number"
            min={0}
            max={23}
            value={hours}
            onChange={(e) => onChange(days, Math.max(0, Math.min(23, parseInt(e.target.value) || 0)), minutes)}
            className="w-full text-center"
          />
          <p className="text-xs text-eve-muted text-center mt-0.5">hours</p>
        </div>
        <span className="text-xl font-bold text-eve-muted pb-4">:</span>
        <div className="flex-1">
          <input
            type="number"
            min={0}
            max={59}
            value={minutes}
            onChange={(e) => onChange(days, hours, Math.max(0, Math.min(59, parseInt(e.target.value) || 0)))}
            className="w-full text-center"
          />
          <p className="text-xs text-eve-muted text-center mt-0.5">minutes</p>
        </div>
      </div>
      {totalMs > 0 && (
        <p className="text-xs text-eve-muted mt-1">
          Window opens at:{" "}
          <span className="text-gray-300">
            {new Date(Date.now() + totalMs).toUTCString()}
          </span>
        </p>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function TransitionDialog({
  structureId,
  currentState,
  actions,
  autoOpen = false,
  onSuccess,
  onClose,
}: Props) {
  const isVulnerable =
    currentState === "ARMOR_VULNERABLE" || currentState === "HULL_VULNERABLE";

  const [open, setOpen] = useState(autoOpen);
  const [selected, setSelected] = useState<TransitionAction | null>(null);

  // Shield timer (SHIELD_DOWN): hours + minutes
  const [shieldH, setShieldH] = useState(23);
  const [shieldM, setShieldM] = useState(55);

  // Hull timer (ARMOR_DOWN): days + hours + minutes
  const [hullD, setHullD] = useState(1);
  const [hullH, setHullH] = useState(0);
  const [hullM, setHullM] = useState(0);

  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function close() {
    setOpen(false);
    onClose?.();
  }

  function openDialog() {
    setSelected(null);
    setError("");
    setOpen(true);
  }

  function buildExpiresAt(): string | undefined {
    if (selected === "SHIELD_DOWN") {
      const ms = shieldH * 3_600_000 + shieldM * 60_000;
      if (ms <= 0) return undefined;
      return new Date(Date.now() + ms).toISOString();
    }
    if (selected === "ARMOR_DOWN") {
      const ms = hullD * 86_400_000 + hullH * 3_600_000 + hullM * 60_000;
      if (ms <= 0) return undefined;
      return new Date(Date.now() + ms).toISOString();
    }
    return undefined;
  }

  async function submit() {
    if (!selected) return;
    setError("");

    if (selected === "SHIELD_DOWN" && shieldH === 0 && shieldM === 0) {
      setError("Duration must be greater than 0.");
      return;
    }
    if (selected === "ARMOR_DOWN" && hullD === 0 && hullH === 0 && hullM === 0) {
      setError("Duration must be greater than 0.");
      return;
    }

    const expiresAt = buildExpiresAt();

    startTransition(async () => {
      const res = await fetch(`/api/structures/${structureId}/transition`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: selected, expiresAt }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Transition failed");
        return;
      }

      close();
      onSuccess();
    });
  }

  // ── Vulnerable states: "what happened?" dialog ────────────────────────────
  if (isVulnerable) {
    const attackedAction: TransitionAction =
      currentState === "ARMOR_VULNERABLE" ? "ARMOR_DOWN" : "MARK_DEAD";

    return (
      <>
        <button onClick={openDialog} className="btn-primary">
          Update State
        </button>

        {open && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
            <div className="card w-full max-w-md space-y-4">
              <h2 className="text-lg font-semibold text-white">
                What happened to the POS?
              </h2>

              {selected === null && (
                <div className="space-y-2">
                  <button
                    onClick={() => setSelected("REGENERATED")}
                    className="w-full text-left px-4 py-3 rounded-md border border-eve-border text-sm text-gray-300 hover:border-blue-500 transition-colors"
                  >
                    🔵 POS Regenerated — nobody attacked, shields back up
                  </button>
                  <button
                    onClick={() => { setSelected(attackedAction); setError(""); }}
                    className="w-full text-left px-4 py-3 rounded-md border border-eve-border text-sm text-gray-300 hover:border-red-500 transition-colors"
                  >
                    {currentState === "ARMOR_VULNERABLE"
                      ? "🔴 Was Attacked — armor stripped, set hull timer"
                      : "💀 Was Destroyed — mark as dead"}
                  </button>
                </div>
              )}

              {selected === "ARMOR_DOWN" && (
                <HullDurationInput
                  days={hullD}
                  hours={hullH}
                  minutes={hullM}
                  onChange={(d, h, m) => { setHullD(d); setHullH(h); setHullM(m); }}
                />
              )}

              {error && <p className="text-red-400 text-sm">{error}</p>}

              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => selected ? setSelected(null) : close()}
                  className="btn-ghost"
                  disabled={isPending}
                >
                  {selected ? "Back" : "Cancel"}
                </button>
                {selected && (
                  <button
                    onClick={submit}
                    className="btn-primary"
                    disabled={isPending}
                  >
                    {isPending ? "Saving…" : "Confirm"}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  // ── Normal states ──────────────────────────────────────────────────────────
  return (
    <>
      <button onClick={openDialog} className="btn-primary">
        Update State
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
          <div className="card w-full max-w-md space-y-4">
            <h2 className="text-lg font-semibold text-white">Update Structure State</h2>

            {selected === null && (
              <div className="space-y-2">
                {actions.map((action) => (
                  <button
                    key={action}
                    onClick={() => { setSelected(action); setError(""); }}
                    className="w-full text-left px-4 py-2 rounded-md border border-eve-border text-sm text-gray-300 hover:border-eve-accent/50 transition-colors"
                  >
                    {actionLabel(action)}
                  </button>
                ))}
              </div>
            )}

            {selected === "SHIELD_DOWN" && (
              <ShieldDurationInput
                hours={shieldH}
                minutes={shieldM}
                onChange={(h, m) => { setShieldH(h); setShieldM(m); }}
              />
            )}

            {error && <p className="text-red-400 text-sm">{error}</p>}

            <div className="flex gap-2 justify-end">
              <button
                onClick={() => selected ? setSelected(null) : close()}
                className="btn-ghost"
                disabled={isPending}
              >
                {selected ? "Back" : "Cancel"}
              </button>
              {selected && (
                <button
                  onClick={submit}
                  className="btn-primary"
                  disabled={isPending}
                >
                  {isPending ? "Saving…" : "Confirm"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
