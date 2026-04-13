import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canTransition, getTransition, TransitionAction } from "@/lib/state-machine";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";

const VALID_ACTIONS = new Set<string>([
  "SHIELD_DOWN", "ARMOR_DOWN", "HULL_DOWN", "REGENERATED", "MARK_DEAD", "CANCEL_TIMER",
]);

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const structure = await prisma.structure.findFirst({
    where: { id: params.id, deletedAt: null },
    include: {
      timers: { where: { status: "PENDING" }, take: 1 },
    },
  });

  if (!structure) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (structure.currentState === "DEAD") {
    return NextResponse.json({ error: "Structure is already dead" }, { status: 400 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Validate action is a known enum value before passing to state machine
  const action = body.action;
  if (typeof action !== "string" || !VALID_ACTIONS.has(action)) {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  const expiresAtRaw = body.expiresAt;

  if (!canTransition(structure.currentState, action as TransitionAction)) {
    return NextResponse.json(
      { error: `Cannot perform ${action} from state ${structure.currentState}` },
      { status: 400 }
    );
  }

  const transition = getTransition(structure.currentState, action as TransitionAction);

  if (transition.timerKind && !expiresAtRaw) {
    return NextResponse.json({ error: "expiresAt is required for this action" }, { status: 400 });
  }

  let expiresAtDate: Date | undefined;
  if (expiresAtRaw !== undefined) {
    expiresAtDate = new Date(String(expiresAtRaw));
    if (isNaN(expiresAtDate.getTime())) {
      return NextResponse.json({ error: "Invalid expiresAt datetime" }, { status: 400 });
    }
    // Prevent timers set in the past (allow up to 30s grace for clock skew)
    if (expiresAtDate.getTime() < Date.now() - 30_000) {
      return NextResponse.json({ error: "expiresAt must be in the future" }, { status: 400 });
    }
    // Prevent absurdly far future dates (> 30 days)
    if (expiresAtDate.getTime() > Date.now() + 30 * 24 * 3_600_000) {
      return NextResponse.json({ error: "expiresAt cannot be more than 30 days in the future" }, { status: 400 });
    }
  }

  await prisma.$transaction(async (tx) => {
    if (structure.timers.length > 0) {
      await tx.timer.updateMany({
        where: { structureId: params.id, status: "PENDING" },
        data: { status: transition.clearTimer ? "CANCELLED" : "PROGRESSED" },
      });
    }

    if (transition.timerKind && expiresAtDate) {
      await tx.timer.create({
        data: {
          structureId: params.id,
          kind: transition.timerKind,
          startedAt: new Date(),
          expiresAt: expiresAtDate,
          status: "PENDING",
          createdById: session.user.userId,
        },
      });
    }

    await tx.structure.update({
      where: { id: params.id },
      data: { currentState: transition.nextState, vulnerableWindowEnd: null },
    });

    await tx.structureEvent.create({
      data: {
        structureId: params.id,
        userId: session.user.userId,
        action: transition.eventAction,
        payload: {
          from: structure.currentState,
          to: transition.nextState,
          expiresAt: expiresAtDate?.toISOString(),
        },
      },
    });
  });

  const updated = await prisma.structure.findUnique({
    where: { id: params.id },
    include: { timers: { where: { status: "PENDING" }, take: 1 } },
  });

  return NextResponse.json(updated);
}
