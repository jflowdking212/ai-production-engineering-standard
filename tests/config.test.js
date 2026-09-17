const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { loadConfig } = require('../scripts/lib');
function withConfig(obj, fn) { const root = fs.mkdtempSync(path.join(os.tmpdir(), 'apes-config-')); fs.writeFileSync(path.join(root, '.apes.json'), JSON.stringify(obj, null, 2)); try { return fn(root); } finally { fs.rmSync(root, { recursive: true, force: true }); } }
test('valid partial config merges with defaults', () => { withConfig({ version: 1, security: { dependencyAudit: 'required' } }, (root) => { const cfg = loadConfig(root); assert.equal(cfg.security.dependencyAudit, 'required'); assert.deepEqual(cfg.runtime.requiredScripts, ['typecheck', 'test', 'build']); }); });
test('unknown top-level keys fail loudly', () => { withConfig({ version: 1, externalAI: { allowed: true } }, (root) => { assert.throws(() => loadConfig(root), /Unknown APES config key: externalAI/); }); });
test('unknown nested keys fail loudly', () => { withConfig({ version: 1, review: { approvedProviders: ['openrouter'] } }, (root) => { assert.throws(() => loadConfig(root), /Unknown APES config key: review\.approvedProviders/); }); });
test('wrong config value shapes fail loudly', () => { withConfig({ version: 1, runtime: { requiredScripts: 'test' } }, (root) => { assert.throws(() => loadConfig(root), /runtime\.requiredScripts must be an array/); }); });
test('unsupported provider names fail loudly', () => { withConfig({ version: 1, review: { allowedExternalProviders: ['unknown-provider'] } }, (root) => { assert.throws(() => loadConfig(root), /Unsupported external AI provider/); }); });
test('invalid dependency-audit mode fails loudly', () => { withConfig({ version: 1, security: { dependencyAudit: 'sometimes' } }, (root) => { assert.throws(() => loadConfig(root), /Invalid security\.dependencyAudit mode/); }); });
test('unsafe review limits fail loudly', () => { withConfig({ version: 1, review: { maxChunks: 0 } }, (root) => { assert.throws(() => loadConfig(root), /review\.maxChunks must be an integer/); }); });
test('direct OpenAI/Anthropic provider names are accepted', () => { withConfig({ version: 1, review: { allowedExternalProviders: ['openai', 'anthropic', 'gemini'] } }, (root) => { const cfg = loadConfig(root); assert.deepEqual(cfg.review.allowedExternalProviders, ['openai', 'anthropic', 'gemini']); }); });
test('invalid Hermes routing mode fails loudly', () => { withConfig({ version: 1, review: { routing: { mode: 'magic' } } }, (root) => { assert.throws(() => loadConfig(root), /Invalid review\.routing\.mode/); }); });
test('invalid capability provider preference fails loudly', () => { withConfig({ version: 1, review: { routing: { providerPreference: { medium: ['unknown'] } } } }, (root) => { assert.throws(() => loadConfig(root), /providerPreference\.medium/); }); });
