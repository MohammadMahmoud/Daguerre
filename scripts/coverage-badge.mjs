// Turns coverage/coverage-summary.json into a shields.io endpoint badge and a CI job summary.
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';

const { total } = JSON.parse(
  readFileSync('coverage/coverage-summary.json', 'utf8'),
);
const pct = total.statements.pct;
const color =
  pct >= 90
    ? 'brightgreen'
    : pct >= 80
      ? 'green'
      : pct >= 70
        ? 'yellow'
        : 'red';
writeFileSync(
  'coverage/badge.json',
  JSON.stringify({
    schemaVersion: 1,
    label: 'coverage',
    message: `${Math.floor(pct)}%`,
    color,
  }),
);

const rows = ['statements', 'branches', 'functions', 'lines']
  .map(
    (k) =>
      `| ${k} | ${total[k].pct}% | ${total[k].covered} / ${total[k].total} |`,
  )
  .join('\n');
const summary = `### Test coverage: ${pct}%\n\n| Metric | Coverage | Covered |\n|---|---|---|\n${rows}\n`;
if (process.env.GITHUB_STEP_SUMMARY)
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);
console.log(summary);
