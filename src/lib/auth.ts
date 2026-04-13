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

export const authOptions: NextAuthOptions = {
  providers: [
    DiscordProvider({
      clientId: process.env.DISCORD_CLIENT_ID!,
      clientSecret: process.env.DISCORD_CLIENT_SECRET!,
      authorization: {
        params: { scope: "identify guilds" },
      },
    }),
  ],
  session: { strategy: "jwt" },
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider !== "discord" || !account.access_token) return false;

      // Fetch user's Discord guilds
      const userGuilds = await fetchUserGuilds(account.access_token);
      const userGuildIds = userGuilds.map((g) => g.id);

      // Check against allowed guilds in DB
      const allowedGuilds = await prisma.allowedGuild.findMany({
        select: { guildId: true },
      });
      const allowedIds = allowedGuilds.map((g) => g.guildId);

      const hasAccess = userGuildIds.some((id) => allowedIds.includes(id));
      if (!hasAccess) return false;

      // Upsert user — set role OWNER if matches env
      const discordId = account.providerAccountId;
      const isOwner = discordId === process.env.OWNER_DISCORD_ID;

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
