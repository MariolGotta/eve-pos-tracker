import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import GuildsManager from "./GuildsManager";

export const revalidate = 0;

export default async function GuildsPage() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "OWNER") redirect("/");

  const guilds = await prisma.allowedGuild.findMany({
    orderBy: { addedAt: "asc" },
  });

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-xl font-bold text-white">Allowed Guilds</h1>
      <p className="text-sm text-eve-muted">
        Members of these Discord servers can log in to EVE POS Tracker.
      </p>
      <GuildsManager
        initialGuilds={guilds.map((g) => ({
          guildId: g.guildId,
          name: g.name,
          requiredRoleIds: g.requiredRoleIds,
          addedAt: g.addedAt.toISOString(),
        }))}
      />
    </div>
  );
}
