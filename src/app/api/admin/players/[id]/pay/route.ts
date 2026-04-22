import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { jsonBig } from "@/lib/json-response";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

// POST /api/admin/players/[id]/pay
// Registers a payment and decrements the player's remaining balance.

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "OWNER" && session.user.role !== "ADMIN")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { iskAmount, notes } = body;
  if (!iskAmount) return NextResponse.json({ error: "iskAmount required" }, { status: 400 });

  const amount = BigInt(String(iskAmount));
  if (amount <= BigInt(0)) return NextResponse.json({ error: "iskAmount must be positive" }, { status: 400 });

  const player = await db.player.findUnique({ where: { id: params.id } });
  if (!player) return NextResponse.json({ error: "Player not found" }, { status: 404 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const paidById = (session.user as any).userId ?? (session.user as any).id ?? "unknown";

  const [payment, updatedPlayer] = await db.$transaction([
    db.payment.create({
      data: {
        playerId: params.id,
        iskAmount: amount,
        notes: notes ? String(notes) : null,
        paidByDiscordId: paidById,
      },
    }),
    db.player.update({
      where: { id: params.id },
      data: {
        totalPaid: { increment: amount },
        remaining: { decrement: amount },
      },
    }),
  ]);

  return jsonBig({ payment, player: updatedPlayer });
}
