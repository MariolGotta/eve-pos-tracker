"use client";
import { useState, useTransition } from "react";

interface Guild {
  guildId: string;
  name: string;
}

interface Config {
  guildId: string;
  webhookSet: boolean;
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
  const [webhookUrl, setWebhookUrl] = useState("");
  const [minutesBefore, setMinutesBefore] = useState("60,15");
  const [enabled, setEnabled] = useState(true);
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  const currentConfig = configs.find((c) => c.guildId === selected);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");

    const minutes = minutesBefore
      .split(",")
      .map((s) => parseInt(s.trim()))
      .filter((n) => !isNaN(n) && n > 0);

    startTransition(async () => {
      const res = await fetch("/api/admin/notifications", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guildId: selected,
          webhookUrl: webhookUrl || undefined,
          notifyMinutesBefore: minutes,
          enabled,
        }),
      });

      if (!res.ok) {
        setMessage("Failed to save.");
        return;
      }

      setConfigs((prev) => {
        const existing = prev.find((c) => c.guildId === selected);
        if (existing) {
          return prev.map((c) =>
            c.guildId === selected
              ? { ...c, webhookSet: webhookUrl ? true : c.webhookSet, notifyMinutesBefore: minutes, enabled }
              : c
          );
        }
        return [...prev, { guildId: selected, webhookSet: !!webhookUrl, notifyMinutesBefore: minutes, enabled }];
      });

      setWebhookUrl("");
      setMessage("Saved successfully.");
    });
  }

  if (guilds.length === 0) {
    return <p className="text-eve-muted text-sm">No guilds configured. Add a guild first.</p>;
  }

  return (
    <div className="space-y-6">
      <form onSubmit={save} className="card space-y-4">
        <div>
          <label>Discord Server</label>
          <select
            value={selected}
            onChange={(e) => {
              setSelected(e.target.value);
              const cfg = configs.find((c) => c.guildId === e.target.value);
              if (cfg) {
                setMinutesBefore(cfg.notifyMinutesBefore.join(","));
                setEnabled(cfg.enabled);
              }
              setWebhookUrl("");
            }}
            className="w-full"
          >
            {guilds.map((g) => (
              <option key={g.guildId} value={g.guildId}>
                {g.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label>
            Discord Webhook URL
            {currentConfig?.webhookSet && (
              <span className="ml-2 text-green-400 text-xs">(currently set — leave blank to keep)</span>
            )}
          </label>
          <input
            type="url"
            value={webhookUrl}
            onChange={(e) => setWebhookUrl(e.target.value)}
            placeholder="https://discord.com/api/webhooks/…"
            className="w-full"
          />
        </div>

        <div>
          <label>Notify (minutes before expiry, comma-separated)</label>
          <input
            value={minutesBefore}
            onChange={(e) => setMinutesBefore(e.target.value)}
            placeholder="60,15"
            className="w-full"
          />
          <p className="text-xs text-eve-muted mt-1">
            e.g. "60,15" sends alerts at 60 minutes and 15 minutes before the timer expires.
          </p>
        </div>

        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="w-auto border-0 p-0"
          />
          <span className="text-sm text-gray-300">Notifications enabled</span>
        </label>

        {message && (
          <p className={`text-sm ${message.includes("Failed") ? "text-red-400" : "text-green-400"}`}>
            {message}
          </p>
        )}

        <div className="flex justify-end">
          <button type="submit" className="btn-primary" disabled={isPending}>
            {isPending ? "Saving…" : "Save"}
          </button>
        </div>
      </form>

      {/* Summary */}
      {configs.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-eve-muted uppercase tracking-wide mb-3">
            Current Configurations
          </h2>
          <div className="space-y-2">
            {configs.map((c) => {
              const guild = guilds.find((g) => g.guildId === c.guildId);
              return (
                <div key={c.guildId} className="card text-sm flex items-center justify-between gap-2">
                  <div>
                    <p className="text-white font-medium">{guild?.name ?? c.guildId}</p>
                    <p className="text-xs text-eve-muted">
                      Webhook: {c.webhookSet ? "Set" : "Not set"} ·
                      Alerts at: {c.notifyMinutesBefore.join(", ")}min
                    </p>
                  </div>
                  <span
                    className={`text-xs font-semibold uppercase ${c.enabled ? "text-green-400" : "text-gray-500"}`}
                  >
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
