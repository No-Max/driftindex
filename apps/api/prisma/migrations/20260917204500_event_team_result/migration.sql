-- Official per-event team championship points (Royal DS scoring is not a raw sum of driver totals).
CREATE TABLE "EventTeamResult" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "points" INTEGER NOT NULL DEFAULT 0,
    "position" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventTeamResult_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EventTeamResult_eventId_teamId_key" ON "EventTeamResult"("eventId", "teamId");
CREATE INDEX "EventTeamResult_teamId_idx" ON "EventTeamResult"("teamId");

ALTER TABLE "EventTeamResult" ADD CONSTRAINT "EventTeamResult_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EventTeamResult" ADD CONSTRAINT "EventTeamResult_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
