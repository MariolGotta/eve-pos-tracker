import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

// DELETE /api/admin/players/[id]
// ADMIN+. Removes a player and their payment history from the ranking.
// KillmailAttacker records are preserved (they belong to the killmail, not the player).

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "OWNER" && session.user.role !== "ADMIN")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const player = await db.player.findUnique({ where: { id: params.id } });
  if (!player) return NextResponse.json({ error: "Player not found" }, { status: 404 });

  // Payment has no onDelete: Cascade in schema — delete manually first
  await db.$transaction([
    db.payment.deleteMany({ where: { playerId: params.id } }),
    db.player.delete({ where: { id: params.id } }),
  ]);

  return NextResponse.json({ ok: true, pilot: player.pilot });
}
