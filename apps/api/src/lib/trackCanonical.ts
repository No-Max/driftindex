import { transliterate } from './transliterate.js';

export interface ResolvedTrackFields {
  name: string;
  city: string | null;
  country: string | null;
  /** Fixed slug when this row maps to a known circuit; used for deduplication. */
  preferredSlug: string | null;
}

const RUSSIA = 'Russia';

const CITY_EN: Record<string, string> = {
  москва: 'Moscow',
  'санкт-петербург': 'Saint Petersburg',
  'нижний новгород': 'Nizhny Novgorod',
  красноярск: 'Krasnoyarsk',
  сочи: 'Sochi',
  рязань: 'Ryazan',
  смоленск: 'Smolensk',
  казань: 'Kazan',
  краснодар: 'Krasnodar',
  владивосток: 'Vladivostok',
  'усть-лабинск': 'Ust-Labinsk',
  дорогобуж: 'Dorogobuzh',
  артём: 'Artem',
  артем: 'Artem',
};

const CANONICAL: Array<{
  preferredSlug: string;
  name: string;
  city: string;
  country: string;
  matches: (raw: string, normalized: string) => boolean;
}> = [
  {
    preferredSlug: 'adm-raceway',
    name: 'ADM Raceway',
    city: 'Moscow',
    country: RUSSIA,
    matches: (raw, norm) =>
      /\badm\b/i.test(raw) ||
      /adm raceway/i.test(norm) ||
      /москва\s*\/?\s*adm/i.test(raw),
  },
  {
    preferredSlug: 'tushino-ring',
    name: 'Tushino Ring',
    city: 'Moscow',
    country: RUSSIA,
    matches: (raw, norm) => /tushino|тушино/i.test(raw),
  },
  {
    preferredSlug: 'moscow-raceway',
    name: 'Moscow Raceway',
    city: 'Moscow',
    country: RUSSIA,
    matches: (raw, norm) =>
      /moscow raceway/i.test(norm) ||
      /\bmrw\b/i.test(raw) ||
      /москва\s*\/?\s*mrw/i.test(raw) ||
      norm === 'москва' ||
      raw.trim() === 'Москва',
  },
  {
    preferredSlug: 'igora-drive',
    name: 'Igora Drive',
    city: 'Saint Petersburg',
    country: RUSSIA,
    matches: (raw, norm) => /igora drive|igora|игора/i.test(norm) || /igora|игора/i.test(raw),
  },
  {
    preferredSlug: 'saint-petersburg-circuit',
    name: 'Saint Petersburg Circuit',
    city: 'Saint Petersburg',
    country: RUSSIA,
    matches: (raw, norm) => {
      if (/igora|игора/i.test(raw)) return false;
      if (/молл|ашан|культур\s*41/i.test(raw)) return false;
      return (
        norm === 'санкт-петербург' ||
        raw.trim() === 'Санкт-Петербург' ||
        /автодром «санкт-петербург»/i.test(raw) ||
        /autodrom «saint petersburg»/i.test(norm)
      );
    },
  },
  {
    preferredSlug: 'atron-international-circuit',
    name: 'ATRON International Circuit',
    city: 'Ryazan',
    country: RUSSIA,
    matches: (raw, norm) =>
      /atron|атрон/i.test(raw) || norm === 'рязань' || raw.trim() === 'Рязань',
  },
  {
    preferredSlug: 'smolensk-ring',
    name: 'Smolensk Ring',
    city: 'Dorogobuzh',
    country: RUSSIA,
    matches: (raw, norm) =>
      /smolensk ring|smolensk|смоленск/i.test(norm) || /смоленск/i.test(raw),
  },
  {
    preferredSlug: 'kazanring-canyon',
    name: 'KazanRing Canyon',
    city: 'Kazan',
    country: RUSSIA,
    matches: (raw, norm) =>
      /kazanring|kazan ring|казань.?ринг|canyon|каньон/i.test(norm) ||
      norm === 'казань' ||
      raw.trim() === 'Казань',
  },
  {
    preferredSlug: 'turbodrom-belaya-strela',
    name: 'Turbodrom Belaya Strela',
    city: 'Krasnodar',
    country: RUSSIA,
    matches: (raw, norm) =>
      /belaya strela|белая стрела|turbodrom/i.test(norm) ||
      norm === 'краснодар' ||
      raw.trim() === 'Краснодар',
  },
  {
    preferredSlug: 'primring',
    name: 'PrimRing',
    city: 'Artem',
    country: RUSSIA,
    matches: (raw, norm) =>
      /primring|prim ring|приморск/i.test(norm) ||
      norm === 'владивосток' ||
      raw.trim() === 'Владивосток',
  },
  {
    preferredSlug: 'stk-pilot',
    name: 'Pilot Kart Circuit',
    city: 'Ust-Labinsk',
    country: RUSSIA,
    matches: (raw, norm) => /stk "пилот"|стк "пилот"|пилот/i.test(raw) || /усть-лабинск/i.test(raw),
  },
  {
    preferredSlug: 'lubyanka-square',
    name: 'Lubyanka Square',
    city: 'Moscow',
    country: RUSSIA,
    matches: (raw, norm) => /лубянск/i.test(raw),
  },
  {
    preferredSlug: 'auchan-kultury-41',
    name: 'Auchan Kultury 41',
    city: 'Saint Petersburg',
    country: RUSSIA,
    matches: (raw, norm) => /культур\s*41|площадка ашан/i.test(raw),
  },
  {
    preferredSlug: 'severny-mall',
    name: 'Severny Mall',
    city: 'Saint Petersburg',
    country: RUSSIA,
    matches: (raw, norm) => /северный молл|severny mall/i.test(raw),
  },
  {
    preferredSlug: 'nring',
    name: 'NRing',
    city: 'Nizhny Novgorod',
    country: RUSSIA,
    matches: (raw, norm) =>
      /\bnring\b|\bn ring\b/i.test(raw) ||
      /nring/i.test(norm) ||
      norm === 'нижний новгород' ||
      /нижний новгород/i.test(raw),
  },
  {
    preferredSlug: 'red-ring',
    name: 'Red Ring',
    city: 'Krasnoyarsk',
    country: RUSSIA,
    matches: (raw, norm) =>
      /red ring/i.test(norm) ||
      /красное кольцо/i.test(raw) ||
      norm === 'красноярск' ||
      raw.trim() === 'Красноярск',
  },
  {
    preferredSlug: 'sochi-autodrom',
    name: 'Sochi Autodrom',
    city: 'Sochi',
    country: RUSSIA,
    matches: (raw, norm) =>
      /sochi autodrom/i.test(norm) ||
      /сочи.*(autodrom|автодром)/i.test(raw) ||
      /\bsochi\b/i.test(raw) ||
      norm === 'сочи' ||
      raw.trim() === 'Сочи',
  },
];

