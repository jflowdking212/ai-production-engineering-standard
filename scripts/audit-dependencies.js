#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { loadConfig } = require('./lib');
const { detectPackageManager } = require('./run-validation');

function commandFor(pm) {
  if (pm.name === 'npm') return ['npm', ['audit', '--omit=dev', '--audit-level=high']];
  if (pm.name === 'pnpm') return ['pnpm', ['audit', '--prod', '--audit-level', 'high']];
  if (pm.name === 'yarn') {
    const major = Number((pm.version || '1').split('.')[0]);
    return major >= 2
      ? ['yarn', ['npm', 'audit', '--severity', 'high', '--environment', 'production']]
      : ['yarn', ['audit', '--groups', 'dependencies', '--level', 'high']];
  }
  throw new Error(`Unsupported package manager for dependency audit: ${pm.name}`);
}

function runDependencyAudit({ projectRoot, config }) {
  const mode = config.security?.dependencyAudit || 'off';
  if (!['off', 'optional', 'required'].includes(mode)) throw new Error(`Invalid security.dependencyAudit mode: ${mode}`);
  if (mode === 'off') {
    console.log('Dependency audit disabled by .apes.json.');
    return { mode, status: 'skipped' };
  }
  const pkgPath = path.join(projectRoot, 'package.json');
  if (!fs.existsSync(pkgPath)) {
    const msg = 'Dependency audit requested but package.json is missing.';
    if (mode === 'required') throw new Error(msg);
    console.warn(`WARNING: ${msg}`);
    return { mode, status: 'unsupported' };
  }
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  const pm = detectPackageManager(projectRoot, pkg);
  const lockExists = fs.existsSync(path.join(projectRoot, 'package-lock.json')) || fs.existsSync(path.join(projectRoot, 'pnpm-lock.yaml')) || fs.existsSync(path.join(projectRoot, 'yarn.lock'));
  if (!lockExists) {
    const msg = 'Dependency audit requested but no supported lockfile exists.';
    if (mode === 'required') throw new Error(msg);
    console.warn(`WARNING: ${msg}`);
    return { mode, status: 'unsupported' };
  }
  const [cmd, args] = commandFor(pm);
  console.log(`$ ${cmd} ${args.join(' ')}`);
  const r = spawnSync(cmd, args, { cwd: projectRoot, stdio: 'inherit', shell: process.platform === 'win32' });
  if (r.error) {
    if (mode === 'required') throw r.error;
    console.warn(`WARNING: dependency audit could not run: ${r.error.message}`);
    return { mode, status: 'warning' };
  }
  if (r.status !== 0) {
    const msg = `Dependency audit reported high/critical vulnerabilities or failed (exit ${r.status}).`;
    if (mode === 'required') throw new Error(msg);
    console.warn(`WARNING: ${msg}`);
    return { mode, status: 'warning' };
  }
  console.log('Dependency audit passed at high/critical production-dependency threshold.');
  return { mode, status: 'passed' };
}

function main() {
  const projectRoot = path.resolve(process.env.PROJECT_ROOT || process.cwd());
  const config = loadConfig(projectRoot, process.env.APES_CONFIG_PATH || '.apes.json');
  runDependencyAudit({ projectRoot, config });
}

if (require.main === module) {
  try { main(); } catch (err) { console.error(err.stack || err.message); process.exit(1); }
}
module.exports = { commandFor, runDependencyAudit };
