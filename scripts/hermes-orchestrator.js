#!/usr/bin/env node
/**
 * Hermes provider/model orchestration for APES.
 *
 * Hermes does not blindly start with the biggest model. The deterministic APES
 * risk engine supplies the minimum capability. Hermes then resolves the active
 * provider topology from explicit repository policy + available credentials.
 *
 * auto mode:
 *   OPENROUTER key present+approved -> OpenRouter primary, Gemini fallback.
 *   otherwise direct OpenAI/Anthropic credentials -> direct primary set, Gemini fallback.
 *   otherwise Gemini credentials -> Gemini immediately.
 *
 * A response validator may reject malformed/insufficient model output. Hermes
 * then tries another candidate at the same capability and may escalate upward.
 */
const { callOpenRouter, callOpenAI, callAnthropic } = require('./provider-clients');
const { GeminiCredentialPool, parseGeminiCredentials } = require('./gemini-credential-pool');

const CAPABILITIES = ['medium', 'strong', 'advanced'];

function hasCredential(provider, env = process.env) {
  if (provider === 'openrouter') return !!env.OPENROUTER_API_KEY;
  if (provider === 'openai') return !!env.OPENAI_API_KEY;
  if (provider === 'anthropic') return !!env.ANTHROPIC_API_KEY;
  if (provider === 'gemini') return !!(env.GEMINI_API_KEYS_JSON || env.GEMINI_API_KEY);
  return false;
}

function minimumCapability(modelTier) {
  return CAPABILITIES.includes(modelTier) ? modelTier : 'medium';
}

function escalationCapabilities(modelTier) {
  const start = CAPABILITIES.indexOf(minimumCapability(modelTier));
  return CAPABILITIES.slice(start);
}

function activePrimaryProviders(config, env = process.env) {
  const allowed = new Set(config.review.allowedExternalProviders || []);
  const mode = config.review.routing.mode;
  const openrouter = allowed.has('openrouter') && hasCredential('openrouter', env);
  const direct = ['anthropic', 'openai'].filter((p) => allowed.has(p) && hasCredential(p, env));

  if (mode === 'gemini') return [];
  if (mode === 'openrouter') return openrouter ? ['openrouter'] : [];
  if (mode === 'direct') return direct;
  if (mode !== 'auto') throw new Error(`Unsupported Hermes routing mode: ${mode}`);

  if (openrouter && !config.review.routing.allowMixedPrimary) return ['openrouter'];
  if (openrouter) return ['openrouter', ...direct];
  return direct;
}

function providerOrderForCapability(config, capability, env = process.env) {
  const allowed = new Set(config.review.allowedExternalProviders || []);
  const primary = activePrimaryProviders(config, env);
  const preferred = (config.review.routing.providerPreference || {})[capability] || [];
  primary.sort((a, b) => {
    const ai = preferred.indexOf(a); const bi = preferred.indexOf(b);
    return (ai < 0 ? 999 : ai) - (bi < 0 ? 999 : bi);
  });
  const out = [...primary];
  if (allowed.has('gemini') && hasCredential('gemini', env) && !out.includes('gemini')) out.push('gemini');
  return out.filter((provider) => ((config.review.routing.modelCatalog[provider] || {})[capability] || []).length > 0);
}

function modelCandidates(config, provider, capability) {
  return [...(((config.review.routing.modelCatalog || {})[provider] || {})[capability] || [])];
}

class HermesOrchestrator {
  constructor({ config, env = process.env, clients = {}, geminiPool = null }) {
    this.config = config;
    this.env = env;
    this.clients = {
      openrouter: clients.openrouter || callOpenRouter,
      openai: clients.openai || callOpenAI,
      anthropic: clients.anthropic || callAnthropic,
    };
    this.trace = [];
    this.providerCooldowns = new Map();
    this.disabledProviders = new Set();
    const geminiAllowed = new Set(config.review.allowedExternalProviders || []).has('gemini');
    const geminiCredentials = geminiAllowed ? parseGeminiCredentials(env) : [];
    this.geminiPool = geminiPool || (geminiCredentials.length ? new GeminiCredentialPool(geminiCredentials, {
      timeoutMs: config.review.requestTimeoutMs,
      cooldown429Ms: config.review.routing.geminiPool.cooldown429Ms,
      transientCooldownMs: config.review.routing.geminiPool.transientCooldownMs,
      maxRetriesPerCredential: config.review.routing.geminiPool.maxRetriesPerCredential,
      backoffBaseMs: config.review.routing.geminiPool.backoffBaseMs,
    }) : null);
  }

