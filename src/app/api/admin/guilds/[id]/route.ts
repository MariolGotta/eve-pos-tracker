import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "OWNER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const guild = await prisma.allowedGuild.findUnique({
    where: { guildId: params.id },
  });
  if (!guild) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.allowedGuild.delete({ where: { guildId: params.id } });

  return NextResponse.json({ ok: true });
}
