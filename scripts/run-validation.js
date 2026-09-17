#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { loadConfig } = require('./lib');

function exec(cmd, args, cwd) {
  console.log(`$ ${cmd} ${args.join(' ')}`);
  const r = spawnSync(cmd, args, { cwd, stdio: 'inherit', shell: process.platform === 'win32' });
  if (r.error) throw r.error;
  if (r.status !== 0) throw new Error(`${cmd} ${args.join(' ')} failed with exit code ${r.status}`);
}

function detectPackageManager(root, pkg) {
  const declared = pkg.packageManager || '';
  if (declared.startsWith('pnpm@')) return { name: 'pnpm', version: declared.split('@')[1] };
  if (declared.startsWith('yarn@')) return { name: 'yarn', version: declared.split('@')[1] };
  if (declared.startsWith('npm@')) return { name: 'npm', version: declared.split('@')[1] };
  if (fs.existsSync(path.join(root, 'pnpm-lock.yaml'))) return { name: 'pnpm' };
  if (fs.existsSync(path.join(root, 'yarn.lock'))) return { name: 'yarn' };
  return { name: 'npm' };
}

function installDependencies(pm, root, allowUnlockedInstall) {
  const hasLock = fs.existsSync(path.join(root, 'package-lock.json')) || fs.existsSync(path.join(root, 'pnpm-lock.yaml')) || fs.existsSync(path.join(root, 'yarn.lock'));
  if (!hasLock && !allowUnlockedInstall) throw new Error('No supported lockfile found. APES refuses an unlocked dependency install.');
  if (pm.name === 'npm') exec('npm', hasLock ? ['ci'] : ['install'], root);
  else if (pm.name === 'pnpm') exec('pnpm', ['install', ...(hasLock ? ['--frozen-lockfile'] : [])], root);
  else if (pm.name === 'yarn') {
    const major = Number((pm.version || '1').split('.')[0]);
    exec('yarn', ['install', ...(hasLock ? [major >= 2 ? '--immutable' : '--frozen-lockfile'] : [])], root);
  } else throw new Error(`Unsupported package manager: ${pm.name}`);
}

function runValidation({ projectRoot, config, install = true }) {
  if (config.runtime.type !== 'node') throw new Error(`Unsupported runtime type in APES v1: ${config.runtime.type}. Add a runtime adapter before enabling the gate.`);
  const pkgPath = path.join(projectRoot, 'package.json');
  if (!fs.existsSync(pkgPath)) throw new Error('runtime.type=node but package.json is missing.');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  const scripts = pkg.scripts || {};
  const pm = detectPackageManager(projectRoot, pkg);

  for (const name of config.runtime.requiredScripts || []) {
    if (!scripts[name]) throw new Error(`Required validation script '${name}' is missing from package.json.`);
  }
  if (install) installDependencies(pm, projectRoot, !!config.runtime.allowUnlockedInstall);

  const runner = pm.name === 'npm' ? ['npm', ['run']] : pm.name === 'pnpm' ? ['pnpm', ['run']] : ['yarn', []];
  for (const name of config.runtime.requiredScripts || []) exec(runner[0], [...runner[1], name], projectRoot);
  for (const name of config.runtime.optionalScripts || []) {
    if (scripts[name]) exec(runner[0], [...runner[1], name], projectRoot);
    else console.log(`Optional validation script '${name}' is not defined; skipping.`);
  }
  return { packageManager: pm.name, required: config.runtime.requiredScripts, optional: config.runtime.optionalScripts };
}

function main() {
  const projectRoot = path.resolve(process.env.PROJECT_ROOT || process.cwd());
  const config = loadConfig(projectRoot, process.env.APES_CONFIG_PATH || '.apes.json');
  runValidation({ projectRoot, config, install: process.env.SKIP_INSTALL !== '1' });
}

if (require.main === module) {
  try { main(); } catch (err) { console.error(err.stack || err.message); process.exit(1); }
}
module.exports = { detectPackageManager, runValidation };
