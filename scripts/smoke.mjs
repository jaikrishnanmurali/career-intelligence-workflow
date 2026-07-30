process.env.ATS_BOARDS_PER_SOURCE ||= '5';
process.env.MAX_SCAN_MINUTES ||= '2';
process.env.MAX_PAGE_VERIFICATIONS ||= '5';

const { run } = await import('../src/run.mjs');
const { report } = await run({ dryRun: true, send: false });

process.stdout.write(
  `Smoke scan complete: ${report.jobsScanned} jobs checked, ${report.recommendations.length} recommendations, 0 model tokens. No email sent.\n`,
);
