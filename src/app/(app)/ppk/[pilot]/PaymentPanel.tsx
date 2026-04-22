"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

function formatIsk(n: number): string {
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(2) + "B";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return n.toLocaleString();
}

export function PaymentPanel({
  playerId,
  remainingStr,
  totalEarnedStr,
  totalPaidStr,
}: {
  playerId: string;
  remainingStr: string;
  totalEarnedStr: string;
  totalPaidStr: string;
}) {
  const router = useRouter();

  const remaining = Number(remainingStr);
  const totalEarned = Number(totalEarnedStr);
  const totalPaid = Number(totalPaidStr);

  const [amount, setAmount] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const [localRemaining, setLocalRemaining] = useState(remaining);
  const [localPaid, setLocalPaid] = useState(totalPaid);

  const amountNum = Number(amount.replace(/\D/g, "")) || 0;
  const isValid = amountNum > 0 && amountNum <= localRemaining;

  function setQuick(pct: number) {
    const v = Math.floor(localRemaining * pct);
    setAmount(String(v));
    setResult(null);
  }

  async function handlePay() {
    if (!isValid) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch(`/api/admin/players/${playerId}/pay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ iskAmount: String(amountNum), notes: notes.trim() || null }),
      });
      const data = await res.json();
      if (res.ok) {
        const newRemaining = Number(data.player.remaining);
        const newPaid = Number(data.player.totalPaid);
        setLocalRemaining(newRemaining);
        setLocalPaid(newPaid);
        setAmount("");
        setNotes("");
        setResult({
          ok: true,
          msg: `✅ Payment of ${formatIsk(amountNum)} ISK registered. Remaining balance: ${formatIsk(newRemaining)} ISK`,
        });
        router.refresh();
      } else {
        setResult({ ok: false, msg: "❌ " + (data.error ?? "Unknown error") });
      }
    } catch {
      setResult({ ok: false, msg: "❌ Network error" });
    }
    setLoading(false);
  }

  return (
    <div className="bg-eve-panel border border-eve-border rounded-lg p-5 space-y-4">
      <h2 className="text-sm font-semibold text-eve-muted uppercase tracking-wider">
        Register Payment
      </h2>

      {/* Balance summary */}
      <div className="grid grid-cols-3 gap-3 text-center text-xs">
        <div className="bg-eve-bg border border-eve-border rounded p-3">
          <div className="text-eve-muted mb-0.5">Total Earned</div>
          <div className="text-white font-bold">{formatIsk(totalEarned)} ISK</div>
        </div>
        <div className="bg-eve-bg border border-eve-border rounded p-3">
          <div className="text-eve-muted mb-0.5">Paid Out</div>
          <div className="text-eve-green font-bold">{formatIsk(localPaid)} ISK</div>
        </div>
        <div className="bg-eve-bg border border-eve-border rounded p-3">
          <div className="text-eve-muted mb-0.5">Balance Due</div>
          <div className={`font-bold ${localRemaining > 0 ? "text-eve-gold" : "text-eve-muted"}`}>
            {formatIsk(localRemaining)} ISK
          </div>
        </div>
      </div>

      {localRemaining <= 0 ? (
        <p className="text-eve-green text-sm text-center">✅ Player balance is zero — nothing to pay.</p>
      ) : (
        <>
          {/* Amount input + quick buttons */}
          <div>
            <label className="block text-xs text-eve-muted mb-1">
              Amount to pay (ISK) — balance:{" "}
              <span className="text-eve-gold font-semibold">{formatIsk(localRemaining)}</span>
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="1"
                max={localRemaining}
                value={amount}
                onChange={(e) => { setAmount(e.target.value); setResult(null); }}
                placeholder="0"
                className="bg-eve-bg border border-eve-border rounded px-3 py-1.5 text-sm text-white font-mono w-44 focus:outline-none focus:border-eve-accent"
              />
              {amount && amountNum > 0 && (
                <span className="text-eve-muted text-xs">{formatIsk(amountNum)} ISK</span>
              )}
            </div>

            {/* Quick-fill buttons */}
            <div className="flex gap-2 mt-2">
              {[
                { label: "25%", pct: 0.25 },
                { label: "50%", pct: 0.50 },
                { label: "75%", pct: 0.75 },
                { label: "Full", pct: 1.00 },
              ].map(({ label, pct }) => (
                <button
                  key={label}
                  onClick={() => setQuick(pct)}
                  className="text-xs px-2 py-0.5 border border-eve-border rounded text-eve-muted hover:text-white hover:border-eve-accent transition-colors"
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Balance preview */}
            {isValid && (
              <p className="text-xs text-eve-muted mt-2">
                After payment: remaining balance will be{" "}
                <span className="text-eve-gold font-semibold">
                  {formatIsk(localRemaining - amountNum)} ISK
                </span>
              </p>
            )}
            {amount && amountNum > localRemaining && (
              <p className="text-xs text-eve-red mt-2">
                ⚠ Amount exceeds available balance ({formatIsk(localRemaining)} ISK)
              </p>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs text-eve-muted mb-1">Notes (optional)</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. partial payment week 16"
              className="w-full bg-eve-bg border border-eve-border rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-eve-accent"
              maxLength={200}
            />
          </div>

          {/* Submit */}
          <button
            onClick={handlePay}
            disabled={loading || !isValid}
            className="w-full bg-eve-accent hover:opacity-90 text-black text-sm font-semibold py-2 rounded disabled:opacity-40 transition-opacity"
          >
            {loading ? "Processing..." : `Register Payment of ${amountNum > 0 ? formatIsk(amountNum) + " ISK" : "..."}`}
          </button>
        </>
      )}

      {result && (
        <p className={`text-xs ${result.ok ? "text-eve-green" : "text-eve-red"}`}>
          {result.msg}
        </p>
      )}
    </div>
  );
}
