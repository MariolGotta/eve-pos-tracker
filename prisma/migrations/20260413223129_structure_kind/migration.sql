-- CreateEnum
CREATE TYPE "StructureKind" AS ENUM ('POS', 'CITADEL');

-- AlterTable
ALTER TABLE "Structure" ADD COLUMN     "kind" "StructureKind" NOT NULL DEFAULT 'POS';
