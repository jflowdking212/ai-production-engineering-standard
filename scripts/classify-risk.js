#!/usr/bin/env node
const fs = require('fs');
const { DEFAULT_CONFIG, loadConfig, matchesAny, parseUnifiedDiff } = require('./lib');

const DESTRUCTIVE_RULES = [
  /\.(?:delete|deleteMany|destroy|truncate)\s*\(/i,
  /\b(?:DELETE\s+FROM|DROP\s+(?:TABLE|DATABASE|SCHEMA)|TRUNCATE\s+TABLE)\b/i,
  /\$(?:executeRawUnsafe|queryRawUnsafe)\s*\(/i,
];
const HIGH_CONTENT_RULES = [
  /\b(?:authoriz(?:e|ation)\w*|permission\w*|rbac|role\w*|tenantId|workspaceId|organisationId|organizationId)\b/i,
  /\b(?:subscription|entitlement|webhook|billing|payment)\b/i,
];

function classify({ files, diffText = '', config }) {
  const reasons = [];
  let risk = 'LOW';
  const uniqueFiles = [...new Set(files.filter(Boolean))];

  const criticalPaths = [...DEFAULT_CONFIG.risk.criticalPaths, ...(config.risk.additionalCriticalPaths || [])];
  const highPaths = [...DEFAULT_CONFIG.risk.highPaths, ...(config.risk.additionalHighPaths || [])];
  const lowPaths = [...DEFAULT_CONFIG.risk.lowPaths, ...(config.risk.additionalLowPaths || [])];

  const criticalPathHits = uniqueFiles.filter((f) => matchesAny(f, criticalPaths));
  if (criticalPathHits.length) {
    risk = 'CRITICAL';
    reasons.push(...criticalPathHits.map((f) => `critical path touched: ${f}`));
  }

  if (risk !== 'CRITICAL') {
    const highHits = uniqueFiles.filter((f) => matchesAny(f, highPaths));
    if (highHits.length) {
      risk = 'HIGH';
      reasons.push(...highHits.map((f) => `high-risk path touched: ${f}`));
    }
  }

  const parsed = parseUnifiedDiff(diffText);
  for (const fileDiff of parsed) {
    const lowOnlyFile = matchesAny(fileDiff.path, lowPaths);
    if (lowOnlyFile) continue;
    for (const added of fileDiff.added) {
      if (DESTRUCTIVE_RULES.some((re) => re.test(added.text))) {
        risk = 'CRITICAL';
        reasons.push(`destructive operation added: ${fileDiff.path}:${added.line}`);
      } else if (risk !== 'CRITICAL' && HIGH_CONTENT_RULES.some((re) => re.test(added.text))) {
        risk = 'HIGH';
        reasons.push(`sensitive authorization/tenant/financial logic added: ${fileDiff.path}:${added.line}`);
      }
    }
    if (risk !== 'CRITICAL') {
      for (const removed of fileDiff.removed || []) {
        if (HIGH_CONTENT_RULES.some((re) => re.test(removed.text))) {
          risk = 'HIGH';
          reasons.push(`sensitive authorization/tenant/financial logic removed: ${fileDiff.path}:${removed.line}`);
        }
      }
    }
  }

  if (risk === 'LOW') {
    const allLow = uniqueFiles.length > 0 && uniqueFiles.every((f) => matchesAny(f, lowPaths));
    if (!allLow) {
      risk = 'MEDIUM';
      reasons.push('non-trivial code change outside configured low-risk paths');
    } else if (!reasons.length) {
      reasons.push('all changed files match configured low-risk paths');
    }
  }

  const modelTier = risk === 'CRITICAL' ? 'advanced' : risk === 'HIGH' ? 'strong' : risk === 'MEDIUM' ? 'medium' : 'skip';
  const requiredMachineChecks = ['deterministic-checks', 'security-scan'];
  if (risk !== 'LOW') requiredMachineChecks.push('ai-review');
  const humanApprovalRequired = risk === 'CRITICAL' || risk === 'HIGH';

  return { risk, reasons: [...new Set(reasons)], requiredMachineChecks, humanApprovalRequired, modelTier };
}

function main() {
  const projectRoot = process.env.PROJECT_ROOT || process.cwd();
  const config = loadConfig(projectRoot, process.env.APES_CONFIG_PATH || '.apes.json');
  const rawFiles = process.env.CHANGED_FILES || (process.env.CHANGED_FILES_FILE && fs.existsSync(process.env.CHANGED_FILES_FILE) ? fs.readFileSync(process.env.CHANGED_FILES_FILE, 'utf8') : '');
  const files = rawFiles.split('\n').map((s) => s.trim()).filter(Boolean);
  const diffText = process.env.DIFF_TEXT_PATH && fs.existsSync(process.env.DIFF_TEXT_PATH) ? fs.readFileSync(process.env.DIFF_TEXT_PATH, 'utf8') : '';
  if (!files.length) throw new Error('No changed files supplied to deterministic risk classifier.');

  const result = classify({ files, diffText, config });
  console.log(JSON.stringify(result, null, 2));
  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `risk=${result.risk}\nmodel_tier=${result.modelTier}\nhuman_approval_required=${result.humanApprovalRequired}\n`);
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `reasons<<EOF\n${result.reasons.join('\n')}\nEOF\n`);
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `required_machine_checks<<EOF\n${result.requiredMachineChecks.join('\n')}\nEOF\n`);
  }
}

if (require.main === module) {
  try { main(); } catch (err) { console.error(err.stack || err.message); process.exit(1); }
}
module.exports = { classify, DESTRUCTIVE_RULES, HIGH_CONTENT_RULES };
