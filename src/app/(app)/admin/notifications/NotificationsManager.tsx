"use client";
import { useState, useTransition } from "react";

interface Guild {
  guildId: string;
  name: string;
}

interface Config {
  guildId: string;
  webhookCount: number;
  notifyMinutesBefore: number[];
  enabled: boolean;
}

interface Props {
  guilds: Guild[];
  configs: Config[];
}

export default function NotificationsManager({ guilds, configs: initialConfigs }: Props) {
  const [configs, setConfigs] = useState<Config[]>(initialConfigs);
  const [selected, setSelected] = useState(guilds[0]?.guildId ?? "");
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  const config = configs.find((c) => c.guildId === selected) ?? {
    guildId: selected,
    webhookCount: 0,
    notifyMinutesBefore: [60, 15],
    enabled: true,
  };

  const [newUrl, setNewUrl] = useState("");
  const [minutesInput, setMinutesInput] = useState(config.notifyMinutesBefore.join(", "));
  const [enabledInput, setEnabledInput] = useState(config.enabled);

  function selectGuild(guildId: string) {
    setSelected(guildId);
    setMessage(null);
    const cfg = configs.find((c) => c.guildId === guildId);
    setMinutesInput(cfg?.notifyMinutesBefore.join(", ") ?? "60, 15");
    setEnabledInput(cfg?.enabled ?? true);
    setNewUrl("");
  }

  function addWebhook(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    startTransition(async () => {
      const res = await fetch("/api/admin/notifications", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guildId: selected, action: "add_webhook", webhookUrl: newUrl }),
      });
      const data = await res.json();
      if (!res.ok) { setMessage({ text: data.error ?? "Failed to add webhook.", ok: false }); return; }
      setConfigs((prev) => upsert(prev, selected, { webhookCount: data.webhookCount }));
      setNewUrl("");
      setMessage({ text: "Webhook added successfully.", ok: true });
    });
  }

  function removeWebhook(index: number) {
    if (!confirm(`Remove Webhook #${index + 1}?`)) return;
    setMessage(null);
    startTransition(async () => {
      const res = await fetch("/api/admin/notifications", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guildId: selected, action: "remove_webhook", removeIndex: index }),
      });
      const data = await res.json();
      if (!res.ok) { setMessage({ text: data.error ?? "Failed to remove.", ok: false }); return; }
      setConfigs((prev) => upsert(prev, selected, { webhookCount: data.webhookCount }));
      setMessage({ text: "Webhook removed.", ok: true });
    });
  }

  function saveSettings(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    const minutes = minutesInput
      .split(",")
      .map((s) => parseInt(s.trim()))
      .filter((n) => !isNaN(n) && n > 0);

    startTransition(async () => {
      const res = await fetch("/api/admin/notifications", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guildId: selected,
          action: "update_settings",
          notifyMinutesBefore: minutes,
          enabled: enabledInput,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setMessage({ text: data.error ?? "Failed to save.", ok: false }); return; }
      setConfigs((prev) =>
        upsert(prev, selected, {
          notifyMinutesBefore: data.notifyMinutesBefore,
          enabled: data.enabled,
        })
      );
      setMessage({ text: "Settings saved.", ok: true });
    });
  }

  if (guilds.length === 0) {
    return <p className="text-eve-muted text-sm">No guilds configured. Add a guild first.</p>;
  }

  return (
    <div className="space-y-6">
      {/* Guild selector */}
      <div>
        <label>Discord Server</label>
        <select value={selected} onChange={(e) => selectGuild(e.target.value)} className="w-full">
          {guilds.map((g) => (
            <option key={g.guildId} value={g.guildId}>{g.name}</option>
          ))}
        </select>
      </div>

      {/* Feedback */}
      {message && (
        <p className={`text-sm ${message.ok ? "text-green-400" : "text-red-400"}`}>{message.text}</p>
      )}

      {/* Webhook list */}
      <div className="card space-y-3">
        <h2 className="text-sm font-semibold text-white">
          Webhooks
          <span className="ml-2 text-eve-muted font-normal">({config.webhookCount}/10)</span>
        </h2>

        {config.webhookCount === 0 ? (
          <p className="text-xs text-eve-muted">No webhooks configured for this server.</p>
        ) : (
          <ul className="space-y-2">
            {Array.from({ length: config.webhookCount }, (_, i) => (
              <li key={i} className="flex items-center justify-between text-sm bg-eve-bg rounded px-3 py-2">
                <span className="text-gray-300">Webhook #{i + 1}</span>
                <button
                  onClick={() => removeWebhook(i)}
                  disabled={isPending}
                  className="text-xs text-red-400 hover:text-red-300 disabled:opacity-50"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}

        {/* Add webhook form */}
        <form onSubmit={addWebhook} className="flex gap-2 pt-1">
          <input
            type="url"
            value={newUrl}
            onChange={(e) => setNewUrl(e.target.value)}
            placeholder="https://discord.com/api/webhooks/…"
            className="flex-1 text-sm"
            required
          />
          <button
            type="submit"
            className="btn-primary text-sm shrink-0"
            disabled={isPending || config.webhookCount >= 10}
          >
            Add
          </button>
        </form>
        <p className="text-xs text-eve-muted">
          Discord: right-click channel → Edit Channel → Integrations → Webhooks → New Webhook → Copy URL.
        </p>
      </div>

      {/* Alert settings */}
      <form onSubmit={saveSettings} className="card space-y-4">
        <h2 className="text-sm font-semibold text-white">Alert Settings</h2>

        <div>
          <label>Notify (minutes before expiry, comma-separated)</label>
          <input
            value={minutesInput}
            onChange={(e) => setMinutesInput(e.target.value)}
            placeholder="60, 40, 15"
            className="w-full"
          />
          <p className="text-xs text-eve-muted mt-1">
            e.g. <code>60, 40, 15</code> → sends alerts at 60 min, 40 min and 15 min before the window opens.
          </p>
        </div>

        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={enabledInput}
            onChange={(e) => setEnabledInput(e.target.checked)}
            className="w-auto border-0 p-0"
          />
          <span className="text-sm text-gray-300">Notifications enabled</span>
        </label>

        <div className="flex justify-end">
          <button type="submit" className="btn-primary" disabled={isPending}>
            {isPending ? "Saving…" : "Save Settings"}
          </button>
        </div>
      </form>

      {/* Summary of all servers */}
      {configs.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-eve-muted uppercase tracking-wide mb-3">All Servers</h2>
          <div className="space-y-2">
            {configs.map((c) => {
              const guild = guilds.find((g) => g.guildId === c.guildId);
              return (
                <div
                  key={c.guildId}
                  className="card text-sm flex items-center justify-between gap-2 cursor-pointer hover:border-eve-accent/40"
                  onClick={() => selectGuild(c.guildId)}
                >
                  <div>
                    <p className="text-white font-medium">{guild?.name ?? c.guildId}</p>
                    <p className="text-xs text-eve-muted">
                      {c.webhookCount} webhook{c.webhookCount !== 1 ? "s" : ""} ·
                      Alerts at: {c.notifyMinutesBefore.join(", ")} min
                    </p>
                  </div>
                  <span className={`text-xs font-semibold uppercase ${c.enabled ? "text-green-400" : "text-gray-500"}`}>
                    {c.enabled ? "Enabled" : "Disabled"}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function upsert(configs: Config[], guildId: string, patch: Partial<Config>): Config[] {
  const exists = configs.find((c) => c.guildId === guildId);
  if (exists) return configs.map((c) => c.guildId === guildId ? { ...c, ...patch } : c);
  return [...configs, { guildId, webhookCount: 0, notifyMinutesBefore: [60, 15], enabled: true, ...patch }];
}
