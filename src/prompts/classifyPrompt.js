const { categoriesBlock, skillsBlock, FIELD_RULES } = require('./taxonomyBlock');

// Used by the one-off re-classification script on jobs that are already in the database.
const CLASSIFY_PROMPT = `You are re-classifying an existing job listing for a job board. You are \
given the listing's title, its cleaned description, and the original raw text of the LinkedIn post \
it came from (which may contain UI noise and may mention OTHER roles too — classify ONLY the role \
titled below).

Respond with ONLY a single JSON object, no markdown code fences, exactly this shape:

{
  "categories": [string, ...],
  "skills": [string, ...],
  "unknownSkills": [string, ...],
  "cities": [string, ...],
  "experienceYears": number or null,
  "confidence": number between 0 and 1,
  "reasoning": string (one short sentence)
}

Field rules:
${FIELD_RULES}
- "confidence": how sure you are that the categories are right (1 = certain, below 0.6 = a human \
should look at it).
- "reasoning": one short sentence on why you chose the primary category.

=== CATEGORY LIST (closed — use these exact strings) ===
${categoriesBlock()}

=== SKILLS LIST (closed — use these exact strings) ===
${skillsBlock()}

=== THE LISTING ===
Title: {{TITLE}}
Company: {{COMPANY}}
Previously stored location: {{LOCATION}}
Previously stored experienceYears: {{EXPERIENCE}}
Description:
"""
{{DESCRIPTION}}
"""

Original post raw text (for extra context only):
"""
{{RAW_TEXT}}
"""`;

module.exports = { CLASSIFY_PROMPT };
