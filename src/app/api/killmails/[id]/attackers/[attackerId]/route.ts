import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

// ─── DELETE /api/killmails/[id]/attackers/[attackerId] ────────────────────────

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string; attackerId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const attacker = await db.killmailAttacker.findUnique({ where: { id: params.attackerId } });
  if (!attacker || attacker.killmailId !== params.id)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (attacker.iskEarned && attacker.iskEarned > BigInt(0)) {
    await db.player.updateMany({
      where: { pilot: attacker.pilot },
      data: {
        totalEarned: { decrement: attacker.iskEarned },
        remaining: { decrement: attacker.iskEarned },
      },
    });
  }

  await db.killmailAttacker.delete({ where: { id: params.attackerId } });

  // Recalculate damageCoverage
  const allAttackers = await db.killmailAttacker.findMany({ where: { killmailId: params.id } });
  const damageCoverage = allAttackers.reduce((s: number, a: any) => s + a.damagePct, 0);
  const km = await db.killmail.findUnique({ where: { id: params.id } });
  const isComplete =
    damageCoverage >= 98 ||
    (km?.participantsTotal !== null && km?.participantsTotal !== undefined &&
      allAttackers.length >= km.participantsTotal);

  await db.killmail.update({
    where: { id: params.id },
    data: { damageCoverage, status: isComplete ? "COMPLETE" : "PENDING" },
  });

  // Log event
  await db.killmailEvent.create({
    data: {
      killmailId: params.id,
      userId: session.user.userId,
      action: "ATTACKER_REMOVED",
      payload: { pilot: attacker.pilot, corpTag: attacker.corpTag },
    },
  });

  return NextResponse.json({ ok: true, damageCoverage: Math.round(damageCoverage * 10) / 10 });
}

// ─── PATCH /api/killmails/[id]/attackers/[attackerId] ─────────────────────────

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; attackerId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const attacker = await db.killmailAttacker.findUnique({ where: { id: params.attackerId } });
  if (!attacker || attacker.killmailId !== params.id)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { pilot, corpTag, ship, damage, damagePct, finalBlow, topDamage } = body;

  // ── Input validation ──────────────────────────────────────────────────────
  if (pilot    !== undefined && String(pilot).trim().length === 0)
    return NextResponse.json({ error: "pilot cannot be empty" }, { status: 400 });
  if (pilot    !== undefined && String(pilot).length > 200)
    return NextResponse.json({ error: "pilot exceeds 200 characters" }, { status: 400 });
  if (corpTag  !== undefined && String(corpTag).length > 10)
    return NextResponse.json({ error: "corpTag exceeds 10 characters" }, { status: 400 });
  if (ship     !== undefined && String(ship).length > 200)
    return NextResponse.json({ error: "ship exceeds 200 characters" }, { status: 400 });
  if (damage !== undefined) {
    const dmgNum = Number(damage);
    if (isNaN(dmgNum) || dmgNum < 0)
      return NextResponse.json({ error: "damage must be a non-negative number" }, { status: 400 });
  }
  if (damagePct !== undefined) {
    const pctNum = Number(damagePct);
    if (isNaN(pctNum) || pctNum < 0 || pctNum > 100)
      return NextResponse.json({ error: "damagePct must be between 0 and 100" }, { status: 400 });
  }

  await db.killmailAttacker.update({
    where: { id: params.attackerId },
    data: {
      pilot:     pilot     !== undefined ? String(pilot).trim()            : undefined,
      corpTag:   corpTag   !== undefined ? String(corpTag).trim().toUpperCase() : undefined,
      ship:      ship      !== undefined ? String(ship).trim()             : undefined,
      damage:    damage    !== undefined ? Number(damage)                  : undefined,
      damagePct: damagePct !== undefined ? Number(damagePct)               : undefined,
      finalBlow: finalBlow !== undefined ? Boolean(finalBlow)              : undefined,
      topDamage: topDamage !== undefined ? Boolean(topDamage)              : undefined,
    },
  });

  if (damagePct !== undefined) {
    const allAttackers = await db.killmailAttacker.findMany({ where: { killmailId: params.id } });
    const newCoverage = allAttackers.reduce((s: number, a: any) => s + a.damagePct, 0);
    const km = await db.killmail.findUnique({ where: { id: params.id } });
    const isComplete =
      newCoverage >= 98 ||
      (km?.participantsTotal !== null && km?.participantsTotal !== undefined &&
        allAttackers.length >= km.participantsTotal);
    await db.killmail.update({
      where: { id: params.id },
      data: { damageCoverage: newCoverage, status: isComplete ? "COMPLETE" : "PENDING" },
    });
  }

  // Build diff payload — only fields that actually changed
  const diffPayload: Record<string, unknown> = { pilot: attacker.pilot };
  if (pilot !== undefined && String(pilot) !== attacker.pilot)
    diffPayload.pilot = `${attacker.pilot} → ${pilot}`;
  if (corpTag !== undefined && String(corpTag) !== attacker.corpTag)
    diffPayload.corpTag = `${attacker.corpTag} → ${corpTag}`;
  if (ship !== undefined && String(ship) !== attacker.ship)
    diffPayload.ship = `${attacker.ship} → ${ship}`;
  if (damage !== undefined && Number(damage) !== Number(attacker.damage))
    diffPayload.damage = Number(damage);
  if (damagePct !== undefined && Number(damagePct) !== Number(attacker.damagePct))
    diffPayload.damagePct = `${Number(attacker.damagePct).toFixed(1)}% → ${Number(damagePct).toFixed(1)}%`;
  if (finalBlow !== undefined && Boolean(finalBlow) !== attacker.finalBlow)
    diffPayload.finalBlow = `${attacker.finalBlow} → ${finalBlow}`;
  if (topDamage !== undefined && Boolean(topDamage) !== attacker.topDamage)
    diffPayload.topDamage = `${attacker.topDamage} → ${topDamage}`;

  // Log event
  await db.killmailEvent.create({
    data: {
      killmailId: params.id,
      userId: session.user.userId,
      action: "ATTACKER_EDITED",
      payload: diffPayload,
    },
  });

  return NextResponse.json({ ok: true });
}
