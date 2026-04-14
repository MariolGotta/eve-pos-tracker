/**
 * One-time seed script to import timers from Discord bot.
 * All times below are in GMT-3. Script converts to UTC (+3h).
 * Run with: npx tsx scripts/seed-timers.ts
 */

import { PrismaClient, StructureState, TimerKind } from "@prisma/client";

const prisma = new PrismaClient();

// Convert GMT-3 date+time to UTC Date object
function gmt3ToUTC(dateStr: string, timeStr: string): Date {
  const [year, month, day] = dateStr.split("-").map(Number);
  const [hours, minutes] = timeStr.split(":").map(Number);
  // GMT-3 → UTC: add 3 hours
  return new Date(Date.UTC(year, month - 1, day, hours + 3, minutes, 0));
}

interface Entry {
  date: string;       // YYYY-MM-DD
  time: string;       // HH:MM in GMT-3
  system: string;
  state: StructureState;
  timerKind: TimerKind;
  corporation: string | null;
  name: string | null;
}

const ENTRIES: Entry[] = [
  // ── Apr 14 ────────────────────────────────────────────────────────────────
  { date: "2026-04-14", time: "03:40", system: "GA-2V7",  state: "ARMOR_TIMER", timerKind: "SHIELD_TO_ARMOR", corporation: null,    name: "Live to serve" },
  { date: "2026-04-14", time: "04:00", system: "JKJ-VJ",  state: "HULL_TIMER",  timerKind: "ARMOR_TO_HULL",  corporation: "CENI",   name: "Vagena" },
  { date: "2026-04-14", time: "09:00", system: "GA-2V7",  state: "HULL_TIMER",  timerKind: "ARMOR_TO_HULL",  corporation: null,    name: "house of the sun" },
  { date: "2026-04-14", time: "18:00", system: "GA-2V7",  state: "HULL_TIMER",  timerKind: "ARMOR_TO_HULL",  corporation: null,    name: "Mar a Lago" },
  // ── Apr 15 ────────────────────────────────────────────────────────────────
  { date: "2026-04-15", time: "18:00", system: "MT-2VJ",  state: "HULL_TIMER",  timerKind: "ARMOR_TO_HULL",  corporation: null,    name: "Papatunuku" },
  // ── Apr 16 ────────────────────────────────────────────────────────────────
  { date: "2026-04-16", time: "01:00", system: "OX-RGN",  state: "HULL_TIMER",  timerKind: "ARMOR_TO_HULL",  corporation: null,    name: "Brain steakhouse" },
  { date: "2026-04-16", time: "02:00", system: "DB-6W4",  state: "HULL_TIMER",  timerKind: "ARMOR_TO_HULL",  corporation: "CENI",  name: "Brain culing" },
  { date: "2026-04-16", time: "03:00", system: "R-OCBA",  state: "HULL_TIMER",  timerKind: "ARMOR_TO_HULL",  corporation: null,    name: "Caer Muhem" },
  { date: "2026-04-16", time: "04:00", system: "2JJ-OE",  state: "HULL_TIMER",  timerKind: "ARMOR_TO_HULL",  corporation: "LWC",   name: "chicken" },
  // ── Apr 17 ────────────────────────────────────────────────────────────────
  { date: "2026-04-17", time: "01:00", system: "7-692B",  state: "HULL_TIMER",  timerKind: "ARMOR_TO_HULL",  corporation: "CENI",  name: "Fort Brains" },
  { date: "2026-04-17", time: "06:00", system: "MT-2VJ",  state: "HULL_TIMER",  timerKind: "ARMOR_TO_HULL",  corporation: null,    name: "tomatuenga" },
  { date: "2026-04-17", time: "09:00", system: "OX-RGN",  state: "HULL_TIMER",  timerKind: "ARMOR_TO_HULL",  corporation: "WAIT",  name: "Neko" },
  { date: "2026-04-17", time: "21:00", system: "3HQC-6",  state: "HULL_TIMER",  timerKind: "ARMOR_TO_HULL",  corporation: "CENI",  name: "Casa Zegin" },
  // ── Apr 18 ────────────────────────────────────────────────────────────────
  { date: "2026-04-18", time: "01:00", system: "JKJ-VJ",  state: "HULL_TIMER",  timerKind: "ARMOR_TO_HULL",  corporation: null,    name: "Orion ARML" },
  { date: "2026-04-18", time: "01:00", system: "JKJ-VJ",  state: "HULL_TIMER",  timerKind: "ARMOR_TO_HULL",  corporation: "WAIT",  name: "Code 12" },
  { date: "2026-04-18", time: "02:00", system: "LGUZ-1",  state: "HULL_TIMER",  timerKind: "ARMOR_TO_HULL",  corporation: "WAIT",  name: "Ilusion Time" },
  { date: "2026-04-18", time: "12:00", system: "GA-2V7",  state: "HULL_TIMER",  timerKind: "ARMOR_TO_HULL",  corporation: null,    name: "EVA Café" },
  { date: "2026-04-18", time: "19:00", system: "NP6-38",  state: "HULL_TIMER",  timerKind: "ARMOR_TO_HULL",  corporation: null,    name: "Near You" },
  { date: "2026-04-18", time: "23:59", system: "MT-2VJ",  state: "HULL_TIMER",  timerKind: "ARMOR_TO_HULL",  corporation: null,    name: "QUXnova" },
  { date: "2026-04-18", time: "23:59", system: "MT-2VJ",  state: "HULL_TIMER",  timerKind: "ARMOR_TO_HULL",  corporation: null,    name: "MosqNova" },
  { date: "2026-04-18", time: "23:59", system: "OX-RGN",  state: "HULL_TIMER",  timerKind: "ARMOR_TO_HULL",  corporation: null,    name: "Silannova" },
  { date: "2026-04-18", time: "23:59", system: "OX-RGN",  state: "HULL_TIMER",  timerKind: "ARMOR_TO_HULL",  corporation: "CENI",  name: "Xanohova" },
  // ── Apr 19 ────────────────────────────────────────────────────────────────
  { date: "2026-04-19", time: "01:00", system: "RTXO-S",  state: "HULL_TIMER",  timerKind: "ARMOR_TO_HULL",  corporation: "CENI",  name: "Iris nova" },
  { date: "2026-04-19", time: "01:00", system: "3HQC-6",  state: "HULL_TIMER",  timerKind: "ARMOR_TO_HULL",  corporation: "ARML",  name: "MADDY Nova" },
  { date: "2026-04-19", time: "14:00", system: "R-OCBA",  state: "HULL_TIMER",  timerKind: "ARMOR_TO_HULL",  corporation: "CENI",  name: "LAOZ house" },
  { date: "2026-04-19", time: "14:00", system: "R-OCBA",  state: "HULL_TIMER",  timerKind: "ARMOR_TO_HULL",  corporation: "LAOZ",  name: "House" },
  // ── Apr 20 ────────────────────────────────────────────────────────────────
  { date: "2026-04-20", time: "06:00", system: "RTXO-S",  state: "HULL_TIMER",  timerKind: "ARMOR_TO_HULL",  corporation: "AGIS",  name: "Lidi" },
  { date: "2026-04-20", time: "18:00", system: "RTXO-S",  state: "HULL_TIMER",  timerKind: "ARMOR_TO_HULL",  corporation: "CENI",  name: "Dep core" },
];

