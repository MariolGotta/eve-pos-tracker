import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const [, , guildId] = process.argv;

  if (!guildId) {
    console.error("Usage: tsx scripts/remove-guild.ts <guildId>");
    process.exit(1);
  }

  const guild = await prisma.allowedGuild.findUnique({ where: { guildId } });
  if (!guild) {
    console.error(`Guild not found: ${guildId}`);
    process.exit(1);
  }

  await prisma.allowedGuild.delete({ where: { guildId } });
  console.log(`✓ Removed guild: ${guild.name} (${guild.guildId})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
