-- AlterTable
ALTER TABLE "NotificationConfig" ALTER COLUMN "webhookUrls" DROP DEFAULT;

-- CreateTable
CREATE TABLE "TimerAttendee" (
    "id" TEXT NOT NULL,
    "timerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TimerAttendee_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TimerAttendee_timerId_idx" ON "TimerAttendee"("timerId");

-- CreateIndex
CREATE UNIQUE INDEX "TimerAttendee_timerId_userId_key" ON "TimerAttendee"("timerId", "userId");

-- AddForeignKey
ALTER TABLE "TimerAttendee" ADD CONSTRAINT "TimerAttendee_timerId_fkey" FOREIGN KEY ("timerId") REFERENCES "Timer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimerAttendee" ADD CONSTRAINT "TimerAttendee_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