async function main() {
  // Find the owner user to attribute the records to
  const owner = await prisma.user.findFirst({ where: { role: "OWNER" } });
  if (!owner) {
    console.error("No OWNER user found. Log in first so the owner account is created.");
    process.exit(1);
  }
  console.log(`Using owner: ${owner.username} (${owner.id})`);

  const now = new Date();
  let created = 0;
  let skipped = 0;

  for (const entry of ENTRIES) {
    const expiresAt = gmt3ToUTC(entry.date, entry.time);

    // Skip timers that already expired
    if (expiresAt <= now) {
      console.log(`⏭  SKIPPED (past): ${entry.system} - ${entry.name} → ${expiresAt.toUTCString()}`);
      skipped++;
      continue;
    }

    const structure = await prisma.structure.create({
      data: {
        kind: "POS",
        system: entry.system,
        distanceFromSun: 0,
        name: entry.name,
        corporation: entry.corporation,
        currentState: entry.state,
        createdById: owner.id,
      },
    });

    await prisma.timer.create({
      data: {
        structureId: structure.id,
        kind: entry.timerKind,
        startedAt: now,
        expiresAt,
        status: "PENDING",
        createdById: owner.id,
      },
    });

    await prisma.structureEvent.create({
      data: {
        structureId: structure.id,
        userId: owner.id,
        action: "CREATED",
        payload: { source: "seed-timers", expiresAt: expiresAt.toISOString() } as any,
      },
    });

    console.log(`✅ ${entry.system} - ${entry.name} → ${expiresAt.toUTCString()}`);
    created++;
  }

  console.log(`\nDone. Created: ${created}, Skipped (past): ${skipped}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