/** Remove trailing event date fragments (e.g. «, 28-29 апреля»). */
export function stripTrackDateSuffix(segment: string): string {
  return segment
    .replace(/\s*,?\s*\d{1,2}\s*[–-]\s*\d{1,2}\s+[а-яёА-ЯЁ]+.*$/i, '')
    .replace(/\s*,?\s*\d{1,2}\s*[–-]\s*\d{1,2}\s+[a-zA-Z]+.*$/i, '')
    .trim();
}

function cityToEnglish(value: string): string {
  const trimmed = value.trim();
  const key = trimmed.toLowerCase();
  if (CITY_EN[key]) return CITY_EN[key]!;
  if (/^[A-Za-z]/.test(trimmed)) return trimmed;
  return transliterate(trimmed);
}

function titleCaseEnglish(value: string): string {
  if (/^[A-Z]/.test(value.trim())) return value.trim();
  const tr = transliterate(value.trim());
  return tr.replace(/\b([a-z])/g, (_, c: string) => c.toUpperCase());
}

function normalizeForMatch(raw: string): string {
  return raw
    .replace(/\s+/g, ' ')
    .replace(/\s*\/\s*/g, ' / ')
    .trim()
    .toLowerCase();
}

function splitTrackLabel(raw: string): { primary: string; secondary: string | null } {
  const parts = raw.split(',').map((part) => stripTrackDateSuffix(part.trim())).filter(Boolean);
  if (parts.length === 0) return { primary: raw.trim(), secondary: null };
  if (parts.length === 1) return { primary: parts[0]!, secondary: null };
  return { primary: parts[0]!, secondary: parts.slice(1).join(', ') };
}

function isLikelyCity(segment: string): boolean {
  const key = segment.trim().toLowerCase();
  if (CITY_EN[key]) return true;
  if (/^\d/.test(segment)) return false;
  if (/[–-]\d/.test(segment)) return false;
  return segment.length <= 40 && !/\b(raceway|ring|drive|autodrom|speedway|arena)\b/i.test(segment);
}

/**
 * Map importer / legacy labels to English circuit name + city + country.
 * Returns preferredSlug for known RDS GP circuits (dedupe targets).
 */
export function resolveTrackFields(
  rawName: string,
  input?: { city?: string | null; country?: string | null },
): ResolvedTrackFields {
  const raw = rawName.replace(/\s+/g, ' ').trim();
  const norm = normalizeForMatch(raw);

  for (const canon of CANONICAL) {
    if (canon.matches(raw, norm)) {
      return {
        name: canon.name,
        city: input?.city ?? canon.city,
        country: input?.country ?? canon.country,
        preferredSlug: canon.preferredSlug,
      };
    }
  }

  const { primary, secondary } = splitTrackLabel(raw);
  let name = primary;
  let city = input?.city ?? null;

  if (secondary && isLikelyCity(secondary)) {
    city = city ?? cityToEnglish(secondary);
  } else if (!city && isLikelyCity(primary)) {
    city = cityToEnglish(primary);
    name = primary;
  }

  if (/[а-яА-ЯёЁ]/.test(name)) {
    name = titleCaseEnglish(name);
  }

  const country = input?.country ?? (city ? RUSSIA : null);

  return {
    name: stripTrackDateSuffix(name),
    city,
    country,
    preferredSlug: null,
  };
}

export function canonicalSlugsForMerge(): string[] {
  return CANONICAL.map((entry) => entry.preferredSlug);
}
