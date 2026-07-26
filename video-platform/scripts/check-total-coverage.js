const fs = require('node:fs');
const path = require('node:path');

const MIN_COVERAGE = Number.parseFloat(process.env.MIN_COVERAGE || '90');

const summaryPaths = [
  path.join(__dirname, '..', 'services', 'api-gateway', 'coverage', 'coverage-summary.json'),
  path.join(__dirname, '..', 'services', 'processing-worker', 'coverage', 'coverage-summary.json'),
  path.join(__dirname, '..', 'services', 'notification-service', 'coverage', 'coverage-summary.json'),
];

function readJson(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(content);
}

function collectTotals(paths) {
  const totals = {
    lines: { total: 0, covered: 0 },
    statements: { total: 0, covered: 0 },
    functions: { total: 0, covered: 0 },
    branches: { total: 0, covered: 0 },
  };

  for (const summaryPath of paths) {
    if (!fs.existsSync(summaryPath)) {
      throw new Error(`Coverage summary not found: ${summaryPath}`);
    }

    const report = readJson(summaryPath);
    const total = report.total;

    totals.lines.total += total.lines.total;
    totals.lines.covered += total.lines.covered;

    totals.statements.total += total.statements.total;
    totals.statements.covered += total.statements.covered;

    totals.functions.total += total.functions.total;
    totals.functions.covered += total.functions.covered;

    totals.branches.total += total.branches.total;
    totals.branches.covered += total.branches.covered;
  }

  return totals;
}

function pct(covered, total) {
  if (!total) return 100;
  return (covered / total) * 100;
}

function printMetric(name, covered, total) {
  const value = pct(covered, total);
  console.log(`${name}: ${value.toFixed(2)}% (${covered}/${total})`);
  return value;
}

const totals = collectTotals(summaryPaths);

console.log('Aggregated project coverage (video-platform):');
const linesPct = printMetric('Lines', totals.lines.covered, totals.lines.total);
printMetric('Statements', totals.statements.covered, totals.statements.total);
printMetric('Functions', totals.functions.covered, totals.functions.total);
printMetric('Branches', totals.branches.covered, totals.branches.total);

if (linesPct < MIN_COVERAGE) {
  console.error(`Coverage gate failed: lines ${linesPct.toFixed(2)}% is below ${MIN_COVERAGE}%`);
  process.exit(1);
}

console.log(`Coverage gate passed: lines ${linesPct.toFixed(2)}% >= ${MIN_COVERAGE}%`);
