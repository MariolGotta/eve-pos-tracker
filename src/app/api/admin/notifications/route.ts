import { authOptions } from "@/lib/auth";
import { encrypt } from "@/lib/crypto";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";

const ALLOWED_WEBHOOK_HOSTS = ["discord.com", "discordapp.com", "ptb.discord.com", "canary.discord.com"];

function isValidDiscordWebhookUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:") return false;
    return ALLOWED_WEBHOOK_HOSTS.some((h) => u.hostname === h || u.hostname.endsWith(`.${h}`));
  } catch {
    return false;
  }
}

export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "OWNER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const configs = await prisma.notificationConfig.findMany({
    include: { guild: { select: { name: true } } },
  });

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

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { guildId, webhookUrl, notifyMinutesBefore, enabled } = body;

  if (!guildId || typeof guildId !== "string") {
    return NextResponse.json({ error: "guildId is required" }, { status: 400 });
  }

  // Validate webhook URL if provided
  if (webhookUrl && webhookUrl !== "***") {
    if (typeof webhookUrl !== "string" || !isValidDiscordWebhookUrl(webhookUrl)) {
      return NextResponse.json(
        { error: "webhookUrl must be a valid HTTPS Discord webhook URL" },
        { status: 400 }
      );
    }
  }

  // Validate notifyMinutesBefore
  let parsedMinutes: number[] | undefined;
  if (notifyMinutesBefore !== undefined) {
    if (!Array.isArray(notifyMinutesBefore)) {
      return NextResponse.json({ error: "notifyMinutesBefore must be an array" }, { status: 400 });
    }
    parsedMinutes = [...new Set(
      (notifyMinutesBefore as unknown[])
        .map((v) => parseInt(String(v)))
        .filter((n) => !isNaN(n) && n > 0 && n <= 1440) // 1 min to 24h
    )].sort((a, b) => b - a);

    if (parsedMinutes.length === 0) {
      return NextResponse.json(
        { error: "notifyMinutesBefore must contain at least one value between 1 and 1440" },
        { status: 400 }
      );
    }
  }

  const guild = await prisma.allowedGuild.findUnique({ where: { guildId } });
  if (!guild) return NextResponse.json({ error: "Guild not found" }, { status: 404 });

  const existing = await prisma.notificationConfig.findUnique({ where: { guildId } });

  const webhookData =
    webhookUrl && webhookUrl !== "***"
      ? { webhookUrl: encrypt(String(webhookUrl)) }
      : {};

  const config = existing
    ? await prisma.notificationConfig.update({
        where: { guildId },
        data: {
          ...webhookData,
          ...(parsedMinutes !== undefined ? { notifyMinutesBefore: parsedMinutes } : {}),
          ...(typeof enabled === "boolean" ? { enabled } : {}),
        },
      })
    : await prisma.notificationConfig.create({
        data: {
          guildId,
          webhookUrl: webhookUrl ? encrypt(String(webhookUrl)) : "",
          notifyMinutesBefore: parsedMinutes ?? [60, 15],
          enabled: typeof enabled === "boolean" ? enabled : true,
        },
      });

  return NextResponse.json({ ...config, webhookUrl: "***" });
}
