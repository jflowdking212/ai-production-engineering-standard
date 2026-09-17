const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const CENTRAL = 'jflowdking212/ai-production-engineering-standard';
test('reusable workflow checks out the canonical APES repository', () => { const workflow = fs.readFileSync('.github/workflows/ai-review.yml', 'utf8'); assert.match(workflow, new RegExp(`repository: ${CENTRAL.replace('/', '\\/')}`)); assert.doesNotMatch(workflow, /jflowdking212\/ai-engineering-pipeline/); });
test('project template calls the canonical APES reusable workflow', () => { const caller = fs.readFileSync('templates/project-repo/.github/workflows/ai-review.yml', 'utf8'); assert.match(caller, new RegExp(`${CENTRAL.replace('/', '\\/')}\\/.github\\/workflows\\/ai-review\\.yml@v1\\.2\\.0`)); assert.doesNotMatch(caller, /jflowdking212\/ai-engineering-pipeline/); });
