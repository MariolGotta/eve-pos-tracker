import { authOptions } from "@/lib/auth";
import { encrypt } from "@/lib/crypto";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";

export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "OWNER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const configs = await prisma.notificationConfig.findMany({
    include: { guild: { select: { name: true } } },
  });

  // Mask webhook URL — don't send encrypted blob to client
  return NextResponse.json(
    configs.map((c) => ({
      ...c,
      webhookUrl: c.webhookUrl ? "***" : null,
    }))
  );
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "OWNER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { guildId, webhookUrl, notifyMinutesBefore, enabled } = await req.json();

  if (!guildId) {
    return NextResponse.json({ error: "guildId is required" }, { status: 400 });
  }

  // Verify guild exists
  const guild = await prisma.allowedGuild.findUnique({ where: { guildId } });
  if (!guild) return NextResponse.json({ error: "Guild not found" }, { status: 404 });

  const existing = await prisma.notificationConfig.findUnique({ where: { guildId } });

  // Only encrypt + update webhookUrl if a new one is provided
  const webhookData =
    webhookUrl && webhookUrl !== "***"
      ? { webhookUrl: encrypt(webhookUrl) }
      : {};

  const config = existing
    ? await prisma.notificationConfig.update({
        where: { guildId },
        data: {
          ...webhookData,
          ...(notifyMinutesBefore !== undefined ? { notifyMinutesBefore } : {}),
          ...(enabled !== undefined ? { enabled } : {}),
        },
      })
    : await prisma.notificationConfig.create({
        data: {
          guildId,
          webhookUrl: webhookUrl ? encrypt(webhookUrl) : "",
          notifyMinutesBefore: notifyMinutesBefore ?? [60, 15],
          enabled: enabled ?? true,
        },
      });

  return NextResponse.json({ ...config, webhookUrl: "***" });
}
