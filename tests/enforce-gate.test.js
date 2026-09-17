const test = require('node:test');
const assert = require('node:assert/strict');
const { evaluateGate } = require('../scripts/enforce-gate');
function base(overrides = {}) { return evaluateGate({ riskResult: 'success', validationResult: 'success', securityResult: 'success', aiResult: 'success', modelTier: 'medium', verdict: 'PASS', p0Count: '0', p1Count: '0', ...overrides }); }
test('passes healthy required pipeline', () => assert.equal(base().pass, true));
test('fails closed when deterministic checks fail', () => assert.equal(base({ validationResult: 'failure', aiResult: 'skipped', verdict: '' }).pass, false));
test('fails closed when risk classification fails', () => assert.equal(base({ riskResult: 'failure', validationResult: 'skipped', securityResult: 'skipped', aiResult: 'skipped', verdict: '' }).pass, false));
test('fails closed when AI call fails', () => assert.equal(base({ aiResult: 'failure', verdict: '' }).pass, false));
test('blocks P0 finding', () => assert.equal(base({ verdict: 'BLOCK', p0Count: '1' }).pass, false));
test('blocks P1 finding', () => assert.equal(base({ verdict: 'BLOCK', p1Count: '1' }).pass, false));
test('allows P2-only warning verdict', () => assert.equal(base({ verdict: 'PASS_WITH_WARNINGS' }).pass, true));
test('allows intentional LOW-risk AI skip', () => assert.equal(base({ modelTier: 'skip', aiResult: 'skipped', verdict: '', p0Count: '', p1Count: '' }).pass, true));
test('does not allow unexpected AI skip for MEDIUM', () => assert.equal(base({ aiResult: 'skipped', verdict: '' }).pass, false));
test('rejects negative P0 count', () => assert.equal(base({ p0Count: '-5' }).pass, false));
test('rejects negative P1 count', () => assert.equal(base({ p1Count: '-1' }).pass, false));
test('rejects malformed numeric counts instead of parseInt coercion', () => assert.equal(base({ p0Count: '1junk' }).pass, false));
test('allows intentional AI skip for restricted fork/Dependabot PR when deterministic gates pass', () => { const result = base({ restrictedPr: 'true', aiResult: 'skipped', verdict: '', p0Count: '', p1Count: '' }); assert.equal(result.pass, true); assert.equal(result.warnings.length, 1); });
test('restricted PR still fails if deterministic validation fails', () => { const result = base({ restrictedPr: 'true', aiResult: 'skipped', verdict: '', p0Count: '', p1Count: '', validationResult: 'failure' }); assert.equal(result.pass, false); });
