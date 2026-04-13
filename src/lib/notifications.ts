import { Structure, Timer, TimerKind } from "@prisma/client";
import { decrypt } from "./crypto";
import { stateLabel } from "./state-machine";

const STATE_COLORS: Record<string, number> = {
  ARMOR_VULNERABLE: 0xe53e3e, // red
  HULL_VULNERABLE: 0xdd6b20,  // orange
  ARMOR_TIMER: 0xc9a84c,      // gold
  HULL_TIMER: 0x718096,       // gray
};

function kindToVulnerableState(kind: TimerKind): string {
  return kind === "SHIELD_TO_ARMOR" ? "ARMOR_VULNERABLE" : "HULL_VULNERABLE";
}

export async function sendVulnerableNotification(
  webhookUrl: string,
  structure: Structure,
  timer: Timer
): Promise<void> {
  const state = kindToVulnerableState(timer.kind);
  const label = stateLabel(state as never);

  const embed = {
    title: `🚨 Structure Vulnerable — ${structure.system}`,
    description: [
      `**State:** ${label}`,
      structure.name ? `**Name:** ${structure.name}` : null,
      structure.corporation ? `**Corp:** ${structure.corporation}` : null,
      `**Distance:** ${structure.distanceFromSun} AU`,
      `**System:** ${structure.system}`,
    ]
      .filter(Boolean)
      .join("\n"),
    color: STATE_COLORS[state] ?? 0x4a9eff,
    timestamp: new Date().toISOString(),
    footer: { text: "EVE POS Tracker" },
  };

  await postWebhook(webhookUrl, { embeds: [embed] });
}

export async function sendTimerWarningNotification(
  webhookUrl: string,
  structure: Structure,
  timer: Timer,
  minutesLeft: number
): Promise<void> {
  const state = kindToVulnerableState(timer.kind);
  const label = stateLabel(state as never);
  const expiresAt = new Date(timer.expiresAt).toUTCString();

  const embed = {
    title: `⏰ Timer Alert — ${minutesLeft}min until ${label}`,
    description: [
      `**System:** ${structure.system}`,
      structure.name ? `**Name:** ${structure.name}` : null,
      structure.corporation ? `**Corp:** ${structure.corporation}` : null,
      `**Distance:** ${structure.distanceFromSun} AU`,
      `**Expires:** ${expiresAt}`,
    ]
      .filter(Boolean)
      .join("\n"),
    color: STATE_COLORS[state] ?? 0x4a9eff,
    timestamp: new Date().toISOString(),
    footer: { text: "EVE POS Tracker" },
  };

  await postWebhook(webhookUrl, { embeds: [embed] });
}

const ALLOWED_WEBHOOK_HOSTS = ["discord.com", "discordapp.com", "ptb.discord.com", "canary.discord.com"];

function validateWebhookUrl(rawUrl: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error("Invalid webhook URL");
  }
  if (parsed.protocol !== "https:") throw new Error("Webhook URL must use HTTPS");
  const host = parsed.hostname.toLowerCase();
  if (!ALLOWED_WEBHOOK_HOSTS.some((allowed) => host === allowed || host.endsWith(`.${allowed}`))) {
    throw new Error(`Webhook host not allowed: ${host}`);
  }
  return parsed;
}

async function postWebhook(url: string, body: object): Promise<void> {
  try {
    // Decrypt stored ciphertext
    let webhookUrl: string;
    try {
      webhookUrl = decrypt(url);
    } catch {
      webhookUrl = url;
    }

    // SSRF guard — only allow Discord domains over HTTPS
    validateWebhookUrl(webhookUrl);

    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      console.error(`Webhook failed: ${res.status}`);
    }
  } catch (err) {
    console.error("Webhook error:", (err as Error).message);
  }
}
