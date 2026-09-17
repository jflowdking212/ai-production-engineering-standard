const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'); const os = require('os'); const path = require('path');
const { assertSafeProjectPath } = require('../scripts/lib');
test('rejects lexical context traversal', () => { const root = fs.mkdtempSync(path.join(os.tmpdir(), 'apes-path-')); try { assert.throws(() => assertSafeProjectPath(root, '../outside.txt'), /escapes project root/); } finally { fs.rmSync(root, { recursive: true, force: true }); } });
test('rejects symlinked context files', { skip: process.platform === 'win32' }, () => { const root = fs.mkdtempSync(path.join(os.tmpdir(), 'apes-path-')); const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'apes-outside-')); try { const target = path.join(outside, 'secret.txt'); fs.writeFileSync(target, 'not for model context'); fs.symlinkSync(target, path.join(root, 'linked.txt')); assert.throws(() => assertSafeProjectPath(root, 'linked.txt'), /symlinked project context/); } finally { fs.rmSync(root, { recursive: true, force: true }); fs.rmSync(outside, { recursive: true, force: true }); } });
