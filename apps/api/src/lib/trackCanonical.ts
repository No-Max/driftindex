import { transliterate } from './transliterate.js';

export interface ResolvedTrackFields {
  name: string;
  city: string | null;
  country: string | null;
  /** Fixed slug when this row maps to a known circuit; used for deduplication. */
  preferredSlug: string | null;
}

const RUSSIA = 'Russia';
const CHINA = 'China';
const JAPAN = 'Japan';
const USA = 'United States';

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
  {
    preferredSlug: 'tianma-circuit',
    name: 'Tianma Circuit',
    city: 'Shanghai',
    country: CHINA,
    matches: (raw, norm) => /tianma|тяньма|天马/i.test(raw) || /tianma/i.test(norm),
  },
  {
    preferredSlug: 'v1-auto-world',
    name: 'V1 Auto World International Speedway',
    city: 'Tianjin',
    country: CHINA,
    matches: (raw, norm) => /v1 auto world|v1汽车|автодром v1/i.test(raw) || /v1 auto world/i.test(norm),
  },
  {
    preferredSlug: 'ningbo-international',
    name: 'Ningbo International Speedway',
    city: 'Ningbo',
    country: CHINA,
    matches: (raw, norm) => /ningbo international|нинбо/i.test(raw) || /ningbo/i.test(norm),
  },
  {
    preferredSlug: 'zhengzhou-autodrome',
    name: 'Zhengzhou International Autodrome',
    city: 'Zhengzhou',
    country: CHINA,
    matches: (raw, norm) => /zhengzhou|чжэнчжоу|郑州/i.test(raw),
  },
  {
    preferredSlug: 'zhejiang-circuit',
    name: 'Zhejiang International Circuit',
    city: 'Shaoxing',
    country: CHINA,
    matches: (raw, norm) => /zhejiang international|чжэцзян|绍兴|shaoxing/i.test(raw) || /zhejiang/i.test(norm),
  },
  {
    preferredSlug: 'ebisu-circuit',
    name: 'Ebisu Circuit',
    city: 'Nihonmatsu',
    country: JAPAN,
    matches: (raw, norm) => /\bebisu\b/i.test(raw) || /ebisu/i.test(norm),
  },
  {
    preferredSlug: 'tsukuba-circuit',
    name: 'Tsukuba Circuit',
    city: 'Shimotsuma',
    country: JAPAN,
    matches: (raw, norm) => /\btsukuba\b/i.test(raw) || /tsukuba/i.test(norm),
  },
  {
    preferredSlug: 'autopolis',
    name: 'Autopolis',
    city: 'Hita',
    country: JAPAN,
    matches: (raw, norm) => /\bautopolis\b/i.test(raw) || /\bap\b/i.test(norm),
  },
  {
    preferredSlug: 'fuji-speedway',
    name: 'Fuji Speedway',
    city: 'Oyama',
    country: JAPAN,
    matches: (raw, norm) => /\bfuji\b/i.test(raw) && /speedway|fuji/i.test(norm),
  },
  {
    preferredSlug: 'odaiba-tokyo-bay',
    name: 'Odaiba, Tokyo Bay',
    city: 'Tokyo',
    country: JAPAN,
    matches: (raw, norm) => /odaiba|tokyo bay|tokyo drift/i.test(raw) || /odaiba/i.test(norm),
  },
  {
    preferredSlug: 'okuibuki-circuit',
    name: 'Okuibuki Circuit',
    city: 'Maibara',
    country: JAPAN,
    matches: (raw, norm) => /\bokui\b|okuibuki|奥伊吹/i.test(raw),
  },
  {
    preferredSlug: 'suzuka-circuit',
    name: 'Suzuka Circuit',
    city: 'Suzuka',
    country: JAPAN,
    matches: (raw, norm) => /\bsuzuka\b/i.test(raw),
  },
  {
    preferredSlug: 'okayama-international-circuit',
    name: 'Okayama International Circuit',
    city: 'Mimasaka',
    country: JAPAN,
    matches: (raw, norm) => /\bokayama\b/i.test(raw),
  },
  {
    preferredSlug: 'sports-land-sugo',
    name: 'Sports Land SUGO',
    city: 'Murata',
    country: JAPAN,
    matches: (raw, norm) => /\bsugo\b/i.test(raw),
  },
  {
    preferredSlug: 'nikko-circuit',
    name: 'Nikko Circuit',
    city: 'Nikko',
    country: JAPAN,
    matches: (raw, norm) => /\bnikko\b|nikkō/i.test(raw),
  },
  {
    preferredSlug: 'bihoku-highland-circuit',
    name: 'Bihoku Highland Circuit',
    city: 'Shobara',
    country: JAPAN,
    matches: (raw, norm) => /\bbihoku\b/i.test(raw),
  },
  {
    preferredSlug: 'sekia-hills',
    name: 'Sekia Hills',
    city: 'Ashikita',
    country: JAPAN,
    matches: (raw, norm) => /\bsekia\b/i.test(raw),
  },
  {
    preferredSlug: 'irwindale-speedway',
    name: 'Irwindale Speedway',
    city: 'Irwindale',
    country: USA,
    matches: (raw, norm) => /\birwindale\b/i.test(raw),
  },
  {
    preferredSlug: 'maishima-sports-island',
    name: 'Maishima Sports Island',
    city: 'Osaka',
    country: JAPAN,
    matches: (raw, norm) => /\bmaishima\b/i.test(raw),
  },
  {
    preferredSlug: 'tokachi-international-speedway',
    name: 'Tokachi International Speedway',
    city: 'Sarabetsu',
    country: JAPAN,
    matches: (raw, norm) => /\btokachi\b/i.test(raw),
  },
  {
    preferredSlug: 'aichi-sky-expo',
    name: 'Aichi Sky Expo',
    city: 'Tokoname',
    country: JAPAN,
    matches: (raw, norm) => /aichi sky expo|sky expo|centrair|chubu centrair/i.test(raw),
  },
  {
    preferredSlug: 'huis-ten-bosch',
    name: 'Huis Ten Bosch',
    city: 'Sasebo',
    country: JAPAN,
    matches: (raw) => /huis ten bosch/i.test(raw),
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
  return (
    segment.length <= 40 &&
    !/\b(raceway|ring|drive|autodrom|speedway|arena|circuit|island|airport|hills|expo|park)\b/i.test(
      segment,
    )
  );
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
