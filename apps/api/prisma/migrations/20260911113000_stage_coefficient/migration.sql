-- CreateEnum
CREATE TYPE "GridSource" AS ENUM ('QUAL', 'POINTS');

-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "gridActual" INTEGER,
ADD COLUMN     "gridReference" INTEGER NOT NULL DEFAULT 32,
ADD COLUMN     "stageCoefficient" DOUBLE PRECISION,
ADD COLUMN     "gridSource" "GridSource";
