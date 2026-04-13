import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const [, , guildId, ...nameParts] = process.argv;
  const name = nameParts.join(" ");

  if (!guildId || !name) {
    console.error("Usage: tsx scripts/add-guild.ts <guildId> <name>");
    process.exit(1);
  }

  const guild = await prisma.allowedGuild.upsert({
    where: { guildId },
    create: { guildId, name },
    update: { name },
  });

  console.log(`✓ Guild saved: ${guild.name} (${guild.guildId})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
