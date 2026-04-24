import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { computeKillmailPayouts } from "@/lib/ppk-calc";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

// ─── POST /api/killmails/[id]/reprocess ──────────────────────────────────────
// OWNER only. Recalculates PPK payouts for an already-COMPLETE killmail.
// Safe to call multiple times: reverts any previously distributed ISK first,
// then recalculates from scratch using current PpkConfig + PpkCorporation.

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const km = await db.killmail.findUnique({
    where: { id: params.id },
    include: { attackers: true },
  });
  if (!km) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (km.status !== "COMPLETE")
    return NextResponse.json({ error: "Killmail is not COMPLETE" }, { status: 400 });

  const [config, eligibleCorps] = await Promise.all([
    db.ppkConfig.findUnique({ where: { id: 1 } }),
    db.ppkCorporation.findMany({ where: { eligible: true } }),
  ]);
  if (!config)
    return NextResponse.json({ error: "PpkConfig not set — go to /admin/ppk first" }, { status: 400 });

  const eligibleTags = new Set<string>(
    eligibleCorps.map((c: any) => String(c.corpTag).toUpperCase())
  );

  const results = computeKillmailPayouts(
    km.iskValue,
    km.shipType,
    km.attackers.map((a: any) => ({
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

  await db.$transaction(async (tx: any) => {
    // 1. Revert previously distributed ISK
    for (const a of km.attackers) {
      if (a.iskEarned && a.iskEarned > BigInt(0)) {
        await tx.player.updateMany({
          where: { pilot: a.pilot },
          data: {
            totalEarned: { decrement: a.iskEarned },
            remaining: { decrement: a.iskEarned },
          },
        });
      }
      // Reset attacker iskEarned
      await tx.killmailAttacker.update({
        where: { id: a.id },
        data: { iskEarned: BigInt(0) },
      });
    }

    // 2. Apply new calculation
    for (const r of results) {
      await tx.killmailAttacker.updateMany({
        where: { killmailId: km.id, pilot: r.pilot },
        data: { iskEarned: r.iskEarned },
      });

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

  const totalDistributed = results.reduce(
    (s, r) => s + r.iskEarned,
    BigInt(0)
  );

  // Log event
  await db.killmailEvent.create({
    data: {
      killmailId: km.id,
      userId: session.user.userId,
      action: "REPROCESSED",
      payload: { playersUpdated: results.length, totalDistributed: totalDistributed.toString() },
    },
  });

  return NextResponse.json({
    ok: true,
    killmailId: km.id,
    playersUpdated: results.length,
    totalDistributed: totalDistributed.toString(),
  });
}
