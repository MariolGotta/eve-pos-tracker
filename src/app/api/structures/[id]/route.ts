import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { StructureKind } from "@prisma/client";
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

  if (!structure) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(structure);
}

// Any authenticated user can edit
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

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { name, system, corporation, notes, distanceFromSun, kind, timerExpiresAt } = body;

  let parsedDistance: number | undefined;
  if (distanceFromSun !== undefined) {
    parsedDistance = parseFloat(String(distanceFromSun));
    if (isNaN(parsedDistance) || !isFinite(parsedDistance) || parsedDistance < 0 || parsedDistance > 1_000_000) {
      return NextResponse.json({ error: "Invalid distanceFromSun value" }, { status: 400 });
    }
  }

  if (notes !== undefined && typeof notes === "string" && notes.trim().length > 100) {
    return NextResponse.json({ error: "Notes cannot exceed 100 characters" }, { status: 400 });
  }

  const validKinds: StructureKind[] = ["POS", "CITADEL"];
  const parsedKind: StructureKind | undefined =
    kind !== undefined && validKinds.includes(kind as StructureKind)
      ? (kind as StructureKind)
      : undefined;

  const updated = await prisma.structure.update({
    where: { id: params.id },
    data: {
      ...(system !== undefined ? { system: typeof system === "string" ? system.trim().slice(0, 100) || structure.system : structure.system } : {}),
      ...(name !== undefined ? { name: typeof name === "string" ? name.trim().slice(0, 200) || null : null } : {}),
      ...(corporation !== undefined ? { corporation: typeof corporation === "string" ? corporation.trim().slice(0, 200) || null : null } : {}),
      ...(notes !== undefined ? { notes: typeof notes === "string" ? notes.trim().slice(0, 100) || null : null } : {}),
      ...(parsedDistance !== undefined ? { distanceFromSun: parsedDistance } : {}),
      ...(parsedKind !== undefined ? { kind: parsedKind } : {}),
    },
  });

  // Update active timer expiry if provided
  if (timerExpiresAt !== undefined && typeof timerExpiresAt === "string") {
    const newExpiry = new Date(timerExpiresAt);
    if (isNaN(newExpiry.getTime()) || newExpiry <= new Date()) {
      return NextResponse.json({ error: "timerExpiresAt must be a valid future date" }, { status: 400 });
    }
    const activeTimer = await prisma.timer.findFirst({
      where: { structureId: params.id, status: "PENDING" },
    });
    if (activeTimer) {
      await prisma.timer.update({
        where: { id: activeTimer.id },
        data: { expiresAt: newExpiry, notifiedAt: null }, // reset notifiedAt so warnings fire again
      });
    }
  }

  await prisma.structureEvent.create({
    data: {
      structureId: params.id,
      userId: session.user.userId,
      action: "EDITED",
      payload: { system, name, corporation, notes, distanceFromSun, kind, timerExpiresAt } as any,
    },
  });

  return NextResponse.json(updated);
}

// Only OWNER can delete
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (session.user.role !== "OWNER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

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
