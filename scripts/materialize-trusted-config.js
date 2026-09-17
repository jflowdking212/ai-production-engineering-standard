#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { assertSafeProjectPath, loadConfig } = require('./lib');

function gitShow(projectRoot, spec) {
  const r = spawnSync('git', ['show', spec], { cwd: projectRoot, encoding: 'utf8' });
  return r.status === 0 ? r.stdout : null;
}

function materializeTrustedConfig({ projectRoot, baseSha, configPath = '.apes.json', outputPath }) {
  if (!baseSha) throw new Error('BASE_SHA is required to resolve trusted APES policy.');
  if (!outputPath) throw new Error('OUTPUT_PATH is required.');
  assertSafeProjectPath(projectRoot, configPath);

  let text = gitShow(projectRoot, `${baseSha}:${configPath}`);
  let source = 'base';
  if (text == null) {
    const headPath = assertSafeProjectPath(projectRoot, configPath);
    if (!fs.existsSync(headPath)) throw new Error(`APES config '${configPath}' does not exist on the trusted base branch or PR head.`);
    text = fs.readFileSync(headPath, 'utf8');
    source = 'bootstrap-head';
    console.warn(`APES bootstrap: '${configPath}' is absent from the base branch, so this initial onboarding run uses the PR-head config. Do not rely on branch protection until the config is merged.`);
  }

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, text);
  loadConfig(projectRoot, outputPath);
  return { source, outputPath };
}

function main() {
  const projectRoot = path.resolve(process.env.PROJECT_ROOT || process.cwd());
  const baseSha = process.env.BASE_SHA;
  const configPath = process.env.REQUESTED_CONFIG_PATH || '.apes.json';
  const outputPath = path.resolve(process.env.OUTPUT_PATH || '/tmp/apes-trusted.json');
  const out = materializeTrustedConfig({ projectRoot, baseSha, configPath, outputPath });
  console.log(JSON.stringify(out));
  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `config_path=${out.outputPath}\nconfig_source=${out.source}\n`);
  }
}

if (require.main === module) {
  try { main(); } catch (err) { console.error(err.stack || err.message); process.exit(1); }
}
module.exports = { materializeTrustedConfig };
