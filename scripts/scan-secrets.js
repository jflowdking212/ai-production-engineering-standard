#!/usr/bin/env node
const fs = require('fs');
const { parseUnifiedDiff } = require('./lib');

const PLACEHOLDER = /(?:changeme|change_me|replace[_-]?me|\bYOUR_[A-Z0-9_]*(?:KEY|TOKEN|SECRET)[A-Z0-9_]*\b|your[_-]?(?:key|token|secret)|<[^>]+>|\*{3,}|process\.env|\$\{)/i;
const SECRET_PATTERNS = [
  ['private-key', /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/],
  ['github-token', /\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/],
  ['openai-openrouter-key', /\bsk-(?:proj-|or-v1-)?[A-Za-z0-9_-]{20,}\b/],
  ['anthropic-key', /\bsk-ant-[A-Za-z0-9_-]{20,}\b/],
  ['google-api-key', /\bAIza[0-9A-Za-z_-]{30,}\b/],
  ['aws-access-key', /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/],
  ['stripe-live-secret', /\b(?:sk_live|rk_live)_[0-9A-Za-z]{16,}\b/],
  ['stripe-webhook-secret', /\bwhsec_[0-9A-Za-z]{16,}\b/],
  ['generic-secret-assignment', /\b(?:api[_-]?key|secret|client[_-]?secret|password|passwd|token)\b\s*[:=]\s*["'][^"']{12,}["']/i],
  ['credential-url', /\b(?:https?|postgres(?:ql)?|mysql|mongodb(?:\+srv)?):\/\/[^\s:@/]+:[^\s@/]{8,}@/i],
];

function detectSecretsInText(text, location = '<text>') {
  const findings = [];
  String(text || '').split('\n').forEach((line, idx) => {
    if (PLACEHOLDER.test(line)) return;
    for (const [type, re] of SECRET_PATTERNS) {
      if (re.test(line)) findings.push({ type, location, line: idx + 1 });
    }
  });
  return findings;
}

function redactSecretsInText(text) {
  let redactedCount = 0;
  const output = String(text || '').split('\n').map((line) => {
    if (PLACEHOLDER.test(line)) return line;
    let current = line;
    for (const [type, re] of SECRET_PATTERNS) {
      let guard = 0;
      while (re.test(current) && guard++ < 20) {
        current = current.replace(re, `[REDACTED_${type.toUpperCase().replace(/-/g, '_')}]`);
        redactedCount += 1;
      }
    }
    return current;
  }).join('\n');
  return { text: output, redactedCount };
}

function scanDiff(diffText) {
  const findings = [];
  for (const file of parseUnifiedDiff(diffText)) {
    for (const added of file.added) {
      if (PLACEHOLDER.test(added.text)) continue;
      for (const [type, re] of SECRET_PATTERNS) {
        if (re.test(added.text)) findings.push({ type, path: file.path, line: added.line, side: 'RIGHT' });
      }
    }
  }
  return findings;
}

function scanRemovedDiffSecrets(diffText) {
  const findings = [];
  for (const file of parseUnifiedDiff(diffText)) {
    for (const removed of file.removed || []) {
      if (PLACEHOLDER.test(removed.text)) continue;
      for (const [type, re] of SECRET_PATTERNS) {
        if (re.test(removed.text)) findings.push({ type, path: file.path, line: removed.line, side: 'LEFT' });
      }
    }
  }
  return findings;
}

function main() {
  const diffPath = process.env.DIFF_TEXT_PATH;
  if (!diffPath || !fs.existsSync(diffPath)) throw new Error('DIFF_TEXT_PATH is required for secret scanning.');
  const diff = fs.readFileSync(diffPath, 'utf8');
  const addedFindings = scanDiff(diff);
  const removedFindings = scanRemovedDiffSecrets(diff);
  if (addedFindings.length) {
    console.error('Potential secrets detected in PR additions. External AI review and merge are blocked.');
    for (const f of addedFindings) console.error(`- ${f.type}: ${f.path}:${f.line}`);
    process.exit(1);
  }
  if (removedFindings.length) {
    console.warn('Potential secrets exist only on removed diff lines. Cleanup is allowed, but those values must be redacted before any external AI call.');
    for (const f of removedFindings) console.warn(`- ${f.type}: ${f.path}:${f.line}`);
  }
  console.log('Secret scan passed: no supported secret patterns found in added lines.');
}

if (require.main === module) {
  try { main(); } catch (err) { console.error(err.stack || err.message); process.exit(1); }
}
module.exports = { scanDiff, scanRemovedDiffSecrets, detectSecretsInText, redactSecretsInText, SECRET_PATTERNS };
