const fs = require('fs');
const path = require('path');

const DEFAULT_CONFIG = {
  version: 1,
  runtime: {
    type: 'node',
    requiredScripts: ['typecheck', 'test', 'build'],
    optionalScripts: ['lint'],
    allowUnlockedInstall: false,
  },
  risk: {
    criticalPaths: [
      '**/payments/**', '**/payment/**', '**/billing/**', '**/webhooks/**',
      '**/auth/**', '**/authentication/**', '**/authorization/**', '**/rbac/**',
      '**/permissions/**', '**/sessions/**', '**/security/**', '**/migrations/**',
      '.github/workflows/**', '.apes.json', '**/CODEOWNERS'
    ],
    highPaths: [
      '**/api/**', '**/tenant/**', '**/tenants/**', '**/workspace/**',
      '**/workspaces/**', '**/subscription/**', '**/subscriptions/**',
      '**/entitlement/**', '**/entitlements/**',
      '**/package.json', '**/package-lock.json', '**/pnpm-lock.yaml', '**/yarn.lock',
      '**/.npmrc', '**/.yarnrc', '**/.yarnrc.yml', '**/pnpm-workspace.yaml'
    ],
    lowPaths: [
      '**/*.md', '**/*.css', '**/*.scss', 'docs/**', '**/locales/**', '**/i18n/**',
      '**/*.test.ts', '**/*.test.tsx', '**/*.test.js', '**/*.test.jsx',
      '**/*.spec.ts', '**/*.spec.tsx', '**/*.spec.js', '**/*.spec.jsx'
    ],
    additionalCriticalPaths: [],
    additionalHighPaths: [],
    additionalLowPaths: []
  },
  context: {
    documents: [
      'docs/PROJECT_ARCHITECTURE.md',
      'docs/BUSINESS_RULES.md',
      'docs/SECURITY_POLICY.md'
    ],
    includeChangedFiles: true,
    includeDirectImports: true,
    maxContextChars: 50000,
    maxPerFileChars: 12000
  },
  review: {
    allowedExternalProviders: [],
    maxChunkChars: 45000,
    maxChunks: 12,
    requestTimeoutMs: 90000,
    routing: {
      mode: 'auto',
      allowMixedPrimary: false,
      providerPreference: {
        medium: ['openai', 'anthropic', 'openrouter'],
        strong: ['anthropic', 'openai', 'openrouter'],
        advanced: ['anthropic', 'openai', 'openrouter']
      },
      modelCatalog: {
        openrouter: {
          medium: ['openai/gpt-5.6-luna'],
          strong: ['anthropic/claude-sonnet-5', 'openai/gpt-5.6-terra'],
          advanced: ['anthropic/claude-opus-5', 'openai/gpt-5.6-sol']
        },
        openai: {
          medium: ['gpt-5.6-luna'],
          strong: ['gpt-5.6-terra'],
          advanced: ['gpt-5.6-sol']
        },
        anthropic: {
          medium: ['claude-sonnet-5'],
          strong: ['claude-sonnet-5'],
          advanced: ['claude-opus-5']
        },
        gemini: {
          medium: ['gemini-3.5-flash-lite', 'gemini-3.6-flash'],
          strong: ['gemini-3.8-flash', 'gemini-3.6-flash'],
          advanced: ['gemini-2.5-pro', 'gemini-3.8-flash']
        }
      },
      geminiPool: {
        cooldown429Ms: 60000,
        transientCooldownMs: 5000,
        maxRetriesPerCredential: 1,
        backoffBaseMs: 500
      }
    }
  },
  security: {
    dependencyAudit: 'optional'
  }
};

function deepMerge(base, override) {
  if (!override || typeof override !== 'object' || Array.isArray(override)) return base;
  const out = { ...base };
  for (const [key, value] of Object.entries(override)) {
    if (value && typeof value === 'object' && !Array.isArray(value) && base[key] && typeof base[key] === 'object' && !Array.isArray(base[key])) {
      out[key] = deepMerge(base[key], value);
    } else {
      out[key] = value;
    }
  }
  return out;
}

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function validateConfigShape(user, schema, prefix = '') {
  if (!isPlainObject(user)) throw new Error(`APES config ${prefix || 'root'} must be an object.`);
  for (const [key, value] of Object.entries(user)) {
    const here = prefix ? `${prefix}.${key}` : key;
    if (!Object.prototype.hasOwnProperty.call(schema, key)) {
      throw new Error(`Unknown APES config key: ${here}. Refusing to ignore security-policy configuration.`);
    }
    const expected = schema[key];
    if (Array.isArray(expected)) {
      if (!Array.isArray(value)) throw new Error(`APES config ${here} must be an array.`);
    } else if (isPlainObject(expected)) {
      if (!isPlainObject(value)) throw new Error(`APES config ${here} must be an object.`);
      validateConfigShape(value, expected, here);
    } else if (typeof value !== typeof expected) {
      throw new Error(`APES config ${here} must be of type ${typeof expected}.`);
    }
  }
}

