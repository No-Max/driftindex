/** Simple Russian → Latin transliteration for pilot identity matching. */
const CYRILLIC_MAP: Record<string, string> = {
  а: 'a',
  б: 'b',
  в: 'v',
  г: 'g',
  д: 'd',
  е: 'e',
  ё: 'e',
  ж: 'zh',
  з: 'z',
  и: 'i',
  й: 'y',
  к: 'k',
  л: 'l',
  м: 'm',
  н: 'n',
  о: 'o',
  п: 'p',
  р: 'r',
  с: 's',
  т: 't',
  у: 'u',
  ф: 'f',
  х: 'kh',
  ц: 'ts',
  ч: 'ch',
  ш: 'sh',
  щ: 'shch',
  ъ: '',
  ы: 'y',
  ь: '',
  э: 'e',
  ю: 'yu',
  я: 'ya',
};

export function containsCyrillic(value: string): boolean {
  return /[\u0400-\u04FF]/.test(value);
}

const LATIN_FOLD: Record<string, string> = {
  ø: 'o',
  æ: 'ae',
  ł: 'l',
  đ: 'd',
  ð: 'd',
  þ: 'th',
  ß: 'ss',
};

export function transliterate(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .split('')
    .map((char) => {
      const lower = char.toLowerCase();
      const mapped = CYRILLIC_MAP[lower] ?? LATIN_FOLD[lower];
      if (!mapped) return char;
      return char === lower ? mapped : mapped.charAt(0).toUpperCase() + mapped.slice(1);
    })
    .join('');
}

export function normalizeToken(value: string): string {
  return transliterate(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .trim();
}

export function nameTokens(...parts: Array<string | null | undefined>): string[] {
  const tokens = new Set<string>();
  for (const part of parts) {
    if (!part) continue;
    for (const word of part.split(/\s+/)) {
      const token = normalizeToken(word);
      if (token.length > 1) tokens.add(token);
    }
  }
  return [...tokens].sort();
}

/** Sorted token key — order-independent match for «Козлов Антон» / «Anton Kozlov». */
export function buildNameKey(
  firstName: string,
  lastName: string,
  nameAlias: string | null | undefined,
): string {
  const hasLatinNames = isLatinName(firstName) && isLatinName(lastName);
  return nameTokens(firstName, lastName, hasLatinNames ? null : nameAlias).join('|');
}

function titleCaseWord(value: string): string {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

/** Russian «Фамилия Имя» → English first/last. */
export function englishNamesFromNameRu(nameRu: string): { firstName: string; lastName: string } {
  const parts = nameRu.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return {
      lastName: titleCaseWord(normalizeToken(parts[0]!)),
      firstName: titleCaseWord(
        parts
          .slice(1)
          .map((part) => normalizeToken(part))
          .filter(Boolean)
          .join(''),
      ),
    };
  }
  const single = titleCaseWord(normalizeToken(parts[0] ?? nameRu));
  return { firstName: single, lastName: single };
}

export function isLatinName(value: string): boolean {
  return /^[\p{Script=Latin}\s.'-]+$/u.test(value.trim());
}

/** Prefer existing Latin names; otherwise transliterate Russian fields. */
export function toEnglishPilotNames(input: {
  firstName: string;
  lastName: string;
  nameAlias?: string | null;
}): { firstName: string; lastName: string } {
  const firstLatin = isLatinName(input.firstName);
  const lastLatin = isLatinName(input.lastName);

  if (firstLatin && lastLatin) {
    return {
      firstName: input.firstName
        .trim()
        .split(/\s+/)
        .map(titleCaseWord)
        .join(' '),
      lastName: input.lastName
        .trim()
        .split(/\s+/)
        .map(titleCaseWord)
        .join(' '),
    };
  }

  // Russian «Фамилия Имя» is the canonical source when Latin names are missing.
  if (input.nameAlias?.trim() && containsCyrillic(input.nameAlias)) {
    return englishNamesFromNameRu(input.nameAlias);
  }

  if (input.nameAlias) {
    return englishNamesFromNameRu(input.nameAlias);
  }

  if (firstLatin || lastLatin) {
    return {
      firstName: titleCaseWord(transliterate(firstLatin ? input.firstName : input.lastName)),
      lastName: titleCaseWord(transliterate(lastLatin ? input.lastName : input.firstName)),
    };
  }

  return englishNamesFromNameRu(`${input.firstName} ${input.lastName}`.trim());
}
