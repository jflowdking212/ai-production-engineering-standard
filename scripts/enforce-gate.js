#!/usr/bin/env node
function isTrue(value) {
  return String(value || '').toLowerCase() === 'true';
}

function parseNonNegativeCount(raw, name, { allowMissing = false } = {}) {
  const text = String(raw ?? '').trim();
  if (!text) {
    if (allowMissing) return { value: 0, error: null };
    return { value: NaN, error: `${name} is missing.` };
  }
  if (!/^(?:0|[1-9]\d*)$/.test(text)) return { value: NaN, error: `${name} must be a non-negative integer.` };
  const value = Number(text);
  if (!Number.isSafeInteger(value)) return { value: NaN, error: `${name} exceeds the safe integer range.` };
  return { value, error: null };
}

function evaluateGate(input) {
  const errors = [];
  const warnings = [];
  const requiredSuccess = [
    ['risk-classify', input.riskResult],
    ['deterministic-checks', input.validationResult],
    ['security-scan', input.securityResult],
  ];
  for (const [name, result] of requiredSuccess) {
    if (result !== 'success') errors.push(`${name} result is '${result || 'missing'}', expected 'success'`);
  }

  const restrictedPr = isTrue(input.restrictedPr);
  const intentionalAiSkip = input.modelTier === 'skip' || restrictedPr;
  if (intentionalAiSkip) {
    if (!['skipped', 'success'].includes(input.aiResult)) errors.push(`ai-review result is '${input.aiResult || 'missing'}' for an intentional AI-skip path`);
    if (restrictedPr && input.modelTier !== 'skip') warnings.push('External AI review was intentionally skipped for a fork/Dependabot-style restricted PR. Human approval remains required by repository branch protection/rulesets.');
  } else if (input.aiResult !== 'success') {
    errors.push(`ai-review result is '${input.aiResult || 'missing'}', expected 'success'`);
  }

  const allowMissingCounts = intentionalAiSkip;
  const p0Parsed = parseNonNegativeCount(input.p0Count, 'P0_COUNT', { allowMissing: allowMissingCounts });
  const p1Parsed = parseNonNegativeCount(input.p1Count, 'P1_COUNT', { allowMissing: allowMissingCounts });
  if (p0Parsed.error) errors.push(p0Parsed.error);
  if (p1Parsed.error) errors.push(p1Parsed.error);
  const p0 = p0Parsed.value;
  const p1 = p1Parsed.value;

  const verdict = input.verdict || (intentionalAiSkip ? 'PASS' : 'MISSING');
  if (Number.isFinite(p0) && Number.isFinite(p1) && (p0 > 0 || p1 > 0 || verdict === 'BLOCK')) {
    errors.push(`blocking AI findings remain (verdict=${verdict}, P0=${p0}, P1=${p1})`);
  }
  if (!intentionalAiSkip && !['PASS', 'PASS_WITH_WARNINGS', 'BLOCK'].includes(verdict)) errors.push(`AI verdict is missing or invalid: ${verdict}`);
  return { pass: errors.length === 0, errors, warnings, p0, p1, verdict, restrictedPr };
}

function main() {
  const result = evaluateGate({
    riskResult: process.env.RISK_RESULT,
    validationResult: process.env.VALIDATION_RESULT,
    securityResult: process.env.SECURITY_RESULT,
    aiResult: process.env.AI_RESULT,
    modelTier: process.env.MODEL_TIER,
    verdict: process.env.VERDICT,
    p0Count: process.env.P0_COUNT,
    p1Count: process.env.P1_COUNT,
    restrictedPr: process.env.RESTRICTED_PR,
  });
  console.log(`Verdict: ${result.verdict} | P0: ${result.p0} | P1: ${result.p1}`);
  result.warnings.forEach((w) => console.warn(`WARNING: ${w}`));
  if (!result.pass) {
    console.error('Quality gate FAILED CLOSED:');
    result.errors.forEach((e) => console.error(`- ${e}`));
    process.exit(1);
  }
  console.log('Quality gate passed.');
}

if (require.main === module) main();
module.exports = { evaluateGate, parseNonNegativeCount };
