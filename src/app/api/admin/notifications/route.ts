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

async function requireOwner() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "OWNER") return null;
  return session;
}

export async function GET(_req: NextRequest) {
  if (!(await requireOwner())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const configs = await prisma.notificationConfig.findMany({
    include: { guild: { select: { name: true } } },
  });

  return NextResponse.json(
    configs.map((c) => ({
      ...c,
      webhookUrls: c.webhookUrls.map((_, i) => `Webhook #${i + 1}`),
      webhookCount: c.webhookUrls.length,
    }))
  );
}

export async function PUT(req: NextRequest) {
  if (!(await requireOwner())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { guildId, action, webhookUrl, removeIndex, notifyMinutesBefore, enabled } = body as {
    guildId?: string;
    action?: string;
    webhookUrl?: string;
    removeIndex?: number;
    notifyMinutesBefore?: number[];
    enabled?: boolean;
  };

  if (!guildId) return NextResponse.json({ error: "guildId required" }, { status: 400 });

  const guild = await prisma.allowedGuild.findUnique({ where: { guildId } });
  if (!guild) return NextResponse.json({ error: "Guild not found" }, { status: 404 });

  // Ensure config row exists
  let config = await prisma.notificationConfig.findUnique({ where: { guildId } });
  if (!config) {
    config = await prisma.notificationConfig.create({
      data: { guildId, webhookUrls: [], notifyMinutesBefore: [60, 15], enabled: true },
    });
  }

  if (action === "add_webhook") {
    if (!webhookUrl || !isValidDiscordWebhookUrl(webhookUrl)) {
      return NextResponse.json({ error: "Invalid Discord webhook URL" }, { status: 400 });
    }
    if (config.webhookUrls.length >= 10) {
      return NextResponse.json({ error: "Maximum 10 webhooks per server" }, { status: 400 });
    }
    const updated = await prisma.notificationConfig.update({
      where: { guildId },
      data: { webhookUrls: { push: encrypt(webhookUrl) } },
    });
    return NextResponse.json({ webhookCount: updated.webhookUrls.length });
  }

  if (action === "remove_webhook") {
    if (typeof removeIndex !== "number" || removeIndex < 0 || removeIndex >= config.webhookUrls.length) {
      return NextResponse.json({ error: "Invalid removeIndex" }, { status: 400 });
    }
    const newUrls = config.webhookUrls.filter((_, i) => i !== removeIndex);
    const updated = await prisma.notificationConfig.update({
      where: { guildId },
      data: { webhookUrls: newUrls },
    });
    return NextResponse.json({ webhookCount: updated.webhookUrls.length });
  }

  if (action === "update_settings") {
    let parsedMinutes: number[] | undefined;
    if (notifyMinutesBefore !== undefined) {
      if (!Array.isArray(notifyMinutesBefore)) {
        return NextResponse.json({ error: "notifyMinutesBefore must be an array" }, { status: 400 });
      }
      parsedMinutes = [...new Set(
        notifyMinutesBefore
          .map((v) => parseInt(String(v)))
          .filter((n) => !isNaN(n) && n > 0 && n <= 1440)
      )].sort((a, b) => b - a);
      if (parsedMinutes.length === 0) {
        return NextResponse.json({ error: "At least one valid minute value required" }, { status: 400 });
      }
    }

    const updated = await prisma.notificationConfig.update({
      where: { guildId },
      data: {
        ...(parsedMinutes !== undefined ? { notifyMinutesBefore: parsedMinutes } : {}),
        ...(typeof enabled === "boolean" ? { enabled } : {}),
      },
    });

    return NextResponse.json({
      notifyMinutesBefore: updated.notifyMinutesBefore,
      enabled: updated.enabled,
      webhookCount: updated.webhookUrls.length,
    });
  }

  return NextResponse.json({ error: "Unknown action. Use: add_webhook, remove_webhook, update_settings" }, { status: 400 });
}
