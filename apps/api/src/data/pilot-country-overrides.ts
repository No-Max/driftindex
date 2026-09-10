/**
 * Verified pilot countries not available from import sources (Almanac shows «—», no rdsgp field).
 * Keys are pilot slugs; values are ISO 3166-1 alpha-2 codes.
 */
export const PILOT_COUNTRY_OVERRIDES: Record<string, string> = {
  'rds-1305': 'JP', // Daigo Saito
  'rds-1835': 'JP', // Naoto Suenaga
  'rds-8804': 'JP', // Masato Kawabata
  'rds-2116': 'JP', // Tetsuya Hibino
  'rds-13474': 'IE', // James Deane
  'rds-13802': 'IE', // Jack Shanahan
  'rds-37718': 'IE', // Tommy Kiely
  'rds-1517': 'US', // Ryan Terc
  'rds-1834': 'NZ', // Matthew Field
  'rds-111': 'LV', // Kristaps Bluss
  'rds-16696': 'LV', // Nikolas Bertans
  'rds-6415': 'LV', // Edmunds Erglis
  'rds-112': 'LV', // Gvido Elksnis
  'rds-2028': 'LT', // Aurimas Bakchis
  'rds-754': 'LT', // Giedrius Ivanavicius / Ivanauskas
  'rds-6239': 'EE', // Harold Valdma
  'rds-643': 'EE', // Aivar Mustakimov
  'rds-166': 'AM', // Armen Harutyunyan
  'rds-139': 'AM', // Albert Seviyan
  'rds-4': 'AM', // William Gukasyan
  'rds-16': 'AM', // Garik Khachatryan
  'rds-93': 'RU', // Georgii (Gocha) Chivchyan
  'rds-5763': 'HK', // Charles Ng
  'rds-16887': 'PT', // Emmanuel Amandio
  'rds-27778': 'LV', // Artem Leitis
  'rds-41': 'AM', // Artur Melkumyan
  'rds-16889': 'LV', // Haris Skupelis
  'rds-144': 'RU', // Driftgal
  'rds-171': 'RU', // Godzilla
  'rds-9564': 'RU', // SHAK
};
