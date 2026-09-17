const test = require('node:test');
const assert = require('node:assert/strict');
const { DEFAULT_CONFIG } = require('../scripts/lib');
const { HermesOrchestrator, activePrimaryProviders, providerOrderForCapability } = require('../scripts/hermes-orchestrator');

function cfg() { return structuredClone(DEFAULT_CONFIG); }

test('auto mode uses OpenRouter as primary when configured and does not also require direct keys', () => {
  const config = cfg(); config.review.allowedExternalProviders = ['openrouter', 'openai', 'anthropic', 'gemini'];
  const env = { OPENROUTER_API_KEY: 'or', OPENAI_API_KEY: 'oa', ANTHROPIC_API_KEY: 'an', GEMINI_API_KEY: 'g' };
  assert.deepEqual(activePrimaryProviders(config, env), ['openrouter']);
  assert.deepEqual(providerOrderForCapability(config, 'strong', env), ['openrouter', 'gemini']);
});

test('auto mode uses direct providers when OpenRouter is absent, then Gemini fallback', () => {
  const config = cfg(); config.review.allowedExternalProviders = ['openrouter', 'openai', 'anthropic', 'gemini'];
  const env = { OPENAI_API_KEY: 'oa', ANTHROPIC_API_KEY: 'an', GEMINI_API_KEY: 'g' };
  assert.deepEqual(activePrimaryProviders(config, env), ['anthropic', 'openai']);
  assert.deepEqual(providerOrderForCapability(config, 'strong', env), ['anthropic', 'openai', 'gemini']);
});

test('Gemini activates immediately when no other approved provider credential exists', () => {
  const config = cfg(); config.review.allowedExternalProviders = ['openrouter', 'openai', 'anthropic', 'gemini'];
  const env = { GEMINI_API_KEY: 'g' };
  assert.deepEqual(activePrimaryProviders(config, env), []);
  assert.deepEqual(providerOrderForCapability(config, 'medium', env), ['gemini']);
});

test('Hermes starts at the minimum required capability instead of the strongest model', async () => {
  const config = cfg(); config.review.allowedExternalProviders = ['openai']; config.review.routing.mode = 'direct';
  config.review.routing.modelCatalog.openai = { medium: ['m-lite'], strong: ['m-strong'], advanced: ['m-advanced'] };
  const called = [];
  const hermes = new HermesOrchestrator({ config, env: { OPENAI_API_KEY: 'oa' }, clients: { openai: async (model) => { called.push(model); return { text: '{"findings":[]}', provider: 'openai', model }; } } });
  const out = await hermes.review({ modelTier: 'medium', systemPrompt: 's', userPrompt: 'u', validate: (text) => JSON.parse(text) });
  assert.equal(out.model, 'm-lite'); assert.deepEqual(called, ['m-lite']);
});

test('Hermes escalates capability when a lower model cannot return valid output', async () => {
  const config = cfg(); config.review.allowedExternalProviders = ['openai']; config.review.routing.mode = 'direct';
  config.review.routing.modelCatalog.openai = { medium: ['m-lite'], strong: ['m-strong'], advanced: ['m-advanced'] };
  const called = [];
  const hermes = new HermesOrchestrator({ config, env: { OPENAI_API_KEY: 'oa' }, clients: { openai: async (model) => { called.push(model); return { text: model === 'm-lite' ? 'bad' : '{"findings":[]}', provider: 'openai', model }; } } });
  const out = await hermes.review({ modelTier: 'medium', systemPrompt: 's', userPrompt: 'u', validate: (text) => { if (text === 'bad') throw new Error('malformed'); return JSON.parse(text); } });
  assert.equal(out.capability, 'strong'); assert.equal(out.model, 'm-strong'); assert.deepEqual(called, ['m-lite', 'm-strong']);
});

test('Hermes honors a model escalation request and moves upward rather than accepting it', async () => {
  const config = cfg(); config.review.allowedExternalProviders = ['openai']; config.review.routing.mode = 'direct';
  config.review.routing.modelCatalog.openai = { medium: ['m-lite'], strong: ['m-strong'], advanced: ['m-advanced'] };
  const hermes = new HermesOrchestrator({ config, env: { OPENAI_API_KEY: 'oa' }, clients: { openai: async (model) => ({ text: model === 'm-lite' ? 'escalate' : 'ok', provider: 'openai', model }) } });
  const out = await hermes.review({ modelTier: 'medium', systemPrompt: 's', userPrompt: 'u', validate: (text) => text === 'escalate' ? { needs_escalation: true } : { needs_escalation: false } });
  assert.equal(out.capability, 'strong'); assert.equal(out.model, 'm-strong');
});

