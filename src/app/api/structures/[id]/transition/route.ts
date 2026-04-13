import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canTransition, getTransition, TransitionAction } from "@/lib/state-machine";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";

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

  const body = await req.json();
  const action = body.action as TransitionAction;
  const expiresAt: string | undefined = body.expiresAt;

  if (!canTransition(structure.currentState, action)) {
    return NextResponse.json(
      { error: `Cannot perform ${action} from state ${structure.currentState}` },
      { status: 400 }
    );
  }

  const transition = getTransition(structure.currentState, action);

  // Validate timer datetime when required
  if (transition.timerKind && !expiresAt) {
    return NextResponse.json(
      { error: "expiresAt is required for this action" },
      { status: 400 }
    );
  }

  const expiresAtDate = expiresAt ? new Date(expiresAt) : undefined;
  if (expiresAtDate && isNaN(expiresAtDate.getTime())) {
    return NextResponse.json({ error: "Invalid expiresAt datetime" }, { status: 400 });
  }

  // Run everything in a transaction
  await prisma.$transaction(async (tx) => {
    // Cancel any pending timer
    if (structure.timers.length > 0) {
      await tx.timer.updateMany({
        where: { structureId: params.id, status: "PENDING" },
        data: {
          status: transition.clearTimer ? "CANCELLED" : "PROGRESSED",
        },
      });
    }

    // Create new timer if needed
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

    // Update structure state
    await tx.structure.update({
      where: { id: params.id },
      data: { currentState: transition.nextState },
    });

    // Log event
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
    include: {
      timers: { where: { status: "PENDING" }, take: 1 },
    },
  });

  return NextResponse.json(updated);
}
