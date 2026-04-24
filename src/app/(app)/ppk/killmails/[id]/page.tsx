import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { KillmailAttackersClient } from "./KillmailAttackersClient";
import type { AttackerRow } from "./KillmailAttackersClient";
import { ReprocessButton } from "./ReprocessButton";
import { DeleteKillmailButton } from "./DeleteKillmailButton";
import { EditKillmailModal } from "./EditKillmailModal";
import { InGameLink } from "./InGameLink";

function formatIsk(isk: bigint | null): string {
  if (!isk) return "—";
  const n = Number(isk);
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(2) + "B";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return n.toLocaleString();
}

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 19).replace("T", " ") + " UTC";
}

const ACTION_LABELS: Record<string, string> = {
  CREATED: "📥 Created",
  EDITED: "✏️ Edited",
  ATTACKER_ADDED: "➕ Attacker added",
  ATTACKER_EDITED: "✏️ Attacker edited",
  ATTACKER_REMOVED: "🗑 Attacker removed",
  REPROCESSED: "⚡ Reprocessed",
  DELETED: "🗑 Deleted",
};

const PAYLOAD_LABELS: Record<string, string> = {
  id: "ID",
  iskValue: "ISK value",
  participantsTotal: "participants",
  victimPilot: "victim pilot",
  victimCorpTag: "victim corp",
  victimShip: "ship",
  system: "system",
  region: "region",
  timestampUtc: "date",
  shipType: "ship type",
  status: "status",
  pilot: "pilot",
  corpTag: "corp",
  ship: "ship",
  damage: "damage",
  damagePct: "dmg%",
  finalBlow: "final blow",
  topDamage: "top damage",
  attackerCount: "attackers",
  damageCoverage: "coverage",
  playersUpdated: "players updated",
  totalDistributed: "distributed",
};

function formatPayloadEntry(key: string, value: unknown): string {
  if (value === null) return `${PAYLOAD_LABELS[key] ?? key}: —`;
  const label = PAYLOAD_LABELS[key] ?? key;
  const val = typeof value === "number" ? value.toLocaleString() : String(value);
  return `${label}: ${val}`;
}

function formatPayload(payload: Record<string, unknown>): string {
  if (payload.noChanges) return "no changes";
  return Object.entries(payload)
    .filter(([, v]) => v !== null && v !== undefined)
    .map(([k, v]) => formatPayloadEntry(k, v))
    .join("  ·  ");
}

