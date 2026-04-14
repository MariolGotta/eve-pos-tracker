import { NextAuthOptions } from "next-auth";
import DiscordProvider from "next-auth/providers/discord";
import { prisma } from "./prisma";

interface DiscordGuild {
  id: string;
  name: string;
}

async function fetchUserGuilds(accessToken: string): Promise<DiscordGuild[]> {
  const res = await fetch("https://discord.com/api/users/@me/guilds", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return [];
  return res.json();
}

async function fetchMemberRoles(accessToken: string, guildId: string): Promise<string[]> {
  const res = await fetch(`https://discord.com/api/users/@me/guilds/${guildId}/member`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return [];
  const member = await res.json();
  return Array.isArray(member.roles) ? member.roles : [];
}

/**
 * Checks if a Discord user (via their OAuth access token) is authorized.
 * Returns true only if the user is in at least one allowed guild AND has a required role.
 * On any API failure, denies access (fail-closed).
 */
async function checkGuildAccess(accessToken: string): Promise<boolean> {
  const userGuilds = await fetchUserGuilds(accessToken);
  if (userGuilds.length === 0) return false;

  const userGuildIds = new Set(userGuilds.map((g) => g.id));

  const allowedGuilds = await prisma.allowedGuild.findMany({
    select: { guildId: true, requiredRoleIds: true },
  });

  const matchedGuilds = allowedGuilds.filter((g) => userGuildIds.has(g.guildId));
  if (matchedGuilds.length === 0) return false;

  for (const guild of matchedGuilds) {
    if (guild.requiredRoleIds.length === 0) continue; // no roles configured → nobody enters
    const memberRoles = await fetchMemberRoles(accessToken, guild.guildId);
    const hasRole = guild.requiredRoleIds.some((r) => memberRoles.includes(r));
    if (hasRole) return true;
  }

  return false;
}

// Re-check guild/role membership every 30 minutes
const RECHECK_INTERVAL_MS = 30 * 60 * 1000;

export const authOptions: NextAuthOptions = {
  providers: [
    DiscordProvider({
      clientId: process.env.DISCORD_CLIENT_ID!,
      clientSecret: process.env.DISCORD_CLIENT_SECRET!,
      authorization: {
        params: { scope: "identify guilds guilds.members.read" },
      },
    }),
  ],
  session: {
    strategy: "jwt",
    maxAge: 24 * 60 * 60, // 24 hours — shorter window limits exposure
  },
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider !== "discord" || !account.access_token) return false;

      const discordId = account.providerAccountId;
      const isOwner = discordId === process.env.OWNER_DISCORD_ID;

      // Owner always has access — needed to bootstrap guild/role config
      if (!isOwner) {
        const authorized = await checkGuildAccess(account.access_token);
        if (!authorized) return false;
      }

      // Upsert user
      await prisma.user.upsert({
        where: { discordId },
        create: {
          discordId,
          username: user.name ?? "Unknown",
          avatarUrl: user.image ?? null,
          role: isOwner ? "OWNER" : "MEMBER",
        },
        update: {
          username: user.name ?? "Unknown",
          avatarUrl: user.image ?? null,
          role: isOwner ? "OWNER" : "MEMBER",
        },
      });

      return true;
    },

    async jwt({ token, account }) {
      // On first sign-in: store access token and mark as just verified
      if (account?.providerAccountId) {
        const dbUser = await prisma.user.findUnique({
          where: { discordId: account.providerAccountId },
          select: { id: true, role: true },
        });
        if (dbUser) {
          token.userId = dbUser.id;
          token.role = dbUser.role;
        }
        // Store access token for periodic re-checks
        token.accessToken = account.access_token;
        token.guildCheckedAt = Date.now();
        return token;
      }

      // On subsequent requests: re-check guild access every 30 minutes for non-owners
      if (
        token.role !== "OWNER" &&
        token.accessToken &&
        typeof token.guildCheckedAt === "number" &&
        Date.now() - token.guildCheckedAt > RECHECK_INTERVAL_MS
      ) {
        try {
          const authorized = await checkGuildAccess(token.accessToken as string);
          if (!authorized) {
            // Invalidate the token — middleware will redirect to login
            return { ...token, invalidated: true };
          }
          token.guildCheckedAt = Date.now();
        } catch {
          // On unexpected error, deny access (fail-closed)
          return { ...token, invalidated: true };
        }
      }

      return token;
    },

    async session({ session, token }) {
      session.user.userId = token.userId as string;
      session.user.role = token.role as string;
      return session;
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
};

// Extend next-auth types
declare module "next-auth" {
  interface Session {
    user: {
      userId: string;
      role: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId?: string;
    role?: string;
    accessToken?: string;
    guildCheckedAt?: number;
    invalidated?: boolean;
  }
}
