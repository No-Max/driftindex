-- Replace localized series names with one English display name and a short name.
ALTER TABLE "Series" RENAME COLUMN "nameEn" TO "name";
ALTER TABLE "Series" ADD COLUMN "shortName" TEXT;

UPDATE "Series"
SET "shortName" = CASE "slug"
  WHEN 'formula-drift-pro' THEN 'FD PRO'
  WHEN 'drift-masters' THEN 'DM'
  WHEN 'd1gp' THEN 'D1GP'
  WHEN 'rds-gp' THEN 'RDS GP'
  WHEN 'royal-ds' THEN 'RDS'
  WHEN 'drift-kings' THEN 'DK'
  ELSE NULL
END;

CREATE TABLE "SeriesName" (
  "id" TEXT NOT NULL,
  "seriesId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "shortName" TEXT,
  "yearFrom" INTEGER,
  "yearTo" INTEGER,
  "sourceUrl" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "SeriesName_pkey" PRIMARY KEY ("id")
);

INSERT INTO "SeriesName" (
  "id",
  "seriesId",
  "name",
  "shortName",
  "yearFrom",
  "yearTo",
  "sourceUrl",
  "createdAt",
  "updatedAt"
)
SELECT
  'series_name_' || md5("id" || ':' || "name") AS "id",
  "id" AS "seriesId",
  "name",
  "shortName",
  NULL,
  NULL,
  NULL,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Series";

ALTER TABLE "Series" DROP COLUMN "nameRu";

CREATE INDEX "SeriesName_seriesId_yearFrom_yearTo_idx" ON "SeriesName"("seriesId", "yearFrom", "yearTo");
CREATE UNIQUE INDEX "SeriesName_seriesId_name_key" ON "SeriesName"("seriesId", "name");

ALTER TABLE "SeriesName" ADD CONSTRAINT "SeriesName_seriesId_fkey"
  FOREIGN KEY ("seriesId") REFERENCES "Series"("id") ON DELETE CASCADE ON UPDATE CASCADE;
