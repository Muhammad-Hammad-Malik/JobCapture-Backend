const ApiError = require('../utils/ApiError');

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

function stripCodeFences(text) {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced ? fenced[1] : trimmed;
}

// Sends one prompt to OpenRouter and returns the raw message text.
// An explicit max_tokens matters: without it OpenRouter reserves the model's maximum (tens of
// thousands of tokens) against the account balance and can reject requests with HTTP 402.
const DEFAULT_MAX_TOKENS = 8192;

async function callLlm(prompt, { model, maxTokens } = {}) {
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
      model: model || process.env.OPENROUTER_MODEL || 'google/gemini-2.5-flash-lite',
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
  return content;
}

// Calls the LLM and parses JSON, retrying once on a malformed/empty response.
async function callLlmJson(prompt, { model, validate, maxTokens } = {}) {
  let lastError;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const parsed = JSON.parse(stripCodeFences(await callLlm(prompt, { model, maxTokens })));
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

module.exports = { callLlm, callLlmJson };
