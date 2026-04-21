import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { computeKillmailPayouts } from "@/lib/ppk-calc";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

function isBotRequest(req: NextRequest) {
  return req.headers.get("x-bot-secret") === process.env.BOT_SHARED_SECRET;
}

async function runPpkCalc(killmailId: string) {
  const [killmail, config, eligibleCorps] = await Promise.all([
    db.killmail.findUnique({ where: { id: killmailId }, include: { attackers: true } }),
    db.ppkConfig.findUnique({ where: { id: 1 } }),
    db.ppkCorporation.findMany({ where: { eligible: true } }),
  ]);
  if (!killmail || !config) return;

  const eligibleTags = new Set<string>(eligibleCorps.map((c: any) => String(c.corpTag).toUpperCase()));
  const results = computeKillmailPayouts(
    killmail.iskValue,
    killmail.shipType,
    killmail.attackers.map((a: any) => ({
      pilot: a.pilot, corpTag: a.corpTag, ship: a.ship,
      damage: a.damage, damagePct: a.damagePct,
      finalBlow: a.finalBlow, topDamage: a.topDamage,
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

  await db.$transaction(async (tx: any) => {
    for (const r of results) {
      await tx.killmailAttacker.updateMany({
        where: { killmailId, pilot: r.pilot },
        data: { iskEarned: r.iskEarned },
      });
      await tx.player.upsert({
        where: { pilot: r.pilot },
        create: {
          pilot: r.pilot, corpTag: r.corpTag,
          totalEarned: r.iskEarned, totalPaid: BigInt(0), remaining: r.iskEarned,
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

// ─── POST /api/killmails/[id]/attackers ───────────────────────────────────────
// Called by the bot for subsequent screenshots of the same killmail.

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const isBot = isBotRequest(req);
  if (!isBot) {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const km = await db.killmail.findUnique({ where: { id: params.id } });
  if (!km) return NextResponse.json({ error: "Killmail not found" }, { status: 404 });
  if (km.status === "COMPLETE")
    return NextResponse.json({ error: "Killmail already complete" }, { status: 409 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const attackers = body.attackers as Record<string, unknown>[] | undefined;
  if (!attackers || !Array.isArray(attackers)) {
    return NextResponse.json({ error: "attackers array required" }, { status: 400 });
  }

  for (const a of attackers) {
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

  const allAttackers = await db.killmailAttacker.findMany({ where: { killmailId: km.id } });
  const damageCoverage = allAttackers.reduce((s: number, a: any) => s + a.damagePct, 0);

  const isComplete =
    damageCoverage >= 98 ||
    (km.participantsTotal !== null && allAttackers.length >= km.participantsTotal);

  const updated = await db.killmail.update({
    where: { id: km.id },
    data: { damageCoverage, status: isComplete ? "COMPLETE" : "PENDING" },
  });

  if (isComplete) {
    try {
      await runPpkCalc(km.id);
    } catch (err) {
      console.error("[PPK] runPpkCalc error:", err);
    }
  }

  return NextResponse.json({
    killmailId: km.id,
    status: updated.status,
    damageCoverage: Math.round(damageCoverage * 10) / 10,
    attackerCount: allAttackers.length,
    participantsTotal: km.participantsTotal,
  });
}
