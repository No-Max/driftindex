-- CreateTable
CREATE TABLE "TrackPhoto" (
    "id" TEXT NOT NULL,
    "trackId" TEXT NOT NULL,
    "photoUrl" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrackPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TrackPhoto_trackId_sortOrder_idx" ON "TrackPhoto"("trackId", "sortOrder");

-- AddForeignKey
ALTER TABLE "TrackPhoto" ADD CONSTRAINT "TrackPhoto_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "Track"("id") ON DELETE CASCADE ON UPDATE CASCADE;
