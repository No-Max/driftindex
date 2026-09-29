/**
 * Verified pilot countries not available from import sources (Almanac shows «—», no rdsgp field).
 * Keys are pilot slugs; values are ISO 3166-1 alpha-2 codes.
 */
export const PILOT_COUNTRY_OVERRIDES: Record<string, string> = {
  'daigo-saito': 'JP', // Daigo Saito
  'naoto-suenaga': 'JP', // Naoto Suenaga
  'masato-kawabata': 'JP', // Masato Kawabata
  'tetsuya-khibino': 'JP', // Tetsuya Hibino
  'james-deane': 'IE', // James Deane
  'jack-shanahan': 'IE', // Jack Shanahan
  'tomas-kiely': 'IE', // Tommy Kiely
  'terk-raian': 'US', // Ryan Terc
  'matt-field': 'NZ', // Matthew Field
  'kristaps-bluss': 'LV', // Kristaps Bluss
  'nikolass-bertans': 'LV', // Nikolas Bertans
  'erglis-edmunds': 'LV', // Edmunds Erglis
  'gvido-elksnis': 'LV', // Gvido Elksnis
  'aurimas-bakchis': 'LT', // Aurimas Bakchis
  'gediminas-ivanauskas': 'LT', // Giedrius Ivanavicius / Ivanauskas
  'harold-valdma': 'EE', // Harold Valdma
  'mustakimov-aivar': 'EE', // Aivar Mustakimov
  'arutyunyan-armen': 'AM', // Armen Harutyunyan
  'seviyan-albert': 'AM', // Albert Seviyan
  'gukasyan-vilyam': 'AM', // William Gukasyan
  'khachatryan-garik': 'AM', // Garik Khachatryan
  'georgy-chivchyan': 'RU', // Georgy (Gocha) Chivchyan — DMEC 2019 Riga wildcard
  'charles-ng': 'HK', // Charles Ng
  'emmanuel-amandio': 'PT', // Emmanuel Amandio
  'artem-leitis': 'LV', // Artem Leitis
  'artur-melkumyan': 'AM', // Artur Melkumyan
  'skupelis-kharis': 'LV', // Haris Skupelis
  'driftgal-driftgal': 'RU', // Driftgal
  'vanya-godzilla': 'RU', // Godzilla
  'shak-shak': 'RU', // SHAK
};
