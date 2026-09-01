#!/usr/bin/env bun

const EVALS_DIR = import.meta.dir;
const EVAL_RUN = `${EVALS_DIR}/eval-run.ts`;

/**
 * Arg parsing
 */
function parseArgs(): { prompt: string; skill?: string; count: number } {
  const args = process.argv.slice(2);
  let prompt: string | undefined;
  let skill: string | undefined;
  let count: string | undefined;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--prompt" && args[i + 1]) {
      prompt = args[++i];
    } else if (args[i] === "--skill" && args[i + 1]) {
      skill = args[++i];
    } else if (args[i] === "--count" && args[i + 1]) {
      count = args[++i];
    }
  }

  const n = parseInt(count ?? "", 10);
  if (!prompt || !["A", "B"].includes(prompt) || !count || isNaN(n) || n < 1) {
    console.error(
      "Usage: ./eval-batch.ts --prompt <A|B> --count <N> [--skill <version>]",
    );
    console.error("  --prompt  Required. A or B");
    console.error("  --count   Required. Number of parallel runs");
    console.error(
      "  --skill   Optional. Skill version (e.g., 003). Omit for baseline.",
    );
    process.exit(1);
  }

  return { prompt, skill, count: n };
}

/**
 * Main
 */

const { prompt, skill, count } = parseArgs();
const logDir = `/tmp/eval-batch-${process.pid}`;
await Bun.$`mkdir -p ${logDir}`.quiet();

const childArgs = ["--prompt", prompt];
if (skill) childArgs.push("--skill", skill);

console.log(`Launching ${count} parallel eval runs...`);
console.log(`Logs: ${logDir}/\n`);

const children = Array.from({ length: count }, (_, i) => {
  const runId = `${i + 1}`;
  const mainLogPath = `${logDir}/run-${runId}.main.log`;
  const summaryPath = `${logDir}/run-${runId}.summary.json`;
  const logFile = Bun.file(mainLogPath);
  const proc = Bun.spawn(
    ["bun", EVAL_RUN, ...childArgs, "--log-dir", logDir, "--run-id", runId],
    {
      stdout: logFile,
      stderr: logFile,
      stdin: "ignore",
    },
  );
  return proc.exited.then((code) => ({
    index: i + 1,
    code,
    summaryPath,
    mainLogPath,
  }));
});

type RunSummary = {
  phases?: {
    claude?: { exitCode?: number | null };
    tests?: {
      attempts?: number;
      passed?: boolean;
      passedAttempt?: number | null;
    };
    score?: { exitCode?: number | null };
  };
  artifacts?: {
    runDiff?: string;
  };
};

async function readSummary(path: string): Promise<RunSummary | null> {
  try {
    const text = await Bun.file(path).text();
    return JSON.parse(text) as RunSummary;
  } catch {
    return null;
  }
}

const results = await Promise.all(children);
const summaries = await Promise.all(
  results.map((r) => readSummary(r.summaryPath)),
);

const passed = results.filter((r) => r.code === 0);
const failed = results.filter((r) => r.code !== 0);

console.log(`\n--- summary ---`);
console.log(`Passed: ${passed.length}/${count}`);
console.log(`Failed: ${failed.length}/${count}`);
console.log("\nRun details:");

for (const result of results) {
  const summary = summaries[result.index - 1];
  if (!summary?.phases) {
    console.log(
      `  run ${result.index}: exit ${result.code} | summary missing (${result.summaryPath})`,
    );
    console.log(`    main log: ${result.mainLogPath}`);
    continue;
  }

  const claudeExit = summary.phases.claude?.exitCode;
  const tests = summary.phases.tests;
  const scoreExit = summary.phases.score?.exitCode;
  const testsStatus = tests?.passed
    ? `pass (attempt ${tests.passedAttempt ?? tests.attempts ?? "?"})`
    : `fail (${tests?.attempts ?? "?"} attempts)`;
  const scoreStatus =
    scoreExit === null || scoreExit === undefined
      ? "skipped"
      : scoreExit === 0
        ? "ok"
        : `fail (${scoreExit})`;

  console.log(
    `  run ${result.index}: exit ${result.code} | claude ${claudeExit === 0 ? "ok" : `fail (${claudeExit ?? "?"})`} | tests ${testsStatus} | score ${scoreStatus}`,
  );

  if (result.code !== 0) {
    const runDiff = summary.artifacts?.runDiff;
    if (runDiff) console.log(`    run diff: ${runDiff}`);
    console.log(`    summary:  ${result.summaryPath}`);
    console.log(`    main log: ${result.mainLogPath}`);
  }
}

process.exit(failed.length > 0 ? 1 : 0);
