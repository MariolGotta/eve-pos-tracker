"use client";
import { useState, useTransition } from "react";
import { TransitionAction, actionLabel } from "@/lib/state-machine";
import { StructureState } from "@prisma/client";

interface Props {
  structureId: string;
  currentState: StructureState;
  actions: TransitionAction[];
  /** When true, dialog opens immediately in "what happened?" mode (post 15-min window) */
  autoOpen?: boolean;
  onSuccess: () => void;
  onClose?: () => void;
}

// ── Duration input (for SHIELD_DOWN) ─────────────────────────────────────────
function DurationInput({
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

// ── Hour picker (for ARMOR_DOWN — hull timer) ─────────────────────────────────
function HullTimerInput({
  date,
  hour,
  onChange,
}: {
  date: string;
  hour: number;
  onChange: (date: string, hour: number) => void;
}) {
  const todayLocal = new Date().toISOString().slice(0, 10);
  return (
    <div>
      <label>Hull window opens at (round hour, local time)</label>
      <div className="flex gap-2">
        <input
          type="date"
          value={date}
          min={todayLocal}
          onChange={(e) => onChange(e.target.value, hour)}
          className="flex-1"
        />
        <select
          value={hour}
          onChange={(e) => onChange(date, parseInt(e.target.value))}
          className="w-24"
        >
          {Array.from({ length: 24 }, (_, h) => (
            <option key={h} value={h}>
              {String(h).padStart(2, "0")}:00
            </option>
          ))}
        </select>
      </div>
      {date && (
        <p className="text-xs text-eve-muted mt-1">
          UTC:{" "}
          <span className="text-gray-300">
            {new Date(`${date}T${String(hour).padStart(2, "0")}:00:00`).toUTCString()}
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
  const [selected, setSelected] = useState<TransitionAction | null>(
    isVulnerable ? null : null
  );
  // Duration (SHIELD_DOWN)
  const [durationH, setDurationH] = useState(23);
  const [durationM, setDurationM] = useState(55);
  // Hull timer (ARMOR_DOWN)
  const [hullDate, setHullDate] = useState(
    new Date(Date.now() + 86_400_000).toISOString().slice(0, 10)
  );
  const [hullHour, setHullHour] = useState(new Date().getHours());

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
      const ms = durationH * 3_600_000 + durationM * 60_000;
      if (ms <= 0) return undefined;
      return new Date(Date.now() + ms).toISOString();
    }
    if (selected === "ARMOR_DOWN") {
      if (!hullDate) return undefined;
      return new Date(
        `${hullDate}T${String(hullHour).padStart(2, "0")}:00:00`
      ).toISOString();
    }
    return undefined;
  }

  async function submit() {
    if (!selected) return;
    setError("");

    if (selected === "SHIELD_DOWN" && durationH === 0 && durationM === 0) {
      setError("Duration must be greater than 0.");
      return;
    }
    if (selected === "ARMOR_DOWN" && !hullDate) {
      setError("Please select a date for the hull timer.");
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

  // ── Vulnerable states: simplified "what happened?" dialog ─────────────────
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
                    onClick={() => setSelected(attackedAction)}
                    className="w-full text-left px-4 py-3 rounded-md border border-eve-border text-sm text-gray-300 hover:border-red-500 transition-colors"
                  >
                    {currentState === "ARMOR_VULNERABLE"
                      ? "🔴 Was Attacked — armor stripped, set hull timer"
                      : "💀 Was Destroyed — mark as dead"}
                  </button>
                </div>
              )}

              {selected === "ARMOR_DOWN" && (
                <HullTimerInput
                  date={hullDate}
                  hour={hullHour}
                  onChange={(d, h) => { setHullDate(d); setHullHour(h); }}
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
              <DurationInput
                hours={durationH}
                minutes={durationM}
                onChange={(h, m) => { setDurationH(h); setDurationM(m); }}
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
