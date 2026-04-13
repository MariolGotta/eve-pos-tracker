-- CreateEnum
CREATE TYPE "Role" AS ENUM ('OWNER', 'MEMBER');

-- CreateEnum
CREATE TYPE "StructureState" AS ENUM ('SHIELD', 'ARMOR_TIMER', 'ARMOR_VULNERABLE', 'HULL_TIMER', 'HULL_VULNERABLE', 'DEAD');

-- CreateEnum
CREATE TYPE "TimerKind" AS ENUM ('SHIELD_TO_ARMOR', 'ARMOR_TO_HULL');

-- CreateEnum
CREATE TYPE "TimerStatus" AS ENUM ('PENDING', 'EXPIRED_NOT_HIT', 'PROGRESSED', 'REGENERATED', 'CANCELLED');

-- CreateTable
CREATE TABLE "AllowedGuild" (
    "guildId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AllowedGuild_pkey" PRIMARY KEY ("guildId")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "discordId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "role" "Role" NOT NULL DEFAULT 'MEMBER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "Structure" (
    "id" TEXT NOT NULL,
    "system" TEXT NOT NULL,
    "distanceFromSun" DOUBLE PRECISION NOT NULL,
    "name" TEXT,
    "corporation" TEXT,
    "notes" TEXT,
    "currentState" "StructureState" NOT NULL DEFAULT 'SHIELD',
    "deletedAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Structure_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Timer" (
    "id" TEXT NOT NULL,
    "structureId" TEXT NOT NULL,
    "kind" "TimerKind" NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "status" "TimerStatus" NOT NULL DEFAULT 'PENDING',
    "notifiedAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Timer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StructureEvent" (
    "id" TEXT NOT NULL,
    "structureId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StructureEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationConfig" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "webhookUrl" TEXT NOT NULL,
    "notifyMinutesBefore" INTEGER[] DEFAULT ARRAY[60, 15]::INTEGER[],
    "enabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "NotificationConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_discordId_key" ON "User"("discordId");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE INDEX "Structure_system_idx" ON "Structure"("system");

-- CreateIndex
CREATE INDEX "Structure_currentState_idx" ON "Structure"("currentState");

-- CreateIndex
CREATE INDEX "Structure_system_currentState_idx" ON "Structure"("system", "currentState");

-- CreateIndex
CREATE INDEX "Structure_deletedAt_idx" ON "Structure"("deletedAt");

-- CreateIndex
CREATE INDEX "Timer_expiresAt_idx" ON "Timer"("expiresAt");

-- CreateIndex
CREATE INDEX "Timer_status_idx" ON "Timer"("status");

-- CreateIndex
CREATE INDEX "Timer_structureId_status_idx" ON "Timer"("structureId", "status");

-- CreateIndex
CREATE INDEX "StructureEvent_structureId_idx" ON "StructureEvent"("structureId");

-- CreateIndex
CREATE INDEX "StructureEvent_createdAt_idx" ON "StructureEvent"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationConfig_guildId_key" ON "NotificationConfig"("guildId");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Structure" ADD CONSTRAINT "Structure_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Timer" ADD CONSTRAINT "Timer_structureId_fkey" FOREIGN KEY ("structureId") REFERENCES "Structure"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Timer" ADD CONSTRAINT "Timer_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StructureEvent" ADD CONSTRAINT "StructureEvent_structureId_fkey" FOREIGN KEY ("structureId") REFERENCES "Structure"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StructureEvent" ADD CONSTRAINT "StructureEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationConfig" ADD CONSTRAINT "NotificationConfig_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "AllowedGuild"("guildId") ON DELETE RESTRICT ON UPDATE CASCADE;
