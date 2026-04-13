import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const guilds = await prisma.allowedGuild.findMany({ orderBy: { addedAt: "asc" } });

  if (guilds.length === 0) {
    console.log("No guilds registered.");
    return;
  }

  console.log(`\n${"GUILD ID".padEnd(22)} ${"NAME"}`);
  console.log("-".repeat(50));
  for (const g of guilds) {
    console.log(`${g.guildId.padEnd(22)} ${g.name}`);
  }
  console.log(`\nTotal: ${guilds.length}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
