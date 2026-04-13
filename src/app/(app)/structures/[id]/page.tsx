import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import StateBadge from "@/components/StateBadge";
import TimerCountdown from "@/components/TimerCountdown";
import { availableActions } from "@/lib/state-machine";
import StructureActions from "./StructureActions";
import VerifyToggle from "./VerifyToggle";

export const revalidate = 0;

export default async function StructureDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const structure = await prisma.structure.findFirst({
    where: { id: params.id, deletedAt: null },
    include: {
      timers: { orderBy: { createdAt: "desc" }, take: 20 },
      events: {
        orderBy: { createdAt: "desc" },
        take: 30,
        include: { user: { select: { username: true, avatarUrl: true } } },
      },
      createdBy: { select: { username: true } },
    },
  });

  if (!structure) notFound();

  const activeTimer = structure.timers.find((t) => t.status === "PENDING");
  const actions = availableActions(structure.currentState);
  const isDead = structure.currentState === "DEAD";
  const isVulnerable =
    structure.currentState === "ARMOR_VULNERABLE" ||
    structure.currentState === "HULL_VULNERABLE";

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-white">{structure.system}</h1>
            <span className={`text-xs rounded px-2 py-0.5 font-semibold border ${
              structure.kind === "CITADEL"
                ? "bg-purple-500/20 text-purple-300 border-purple-500/40"
                : "bg-eve-accent/10 text-eve-accent border-eve-accent/30"
            }`}>
              {structure.kind}
            </span>
            <StateBadge state={structure.currentState} />
          </div>
          <p className="text-eve-muted text-sm mt-1">
            {structure.distanceFromSun} AU from sun
            {structure.corporation && (
              <> · <span className="text-eve-gold">{structure.corporation}</span></>
            )}
          </p>
          {structure.name && (
            <p className="text-gray-400 text-sm">{structure.name}</p>
          )}
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          <VerifyToggle structureId={structure.id} initial={structure.needsVerification} />
          {!isDead && actions.length > 0 && (
            <StructureActions
              structureId={structure.id}
              currentState={structure.currentState}
              actions={actions}
              vulnerableWindowEnd={
                structure.vulnerableWindowEnd
                  ? structure.vulnerableWindowEnd.toISOString()
                  : null
              }
            />
          )}
        </div>
      </div>

      {/* Active armor/hull timer countdown */}
      {activeTimer && (
        <div className="card border-eve-accent/40 bg-eve-accent/5">
          <p className="text-xs text-eve-muted uppercase tracking-wide mb-1">
            {activeTimer.kind === "SHIELD_TO_ARMOR" ? "Armor window opens in" : "Hull window opens in"}
          </p>
          <TimerCountdown
            expiresAt={activeTimer.expiresAt.toISOString()}
            className="text-2xl"
          />
          <p className="text-xs text-eve-muted mt-1">
            at {new Date(activeTimer.expiresAt).toUTCString()}
          </p>
        </div>
      )}

      {/* 15-minute attack window countdown */}
      {isVulnerable && structure.vulnerableWindowEnd && (
        <div className="card border-red-700/60 bg-red-900/10">
          <p className="text-xs text-red-400 uppercase tracking-wide font-semibold mb-1">
            ⚔ Attack Window
          </p>
          <TimerCountdown
            expiresAt={structure.vulnerableWindowEnd.toISOString()}
            className="text-2xl"
          />
          <p className="text-xs text-eve-muted mt-1">
            Window closes at {new Date(structure.vulnerableWindowEnd).toUTCString()}
          </p>
        </div>
      )}

      {/* Notes */}
      {structure.notes && (
        <div className="card">
          <p className="text-xs text-eve-muted uppercase tracking-wide mb-1">Notes</p>
          <p className="text-sm text-gray-300 whitespace-pre-wrap">{structure.notes}</p>
        </div>
      )}

      {/* Timer history */}
      {structure.timers.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-eve-muted uppercase tracking-wide mb-3">
            Timer History
          </h2>
          <div className="space-y-2">
            {structure.timers.map((timer) => (
              <div key={timer.id} className="card text-xs flex flex-wrap justify-between gap-2">
                <div>
                  <span className="text-gray-400">
                    {timer.kind === "SHIELD_TO_ARMOR" ? "Shield → Armor" : "Armor → Hull"}
                  </span>
                  <span className="ml-2 text-eve-muted">
                    Expires: {new Date(timer.expiresAt).toUTCString()}
                  </span>
                </div>
                <span
                  className={`uppercase font-semibold ${
                    timer.status === "PENDING"
                      ? "text-eve-accent"
                      : timer.status === "EXPIRED_NOT_HIT"
                      ? "text-red-400"
                      : timer.status === "PROGRESSED"
                      ? "text-green-400"
                      : timer.status === "REGENERATED"
                      ? "text-blue-400"
                      : "text-gray-500"
                  }`}
                >
                  {timer.status.replace(/_/g, " ")}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Event log */}
      {structure.events.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-eve-muted uppercase tracking-wide mb-3">
            Event Log
          </h2>
          <div className="space-y-1">
            {structure.events.map((event) => (
              <div
                key={event.id}
                className="flex items-center gap-3 text-xs text-eve-muted border-b border-eve-border/50 py-1.5"
              >
                <span className="text-gray-500 shrink-0">
                  {new Date(event.createdAt).toUTCString()}
                </span>
                <span className="font-semibold text-gray-300 uppercase">
                  {event.action.replace(/_/g, " ")}
                </span>
                <span className="text-gray-500">by {event.user.username}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="text-xs text-eve-muted pt-2 border-t border-eve-border">
        Created by {structure.createdBy.username} · {new Date(structure.createdAt).toUTCString()}
      </div>
    </div>
  );
}
