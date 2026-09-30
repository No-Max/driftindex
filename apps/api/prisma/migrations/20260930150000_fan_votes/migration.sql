-- CreateTable
CREATE TABLE "FanVote" (
    "id" TEXT NOT NULL,
    "pollKey" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "pilotId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FanVote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FanVote_pollKey_pilotId_idx" ON "FanVote"("pollKey", "pilotId");

-- CreateIndex
CREATE UNIQUE INDEX "FanVote_pollKey_userId_key" ON "FanVote"("pollKey", "userId");

-- AddForeignKey
ALTER TABLE "FanVote" ADD CONSTRAINT "FanVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FanVote" ADD CONSTRAINT "FanVote_pilotId_fkey" FOREIGN KEY ("pilotId") REFERENCES "Pilot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
