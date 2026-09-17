const test = require('node:test');
const assert = require('node:assert/strict');
const { classify } = require('../scripts/classify-risk');
const { DEFAULT_CONFIG } = require('../scripts/lib');

function c(files, diffText='') { return classify({ files, diffText, config: DEFAULT_CONFIG }); }

test('docs-only PR is LOW', () => { assert.equal(c(['docs/readme.md']).risk, 'LOW'); });
test('tests-only PR is LOW even when filename contains delete', () => { assert.equal(c(['src/users/delete-user.test.ts']).risk, 'LOW'); });
test('ordinary source change is MEDIUM', () => { assert.equal(c(['src/services/profile.ts']).risk, 'MEDIUM'); });
test('API change is HIGH', () => { assert.equal(c(['src/api/users.ts']).risk, 'HIGH'); });
test('authorization change is CRITICAL', () => { assert.equal(c(['src/security/authorization.ts']).risk, 'CRITICAL'); });
test('payment change is CRITICAL', () => { assert.equal(c(['src/payments/charge.ts']).risk, 'CRITICAL'); });
test('migration change is CRITICAL', () => { assert.equal(c(['prisma/migrations/20260101000000_x/migration.sql']).risk, 'CRITICAL'); });
test('workflow/config controls are CRITICAL', () => { assert.equal(c(['.github/workflows/ai-review.yml']).risk, 'CRITICAL'); assert.equal(c(['.apes.json']).risk, 'CRITICAL'); });
test('destructive operation hidden in ordinary service filename is CRITICAL', () => {
  const diff = `diff --git a/src/users/service.ts b/src/users/service.ts\n--- a/src/users/service.ts\n+++ b/src/users/service.ts\n@@ -10,1 +10,2 @@\n context\n+await prisma.user.deleteMany({ where: { inactive: true } });`;
  const r = c(['src/users/service.ts'], diff); assert.equal(r.risk, 'CRITICAL'); assert.match(r.reasons.join('\n'), /destructive operation/);
});
test('root-level markdown is LOW', () => { assert.equal(c(['README.md']).risk, 'LOW'); });
test('root CODEOWNERS is CRITICAL', () => { assert.equal(c(['CODEOWNERS']).risk, 'CRITICAL'); });
test('removing authorization logic from an ordinary service escalates to HIGH', () => {
  const diff = `diff --git a/src/services/user.ts b/src/services/user.ts\n--- a/src/services/user.ts\n+++ b/src/services/user.ts\n@@ -10,2 +10,1 @@\n-await authorizeUser(userId);\n return loadUser(userId);`;
  assert.equal(c(['src/services/user.ts'], diff).risk, 'HIGH');
});
test('package manifest and lockfile changes are HIGH supply-chain risk', () => { assert.equal(c(['package.json']).risk, 'HIGH'); assert.equal(c(['pnpm-lock.yaml']).risk, 'HIGH'); });
