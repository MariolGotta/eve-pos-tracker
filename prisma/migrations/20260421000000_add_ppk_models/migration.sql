-- CreateEnum
CREATE TYPE "ShipType" AS ENUM ('SUBCAP', 'POS', 'CAPITAL');

-- CreateEnum
CREATE TYPE "KillmailStatus" AS ENUM ('PENDING', 'COMPLETE');

-- CreateTable
CREATE TABLE "Killmail" (
    "id" TEXT NOT NULL,
    "reportTitle" TEXT NOT NULL,
    "timestampUtc" TIMESTAMP(3) NOT NULL,
    "system" TEXT NOT NULL,
    "region" TEXT,
    "totalDamage" INTEGER NOT NULL,
    "iskValue" BIGINT NOT NULL,
    "shipType" "ShipType" NOT NULL DEFAULT 'SUBCAP',
    "victimPilot" TEXT NOT NULL,
    "victimCorpTag" TEXT NOT NULL,
    "victimShip" TEXT NOT NULL,
    "participantsTotal" INTEGER,
    "status" "KillmailStatus" NOT NULL DEFAULT 'PENDING',
    "damageCoverage" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sourceGuildId" TEXT,
    "submittedByDiscordId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Killmail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KillmailAttacker" (
    "id" TEXT NOT NULL,
    "killmailId" TEXT NOT NULL,
    "pilot" TEXT NOT NULL,
    "corpTag" TEXT NOT NULL,
    "ship" TEXT NOT NULL,
    "damage" INTEGER NOT NULL,
    "damagePct" DOUBLE PRECISION NOT NULL,
    "finalBlow" BOOLEAN NOT NULL DEFAULT false,
    "topDamage" BOOLEAN NOT NULL DEFAULT false,
    "iskEarned" BIGINT,

    CONSTRAINT "KillmailAttacker_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Player" (
    "id" TEXT NOT NULL,
    "pilot" TEXT NOT NULL,
    "corpTag" TEXT,
    "totalEarned" BIGINT NOT NULL DEFAULT 0,
    "totalPaid" BIGINT NOT NULL DEFAULT 0,
    "remaining" BIGINT NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Player_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "iskAmount" BIGINT NOT NULL,
    "notes" TEXT,
    "paidByDiscordId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PpkCorporation" (
    "id" TEXT NOT NULL,
    "corpTag" TEXT NOT NULL,
    "fullName" TEXT,
    "eligible" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PpkCorporation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PpkConfig" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "subcapMultiplier" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "posFixedIsk" BIGINT NOT NULL DEFAULT 0,
    "capitalFixedIsk" BIGINT NOT NULL DEFAULT 0,
    "bot5Coefficient" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "nonBot5Coefficient" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "subcapCapIsk" BIGINT NOT NULL DEFAULT 15000000000,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PpkConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "KillmailAttacker_killmailId_pilot_key" ON "KillmailAttacker"("killmailId", "pilot");

-- CreateIndex
CREATE UNIQUE INDEX "Player_pilot_key" ON "Player"("pilot");

-- CreateIndex
CREATE UNIQUE INDEX "PpkCorporation_corpTag_key" ON "PpkCorporation"("corpTag");

-- AddForeignKey
ALTER TABLE "KillmailAttacker" ADD CONSTRAINT "KillmailAttacker_killmailId_fkey" FOREIGN KEY ("killmailId") REFERENCES "Killmail"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
