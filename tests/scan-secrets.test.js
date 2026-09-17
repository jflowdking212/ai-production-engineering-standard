const test = require('node:test');
const assert = require('node:assert/strict');
const { scanDiff, detectSecretsInText } = require('../scripts/scan-secrets');

test('detects a Google API key in added lines', () => {
  const diff = `diff --git a/x.ts b/x.ts\n--- a/x.ts\n+++ b/x.ts\n@@ -1,0 +1,1 @@\n+const key = "AIza12345678901234567890123456789012345";`;
  assert.equal(scanDiff(diff).length, 1);
});

test('detects generic hard-coded secret assignment', () => {
  assert.equal(detectSecretsInText(`api_key = "super-secret-value-12345"`, 'x').length, 1);
});

test('allows obvious placeholders and env references', () => {
  assert.equal(detectSecretsInText(`api_key = "YOUR_API_KEY_HERE"\nsecret = process.env.SECRET`, 'x').length, 0);
});

test('detects bare OpenRouter/OpenAI-style secret', () => {
  assert.equal(detectSecretsInText('sk-or-v1-abcdefghijklmnopqrstuvwxyz123456', 'x').length, 1);
});

test('detects database URL credentials', () => {
  assert.equal(detectSecretsInText('postgresql://admin:supersecretpassword@db.example.com/app', 'x').length, 1);
});

test('detects a secret on a removed line without treating it as an added-secret block', () => {
  const { scanRemovedDiffSecrets } = require('../scripts/scan-secrets');
  const diff = `diff --git a/x.ts b/x.ts\n--- a/x.ts\n+++ b/x.ts\n@@ -1,1 +1,1 @@\n-const key = "AIza12345678901234567890123456789012345";\n+const key = process.env.GOOGLE_API_KEY;`;
  assert.equal(scanDiff(diff).length, 0);
  const removed = scanRemovedDiffSecrets(diff);
  assert.equal(removed.length, 1);
  assert.equal(removed[0].side, 'LEFT');
});

test('redacts secrets while preserving line count for outbound AI payloads', () => {
  const { redactSecretsInText } = require('../scripts/scan-secrets');
  const input = `line1\n-const key = "AIza12345678901234567890123456789012345";\nline3`;
  const out = redactSecretsInText(input);
  assert.equal(out.text.split('\n').length, input.split('\n').length);
  assert.equal(out.text.includes('AIza12345678901234567890123456789012345'), false);
  assert.equal(out.redactedCount, 1);
});
