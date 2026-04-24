import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { computeKillmailPayouts, detectShipType } from "@/lib/ppk-calc";
import { jsonBig } from "@/lib/json-response";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

function isBotRequest(req: NextRequest) {
  return req.headers.get("x-bot-secret") === process.env.BOT_SHARED_SECRET;
}

async function runPpkCalc(killmailId: string) {
  const [killmail, config, eligibleCorps] = await Promise.all([
    db.killmail.findUnique({
      where: { id: killmailId },
      include: { attackers: true },
    }),
    db.ppkConfig.findUnique({ where: { id: 1 } }),
    db.ppkCorporation.findMany({ where: { eligible: true } }),
  ]);

  if (!killmail || !config) return;

  const eligibleTags = new Set<string>(eligibleCorps.map((c: any) => String(c.corpTag).toUpperCase()));

  const results = computeKillmailPayouts(
    killmail.iskValue,
    killmail.shipType,
    killmail.attackers.map((a: any) => ({
      pilot: a.pilot,
      corpTag: a.corpTag,
      ship: a.ship,
      damage: a.damage,
      damagePct: a.damagePct,
      finalBlow: a.finalBlow,
      topDamage: a.topDamage,
    })),
    eligibleTags,
    {
      subcapMultiplier: config.subcapMultiplier,
      posFixedIsk: config.posFixedIsk,
      capitalFixedIsk: config.capitalFixedIsk,
      bot5Coefficient: config.bot5Coefficient,
      nonBot5Coefficient: config.nonBot5Coefficient,
      subcapCapIsk: config.subcapCapIsk,
    }
  );

  // Update each attacker's iskEarned and upsert player balances in a transaction
  await db.$transaction(async (tx: any) => {
    for (const r of results) {
      await tx.killmailAttacker.updateMany({
        where: { killmailId, pilot: r.pilot },
        data: { iskEarned: r.iskEarned },
      });

      // Upsert player
      await tx.player.upsert({
        where: { pilot: r.pilot },
        create: {
          pilot: r.pilot,
          corpTag: r.corpTag,
          totalEarned: r.iskEarned,
          totalPaid: BigInt(0),
          remaining: r.iskEarned,
        },
        update: {
          corpTag: r.corpTag,
          totalEarned: { increment: r.iskEarned },
          remaining: { increment: r.iskEarned },
        },
      });
    }
  });
}

// ─── POST /api/killmails ─────────────────────────────────────────────────────
// Called by the Discord bot to register a new killmail or add its first batch
// of attackers. If the killmail already exists, merges the attackers.

