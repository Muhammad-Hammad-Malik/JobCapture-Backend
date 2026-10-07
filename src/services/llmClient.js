const ApiError = require('../utils/ApiError');

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

// Free model first; if it fails (rate limit, outage, bad output) fall back to the paid model the
// app has always used. Both are overridable via env: OPENROUTER_MODEL / OPENROUTER_FALLBACK_MODEL
// (set the fallback to an empty string to disable paid fallback entirely).
const DEFAULT_PRIMARY_MODEL = 'nvidia/nemotron-3-super-120b-a12b:free';
const DEFAULT_FALLBACK_MODEL = 'google/gemini-2.5-flash-lite';

// An explicit max_tokens matters: without it OpenRouter reserves the model's maximum (tens of
// thousands of tokens) against the account balance and can reject requests with HTTP 402.
const DEFAULT_MAX_TOKENS = 8192;

function stripCodeFences(text) {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced ? fenced[1] : trimmed;
}

function configuredModels({ model, fallback = true } = {}) {
  const primary = model || process.env.OPENROUTER_MODEL || DEFAULT_PRIMARY_MODEL;
  const fallbackModel =
    process.env.OPENROUTER_FALLBACK_MODEL === undefined
      ? DEFAULT_FALLBACK_MODEL
      : process.env.OPENROUTER_FALLBACK_MODEL.trim();
  return {
    primary,
    fallback: fallback && fallbackModel && fallbackModel !== primary ? fallbackModel : null,
  };
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
 *  - 1st attempt: free primary model, with the paid model as automatic provider-level fallback.
 *  - 2nd attempt (only if the 1st returned unusable output): the fallback model directly.
 * Pass `{ fallback: false }` to never touch a paid model (e.g. migration scripts).
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
