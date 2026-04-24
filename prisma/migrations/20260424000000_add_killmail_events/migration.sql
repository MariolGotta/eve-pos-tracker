-- CreateTable
CREATE TABLE "KillmailEvent" (
    "id" TEXT NOT NULL,
    "killmailId" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KillmailEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "KillmailEvent_killmailId_idx" ON "KillmailEvent"("killmailId");

-- CreateIndex
CREATE INDEX "KillmailEvent_createdAt_idx" ON "KillmailEvent"("createdAt");

-- AddForeignKey
ALTER TABLE "KillmailEvent" ADD CONSTRAINT "KillmailEvent_killmailId_fkey"
    FOREIGN KEY ("killmailId") REFERENCES "Killmail"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KillmailEvent" ADD CONSTRAINT "KillmailEvent_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
