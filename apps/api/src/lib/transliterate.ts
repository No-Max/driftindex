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
  const alias = nameAlias?.trim() ?? '';
  if (alias && containsJapaneseScript(alias)) {
    const compact = alias.replace(/\s+/g, '');
    if (compact.length >= 2) return `ja|${compact}`;
  }

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

export function containsJapaneseScript(value: string): boolean {
  return /[\u3040-\u30ff\u4e00-\u9fff]/.test(value);
}

/** Japanese D1-style «姓 名» (family given) → given/family for storage. */
export function japanesePilotNamesFromAlias(nameJa: string): { firstName: string; lastName: string } {
  const parts = nameJa.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return { lastName: parts[0]!, firstName: parts.slice(1).join(' ') };
  }
  const single = parts[0] ?? nameJa.trim();
  return { firstName: single, lastName: single };
}

function pilotNamesFromJapaneseFields(firstName: string, lastName: string): { firstName: string; lastName: string } {
  const firstTrim = firstName.trim();
  const lastTrim = lastName.trim();
  if (firstTrim && lastTrim) {
    return { firstName: firstTrim, lastName: lastTrim };
  }
  const combined = `${firstTrim} ${lastTrim}`.trim();
  return japanesePilotNamesFromAlias(combined);
}

/** Prefer existing Latin names; otherwise transliterate Russian or keep Japanese. */
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

  const alias = input.nameAlias?.trim() ?? '';

  // Russian «Фамилия Имя» is the canonical source when Latin names are missing.
  if (alias && containsCyrillic(alias)) {
    return englishNamesFromNameRu(alias);
  }

  if (alias && containsJapaneseScript(alias)) {
    return japanesePilotNamesFromAlias(alias);
  }

  if (containsJapaneseScript(input.firstName) || containsJapaneseScript(input.lastName)) {
    return pilotNamesFromJapaneseFields(input.firstName, input.lastName);
  }

  if (alias) {
    return englishNamesFromNameRu(alias);
  }

  if (firstLatin || lastLatin) {
    return {
      firstName: titleCaseWord(transliterate(firstLatin ? input.firstName : input.lastName)),
      lastName: titleCaseWord(transliterate(lastLatin ? input.lastName : input.firstName)),
    };
  }

  const combined = `${input.firstName} ${input.lastName}`.trim();
  if (combined && containsJapaneseScript(combined)) {
    return japanesePilotNamesFromAlias(combined);
  }

  return englishNamesFromNameRu(combined);
}