test('Hermes remembers primary provider rate-limit health across review chunks in the same run', async () => {
  const config = cfg(); config.review.allowedExternalProviders = ['openai', 'anthropic']; config.review.routing.mode = 'direct';
  config.review.routing.providerPreference.medium = ['openai', 'anthropic', 'openrouter'];
  config.review.routing.modelCatalog.openai.medium = ['openai-medium']; config.review.routing.modelCatalog.anthropic.medium = ['anthropic-medium'];
  let openaiCalls = 0; let anthropicCalls = 0;
  const hermes = new HermesOrchestrator({ config, env: { OPENAI_API_KEY: 'oa', ANTHROPIC_API_KEY: 'an' }, clients: { openai: async () => { openaiCalls++; throw Object.assign(new Error('quota'), { code: 'HTTP_429', fallbackEligible: true }); }, anthropic: async (model) => { anthropicCalls++; return { text: 'ok', provider: 'anthropic', model }; } } });
  const validate = () => ({ needs_escalation: false });
  await hermes.review({ modelTier: 'medium', systemPrompt: 's', userPrompt: 'chunk1', validate });
  await hermes.review({ modelTier: 'medium', systemPrompt: 's', userPrompt: 'chunk2', validate });
  assert.equal(openaiCalls, 1); assert.equal(anthropicCalls, 2);
});

test('medium direct work prefers the configured light OpenAI route before heavier direct alternatives', () => {
  const config = cfg(); config.review.allowedExternalProviders = ['openai', 'anthropic', 'gemini']; config.review.routing.mode = 'direct';
  const env = { OPENAI_API_KEY: 'oa', ANTHROPIC_API_KEY: 'an', GEMINI_API_KEY: 'g' };
  assert.deepEqual(providerOrderForCapability(config, 'medium', env), ['openai', 'anthropic', 'gemini']);
});

test('direct topology tries another direct provider at the same capability before Gemini fallback', async () => {
  const config = cfg(); config.review.allowedExternalProviders = ['openai', 'anthropic', 'gemini']; config.review.routing.mode = 'direct';
  config.review.routing.providerPreference.medium = ['openai', 'anthropic', 'openrouter']; config.review.routing.modelCatalog.openai.medium = ['openai-medium']; config.review.routing.modelCatalog.anthropic.medium = ['anthropic-medium']; config.review.routing.modelCatalog.gemini.medium = ['gemini-medium'];
  const calls = [];
  const fakeGeminiPool = { request: async (model) => { calls.push(`gemini:${model}`); return { text: 'ok', provider: 'gemini', model, credentialId: 'g1' }; }, publicTelemetry: () => [] };
  const hermes = new HermesOrchestrator({ config, env: { OPENAI_API_KEY: 'oa', ANTHROPIC_API_KEY: 'an', GEMINI_API_KEY: 'g' }, geminiPool: fakeGeminiPool, clients: { openai: async (model) => { calls.push(`openai:${model}`); throw Object.assign(new Error('quota'), { code: 'HTTP_429', fallbackEligible: true }); }, anthropic: async (model) => { calls.push(`anthropic:${model}`); return { text: 'ok', provider: 'anthropic', model }; } } });
  const out = await hermes.review({ modelTier: 'medium', systemPrompt: 's', userPrompt: 'u', validate: () => ({ needs_escalation: false }) });
  assert.equal(out.provider, 'anthropic'); assert.deepEqual(calls, ['openai:openai-medium', 'anthropic:anthropic-medium']);
});

test('OpenRouter topology falls back to Gemini without consuming direct keys when mixed primary is disabled', async () => {
  const config = cfg(); config.review.allowedExternalProviders = ['openrouter', 'openai', 'anthropic', 'gemini']; config.review.routing.mode = 'auto'; config.review.routing.allowMixedPrimary = false;
  config.review.routing.modelCatalog.openrouter.medium = ['or-medium']; config.review.routing.modelCatalog.gemini.medium = ['gemini-medium'];
  const calls = [];
  const fakeGeminiPool = { request: async (model) => { calls.push(`gemini:${model}`); return { text: 'ok', provider: 'gemini', model, credentialId: 'g1' }; }, publicTelemetry: () => [] };
  const hermes = new HermesOrchestrator({ config, env: { OPENROUTER_API_KEY: 'or', OPENAI_API_KEY: 'oa', ANTHROPIC_API_KEY: 'an', GEMINI_API_KEY: 'g' }, geminiPool: fakeGeminiPool, clients: { openrouter: async (model) => { calls.push(`openrouter:${model}`); throw Object.assign(new Error('quota'), { code: 'HTTP_429', fallbackEligible: true }); }, openai: async (model) => { calls.push(`openai:${model}`); return { text: 'ok', provider: 'openai', model }; }, anthropic: async (model) => { calls.push(`anthropic:${model}`); return { text: 'ok', provider: 'anthropic', model }; } } });
  const out = await hermes.review({ modelTier: 'medium', systemPrompt: 's', userPrompt: 'u', validate: () => ({ needs_escalation: false }) });
  assert.equal(out.provider, 'gemini'); assert.deepEqual(calls, ['openrouter:or-medium', 'gemini:gemini-medium']);
});
