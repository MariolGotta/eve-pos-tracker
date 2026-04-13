import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";

function canMutate(session: { user: { userId: string; role: string } }, createdById: string) {
  return session.user.role === "OWNER" || session.user.userId === createdById;
}

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

  if (!canMutate(session, structure.createdById)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { name, corporation, notes, distanceFromSun } = body;

  // Validate distanceFromSun if provided
  let parsedDistance: number | undefined;
  if (distanceFromSun !== undefined) {
    parsedDistance = parseFloat(String(distanceFromSun));
    if (isNaN(parsedDistance) || !isFinite(parsedDistance) || parsedDistance < 0 || parsedDistance > 1_000_000) {
      return NextResponse.json({ error: "Invalid distanceFromSun value" }, { status: 400 });
    }
  }

  const updated = await prisma.structure.update({
    where: { id: params.id },
    data: {
      ...(name !== undefined ? { name: typeof name === "string" ? name.trim() || null : null } : {}),
      ...(corporation !== undefined ? { corporation: typeof corporation === "string" ? corporation.trim() || null : null } : {}),
      ...(notes !== undefined ? { notes: typeof notes === "string" ? notes.trim() || null : null } : {}),
      ...(parsedDistance !== undefined ? { distanceFromSun: parsedDistance } : {}),
    },
  });

  await prisma.structureEvent.create({
    data: {
      structureId: params.id,
      userId: session.user.userId,
      action: "EDITED",
      payload: { name, corporation, notes, distanceFromSun },
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

  if (!canMutate(session, structure.createdById)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

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
