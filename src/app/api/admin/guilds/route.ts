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

  const { guildId, name } = await req.json();
  if (!guildId || !name) {
    return NextResponse.json({ error: "guildId and name are required" }, { status: 400 });
  }

  const guild = await prisma.allowedGuild.upsert({
    where: { guildId },
    create: { guildId, name },
    update: { name },
  });

  return NextResponse.json(guild, { status: 201 });
}
