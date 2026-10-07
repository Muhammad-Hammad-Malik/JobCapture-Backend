// City handling. LinkedIn posts give messy locations ("PIA Road, Johar Town, Lahore",
// "Lahore | Karachi | Islamabad", "Remote (Pakistan)"). We keep only real city names.
const KNOWN_CITIES = [
  // Pakistan
  'Lahore', 'Karachi', 'Islamabad', 'Rawalpindi', 'Faisalabad', 'Multan', 'Peshawar', 'Quetta',
  'Sialkot', 'Gujranwala', 'Gujrat', 'Hyderabad', 'Sargodha', 'Bahawalpur', 'Abbottabad',
  'Sukkur', 'Mardan', 'Wah Cantt', 'Sahiwal', 'Jhelum', 'Mirpur', 'Muzaffarabad', 'Rahim Yar Khan',
  // Middle East / Africa
  'Dubai', 'Abu Dhabi', 'Sharjah', 'Riyadh', 'Jeddah', 'Dammam', 'Doha', 'Muscat', 'Kuwait City',
  'Manama', 'Cairo', 'Nairobi', 'Lagos', 'Johannesburg', 'Cape Town', 'Istanbul',
  // Asia
  'Delhi', 'Mumbai', 'Bangalore', 'Dhaka', 'Singapore', 'Kuala Lumpur', 'Bangkok', 'Manila',
  'Jakarta', 'Tokyo', 'Beijing', 'Shanghai', 'Hong Kong', 'Colombo', 'Kathmandu',
  // Europe / Americas / Oceania
  'London', 'Manchester', 'Berlin', 'Munich', 'Amsterdam', 'Paris', 'Madrid', 'Barcelona', 'Dublin',
  'Stockholm', 'Warsaw', 'Lisbon', 'Zurich', 'New York', 'San Francisco', 'Los Angeles', 'Seattle',
  'Austin', 'Boston', 'Chicago', 'Toronto', 'Vancouver', 'Sydney', 'Melbourne',
];

const CITY_ALIASES = {
  khi: 'Karachi',
  lhr: 'Lahore',
  isb: 'Islamabad',
  isl: 'Islamabad',
  rwp: 'Rawalpindi',
  pindi: 'Rawalpindi',
  'delhi ncr': 'Delhi',
  'new delhi': 'Delhi',
  bengaluru: 'Bangalore',
  nyc: 'New York',
  sf: 'San Francisco',
  'sf bay area': 'San Francisco',
  'masr el-gdida - cairo': 'Cairo',
};

// Things that are not cities and must never be stored as one.
const NOT_A_CITY = new Set([
  'pakistan', 'remote', 'onsite', 'on-site', 'hybrid', 'mena', 'gcc', 'usa', 'us', 'uk', 'uae',
  'egypt', 'saudi arabia', 'india', 'canada', 'europe', 'asia', 'worldwide', 'global', 'anywhere',
  'united states', 'united kingdom', 'phase', 'dha phase', 'tbd', 'n/a', 'na', 'none', 'null',
]);

const LOOKUP = new Map();
for (const city of KNOWN_CITIES) LOOKUP.set(city.toLowerCase(), city);
for (const [alias, city] of Object.entries(CITY_ALIASES)) LOOKUP.set(alias, city);
// Longest first so "Abu Dhabi" wins over any shorter overlap.
const KNOWN_BY_LENGTH = [...LOOKUP.keys()].sort((a, b) => b.length - a.length);

const escapeRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function titleCase(s) {
  return s.toLowerCase().replace(/\b[a-z]/g, c => c.toUpperCase());
}

// Extracts every known city mentioned in a free-text location, in order of appearance.
function scanKnownCities(text) {
  const lower = text.toLowerCase();
  const hits = [];
  for (const key of KNOWN_BY_LENGTH) {
    const match = new RegExp(`(^|[^a-z])${escapeRe(key)}([^a-z]|$)`).exec(lower);
    if (match) hits.push({ city: LOOKUP.get(key), index: match.index });
  }
  return hits;
}

// Accepts a string or array (LLM output / legacy location) and returns a de-duplicated list of cities.
function normalizeCities(input) {
  const rawItems = (Array.isArray(input) ? input : [input]).filter(v => typeof v === 'string' && v.trim());
  const found = [];
  const push = city => { if (city && !found.includes(city)) found.push(city); };

  for (const raw of rawItems) {
    const hits = scanKnownCities(raw).sort((a, b) => a.index - b.index);
    if (hits.length > 0) {
      hits.forEach(h => push(h.city));
      continue;
    }
    // Unknown place: accept it only if it looks like a plain city name (no digits / road words).
    const cleaned = raw.replace(/\(.*?\)/g, '').split(/[,/|]/)[0].trim();
    const key = cleaned.toLowerCase();
    if (
      cleaned &&
      cleaned.length <= 30 &&
      !NOT_A_CITY.has(key) &&
      !/\d|road|block|phase|town|sector|floor|street|society|market|chowk|colony/i.test(cleaned)
    ) {
      push(titleCase(cleaned));
    }
  }
  return found;
}

module.exports = { KNOWN_CITIES, normalizeCities };
