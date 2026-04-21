"use client";

import { useEffect, useState } from "react";

interface Corp {
  id: string;
  corpTag: string;
  fullName: string | null;
  eligible: boolean;
}

interface PpkConfigData {
  subcapMultiplier: number;
  posFixedIsk: string;
  capitalFixedIsk: string;
  bot5Coefficient: number;
  nonBot5Coefficient: number;
  subcapCapIsk: string;
}

function formatIsk(v: string | number): string {
  const n = Number(v);
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(2) + "B";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + "M";
  return String(n);
}

export default function AdminPpkPage() {
  const [corps, setCorps] = useState<Corp[]>([]);
  const [config, setConfig] = useState<PpkConfigData | null>(null);
  const [newTag, setNewTag] = useState("");
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    fetch("/api/admin/ppk/corps").then((r) => r.json()).then(setCorps);
    fetch("/api/admin/ppk/config").then((r) => r.json()).then((d) => {
      if (d) setConfig({
        subcapMultiplier: d.subcapMultiplier,
        posFixedIsk: String(d.posFixedIsk),
        capitalFixedIsk: String(d.capitalFixedIsk),
        bot5Coefficient: d.bot5Coefficient,
        nonBot5Coefficient: d.nonBot5Coefficient,
        subcapCapIsk: String(d.subcapCapIsk),
      });
    });
  }, []);

  async function addCorp() {
    if (!newTag.trim()) return;
    setSaving(true);
    const res = await fetch("/api/admin/ppk/corps", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ corpTag: newTag.trim().toUpperCase(), fullName: newName.trim() || null }),
    });
    const corp = await res.json();
    setCorps((prev) => [...prev.filter((c) => c.corpTag !== corp.corpTag), corp].sort((a, b) => a.corpTag.localeCompare(b.corpTag)));
    setNewTag(""); setNewName(""); setSaving(false);
    setMsg("Corp adicionada!");
    setTimeout(() => setMsg(""), 2000);
  }

  async function toggleEligible(corp: Corp) {
    const res = await fetch("/api/admin/ppk/corps", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: corp.id, eligible: !corp.eligible }),
    });
    const updated = await res.json();
    setCorps((prev) => prev.map((c) => (c.id === corp.id ? updated : c)));
  }

  async function deleteCorp(id: string) {
    if (!confirm("Remover esta corporation?")) return;
    await fetch("/api/admin/ppk/corps", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setCorps((prev) => prev.filter((c) => c.id !== id));
  }

  async function saveConfig() {
    if (!config) return;
    setSaving(true);
    await fetch("/api/admin/ppk/config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(config),
    });
    setSaving(false);
    setMsg("Configuração salva!");
    setTimeout(() => setMsg(""), 2000);
  }

  return (
    <div className="space-y-8">
      <h1 className="text-xl font-bold text-eve-accent tracking-wider">Admin PPK</h1>
      {msg && <div className="text-eve-green text-sm">{msg}</div>}

      {/* Corporations */}
      <section>
        <h2 className="text-sm font-semibold text-eve-muted uppercase tracking-wider mb-4">
          Corporações Elegíveis (Bot5 List)
        </h2>
        <div className="bg-eve-panel border border-eve-border rounded overflow-hidden mb-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-eve-border text-eve-muted text-xs uppercase tracking-wider">
                <th className="text-left px-4 py-3">Tag</th>
                <th className="text-left px-4 py-3">Nome Completo</th>
                <th className="text-center px-4 py-3">Elegível (PPK)</th>
                <th className="text-center px-4 py-3">Ações</th>
              </tr>
            </thead>
            <tbody>
              {corps.map((c) => (
                <tr key={c.id} className="border-b border-eve-border">
                  <td className="px-4 py-2 font-mono font-bold">[{c.corpTag}]</td>
                  <td className="px-4 py-2 text-eve-muted">{c.fullName ?? "—"}</td>
                  <td className="px-4 py-2 text-center">
                    <button
                      onClick={() => toggleEligible(c)}
                      className={`text-xs px-2 py-0.5 rounded border transition-colors ${c.eligible ? "border-eve-green text-eve-green hover:bg-eve-green/10" : "border-eve-red text-eve-red hover:bg-eve-red/10"}`}
                    >
                      {c.eligible ? "SIM" : "NÃO"}
                    </button>
                  </td>
                  <td className="px-4 py-2 text-center">
                    <button
                      onClick={() => deleteCorp(c.id)}
                      className="text-eve-red hover:underline text-xs"
                    >
                      Remover
                    </button>
                  </td>
                </tr>
              ))}
              {corps.length === 0 && (
                <tr><td colSpan={4} className="px-4 py-6 text-center text-eve-muted">Nenhuma corp cadastrada.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Add corp form */}
        <div className="flex gap-3 items-end">
          <div>
            <label className="text-eve-muted text-xs block mb-1">Tag da Corp (ex: FLBR)</label>
            <input
              value={newTag} onChange={(e) => setNewTag(e.target.value.toUpperCase())}
              placeholder="FLBR"
              className="bg-eve-bg border border-eve-border rounded px-3 py-1.5 text-sm text-white w-28 focus:outline-none focus:border-eve-accent"
            />
          </div>
          <div>
            <label className="text-eve-muted text-xs block mb-1">Nome Completo (opcional)</label>
            <input
              value={newName} onChange={(e) => setNewName(e.target.value)}
              placeholder="Federação Luso-Brasileira"
              className="bg-eve-bg border border-eve-border rounded px-3 py-1.5 text-sm text-white w-56 focus:outline-none focus:border-eve-accent"
            />
          </div>
          <button
            onClick={addCorp} disabled={saving || !newTag.trim()}
            className="bg-eve-accent hover:bg-eve-accent/80 text-white text-xs px-4 py-1.5 rounded disabled:opacity-50"
          >
            + Adicionar
          </button>
        </div>
      </section>

      {/* PPK Config */}
      {config && (
        <section>
          <h2 className="text-sm font-semibold text-eve-muted uppercase tracking-wider mb-4">
            Configuração de Bounty (BountyRewards)
          </h2>
          <div className="bg-eve-panel border border-eve-border rounded p-5 grid grid-cols-2 gap-5 text-sm">
            {([
              { key: "subcapMultiplier", label: "Multiplicador Subcap (B2)", type: "float" },
              { key: "bot5Coefficient", label: "Coeficiente Bot5 (A7)", type: "float" },
              { key: "nonBot5Coefficient", label: "Coeficiente Não-Bot5 (B7)", type: "float" },
              { key: "posFixedIsk", label: "ISK Fixo POS (B1)", type: "isk" },
              { key: "capitalFixedIsk", label: "ISK Fixo Capital (B3)", type: "isk" },
              { key: "subcapCapIsk", label: "Cap Subcap (15B default)", type: "isk" },
            ] as const).map(({ key, label, type }) => (
              <div key={key}>
                <label className="text-eve-muted text-xs block mb-1">{label}</label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={String(config[key])}
                    onChange={(e) => setConfig((prev) => prev ? { ...prev, [key]: e.target.value } : prev)}
                    className="bg-eve-bg border border-eve-border rounded px-3 py-1.5 text-sm text-white w-40 focus:outline-none focus:border-eve-accent font-mono"
                  />
                  {type === "isk" && (
                    <span className="text-eve-muted text-xs">= {formatIsk(String(config[key]))}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
          <button
            onClick={saveConfig} disabled={saving}
            className="mt-4 bg-eve-accent hover:bg-eve-accent/80 text-white text-xs px-6 py-1.5 rounded disabled:opacity-50"
          >
            {saving ? "Salvando..." : "Salvar Configuração"}
          </button>
        </section>
      )}
    </div>
  );
}
