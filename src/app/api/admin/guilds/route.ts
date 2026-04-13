import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";

export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "OWNER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const guilds = await prisma.allowedGuild.findMany({
    orderBy: { addedAt: "asc" },
  });

  return NextResponse.json(guilds);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "OWNER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { guildId, name, requiredRoleIds } = body;

  if (!guildId || typeof guildId !== "string" || !guildId.trim()) {
    return NextResponse.json({ error: "guildId is required" }, { status: 400 });
  }
  if (!name || typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const roleIds: string[] = Array.isArray(requiredRoleIds)
    ? requiredRoleIds.filter((r): r is string => typeof r === "string" && r.trim() !== "")
    : [];

  const guild = await prisma.allowedGuild.upsert({
    where: { guildId: guildId.trim() },
    create: { guildId: guildId.trim(), name: name.trim(), requiredRoleIds: roleIds },
    update: { name: name.trim(), requiredRoleIds: roleIds },
  });

  return NextResponse.json(guild, { status: 201 });
}
