-- CreateTable
CREATE TABLE "PilotSeriesAlias" (
    "id" TEXT NOT NULL,
    "pilotId" TEXT NOT NULL,
    "seriesId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PilotSeriesAlias_pkey" PRIMARY KEY ("id")
);

-- Backfill existing pilot names as generic per-series aliases before dropping Pilot.nameRu.
INSERT INTO "PilotSeriesAlias" ("id", "pilotId", "seriesId", "name", "nameKey", "createdAt", "updatedAt")
SELECT
    'alias_' || md5(p."id" || ':' || s."id" || ':' || p."nameRu") AS "id",
    p."id" AS "pilotId",
    s."id" AS "seriesId",
    p."nameRu" AS "name",
    lower(regexp_replace(p."nameRu", '[^[:alnum:]]+', '', 'g')) AS "nameKey",
    CURRENT_TIMESTAMP AS "createdAt",
    CURRENT_TIMESTAMP AS "updatedAt"
FROM "Pilot" p
JOIN (
    SELECT DISTINCT er."pilotId", se."seriesId"
    FROM "EventResult" er
    JOIN "Event" e ON e."id" = er."eventId"
    JOIN "Season" se ON se."id" = e."seasonId"
) ps ON ps."pilotId" = p."id"
JOIN "Series" s ON s."id" = ps."seriesId"
WHERE p."nameRu" IS NOT NULL AND btrim(p."nameRu") <> ''
ON CONFLICT DO NOTHING;

-- CreateIndex
CREATE UNIQUE INDEX "PilotSeriesAlias_seriesId_name_key" ON "PilotSeriesAlias"("seriesId", "name");

-- CreateIndex
CREATE INDEX "PilotSeriesAlias_seriesId_nameKey_idx" ON "PilotSeriesAlias"("seriesId", "nameKey");

-- CreateIndex
CREATE INDEX "PilotSeriesAlias_pilotId_idx" ON "PilotSeriesAlias"("pilotId");

-- AddForeignKey
ALTER TABLE "PilotSeriesAlias" ADD CONSTRAINT "PilotSeriesAlias_pilotId_fkey" FOREIGN KEY ("pilotId") REFERENCES "Pilot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PilotSeriesAlias" ADD CONSTRAINT "PilotSeriesAlias_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "Series"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "Pilot" DROP COLUMN "nameRu";
