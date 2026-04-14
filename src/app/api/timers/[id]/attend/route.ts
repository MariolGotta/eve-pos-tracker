import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";

// POST /api/timers/[id]/attend — toggle attendance for current user
export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const timer = await prisma.timer.findUnique({
    where: { id: params.id },
    select: { id: true, status: true },
  });
  if (!timer) return NextResponse.json({ error: "Timer not found" }, { status: 404 });
  if (timer.status !== "PENDING") {
    return NextResponse.json({ error: "Timer is no longer active" }, { status: 400 });
  }

  const userId = session.user.id;

  const existing = await prisma.timerAttendee.findUnique({
    where: { timerId_userId: { timerId: params.id, userId } },
  });

  if (existing) {
    // Toggle off — remove attendance
    await prisma.timerAttendee.delete({ where: { id: existing.id } });
    return NextResponse.json({ attending: false });
  } else {
    // Toggle on — add attendance
    await prisma.timerAttendee.create({
      data: { timerId: params.id, userId },
    });
    return NextResponse.json({ attending: true });
  }
}
