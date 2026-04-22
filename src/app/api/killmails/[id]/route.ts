import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { jsonBig } from "@/lib/json-response";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

function isBotRequest(req: NextRequest) {
  return req.headers.get("x-bot-secret") === process.env.BOT_SHARED_SECRET;
}

// ─── GET /api/killmails/[id] ──────────────────────────────────────────────────
// Used by the bot (/ppk buscar <id>) and browser users.

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const isBot = isBotRequest(req);
  if (!isBot) {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const km = await db.killmail.findUnique({
    where: { id: params.id },
    include: {
      attackers: {
        orderBy: { damagePct: "desc" },
      },
    },
  });

  if (!km) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return jsonBig(km);
}

// ─── DELETE /api/killmails/[id] ───────────────────────────────────────────────
// Owner only. Reverses player balances before deleting.

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "OWNER")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const km = await db.killmail.findUnique({
    where: { id: params.id },
    include: { attackers: true },
  });
  if (!km) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.$transaction(async (tx: any) => {
    if (km.status === "COMPLETE") {
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
      }
    }
    await tx.killmail.delete({ where: { id: params.id } });
  });

  return NextResponse.json({ ok: true });
}