export default async function KillmailDetailPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = prisma as any;
  const km = await db.killmail.findUnique({
    where: { id: params.id },
    include: {
      attackers: { orderBy: { damagePct: "desc" } },
      events: {
        orderBy: { createdAt: "desc" },
        take: 30,
        include: { user: { select: { displayName: true, username: true } } },
      },
    },
  });

  if (!km) notFound();

  const isOwner = session.user.role === "OWNER";
  const isAdmin = isOwner || session.user.role === "ADMIN";
  const totalIskEarned = km.attackers.reduce(
    (s: bigint, a: any) => s + (a.iskEarned ?? BigInt(0)),
    BigInt(0)
  );

  const attackersForClient: AttackerRow[] = km.attackers.map((a: any) => ({
    id: a.id,
    pilot: a.pilot,
    corpTag: a.corpTag,
    ship: a.ship,
    damage: Number(a.damage),
    damagePct: Number(a.damagePct),
    iskEarned: a.iskEarned != null ? String(a.iskEarned) : null,
    finalBlow: a.finalBlow,
    topDamage: a.topDamage,
  }));

  const kmForEdit = {
    id: km.id,
    iskValue: String(km.iskValue),
    participantsTotal: km.participantsTotal,
    victimPilot: km.victimPilot,
    victimCorpTag: km.victimCorpTag,
    victimShip: km.victimShip,
    system: km.system,
    region: km.region,
    timestampUtc: km.timestampUtc.toISOString(),
    shipType: km.shipType,
    status: km.status,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/ppk/killmails" className="text-eve-muted hover:text-white text-sm">
          ← Killmails
        </Link>
        <span className="text-eve-border">/</span>
        <span className="font-mono text-eve-muted text-sm">{km.id}</span>
        <span
          className={`text-xs px-2 py-0.5 rounded ${
            km.status === "COMPLETE"
              ? "bg-eve-green/20 text-eve-green"
              : "bg-eve-gold/20 text-eve-gold"
          }`}
        >
          {km.status === "COMPLETE" ? "COMPLETE" : "PENDING"}
        </span>
      </div>

      {/* Header info */}
      <div className="bg-eve-panel border border-eve-border rounded p-5 grid grid-cols-2 gap-4 text-sm">
        <div>
          <div className="text-eve-muted text-xs uppercase tracking-wider mb-0.5">Victim</div>
          <div className="font-medium">[{km.victimCorpTag}] {km.victimPilot}</div>
          <div className="text-eve-muted text-xs mt-0.5">{km.victimShip}</div>
        </div>
        <div>
          <div className="text-eve-muted text-xs uppercase tracking-wider mb-0.5">Location / Date</div>
          <div className="font-medium">{km.system}{km.region ? ` — ${km.region}` : ""}</div>
          <div className="text-eve-muted text-xs mt-0.5">{formatDate(km.timestampUtc)}</div>
        </div>
        <div>
          <div className="text-eve-muted text-xs uppercase tracking-wider mb-0.5">Kill Value</div>
          <div className="font-bold text-eve-gold">{formatIsk(km.iskValue)} ISK</div>
        </div>
        <div>
          <div className="text-eve-muted text-xs uppercase tracking-wider mb-0.5">Damage Coverage</div>
          <div className="font-medium">
            {km.damageCoverage.toFixed(1)}%{" "}
            <span className="text-eve-muted text-xs">
              ({km.attackers.length}{km.participantsTotal ? `/${km.participantsTotal}` : ""} attackers)
            </span>
          </div>
        </div>
        <div>
          <div className="text-eve-muted text-xs uppercase tracking-wider mb-0.5">Total ISK Distributed</div>
          <div className="font-bold text-eve-accent">{formatIsk(totalIskEarned)} ISK</div>
        </div>
        <div>
          <div className="text-eve-muted text-xs uppercase tracking-wider mb-0.5">Ship Type</div>
          <div>{km.shipType}</div>
        </div>
      </div>

      {/* Attackers table */}
      <div>
        <h2 className="text-sm font-semibold text-eve-muted uppercase tracking-wider mb-3">
          Participants
        </h2>
        <KillmailAttackersClient kmId={params.id} initialAttackers={attackersForClient} />
      </div>

      {/* Actions — visible to all logged-in users */}
      <div className="bg-eve-panel border border-eve-border rounded p-4 space-y-3">
        <div className="flex flex-wrap gap-4 items-start">
          <div>
            <p className="text-eve-muted text-xs mb-2">
              Edit killmail metadata or add missing participants.
            </p>
            <EditKillmailModal km={kmForEdit} />
          </div>

          {km.status === "COMPLETE" && (
            <div>
              <p className="text-eve-muted text-xs mb-2">
                Recalculates ISK using the current config at{" "}
                <a href="/admin/ppk" className="text-eve-accent underline">/admin/ppk</a>.
                Safe to call multiple times.
              </p>
              <ReprocessButton kmId={km.id} />
            </div>
          )}

          {/* Admin-only: Delete */}
          {isAdmin && (
            <div>
              <p className="text-eve-muted text-xs mb-2">
                {km.status === "COMPLETE"
                  ? "⚠️ Deleting will revert all participant balances."
                  : "Removes this pending killmail from the system."}
              </p>
              <DeleteKillmailButton kmId={km.id} kmStatus={km.status} />
            </div>
          )}
        </div>
      </div>

      {/* In-game link */}
      <InGameLink killId={km.id} />

      {/* Event Log */}
      <div>
        <h2 className="text-sm font-semibold text-eve-muted uppercase tracking-wider mb-3">
          Event Log ({km.events.length})
        </h2>
        {km.events.length > 0 ? (
          <div className="bg-eve-panel border border-eve-border rounded overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-eve-border text-eve-muted text-xs uppercase tracking-wider">
                  <th className="text-left px-4 py-3">Date</th>
                  <th className="text-left px-4 py-3">Action</th>
                  <th className="text-left px-4 py-3">User</th>
                  <th className="text-left px-4 py-3">Details</th>
                </tr>
              </thead>
              <tbody>
                {km.events.map((ev: any) => (
                  <tr key={ev.id} className="border-b border-eve-border">
                    <td className="px-4 py-2 text-eve-muted text-xs whitespace-nowrap">
                      {formatDate(ev.createdAt)}
                    </td>
                    <td className="px-4 py-2 text-xs font-medium">
                      {ACTION_LABELS[ev.action] ?? ev.action}
                    </td>
                    <td className="px-4 py-2 text-eve-muted text-xs">
                      {ev.user
                        ? (ev.user.displayName ?? ev.user.username)
                        : <span className="italic">Bot</span>}
                    </td>
                    <td className="px-4 py-2 text-eve-muted text-xs font-mono max-w-sm">
                      <span className="break-words whitespace-normal">
                        {ev.payload
                          ? formatPayload(ev.payload as Record<string, unknown>)
                          : "—"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-eve-muted text-sm">No events recorded yet.</p>
        )}
      </div>
    </div>
  );
}
