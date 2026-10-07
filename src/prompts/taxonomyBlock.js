const { CATEGORY_DEFS, SKILL_DEFS, SKILL_GROUPS } = require('../taxonomy');

// Renders the closed category / skill lists for inclusion in LLM prompts. Generated from the
// taxonomy so the prompt can never drift from what the database accepts.
function categoriesBlock() {
  return ['tech', 'non-tech']
    .map(track => {
      const lines = CATEGORY_DEFS.filter(c => c.track === track).map(c => `  - "${c.name}": ${c.hint}`);
      return `${track === 'tech' ? 'TECH' : 'NON-TECH'} categories:\n${lines.join('\n')}`;
    })
    .join('\n');
}

function skillsBlock() {
  return SKILL_GROUPS.map(group => {
    const names = SKILL_DEFS.filter(s => s.group === group).map(s => s.name);
    return `  ${group}: ${names.join(', ')}`;
  }).join('\n');
}

const FIELD_RULES = `- "categories": 1 to 4 values taken EXACTLY from the category list below, most relevant FIRST \
(the first one is the primary category). A role can legitimately belong to several categories — \
e.g. "Full Stack AI Engineer" => ["Fullstack", "AI / ML Engineering"]; "DevOps Engineer with QA \
automation duties" => ["DevOps & Cloud", "QA & Testing"]. Only add a second/third category when \
the post clearly asks for that work, not for every passing mention. Never invent a category. \
"Fullstack" means building both frontend and backend in ANY stack (PHP/Laravel, Django, Rails, \
Java, .NET, Go, MERN, MEAN, ...) — it is not limited to MERN/MEAN. Use "Software Engineering" only \
for a generic engineering role with no clearer specialization. Non-tech roles (sales, marketing, \
HR, finance, admin...) use the NON-TECH categories.
- "skills": the technologies/tools this specific role requires or clearly uses, taken EXACTLY \
(same spelling) from the skills list below. Include every listed skill that the post asks for \
(languages, frameworks, databases, cloud, tools), up to 15, most important first. Expand umbrella \
terms into their parts when stated (e.g. "MERN" => MongoDB, Express.js, React, Node.js; "MEAN" => \
MongoDB, Express.js, Angular, Node.js; "LAMP" => PHP, MySQL, Linux). Do not add skills the post \
does not mention. Non-tech roles usually have few or no skills.
- "unknownSkills": important technologies/tools the post requires that are NOT in the skills list, \
written as they appear in the post (max 5). Otherwise [].
- "cities": array of CITY names only where this role is based, e.g. ["Lahore"] or ["Lahore", \
"Karachi"]. Strip neighborhoods, streets, phases, offices ("DHA Phase 8, Lahore" => ["Lahore"]). \
Never include countries, regions, or words like "Remote"/"Onsite". If the post names no city \
(including fully remote roles or only a country), use [].
- "experienceYears": if a range is mentioned (e.g. "3 to 5 years"), use the LOWEST bound only. If \
a single number is mentioned (e.g. "minimum 2 years"), use it. If the role is explicitly \
entry-level/no experience required — "Associate" titles, "fresh graduate", "fresher", "intern", \
"trainee", "entry level" — and no number is given, use 0. If experience is not specified at all, \
use null. NEVER guess a number that the post does not support.
- "remoteType": "remote" | "hybrid" | "onsite" only if explicitly indicated for this role, \
otherwise null. A post-wide policy applies to every listed role.`;

module.exports = { categoriesBlock, skillsBlock, FIELD_RULES };
