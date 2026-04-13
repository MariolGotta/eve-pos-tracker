-- AlterTable
ALTER TABLE "AllowedGuild" ADD COLUMN     "requiredRoleIds" TEXT[] DEFAULT ARRAY[]::TEXT[];
