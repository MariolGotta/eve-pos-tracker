-- Migration: replace single webhookUrl with webhookUrls array
-- Copies existing encrypted webhook into the new array, then drops old column.

ALTER TABLE "NotificationConfig" ADD COLUMN "webhookUrls" TEXT[] NOT NULL DEFAULT '{}';

UPDATE "NotificationConfig"
SET "webhookUrls" = ARRAY["webhookUrl"]
WHERE "webhookUrl" IS NOT NULL AND "webhookUrl" != '';

ALTER TABLE "NotificationConfig" DROP COLUMN "webhookUrl";
