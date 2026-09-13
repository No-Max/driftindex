-- Replace localized event names with a single display name and move tracks into a relation.
CREATE TABLE "Track" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "country" TEXT,
  "city" TEXT,
  "description" TEXT,
  "photoUrl" TEXT,
  "sourceUrl" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Track_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Track_slug_key" ON "Track"("slug");
CREATE INDEX "Track_name_idx" ON "Track"("name");

ALTER TABLE "Event" RENAME COLUMN "nameEn" TO "name";
ALTER TABLE "Event" ADD COLUMN "trackId" TEXT;

WITH source_tracks AS (
  SELECT DISTINCT
    COALESCE(NULLIF(BTRIM("trackEn"), ''), NULLIF(BTRIM("trackRu"), '')) AS "name"
  FROM "Event"
  WHERE COALESCE(NULLIF(BTRIM("trackEn"), ''), NULLIF(BTRIM("trackRu"), '')) IS NOT NULL
),
normalized_tracks AS (
  SELECT
    "name",
    NULLIF(
      TRIM(BOTH '-' FROM LOWER(REGEXP_REPLACE("name", '[^[:alnum:]]+', '-', 'g'))),
      ''
    ) AS "baseSlug"
  FROM source_tracks
)
INSERT INTO "Track" ("id", "slug", "name", "createdAt", "updatedAt")
SELECT
  'track_' || MD5("name") AS "id",
  COALESCE("baseSlug", 'track') || '-' || SUBSTRING(MD5("name") FROM 1 FOR 8) AS "slug",
  "name",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM normalized_tracks;

UPDATE "Event"
SET "trackId" = 'track_' || MD5(COALESCE(NULLIF(BTRIM("trackEn"), ''), NULLIF(BTRIM("trackRu"), '')))
WHERE COALESCE(NULLIF(BTRIM("trackEn"), ''), NULLIF(BTRIM("trackRu"), '')) IS NOT NULL;

ALTER TABLE "Event" DROP COLUMN "nameRu";
ALTER TABLE "Event" DROP COLUMN "trackEn";
ALTER TABLE "Event" DROP COLUMN "trackRu";

CREATE INDEX "Event_trackId_idx" ON "Event"("trackId");

ALTER TABLE "Event" ADD CONSTRAINT "Event_trackId_fkey"
  FOREIGN KEY ("trackId") REFERENCES "Track"("id") ON DELETE SET NULL ON UPDATE CASCADE;
