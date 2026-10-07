const {
  CATEGORIES,
  deriveTrack,
  normalizeSkills,
  normalizeCities,
  deriveLegacyStack,
  canonicalSkill,
  SKILL_DEFAULT_CATEGORY,
} = require('../taxonomy');

const MAX_CATEGORIES = 4;
const CATEGORY_LOOKUP = new Map(CATEGORIES.map(c => [c.toLowerCase(), c]));

// Turns whatever the LLM returned for one role into validated, canonical classification fields.
// Never throws: problems are reported in `warnings` so callers can flag the job for review.
function buildClassification(role = {}) {
  const warnings = [];

  const categories = [];
  const strayTechnologies = []; // the model sometimes returns a technology (".NET") as a category
  for (const raw of Array.isArray(role.categories) ? role.categories : []) {
    const canonical = typeof raw === 'string' ? CATEGORY_LOOKUP.get(raw.trim().toLowerCase()) : null;
    if (canonical) {
      if (!categories.includes(canonical)) categories.push(canonical);
    } else if (canonicalSkill(raw)) {
      strayTechnologies.push(canonicalSkill(raw));
    } else {
      warnings.push(`unknown category "${raw}"`);
    }
  }
  if (categories.length === 0) {
    const implied = strayTechnologies.map(t => SKILL_DEFAULT_CATEGORY[t]).find(Boolean);
    categories.push(implied || 'Software Engineering');
    warnings.push(
      strayTechnologies.length
        ? `category was a technology (${strayTechnologies.join(', ')}); used ${categories[0]}`
        : 'no valid category returned; defaulted to Software Engineering',
    );
  }
  if (categories.length > MAX_CATEGORIES) categories.length = MAX_CATEGORIES;

  const { skills, unknown } = normalizeSkills([...(role.skills || []), ...strayTechnologies]);
  // Skills the model put in unknownSkills may still be known spellings — rescue those.
  const rescued = normalizeSkills(role.unknownSkills || []);
  rescued.skills.forEach(s => { if (!skills.includes(s)) skills.push(s); });
  const unknownSkills = [...new Set([...unknown, ...rescued.unknown])].slice(0, 10);

  const cities = normalizeCities(role.cities ?? role.location ?? null);

  return {
    categories,
    skills,
    unknownSkills,
    cities,
    track: deriveTrack(categories),
    stack: deriveLegacyStack(categories, skills),
    warnings,
  };
}

module.exports = { buildClassification };
