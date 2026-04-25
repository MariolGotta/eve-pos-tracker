-- AlterTable
ALTER TABLE "Killmail" ADD COLUMN     "screenshotUrl" TEXT;

-- CreateIndex
CREATE INDEX "Killmail_status_idx" ON "Killmail"("status");

-- CreateIndex
CREATE INDEX "Killmail_timestampUtc_idx" ON "Killmail"("timestampUtc");

-- CreateIndex
CREATE INDEX "Killmail_victimCorpTag_idx" ON "Killmail"("victimCorpTag");

-- CreateIndex
CREATE INDEX "KillmailAttacker_killmailId_idx" ON "KillmailAttacker"("killmailId");

-- CreateIndex
CREATE INDEX "KillmailAttacker_pilot_idx" ON "KillmailAttacker"("pilot");

-- CreateIndex
CREATE INDEX "KillmailAttacker_corpTag_idx" ON "KillmailAttacker"("corpTag");

-- CreateIndex
CREATE INDEX "Payment_playerId_idx" ON "Payment"("playerId");

-- CreateIndex
CREATE INDEX "Player_remaining_idx" ON "Player"("remaining");

-- CreateIndex
CREATE INDEX "Player_pilot_idx" ON "Player"("pilot");
