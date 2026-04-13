import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";

export async function PATCH(
  req: NextRequest,
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

  const body = await req.json();
  const updates: { name?: string; requiredRoleIds?: string[] } = {};

  if (typeof body.name === "string" && body.name.trim()) {
    updates.name = body.name.trim();
  }
  if (Array.isArray(body.requiredRoleIds)) {
    updates.requiredRoleIds = (body.requiredRoleIds as unknown[]).filter(
      (r): r is string => typeof r === "string" && r.trim() !== ""
    );
  }

  const updated = await prisma.allowedGuild.update({
    where: { guildId: params.id },
    data: updates,
  });

  return NextResponse.json(updated);
}

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
