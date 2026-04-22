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

interface MemberInfo {
  roles: string[];
  nick: string | null; // server-specific nickname
}

async function fetchMemberInfo(accessToken: string, guildId: string): Promise<MemberInfo> {
  const res = await fetch(`https://discord.com/api/users/@me/guilds/${guildId}/member`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return { roles: [], nick: null };
  const member = await res.json();
  return {
    roles: Array.isArray(member.roles) ? member.roles : [],
    nick: typeof member.nick === "string" && member.nick.trim() ? member.nick.trim() : null,
  };
}

interface GuildAccessResult {
  authorized: boolean;
  displayName: string | null; // server nickname from the first matched guild
}

/**
 * Checks if a Discord user (via their OAuth access token) is authorized.
 * Returns true only if the user is in at least one allowed guild AND has a required role.
 * Also returns the server nickname if available, for display purposes.
 * On any API failure, denies access (fail-closed).
 */
async function checkGuildAccess(accessToken: string): Promise<GuildAccessResult> {
  const userGuilds = await fetchUserGuilds(accessToken);
  if (userGuilds.length === 0) return { authorized: false, displayName: null };

  const userGuildIds = new Set(userGuilds.map((g) => g.id));

  const allowedGuilds = await prisma.allowedGuild.findMany({
    select: { guildId: true, requiredRoleIds: true },
  });

  const matchedGuilds = allowedGuilds.filter((g) => userGuildIds.has(g.guildId));
  if (matchedGuilds.length === 0) return { authorized: false, displayName: null };

  for (const guild of matchedGuilds) {
    if (guild.requiredRoleIds.length === 0) continue;
    const { roles, nick } = await fetchMemberInfo(accessToken, guild.guildId);
    const hasRole = guild.requiredRoleIds.some((r) => roles.includes(r));
    if (hasRole) return { authorized: true, displayName: nick };
  }

  return { authorized: false, displayName: null };
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

      let displayName: string | null = null;

      if (!isOwner) {
        const result = await checkGuildAccess(account.access_token);
        if (!result.authorized) return false;
        displayName = result.displayName;
      }

      // Preserve existing ADMIN role — only override to OWNER or MEMBER on create/first login
      const existingUser = await prisma.user.findUnique({
        where: { discordId },
        select: { role: true },
      });
      const roleToAssign = isOwner
        ? "OWNER"
        : existingUser?.role === "ADMIN"
        ? "ADMIN"   // keep ADMIN — don't reset to MEMBER on every login
        : "MEMBER";

      // Upsert user — displayName: guild nick > global display name (user.name) > keep existing
      await prisma.user.upsert({
        where: { discordId },
        create: {
          discordId,
          username: user.name ?? "Unknown",
          displayName: displayName ?? user.name ?? null,
          avatarUrl: user.image ?? null,
          role: roleToAssign,
        },
        update: {
          username: user.name ?? "Unknown",
          displayName: displayName ?? user.name ?? undefined,
          avatarUrl: user.image ?? null,
          role: roleToAssign,
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
          const result = await checkGuildAccess(token.accessToken as string);
          if (!result.authorized) {
            return { ...token, invalidated: true };
          }
          // Refresh displayName in DB if nick changed
          if (result.displayName && token.userId) {
            await prisma.user.update({
              where: { id: token.userId as string },
              data: { displayName: result.displayName },
            });
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
