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
  session: { strategy: "jwt" },
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider !== "discord" || !account.access_token) return false;

      const discordId = account.providerAccountId;
      const isOwner = discordId === process.env.OWNER_DISCORD_ID;

      // Owner always has access — needed to bootstrap guild/role config
      if (!isOwner) {
        // Fetch user's Discord guilds
        const userGuilds = await fetchUserGuilds(account.access_token);
        const userGuildIds = new Set(userGuilds.map((g) => g.id));

        // Fetch all allowed guilds with their required roles
        const allowedGuilds = await prisma.allowedGuild.findMany({
          select: { guildId: true, requiredRoleIds: true },
        });

        // Find guilds the user is actually in
        const matchedGuilds = allowedGuilds.filter((g) => userGuildIds.has(g.guildId));
        if (matchedGuilds.length === 0) return false;

        // For each matched guild, check role requirements
        // A guild with no requiredRoleIds blocks access (must explicitly configure roles)
        let authorized = false;
        for (const guild of matchedGuilds) {
          if (guild.requiredRoleIds.length === 0) continue; // no roles configured → nobody enters
          const memberRoles = await fetchMemberRoles(account.access_token, guild.guildId);
          const hasRole = guild.requiredRoleIds.some((r) => memberRoles.includes(r));
          if (hasRole) {
            authorized = true;
            break;
          }
        }
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
      if (account?.providerAccountId) {
        const dbUser = await prisma.user.findUnique({
          where: { discordId: account.providerAccountId },
          select: { id: true, role: true },
        });
        if (dbUser) {
          token.userId = dbUser.id;
          token.role = dbUser.role;
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
  }
}
