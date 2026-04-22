import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Image from "next/image";
import { RoleToggle } from "./RoleToggle";

export const revalidate = 0;

export default async function UsersPage() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "OWNER") redirect("/");

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      discordId: true,
      username: true,
      displayName: true,
      avatarUrl: true,
      role: true,
      createdAt: true,
      _count: { select: { structures: true } },
    },
  });

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-white">Registered Users</h1>
        <span className="text-sm text-eve-muted">{users.length} account(s)</span>
      </div>

      <div className="space-y-2">
        {users.map((u) => (
          <div key={u.id} className="card flex items-center gap-4">
            {u.avatarUrl ? (
              <Image
                src={u.avatarUrl}
                alt={u.username}
                width={40}
                height={40}
                className="rounded-full shrink-0"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-eve-surface border border-eve-border shrink-0 flex items-center justify-center text-eve-muted text-sm">
                {u.username[0]?.toUpperCase()}
              </div>
            )}

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-white">{u.displayName ?? u.username}</span>
                {u.displayName && u.displayName !== u.username && (
                  <span className="text-xs text-eve-muted font-mono">@{u.username}</span>
                )}
                {u.role === "OWNER" && (
                  <span className="text-xs bg-yellow-500/20 text-yellow-300 border border-yellow-500/40 rounded px-1.5 py-0.5 font-semibold">
                    OWNER
                  </span>
                )}
                {u.role === "ADMIN" && (
                  <span className="text-xs bg-eve-accent/20 text-eve-accent border border-eve-accent/40 rounded px-1.5 py-0.5 font-semibold">
                    ADMIN
                  </span>
                )}
              </div>
              <p className="text-xs text-eve-muted font-mono">{u.discordId}</p>
              <p className="text-xs text-eve-muted">
                Joined {new Date(u.createdAt).toLocaleDateString()} ·{" "}
                {u._count.structures} structure(s) registered
              </p>
            </div>

            {/* Role toggle — OWNER can promote MEMBER→ADMIN or demote ADMIN→MEMBER */}
            <RoleToggle userId={u.id} currentRole={u.role} />
          </div>
        ))}

        {users.length === 0 && (
          <p className="text-eve-muted text-sm">No users yet.</p>
        )}
      </div>
    </div>
  );
}
