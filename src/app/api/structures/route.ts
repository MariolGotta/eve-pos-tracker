import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { StructureKind, StructureState } from "@prisma/client";
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
      ...(corp ? { corporation: { contains: corp.slice(0, 100), mode: "insensitive" } } : {}),
      ...(state ? { currentState: state } : !includeDead ? { currentState: { not: "DEAD" } } : {}),
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

  const { system, distanceFromSun, kind, name, corporation, notes, initialState, timerExpiresAt } = body;

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

  const VALID_INITIAL_STATES = ["SHIELD", "ARMOR_TIMER", "ARMOR_VULNERABLE", "HULL_TIMER", "HULL_VULNERABLE"];
  const state = typeof initialState === "string" && VALID_INITIAL_STATES.includes(initialState)
    ? (initialState as StructureState)
    : "SHIELD" as StructureState;

  const structureKind: StructureKind =
    kind === "CITADEL" ? "CITADEL" : "POS";

  const structure = await prisma.structure.create({
    data: {
      kind: structureKind,
      system: system.trim().slice(0, 100),
      distanceFromSun: distance,
      name: typeof name === "string" ? name.trim().slice(0, 200) || null : null,
      corporation: typeof corporation === "string" ? corporation.trim().slice(0, 200) || null : null,
      notes: typeof notes === "string" ? notes.trim().slice(0, 100) || null : null,
      currentState: state,
      createdById: session.user.userId,
    },
  });

  // Create timer if state requires one and timerExpiresAt was provided
  if (
    (state === "ARMOR_TIMER" || state === "HULL_TIMER") &&
    typeof timerExpiresAt === "string"
  ) {
    const expiresAt = new Date(timerExpiresAt);
    const now = new Date();
    if (!isNaN(expiresAt.getTime()) && expiresAt > now) {
      const maxFuture = new Date(now.getTime() + 30 * 24 * 3_600_000);
      if (expiresAt <= maxFuture) {
        await prisma.timer.create({
          data: {
            structureId: structure.id,
            kind: state === "ARMOR_TIMER" ? "SHIELD_TO_ARMOR" : "ARMOR_TO_HULL",
            startedAt: now,
            expiresAt,
            createdById: session.user.userId,
          },
        });
      }
    }
  }

  await prisma.structureEvent.create({
    data: {
      structureId: structure.id,
      userId: session.user.userId,
      action: "CREATED",
      payload: { system: structure.system, distanceFromSun: structure.distanceFromSun, name: structure.name, corporation: structure.corporation, initialState: state } as any,
    },
  });

  return NextResponse.json(structure, { status: 201 });
}
