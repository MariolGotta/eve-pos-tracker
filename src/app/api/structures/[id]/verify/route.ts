import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const structure = await prisma.structure.findFirst({
    where: { id: params.id, deletedAt: null },
  });
  if (!structure) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const updated = await prisma.structure.update({
    where: { id: params.id },
    data: { needsVerification: !structure.needsVerification },
  });

  await prisma.structureEvent.create({
    data: {
      structureId: params.id,
      userId: session.user.userId,
      action: updated.needsVerification ? "NEEDS_VERIFICATION" : "VERIFICATION_CLEARED",
    },
  });

  return NextResponse.json({ needsVerification: updated.needsVerification });
}
