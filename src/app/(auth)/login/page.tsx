import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import LoginButton from "./LoginButton";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  const session = await getServerSession(authOptions);
  if (session) redirect("/");

  return (
    <div className="min-h-screen flex items-center justify-center bg-eve-bg">
      <div className="card w-full max-w-sm text-center space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-eve-accent tracking-wide">
            EVE POS Tracker
          </h1>
          <p className="text-eve-muted text-sm mt-1">
            Structure timer tracking for Eve Echoes
          </p>
        </div>

        {searchParams.error && (
          <div className="bg-red-900/40 border border-eve-red text-red-300 text-sm rounded-md px-4 py-3">
            {searchParams.error === "AccessDenied"
              ? "Access denied. You are not a member of an authorized Discord server."
              : "Authentication error. Please try again."}
          </div>
        )}

        <LoginButton />

        <p className="text-xs text-eve-muted">
          Access is restricted to members of authorized Discord servers.
        </p>
      </div>
    </div>
  );
}