function validateConfigSemantics(config) {
  if (config.version !== 1) throw new Error(`Unsupported APES config version: ${config.version}`);
  if (config.runtime.type !== 'node') throw new Error(`Unsupported APES runtime type: ${config.runtime.type}`);
  for (const [name, values] of [
    ['runtime.requiredScripts', config.runtime.requiredScripts],
    ['runtime.optionalScripts', config.runtime.optionalScripts],
    ['risk.additionalCriticalPaths', config.risk.additionalCriticalPaths],
    ['risk.additionalHighPaths', config.risk.additionalHighPaths],
    ['risk.additionalLowPaths', config.risk.additionalLowPaths],
    ['context.documents', config.context.documents],
    ['review.allowedExternalProviders', config.review.allowedExternalProviders],
  ]) {
    if (!values.every((v) => typeof v === 'string' && v.trim())) throw new Error(`APES config ${name} must contain only non-empty strings.`);
  }
  const allowedProviders = new Set(['openrouter', 'openai', 'anthropic', 'gemini']);
  for (const provider of config.review.allowedExternalProviders) {
    if (!allowedProviders.has(provider)) throw new Error(`Unsupported external AI provider in APES config: ${provider}`);
  }
  if (!['off', 'optional', 'required'].includes(config.security.dependencyAudit)) throw new Error(`Invalid security.dependencyAudit mode: ${config.security.dependencyAudit}`);
  if (!['auto', 'openrouter', 'direct', 'gemini'].includes(config.review.routing.mode)) throw new Error(`Invalid review.routing.mode: ${config.review.routing.mode}`);
  const providerNames = new Set(['openrouter', 'openai', 'anthropic']);
  for (const tier of ['medium', 'strong', 'advanced']) {
    const list = config.review.routing.providerPreference[tier];
    if (!Array.isArray(list)) throw new Error(`review.routing.providerPreference.${tier} must be an array.`);
    for (const provider of list) {
      if (!providerNames.has(provider)) throw new Error(`Unsupported provider in review.routing.providerPreference.${tier}: ${provider}`);
    }
  }
  for (const provider of ['openrouter', 'openai', 'anthropic', 'gemini']) {
    const tiers = config.review.routing.modelCatalog[provider];
    for (const tier of ['medium', 'strong', 'advanced']) {
      if (!Array.isArray(tiers[tier]) || !tiers[tier].every((m) => typeof m === 'string' && m.trim())) {
        throw new Error(`review.routing.modelCatalog.${provider}.${tier} must contain only non-empty model ids.`);
      }
    }
  }
  const bounded = [
    ['context.maxContextChars', config.context.maxContextChars, 1000, 250000],
    ['context.maxPerFileChars', config.context.maxPerFileChars, 500, 100000],
    ['review.maxChunkChars', config.review.maxChunkChars, 5000, 120000],
    ['review.maxChunks', config.review.maxChunks, 1, 50],
    ['review.requestTimeoutMs', config.review.requestTimeoutMs, 5000, 300000],
    ['review.routing.geminiPool.cooldown429Ms', config.review.routing.geminiPool.cooldown429Ms, 1000, 3600000],
    ['review.routing.geminiPool.transientCooldownMs', config.review.routing.geminiPool.transientCooldownMs, 100, 300000],
    ['review.routing.geminiPool.maxRetriesPerCredential', config.review.routing.geminiPool.maxRetriesPerCredential, 0, 5],
    ['review.routing.geminiPool.backoffBaseMs', config.review.routing.geminiPool.backoffBaseMs, 50, 30000],
  ];
  for (const [name, value, min, max] of bounded) {
    if (!Number.isInteger(value) || value < min || value > max) throw new Error(`APES config ${name} must be an integer between ${min} and ${max}.`);
  }
  if (config.context.maxPerFileChars > config.context.maxContextChars) throw new Error('context.maxPerFileChars cannot exceed context.maxContextChars.');
}