export async function POST(req: NextRequest) {
  const isBot = isBotRequest(req);
  let sessionUserId: string | null = null;
  if (!isBot) {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (session.user.role !== "OWNER" && session.user.role !== "ADMIN")
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    sessionUserId = session.user.userId;
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const {
    killmail_id,
    report_title,
    timestamp_utc,
    system,
    region,
    total_damage,
    isk_value,
    victim,
    attackers,
    participants_count_total,
    source_guild_id,
    submitted_by_discord_id,
  } = body as Record<string, unknown>;

  if (!killmail_id || !attackers || !Array.isArray(attackers)) {
    return NextResponse.json({ error: "killmail_id and attackers are required" }, { status: 400 });
  }

  const victimObj = (victim ?? {}) as Record<string, unknown>;
  const shipType = detectShipType(String(victimObj.ship ?? ""));

  // Upsert the killmail header
  const km = await db.killmail.upsert({
    where: { id: String(killmail_id) },
    create: {
      id: String(killmail_id),
      reportTitle: String(report_title ?? "killmail"),
      timestampUtc: new Date(String(timestamp_utc ?? new Date().toISOString())),
      system: String(system ?? ""),
      region: region ? String(region) : null,
      totalDamage: Number(total_damage ?? 0),
      iskValue: BigInt(String(isk_value ?? 0)),
      shipType,
      victimPilot: String(victimObj.pilot ?? ""),
      victimCorpTag: String(victimObj.corp_tag ?? ""),
      victimShip: String(victimObj.ship ?? ""),
      participantsTotal: participants_count_total ? Number(participants_count_total) : null,
      sourceGuildId: source_guild_id ? String(source_guild_id) : null,
      submittedByDiscordId: submitted_by_discord_id ? String(submitted_by_discord_id) : null,
      damageCoverage: 0,
    },
    update: {
      // Allow updating participant count if sent again
      participantsTotal: participants_count_total ? Number(participants_count_total) : undefined,
    },
  });

  // Upsert each attacker
  for (const a of attackers as Record<string, unknown>[]) {
    await db.killmailAttacker.upsert({
      where: { killmailId_pilot: { killmailId: km.id, pilot: String(a.pilot ?? "") } },
      create: {
        killmailId: km.id,
        pilot: String(a.pilot ?? ""),
        corpTag: String(a.corp_tag ?? ""),
        ship: String(a.ship ?? ""),
        damage: Number(a.damage ?? 0),
        damagePct: Number(a.damage_pct ?? 0),
        finalBlow: Boolean(a.final_blow),
        topDamage: Boolean(a.top_damage),
      },
      update: {
        corpTag: String(a.corp_tag ?? ""),
        ship: String(a.ship ?? ""),
        damage: Number(a.damage ?? 0),
        damagePct: Number(a.damage_pct ?? 0),
        finalBlow: Boolean(a.final_blow),
        topDamage: Boolean(a.top_damage),
      },
    });
  }

  // Recalculate damageCoverage
  const allAttackers = await db.killmailAttacker.findMany({
    where: { killmailId: km.id },
  });
  const damageCoverage = allAttackers.reduce((s: number, a: any) => s + a.damagePct, 0);

  const isComplete =
    damageCoverage >= 98 ||
    (km.participantsTotal !== null && allAttackers.length >= km.participantsTotal);

  const updated = await db.killmail.update({
    where: { id: km.id },
    data: {
      damageCoverage,
      status: isComplete ? "COMPLETE" : "PENDING",
    },
  });

  if (isComplete && km.status !== "COMPLETE") {
    try {
      await runPpkCalc(km.id);
    } catch (err) {
      console.error("[PPK] runPpkCalc error:", err);
    }
  }

  // Log CREATED event (only on first insert, not on attacker accumulation)
  try {
    const isNew = !km.createdAt || (Date.now() - new Date(km.createdAt).getTime()) < 5000;
    await db.killmailEvent.create({
      data: {
        killmailId: km.id,
        userId: sessionUserId ?? null,
        action: isNew ? "CREATED" : "ATTACKER_ADDED",
        payload: { attackerCount: allAttackers.length, damageCoverage: Math.round(damageCoverage * 10) / 10 },
      },
    });
  } catch { /* non-critical */ }

  return NextResponse.json({
    killmailId: km.id,
    status: updated.status,
    damageCoverage: Math.round(damageCoverage * 10) / 10,
    attackerCount: allAttackers.length,
    participantsTotal: km.participantsTotal,
  });
}

// ─── GET /api/killmails ───────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const isBot = isBotRequest(req);
  if (!isBot) {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = req.nextUrl;
  const status = searchParams.get("status") ?? undefined;
  const system = searchParams.get("system") ?? undefined;
  const page = Math.max(1, Number(searchParams.get("page") ?? 1));
  const limit = Math.min(50, Number(searchParams.get("limit") ?? 20));

  const killmails = await db.killmail.findMany({
    where: {
      ...(status === "PENDING" || status === "COMPLETE" ? { status } : {}),
      ...(system ? { system: { contains: system, mode: "insensitive" } } : {}),
    },
    include: { attackers: { select: { pilot: true, corpTag: true, damagePct: true, iskEarned: true, finalBlow: true } } },
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * limit,
    take: limit,
  });

  return jsonBig(killmails);
}
