const { STACK_OPTIONS } = require('../constants');
const ApiError = require('../utils/ApiError');
const { deriveCompanyFromEmail } = require('../utils/deriveCompanyFromEmail');

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

const PROMPT = `You are given raw text extracted from a screenshot of a LinkedIn post. The text \
includes UI noise from the LinkedIn app itself (things like "Like Comment Share", relative \
timestamps such as "2d" or "3h", "Follow"/"Connect" buttons, reaction counts, "... more" \
truncation markers). Ignore all of that noise — it is not part of the post content.

First decide whether this post is actually a job posting (someone sharing/announcing a job \
opening, hiring, or recruiting), as opposed to an unrelated post (opinion, article share, \
personal update, etc).

If it IS a job post, extract the following fields. Respond with ONLY a single JSON object, no \
markdown code fences, matching exactly this shape:

{
  "is_job_post": true,
  "company": string,
  "isCompanyNameFallback": boolean,
  "contactEmail": string or null,
  "applicationLink": string or null,
  "posterName": string or null,
  "jobs": [
    {
      "jobTitle": string,
      "stack": one of ${JSON.stringify(STACK_OPTIONS)},
      "experienceYears": number or null,
      "location": string or null,
      "remoteType": "remote" | "hybrid" | "onsite" | null,
      "description": string
    }
  ]
}

Field rules:
- "company": the hiring company's name, ONLY if it is stated in prose somewhere in the post \
text (e.g. "join our team at Acme Corp"). Never derive a company name from an email address or \
domain (e.g. do NOT turn "jane@acme.com" into "acme" or "acme.com") — an email domain is not a \
reliable company name. If no company name is stated in the post's prose, set "company" to the \
name of the person who posted it (the same value as "posterName") instead, and set \
"isCompanyNameFallback" to true. Otherwise set "isCompanyNameFallback" to false.
- "contactEmail" / "applicationLink": only if actually present in the text; otherwise null.
- "posterName": the name of the person who shared the post, if identifiable; otherwise null.
- "jobs": one entry per DISTINCT job opening in the post. Most posts describe exactly one role — \
in that case "jobs" has exactly one entry. Only create multiple entries when the post explicitly \
lists multiple different job titles/openings (e.g. a numbered/bulleted list of different roles, \
or phrasing like "we're hiring for the following positions"). Do NOT split into multiple entries \
just because a single role mentions multiple skills or technologies (e.g. "Fullstack Developer \
skilled in React and Node" is ONE job, not two). Each entry's fields:
  - "jobTitle": that role's title.
  - "stack": pick EXACTLY ONE value from the closed list above that best matches this specific \
role. Never invent a new category. If nothing in the list clearly fits, use "Software Engineer".
  - "experienceYears": if a range is mentioned for this role (e.g. "3 to 5 years", "3-5 yrs"), \
use the LOWEST bound only (e.g. 3). If a single number is mentioned (e.g. "minimum 2 years"), \
use that number. If this role's title is an "Associate" level role (e.g. "Associate Software \
Engineer", "Associate Engineer", "Associate Developer") and no explicit experience is stated for \
it, use 0 — Associate-level titles conventionally mean entry-level / no experience required. If \
no experience is mentioned and the title isn't an Associate-level role, use null. Different roles \
in the same post can have different experience requirements — extract each independently.
  - "location" / "remoteType": only set if explicitly indicated for this role; otherwise null. \
If the whole post states one location/remote policy that applies to all listed roles, apply it \
to each entry.
  - "description": a REWRITTEN description of just this role, in your own words — do not copy \
sentences verbatim from the original post. Paraphrase and restructure it into clear, \
well-organized prose (responsibilities, requirements, qualifications, etc.), preserving every \
substantive detail for this specific role, just not its exact original wording.

If it is NOT a job post, respond with ONLY this JSON object:
{ "is_job_post": false }

Raw extracted text:
"""
{{RAW_TEXT}}
"""`;

function stripCodeFences(text) {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced ? fenced[1] : trimmed;
}

async function callOpenRouter(rawText) {
  if (!process.env.OPENROUTER_API_KEY) {
    throw new ApiError(500, 'OPENROUTER_API_KEY is not configured on the server.');
  }

  const response = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: process.env.OPENROUTER_MODEL || 'google/gemini-2.5-flash-lite',
      response_format: { type: 'json_object' },
      messages: [{ role: 'user', content: PROMPT.replace('{{RAW_TEXT}}', rawText) }],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new ApiError(502, `OpenRouter request failed (${response.status}): ${body}`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) {
    throw new ApiError(502, 'OpenRouter response had no message content.');
  }
  return content;
}

/**
 * Sends rawText to the LLM (via OpenRouter) and returns the structured post — { company,
 * isCompanyNameFallback, contactEmail, applicationLink, posterName, jobs: [...] } — with jobs
 * containing one entry per distinct role, or null if the model determined this isn't a job post.
 * Retries once on a malformed/empty response.
 */
async function structureJobPost(rawText) {
  let lastError;
  for (let attempt = 0; attempt < 2; attempt++) {
    let responseText;
    try {
      responseText = await callOpenRouter(rawText);
    } catch (e) {
      lastError = e;
      continue;
    }

    try {
      const parsed = JSON.parse(stripCodeFences(responseText));
      if (!parsed.is_job_post) return null;
      if (!Array.isArray(parsed.jobs) || parsed.jobs.length === 0) {
        throw new Error('Response had no "jobs" entries.');
      }
      return enforceCompanyFallbackInvariant(parsed);
    } catch (e) {
      lastError = e;
    }
  }
  throw new ApiError(502, 'Failed to get a structured response from the LLM.', {
    cause: lastError?.message,
  });
}

// When the model can't find an explicit company name, prefer a company name derived from the
// contact email's domain (more useful than a person's name) over the poster's name, which is
// only used as a last resort when there's no usable email either. Enforced in code rather than
// relying on the model to reliably apply this chain itself.
function enforceCompanyFallbackInvariant(parsed) {
  if (parsed.isCompanyNameFallback) {
    const derived = deriveCompanyFromEmail(parsed.contactEmail);
    if (derived) {
      parsed.company = derived;
      parsed.isCompanyNameFallback = false;
    } else {
      parsed.company = parsed.posterName || parsed.company || 'Unknown';
    }
  }
  return parsed;
}

module.exports = { structureJobPost };
