import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { StructureState } from "@prisma/client";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";

const VALID_STATES = new Set<string>([
  "SHIELD", "ARMOR_TIMER", "ARMOR_VULNERABLE", "HULL_TIMER", "HULL_VULNERABLE", "DEAD",
]);

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const system = searchParams.get("system") ?? undefined;
  const stateParam = searchParams.get("state");
  const state = stateParam && VALID_STATES.has(stateParam) ? (stateParam as StructureState) : null;
  const corp = searchParams.get("corp") ?? undefined;
  const includeDead = searchParams.get("includeDead") === "true";

  const structures = await prisma.structure.findMany({
    where: {
      deletedAt: null,
      ...(system ? { system: { contains: system.slice(0, 100), mode: "insensitive" } } : {}),
      ...(state ? { currentState: state } : {}),
      ...(corp ? { corporation: { contains: corp.slice(0, 100), mode: "insensitive" } } : {}),
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

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { system, distanceFromSun, name, corporation, notes } = body;

  if (!system || typeof system !== "string" || !system.trim()) {
    return NextResponse.json({ error: "system is required" }, { status: 400 });
  }
  if (distanceFromSun == null) {
    return NextResponse.json({ error: "distanceFromSun is required" }, { status: 400 });
  }

  const distance = parseFloat(String(distanceFromSun));
  if (isNaN(distance) || !isFinite(distance) || distance < 0 || distance > 1_000_000) {
    return NextResponse.json({ error: "distanceFromSun must be a positive number" }, { status: 400 });
  }

  const structure = await prisma.structure.create({
    data: {
      system: system.trim().slice(0, 100),
      distanceFromSun: distance,
      name: typeof name === "string" ? name.trim().slice(0, 200) || null : null,
      corporation: typeof corporation === "string" ? corporation.trim().slice(0, 200) || null : null,
      notes: typeof notes === "string" ? notes.trim().slice(0, 2000) || null : null,
      createdById: session.user.userId,
    },
  });

  await prisma.structureEvent.create({
    data: {
      structureId: structure.id,
      userId: session.user.userId,
      action: "CREATED",
      payload: { system: structure.system, distanceFromSun: structure.distanceFromSun, name: structure.name, corporation: structure.corporation },
    },
  });

  return NextResponse.json(structure, { status: 201 });
}
