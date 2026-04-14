import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import NotificationsManager from "./NotificationsManager";

export const revalidate = 0;

export default async function NotificationsPage() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "OWNER") redirect("/");

  const guilds = await prisma.allowedGuild.findMany({ orderBy: { name: "asc" } });
  const configs = await prisma.notificationConfig.findMany();

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-xl font-bold text-white">Notification Settings</h1>
      <p className="text-sm text-eve-muted">
        Configure Discord webhooks to receive alerts when structure timers expire or are about to open.
      </p>
      <NotificationsManager
        guilds={guilds.map((g) => ({ guildId: g.guildId, name: g.name }))}
        configs={configs.map((c) => ({
          guildId: c.guildId,
          webhookCount: c.webhookUrls.length,
          notifyMinutesBefore: c.notifyMinutesBefore,
          enabled: c.enabled,
        }))}
      />
    </div>
  );
}
