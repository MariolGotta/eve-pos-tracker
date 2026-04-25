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
    screenshot_url,
  } = body as Record<string, unknown>;

  if (!killmail_id || !attackers || !Array.isArray(attackers)) {
    return NextResponse.json({ error: "killmail_id and attackers are required" }, { status: 400 });
  }

  // ── Input validation ──────────────────────────────────────────────────────
  const killmailIdStr = String(killmail_id).trim();
  if (killmailIdStr.length === 0 || killmailIdStr.length > 50)
    return NextResponse.json({ error: "killmail_id must be 1–50 characters" }, { status: 400 });

  let parsedIskValue: bigint;
  try {
    parsedIskValue = BigInt(String(isk_value ?? 0));
    if (parsedIskValue < 0n)
      return NextResponse.json({ error: "isk_value cannot be negative" }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "isk_value must be a whole number" }, { status: 400 });
  }

  let parsedTimestamp: Date;
  try {
    parsedTimestamp = new Date(String(timestamp_utc ?? new Date().toISOString()));
    if (isNaN(parsedTimestamp.getTime())) throw new Error();
  } catch {
    return NextResponse.json({ error: "timestamp_utc is not a valid date" }, { status: 400 });
  }

  if (participants_count_total !== undefined && participants_count_total !== null) {
    const pt = Number(participants_count_total);
    if (!Number.isInteger(pt) || pt < 0)
      return NextResponse.json({ error: "participants_count_total must be a non-negative integer" }, { status: 400 });
  }

  // Validate attackers array (basic sanity)
  for (const a of attackers as Record<string, unknown>[]) {
    const pct = Number((a as any).damage_pct ?? 0);
    if (isNaN(pct) || pct < 0 || pct > 100)
      return NextResponse.json({ error: `attacker damage_pct out of range for pilot "${a.pilot}"` }, { status: 400 });
    if (String(a.pilot ?? "").length > 200)
      return NextResponse.json({ error: "attacker pilot name exceeds 200 characters" }, { status: 400 });
  }

  const victimObj = (victim ?? {}) as Record<string, unknown>;
  const shipType = detectShipType(String(victimObj.ship ?? ""));

  // Upsert the killmail header
  const km = await db.killmail.upsert({
    where: { id: killmailIdStr },
    create: {
      id: killmailIdStr,
      reportTitle: String(report_title ?? "killmail").slice(0, 200),
      timestampUtc: parsedTimestamp,
      system: String(system ?? "").slice(0, 100),
      region: region ? String(region).slice(0, 100) : null,
      totalDamage: Number(total_damage ?? 0),
      iskValue: parsedIskValue,
      shipType,
      victimPilot: String(victimObj.pilot ?? "").slice(0, 200),
      victimCorpTag: String(victimObj.corp_tag ?? "").slice(0, 10).toUpperCase(),
      victimShip: String(victimObj.ship ?? "").slice(0, 200),
      participantsTotal: participants_count_total ? Number(participants_count_total) : null,
      sourceGuildId: source_guild_id ? String(source_guild_id).slice(0, 50) : null,
      submittedByDiscordId: submitted_by_discord_id ? String(submitted_by_discord_id).slice(0, 50) : null,
      screenshotUrl: screenshot_url ? String(screenshot_url).slice(0, 500) : null,
      damageCoverage: 0,
    },
    update: {
      // Allow updating participant count if sent again
      participantsTotal: participants_count_total ? Number(participants_count_total) : undefined,
      // Store screenshot URL if not already set
      screenshotUrl: screenshot_url ? String(screenshot_url).slice(0, 500) : undefined,
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
        payload: {
          attackerCount: allAttackers.length,
          damageCoverage: Math.round(damageCoverage * 10) / 10,
          ...(isBot && submitted_by_discord_id ? { discordUserId: String(submitted_by_discord_id) } : {}),
        },
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
