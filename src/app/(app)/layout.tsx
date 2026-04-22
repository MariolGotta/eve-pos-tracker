import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import UserMenu from "./UserMenu";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const isOwner = session.user.role === "OWNER";
  const isAdmin = session.user.role === "ADMIN" || isOwner;

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-eve-border bg-eve-panel">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <nav className="flex items-center gap-1">
            <Link
              href="/"
              className="text-eve-accent font-bold text-sm tracking-wider mr-4"
            >
              POS TRACKER
            </Link>
            <Link
              href="/"
              className="btn-ghost text-xs px-3 py-1.5"
            >
              Dashboard
            </Link>
            <Link
              href="/structures"
              className="btn-ghost text-xs px-3 py-1.5"
            >
              Structures
            </Link>
            <Link
              href="/structures/new"
              className="btn-ghost text-xs px-3 py-1.5"
            >
              + New POS
            </Link>
            <Link
              href="/ppk"
              className="btn-ghost text-xs px-3 py-1.5 text-eve-accent"
            >
              PPK
            </Link>
            {isAdmin && (
              <Link
                href="/admin/ppk"
                className="btn-ghost text-xs px-3 py-1.5 text-eve-gold"
              >
                Admin PPK
              </Link>
            )}
            {isOwner && (
              <>
                <Link
                  href="/admin/guilds"
                  className="btn-ghost text-xs px-3 py-1.5 text-eve-gold"
                >
                  Guilds
                </Link>
                <Link
                  href="/admin/notifications"
                  className="btn-ghost text-xs px-3 py-1.5 text-eve-gold"
                >
                  Notifications
                </Link>
                <Link
                  href="/admin/users"
                  className="btn-ghost text-xs px-3 py-1.5 text-eve-gold"
                >
                  Users
                </Link>
              </>
            )}
          </nav>
          <UserMenu user={session.user} />
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-6">
        {children}
      </main>
    </div>
  );
}
