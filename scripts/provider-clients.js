#!/usr/bin/env node

async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try { return await fetch(url, { ...options, signal: controller.signal }); }
  finally { clearTimeout(timer); }
}

function providerError(message, opts = {}) { return Object.assign(new Error(message), opts); }


function retryAfterMs(res) {
  const value = res && res.headers && typeof res.headers.get === 'function' ? res.headers.get('retry-after') : null;
  if (!value) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.ceil(seconds * 1000);
  const date = Date.parse(value);
  if (Number.isFinite(date)) return Math.max(0, date - Date.now());
  return null;
}

function classifyHttpFallback(status) {
  return status === 402 || status === 408 || status === 409 || status === 429 || status >= 500;
}

async function callOpenRouter(model, systemPrompt, userPrompt, timeoutMs, key = process.env.OPENROUTER_API_KEY) {
  if (!key) throw providerError('OPENROUTER_API_KEY is not configured.', { code: 'NO_CREDENTIAL', fallbackEligible: true });
  let res;
  try {
    res = await fetchWithTimeout('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model, messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }], temperature: 0 }),
    }, timeoutMs);
  } catch (err) {
    throw providerError(`OpenRouter network/timeout failure: ${err.message}`, { code: 'NETWORK', fallbackEligible: true });
  }
  if (res.ok) {
    const data = await res.json();
    const text = data.choices?.[0]?.message?.content;
    if (!text) throw providerError('OpenRouter returned an empty review.', { code: 'EMPTY', fallbackEligible: true });
    return { text, provider: 'openrouter', model };
  }
  const body = await res.text();
  throw providerError(`OpenRouter HTTP ${res.status}: ${body.slice(0, 500)}`, { code: `HTTP_${res.status}`, fallbackEligible: classifyHttpFallback(res.status) || res.status === 401 || res.status === 403 || res.status === 404, retryAfterMs: retryAfterMs(res) });
}

function extractOpenAIText(data) {
  if (typeof data?.output_text === 'string' && data.output_text) return data.output_text;
  const parts = [];
  for (const item of data?.output || []) {
    for (const content of item?.content || []) {
      if (typeof content?.text === 'string') parts.push(content.text);
    }
  }
  return parts.join('');
}

async function callOpenAI(model, systemPrompt, userPrompt, timeoutMs, key = process.env.OPENAI_API_KEY) {
  if (!key) throw providerError('OPENAI_API_KEY is not configured.', { code: 'NO_CREDENTIAL', fallbackEligible: true });
  let res;
  try {
    res = await fetchWithTimeout('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model,
        input: [
          { role: 'system', content: [{ type: 'input_text', text: systemPrompt }] },
          { role: 'user', content: [{ type: 'input_text', text: userPrompt }] },
        ],
      }),
    }, timeoutMs);
  } catch (err) {
    throw providerError(`OpenAI network/timeout failure: ${err.message}`, { code: 'NETWORK', fallbackEligible: true });
  }
  if (res.ok) {
    const data = await res.json();
    const text = extractOpenAIText(data);
    if (!text) throw providerError('OpenAI returned an empty review.', { code: 'EMPTY', fallbackEligible: true });
    return { text, provider: 'openai', model };
  }
  const body = await res.text();
  throw providerError(`OpenAI HTTP ${res.status}: ${body.slice(0, 500)}`, { code: `HTTP_${res.status}`, fallbackEligible: classifyHttpFallback(res.status) || res.status === 401 || res.status === 403 || res.status === 404, retryAfterMs: retryAfterMs(res) });
}

function extractAnthropicText(data) {
  return (data?.content || []).filter((x) => x?.type === 'text' && typeof x.text === 'string').map((x) => x.text).join('');
}

async function callAnthropic(model, systemPrompt, userPrompt, timeoutMs, key = process.env.ANTHROPIC_API_KEY) {
  if (!key) throw providerError('ANTHROPIC_API_KEY is not configured.', { code: 'NO_CREDENTIAL', fallbackEligible: true });
  let res;
  try {
    res = await fetchWithTimeout('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: 16384,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    }, timeoutMs);
  } catch (err) {
    throw providerError(`Anthropic network/timeout failure: ${err.message}`, { code: 'NETWORK', fallbackEligible: true });
  }
  if (res.ok) {
    const data = await res.json();
    const text = extractAnthropicText(data);
    if (!text) throw providerError('Anthropic returned an empty review.', { code: 'EMPTY', fallbackEligible: true });
    return { text, provider: 'anthropic', model };
  }
  const body = await res.text();
  throw providerError(`Anthropic HTTP ${res.status}: ${body.slice(0, 500)}`, { code: `HTTP_${res.status}`, fallbackEligible: classifyHttpFallback(res.status) || res.status === 401 || res.status === 403 || res.status === 404, retryAfterMs: retryAfterMs(res) });
}

module.exports = { callOpenRouter, callOpenAI, callAnthropic, extractOpenAIText, extractAnthropicText, fetchWithTimeout, retryAfterMs };
