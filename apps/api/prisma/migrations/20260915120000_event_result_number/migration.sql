-- Per-event car number (season/series-specific; Pilot.number is legacy fallback only).
ALTER TABLE "EventResult" ADD COLUMN "number" INTEGER;

UPDATE "EventResult" er
SET "number" = p."number"
FROM "Pilot" p
WHERE er."pilotId" = p.id
  AND p."number" IS NOT NULL
  AND er."number" IS NULL;