  candidateStateKey(provider, model) { return `${provider}:${model}`; }

  candidateHealthy(provider, model) {
    if (this.disabledProviders.has(provider)) return false;
    return (this.providerCooldowns.get(this.candidateStateKey(provider, model)) || 0) <= Date.now();
  }

  recordProviderFailure(provider, model, err) {
    const code = String(err && err.code || '');
    if (code === 'HTTP_401' || code === 'HTTP_402') {
      this.disabledProviders.add(provider);
      this.trace.push({ provider, model, event: 'provider-disabled', code });
      return;
    }
    if (code === 'HTTP_403' || code === 'HTTP_400' || code === 'HTTP_404') {
      this.providerCooldowns.set(this.candidateStateKey(provider, model), Number.MAX_SAFE_INTEGER);
      this.trace.push({ provider, model, event: 'candidate-disabled', code });
      return;
    }
    if (code === 'HTTP_429') {
      const cooldownMs = Math.max(1000, Number(err && err.retryAfterMs || 60000));
      this.providerCooldowns.set(this.candidateStateKey(provider, model), Date.now() + cooldownMs);
      this.trace.push({ provider, model, event: 'provider-cooldown', code, cooldownMs });
      return;
    }
    if (code === 'NETWORK' || code === 'HTTP_408' || code === 'HTTP_409' || /^HTTP_5/.test(code)) {
      this.providerCooldowns.set(this.candidateStateKey(provider, model), Date.now() + 5000);
      this.trace.push({ provider, model, event: 'provider-cooldown', code, cooldownMs: 5000 });
    }
  }

  async callCandidate(provider, model, systemPrompt, userPrompt) {
    const timeoutMs = Number(this.config.review.requestTimeoutMs || 90000);
    if (provider === 'gemini') {
      if (!this.geminiPool) throw Object.assign(new Error('No Gemini credential pool is configured.'), { fallbackEligible: true });
      return this.geminiPool.request(model, systemPrompt, userPrompt);
    }
    const client = this.clients[provider];
    if (!client) throw Object.assign(new Error(`No client implemented for provider ${provider}.`), { fallbackEligible: true });
    return client(model, systemPrompt, userPrompt, timeoutMs, undefined);
  }

  async review({ modelTier, systemPrompt, userPrompt, validate }) {
    if (typeof validate !== 'function') throw new Error('Hermes requires a response validator so malformed model output cannot be accepted.');
    const errors = [];
    for (const capability of escalationCapabilities(modelTier)) {
      const providers = providerOrderForCapability(this.config, capability, this.env);
      for (const provider of providers) {
        const models = modelCandidates(this.config, provider, capability);
        for (const model of models) {
          if (provider !== 'gemini' && !this.candidateHealthy(provider, model)) {
            this.trace.push({ capability, provider, model, event: 'candidate-skipped-unhealthy' });
            continue;
          }
          let response;
          try {
            response = await this.callCandidate(provider, model, systemPrompt, userPrompt);
            this.trace.push({ capability, provider, model: response.model || model, credentialId: response.credentialId || null, event: 'response' });
          } catch (err) {
            errors.push(`${provider}:${model}: ${err.message}`);
            this.trace.push({ capability, provider, model, event: 'provider-failure', code: err.code || null });
            if (provider !== 'gemini') this.recordProviderFailure(provider, model, err);
            continue;
          }

          try {
            const validated = validate(response.text);
            if (validated && validated.needs_escalation === true) throw new Error('Reviewer explicitly requested stronger capability.');
            this.trace.push({ capability, provider, model: response.model || model, credentialId: response.credentialId || null, event: 'validated' });
            return { ...response, capability, validated, routingTrace: this.publicTrace() };
          } catch (err) {
            errors.push(`${provider}:${model}: invalid/insufficient response: ${err.message}`);
            this.trace.push({ capability, provider, model: response.model || model, credentialId: response.credentialId || null, event: 'validation-failure' });
          }
        }
      }
    }
    throw new Error(`Hermes exhausted all approved provider/model routes at or above required capability. ${errors.join(' | ')}`);
  }

  publicTrace() {
    const own = this.trace.map((x) => ({ ...x }));
    const gemini = this.geminiPool ? this.geminiPool.publicTelemetry() : [];
    return [...own, ...gemini];
  }
}

module.exports = {
  HermesOrchestrator,
  activePrimaryProviders,
  providerOrderForCapability,
  modelCandidates,
  escalationCapabilities,
  minimumCapability,
  hasCredential,
};
