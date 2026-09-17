const test = require('node:test');
const assert = require('node:assert/strict');
const { commandFor } = require('../scripts/audit-dependencies');
test('npm dependency audit targets high production vulnerabilities', () => { assert.deepEqual(commandFor({ name: 'npm' }), ['npm', ['audit', '--omit=dev', '--audit-level=high']]); });
test('pnpm dependency audit targets high production vulnerabilities', () => { assert.deepEqual(commandFor({ name: 'pnpm' }), ['pnpm', ['audit', '--prod', '--audit-level', 'high']]); });
