import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
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
  const corps = await db.ppkCorporation.findMany({ orderBy: { corpTag: "asc" } });
  return NextResponse.json(corps);
}

export async function POST(req: NextRequest) {
  const err = await requireAdmin(req);
  if (err) return err;

  const { corpTag, fullName, eligible } = await req.json();
  if (!corpTag) return NextResponse.json({ error: "corpTag required" }, { status: 400 });

  const corp = await db.ppkCorporation.upsert({
    where: { corpTag: String(corpTag).toUpperCase() },
    create: { corpTag: String(corpTag).toUpperCase(), fullName: fullName ?? null, eligible: eligible ?? true },
    update: { fullName: fullName ?? undefined, eligible: eligible ?? undefined },
  });
  return NextResponse.json(corp, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const err = await requireAdmin(req);
  if (err) return err;

  const { id, fullName, eligible } = await req.json();
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const corp = await db.ppkCorporation.update({
    where: { id },
    data: { fullName: fullName ?? undefined, eligible: eligible ?? undefined },
  });
  return NextResponse.json(corp);
}

export async function DELETE(req: NextRequest) {
  const err = await requireAdmin(req);
  if (err) return err;

  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  await db.ppkCorporation.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
