-- CreateTable
CREATE TABLE "PilotSeriesPhoto" (
    "id" TEXT NOT NULL,
    "pilotId" TEXT NOT NULL,
    "seriesId" TEXT NOT NULL,
    "photoUrl" TEXT,
    "photoSourceUrl" TEXT,
    "photoUpdatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PilotSeriesPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PilotSeriesPhoto_pilotId_seriesId_key" ON "PilotSeriesPhoto"("pilotId", "seriesId");

-- AddForeignKey
ALTER TABLE "PilotSeriesPhoto" ADD CONSTRAINT "PilotSeriesPhoto_pilotId_fkey" FOREIGN KEY ("pilotId") REFERENCES "Pilot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PilotSeriesPhoto" ADD CONSTRAINT "PilotSeriesPhoto_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "Series"("id") ON DELETE CASCADE ON UPDATE CASCADE;
