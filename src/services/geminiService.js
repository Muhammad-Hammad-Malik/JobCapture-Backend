const { deriveCompanyFromEmail } = require('../utils/deriveCompanyFromEmail');
const { INGEST_PROMPT } = require('../prompts/ingestPrompt');
const { callLlmJson } = require('./llmClient');

function validateStructuredPost(parsed) {
  if (!parsed.is_job_post) return;
  if (!Array.isArray(parsed.jobs) || parsed.jobs.length === 0) {
    throw new Error('Response had no "jobs" entries.');
  }
}

/**
 * Sends rawText to the LLM (via OpenRouter) and returns the structured post — { company,
 * isCompanyNameFallback, contactEmail, applicationLink, posterName, jobs: [...] } — with jobs
 * containing one entry per distinct role (each with categories, skills, cities, ...), or null if
 * the model determined this isn't a job post. Retries once on a malformed/empty response.
 */
async function structureJobPost(rawText) {
  const parsed = await callLlmJson(INGEST_PROMPT.replace('{{RAW_TEXT}}', () => rawText), {
    validate: validateStructuredPost,
  });
  if (!parsed.is_job_post) return null;
  return enforceCompanyFallbackInvariant(parsed);
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
