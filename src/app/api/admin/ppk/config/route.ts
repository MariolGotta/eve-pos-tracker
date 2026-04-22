import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { jsonBig } from "@/lib/json-response";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

async function requireAdmin(req: NextRequest) {
  void req;
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "OWNER" && session.user.role !== "ADMIN")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return null;
}

export async function GET(req: NextRequest) {
  const err = await requireAdmin(req);
  if (err) return err;

  const config = await db.ppkConfig.findUnique({ where: { id: 1 } });
  return jsonBig(config ?? null);
}

export async function PUT(req: NextRequest) {
  const err = await requireAdmin(req);
  if (err) return err;

  const body = await req.json();
  const {
    subcapMultiplier,
    posFixedIsk,
    capitalFixedIsk,
    bot5Coefficient,
    nonBot5Coefficient,
    subcapCapIsk,
  } = body;

  const config = await db.ppkConfig.upsert({
    where: { id: 1 },
    create: {
      subcapMultiplier: Number(subcapMultiplier ?? 1),
      posFixedIsk: BigInt(String(posFixedIsk ?? 0)),
      capitalFixedIsk: BigInt(String(capitalFixedIsk ?? 0)),
      bot5Coefficient: Number(bot5Coefficient ?? 1),
      nonBot5Coefficient: Number(nonBot5Coefficient ?? 0.5),
      subcapCapIsk: BigInt(String(subcapCapIsk ?? 15000000000)),
    },
    update: {
      subcapMultiplier: subcapMultiplier !== undefined ? Number(subcapMultiplier) : undefined,
      posFixedIsk: posFixedIsk !== undefined ? BigInt(String(posFixedIsk)) : undefined,
      capitalFixedIsk: capitalFixedIsk !== undefined ? BigInt(String(capitalFixedIsk)) : undefined,
      bot5Coefficient: bot5Coefficient !== undefined ? Number(bot5Coefficient) : undefined,
      nonBot5Coefficient: nonBot5Coefficient !== undefined ? Number(nonBot5Coefficient) : undefined,
      subcapCapIsk: subcapCapIsk !== undefined ? BigInt(String(subcapCapIsk)) : undefined,
    },
  });
  return jsonBig(config);
}
