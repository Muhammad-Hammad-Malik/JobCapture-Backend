const ApiError = require('../utils/ApiError');

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

// One paid model, no fallback (free reasoning models were ~10x slower). OPENROUTER_MODEL and
// OPENROUTER_FALLBACK_MODEL are deliberately ignored so deployments that still carry the old
// free-primary/paid-fallback values keep working unchanged. Optional override: LLM_MODEL.
const DEFAULT_PRIMARY_MODEL = 'google/gemini-2.5-flash-lite';
const DEFAULT_FALLBACK_MODEL = '';

// An explicit max_tokens matters: without it OpenRouter reserves the model's maximum (tens of
// thousands of tokens) against the account balance and can reject requests with HTTP 402.
const DEFAULT_MAX_TOKENS = 8192;

function stripCodeFences(text) {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced ? fenced[1] : trimmed;
}

function configuredModels({ model } = {}) {
  return { primary: model || process.env.LLM_MODEL || DEFAULT_PRIMARY_MODEL, fallback: null };
}

// Sends one prompt to OpenRouter and returns the raw message text.
// `models` is tried in order (OpenRouter routes to the next on provider errors / rate limits).
async function callLlm(prompt, { models, maxTokens } = {}) {
  if (!process.env.OPENROUTER_API_KEY) {
    throw new ApiError(500, 'OPENROUTER_API_KEY is not configured on the server.');
  }
  const list = models && models.length ? models : [configuredModels().primary];

  const response = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      models: list,
      response_format: { type: 'json_object' },
      max_tokens: maxTokens || DEFAULT_MAX_TOKENS,
      messages: [{ role: 'user', content: prompt }],
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

  // Visible in logs so it's clear when the paid fallback was used.
  if (data.model && data.model !== list[0]) {
    console.warn(`[llm] primary model "${list[0]}" not used; answered by "${data.model}"`);
  }
  return content;
}

/**
 * Calls the LLM and parses JSON.
 *  - Calls the single configured model, retrying once if the output was unusable.
 */
async function callLlmJson(prompt, { model, validate, maxTokens, fallback = true } = {}) {
  const { primary, fallback: fallbackModel } = configuredModels({ model, fallback });
  const attempts = [
    fallbackModel ? [primary, fallbackModel] : [primary],
    fallbackModel ? [fallbackModel] : [primary],
  ];

  let lastError;
  for (const models of attempts) {
    try {
      const parsed = JSON.parse(stripCodeFences(await callLlm(prompt, { models, maxTokens })));
      if (validate) validate(parsed);
      return parsed;
    } catch (e) {
      lastError = e;
    }
  }
  throw new ApiError(502, `Failed to get a structured response from the LLM: ${lastError?.message || 'unknown error'}`, {
    cause: lastError?.message,
  });
}

module.exports = { callLlm, callLlmJson, configuredModels, DEFAULT_PRIMARY_MODEL, DEFAULT_FALLBACK_MODEL };
