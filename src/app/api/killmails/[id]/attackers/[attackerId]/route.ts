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
      userId: (session.user as any).id ?? null,
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

  await db.killmailAttacker.update({
    where: { id: params.attackerId },
    data: {
      pilot: pilot !== undefined ? String(pilot) : undefined,
      corpTag: corpTag !== undefined ? String(corpTag) : undefined,
      ship: ship !== undefined ? String(ship) : undefined,
      damage: damage !== undefined ? Number(damage) : undefined,
      damagePct: damagePct !== undefined ? Number(damagePct) : undefined,
      finalBlow: finalBlow !== undefined ? Boolean(finalBlow) : undefined,
      topDamage: topDamage !== undefined ? Boolean(topDamage) : undefined,
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

  // Log event
  await db.killmailEvent.create({
    data: {
      killmailId: params.id,
      userId: (session.user as any).id ?? null,
      action: "ATTACKER_EDITED",
      payload: { attackerId: params.attackerId, previousPilot: attacker.pilot, ...body },
    },
  });

  return NextResponse.json({ ok: true });
}
