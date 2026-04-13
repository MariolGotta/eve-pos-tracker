import { prisma } from "@/lib/prisma";
import {
  sendTimerWarningNotification,
  sendVulnerableNotification,
} from "@/lib/notifications";
import { Structure, Timer } from "@prisma/client";

type StructureWithTimer = Structure & { timers: Timer[] };

const STATE_TRANSITION: Record<string, string> = {
  ARMOR_TIMER: "ARMOR_VULNERABLE",
  HULL_TIMER: "HULL_VULNERABLE",
};

export async function checkTimers(): Promise<{
  expired: number;
  warned: number;
}> {
  const now = new Date();

  // ── 1. Advance expired timers ──────────────────────────────────────────────
  const expiredTimers = await prisma.timer.findMany({
    where: {
      status: "PENDING",
      expiresAt: { lte: now },
    },
    include: {
      structure: true,
    },
  });

  let expired = 0;
  for (const timer of expiredTimers) {
    const structure = timer.structure as Structure;
    const nextState = STATE_TRANSITION[structure.currentState];
    if (!nextState) continue; // Safety: shouldn't happen

    const vulnerableWindowEnd = new Date(now.getTime() + 12 * 60_000);

    await prisma.$transaction([
      prisma.timer.update({
        where: { id: timer.id },
        data: { status: "EXPIRED_NOT_HIT" },
      }),
      prisma.structure.update({
        where: { id: structure.id },
        data: { currentState: nextState as never, vulnerableWindowEnd },
      }),
      prisma.structureEvent.create({
        data: {
          structureId: structure.id,
          userId: structure.createdById, // system event attributed to creator
          action: "TIMER_EXPIRED",
          payload: {
            from: structure.currentState,
            to: nextState,
            timerId: timer.id,
          },
        },
      }),
    ]);

    // Fire vulnerable notifications
    const configs = await prisma.notificationConfig.findMany({
      where: { enabled: true },
    });
    for (const config of configs) {
      await sendVulnerableNotification(config.webhookUrl, structure, timer);
    }

    expired++;
  }

  // ── 2. Send warning notifications ─────────────────────────────────────────
  let warned = 0;

  const allConfigs = await prisma.notificationConfig.findMany({
    where: { enabled: true },
  });
  if (allConfigs.length === 0) return { expired, warned };

  // Gather all unique notifyMinutesBefore values
  const minuteWindows = [
    ...new Set(allConfigs.flatMap((c) => c.notifyMinutesBefore)),
  ].sort((a, b) => a - b);

  for (const minutes of minuteWindows) {
    const windowStart = new Date(now.getTime() + minutes * 60_000 - 60_000);
    const windowEnd = new Date(now.getTime() + minutes * 60_000);

    const timersNearExpiry = await prisma.timer.findMany({
      where: {
        status: "PENDING",
        expiresAt: { gte: windowStart, lte: windowEnd },
        // Only notify once per window: notifiedAt is null or older than windowStart
        OR: [{ notifiedAt: null }, { notifiedAt: { lt: windowStart } }],
      },
      include: { structure: true },
    });

    for (const timer of timersNearExpiry) {
      const structure = timer.structure as Structure;

      for (const config of allConfigs) {
        if (!config.notifyMinutesBefore.includes(minutes)) continue;
        await sendTimerWarningNotification(
          config.webhookUrl,
          structure,
          timer,
          minutes
        );
      }

      await prisma.timer.update({
        where: { id: timer.id },
        data: { notifiedAt: now },
      });

      warned++;
    }
  }

  return { expired, warned };
}

export function startCronScheduler(): void {
  // Dynamic import to avoid pulling node-cron into edge/browser bundles
  import("node-cron").then(({ default: cron }) => {
    cron.schedule("* * * * *", async () => {
      try {
        const result = await checkTimers();
        if (result.expired > 0 || result.warned > 0) {
          console.log(
            `[cron] expired=${result.expired} warned=${result.warned}`
          );
        }
      } catch (err) {
        console.error("[cron] checkTimers error:", err);
      }
    });
    console.log("[cron] Timer scheduler started");
  });
}
