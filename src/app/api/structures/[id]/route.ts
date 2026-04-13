import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const structure = await prisma.structure.findFirst({
    where: { id: params.id, deletedAt: null },
    include: {
      timers: { orderBy: { createdAt: "desc" } },
      events: {
        orderBy: { createdAt: "desc" },
        include: { user: { select: { username: true, avatarUrl: true } } },
      },
      createdBy: { select: { username: true, avatarUrl: true } },
    },
  });

  if (!structure) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(structure);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const structure = await prisma.structure.findFirst({
    where: { id: params.id, deletedAt: null },
  });
  if (!structure) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const { name, corporation, notes, distanceFromSun } = body;

  const updated = await prisma.structure.update({
    where: { id: params.id },
    data: {
      ...(name !== undefined ? { name: name?.trim() || null } : {}),
      ...(corporation !== undefined ? { corporation: corporation?.trim() || null } : {}),
      ...(notes !== undefined ? { notes: notes?.trim() || null } : {}),
      ...(distanceFromSun !== undefined ? { distanceFromSun: parseFloat(distanceFromSun) } : {}),
    },
  });

  await prisma.structureEvent.create({
    data: {
      structureId: params.id,
      userId: session.user.userId,
      action: "EDITED",
      payload: body,
    },
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const structure = await prisma.structure.findFirst({
    where: { id: params.id, deletedAt: null },
  });
  if (!structure) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.structure.update({
    where: { id: params.id },
    data: { deletedAt: new Date() },
  });

  await prisma.structureEvent.create({
    data: {
      structureId: params.id,
      userId: session.user.userId,
      action: "DELETED",
    },
  });

  return NextResponse.json({ ok: true });
}
