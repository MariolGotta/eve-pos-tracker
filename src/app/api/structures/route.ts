import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { StructureState } from "@prisma/client";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const system = searchParams.get("system") ?? undefined;
  const state = searchParams.get("state") as StructureState | null;
  const corp = searchParams.get("corp") ?? undefined;
  const includeDeadParam = searchParams.get("includeDead");
  const includeDead = includeDeadParam === "true";

  const structures = await prisma.structure.findMany({
    where: {
      deletedAt: null,
      ...(system ? { system: { contains: system, mode: "insensitive" } } : {}),
      ...(state ? { currentState: state } : {}),
      ...(corp ? { corporation: { contains: corp, mode: "insensitive" } } : {}),
      ...(!includeDead ? { currentState: { not: "DEAD" } } : {}),
    },
    include: {
      timers: {
        where: { status: "PENDING" },
        orderBy: { expiresAt: "asc" },
        take: 1,
      },
      createdBy: { select: { username: true, avatarUrl: true } },
    },
    orderBy: [{ currentState: "asc" }, { updatedAt: "desc" }],
  });

  return NextResponse.json(structures);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { system, distanceFromSun, name, corporation, notes } = body;

  if (!system || distanceFromSun == null) {
    return NextResponse.json(
      { error: "system and distanceFromSun are required" },
      { status: 400 }
    );
  }

  const structure = await prisma.structure.create({
    data: {
      system: system.trim(),
      distanceFromSun: parseFloat(distanceFromSun),
      name: name?.trim() || null,
      corporation: corporation?.trim() || null,
      notes: notes?.trim() || null,
      createdById: session.user.userId,
    },
  });

  await prisma.structureEvent.create({
    data: {
      structureId: structure.id,
      userId: session.user.userId,
      action: "CREATED",
      payload: { system, distanceFromSun, name, corporation },
    },
  });

  return NextResponse.json(structure, { status: 201 });
}