function loadConfig(projectRoot, configPath = '.apes.json') {
  const full = path.resolve(projectRoot, configPath);
  let user = {};
  if (fs.existsSync(full)) {
    user = JSON.parse(fs.readFileSync(full, 'utf8'));
    validateConfigShape(user, DEFAULT_CONFIG);
  }
  const config = deepMerge(DEFAULT_CONFIG, user);
  validateConfigSemantics(config);
  return config;
}

function globToRegExp(glob) {
  const input = String(glob).replace(/\\/g, '/');
  let out = '^';
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (ch === '*') {
      const next = input[i + 1];
      if (next === '*') {
        const after = input[i + 2];
        if (after === '/') {
          out += '(?:.*/)?';
          i += 2;
        } else {
          out += '.*';
          i += 1;
        }
      } else {
        out += '[^/]*';
      }
    } else if (ch === '?') {
      out += '[^/]';
    } else {
      out += /[.+^${}()|[\]\\]/.test(ch) ? `\\${ch}` : ch;
    }
  }
  return new RegExp(out + '$', 'i');
}

function matchesAny(file, globs = []) {
  const normalized = file.replace(/\\/g, '/').replace(/^\.\//, '');
  return globs.some((g) => globToRegExp(g).test(normalized));
}

function parseUnifiedDiff(diffText) {
  const files = [];
  let current = null;
  let newLine = 0;
  let oldLine = 0;
  for (const line of String(diffText || '').split('\n')) {
    const diffMatch = line.match(/^diff --git a\/(.+) b\/(.+)$/);
    if (diffMatch) {
      current = { path: diffMatch[2], added: [], removed: [], raw: [line] };
      files.push(current);
      continue;
    }
    if (!current) continue;
    current.raw.push(line);
    const plusPath = line.match(/^\+\+\+ b\/(.+)$/);
    if (plusPath) current.path = plusPath[1];
    const hunk = line.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/);
    if (hunk) {
      const fullHunk = line.match(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/);
      oldLine = fullHunk ? Number(fullHunk[1]) : oldLine;
      newLine = Number(hunk[1]);
      continue;
    }
    if (line.startsWith('+') && !line.startsWith('+++')) {
      current.added.push({ line: newLine, text: line.slice(1) });
      newLine += 1;
    } else if (line.startsWith('-') && !line.startsWith('---')) {
      current.removed.push({ line: oldLine, text: line.slice(1) });
      oldLine += 1;
    } else {
      newLine += 1;
      oldLine += 1;
    }
  }
  return files;
}

function addedLineIndex(diffText) {
  const index = new Map();
  for (const f of parseUnifiedDiff(diffText)) {
    index.set(f.path, new Set(f.added.map((a) => a.line)));
  }
  return index;
}

function diffLineIndex(diffText) {
  const index = new Map();
  for (const f of parseUnifiedDiff(diffText)) {
    index.set(f.path, {
      RIGHT: new Set(f.added.map((a) => a.line)),
      LEFT: new Set((f.removed || []).map((r) => r.line)),
    });
  }
  return index;
}

function assertSafeProjectPath(projectRoot, relativePath) {
  if (!relativePath || path.isAbsolute(relativePath)) throw new Error(`Unsafe context path: ${relativePath}`);
  const root = path.resolve(projectRoot);
  const full = path.resolve(root, relativePath);
  if (!(full === root || full.startsWith(root + path.sep))) throw new Error(`Context path escapes project root: ${relativePath}`);
  const rel = path.relative(root, full).replace(/\\/g, '/');
  if (rel.startsWith('.git/') || rel === '.git') throw new Error(`Refusing to read .git context: ${relativePath}`);
  if (fs.existsSync(full)) {
    const stat = fs.lstatSync(full);
    if (stat.isSymbolicLink()) throw new Error(`Refusing to read symlinked project context: ${relativePath}`);
    const rootReal = fs.realpathSync(root);
    const fullReal = fs.realpathSync(full);
    if (!(fullReal === rootReal || fullReal.startsWith(rootReal + path.sep))) throw new Error(`Resolved context path escapes project root: ${relativePath}`);
  }
  return full;
}

function isProbablyText(buffer) {
  const sample = buffer.subarray(0, Math.min(buffer.length, 8000));
  return !sample.includes(0);
}

module.exports = {
  DEFAULT_CONFIG,
  loadConfig,
  validateConfigShape,
  validateConfigSemantics,
  matchesAny,
  parseUnifiedDiff,
  addedLineIndex,
  diffLineIndex,
  assertSafeProjectPath,
  isProbablyText,
};
