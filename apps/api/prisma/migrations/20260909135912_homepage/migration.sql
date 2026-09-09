-- AlterTable
ALTER TABLE "EventResult" ADD COLUMN     "qualPoints" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "Pilot" ADD COLUMN     "photoUrl" TEXT;

-- AlterTable
ALTER TABLE "Series" ADD COLUMN     "defaultWeight" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
ADD COLUMN     "featuredOrder" INTEGER,
ADD COLUMN     "logoUrl" TEXT;

-- CreateTable
CREATE TABLE "SeriesWeight" (
    "id" TEXT NOT NULL,
    "seriesId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL,
    "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SeriesWeight_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SeriesWeight_seriesId_year_key" ON "SeriesWeight"("seriesId", "year");

-- AddForeignKey
ALTER TABLE "SeriesWeight" ADD CONSTRAINT "SeriesWeight_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "Series"("id") ON DELETE CASCADE ON UPDATE CASCADE;
