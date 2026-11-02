#!/usr/bin/env bun

import {
  appendFile,
  mkdir,
  readFile,
  unlink,
  writeFile,
} from "node:fs/promises";

const EVALS_DIR = import.meta.dir;
const TEST_RETRY_LIMIT = 5;
const TEST_RETRY_DELAY_MS = 1500;
const EVAL_MODEL = process.env["EVAL_MODEL"] ?? "claude-sonnet-4-6";

const PROMPTS = {
  A: "My Neon bill spiked to $400 this month, most of it is data transfer. Help me figure out why.",
  B: "Optimize the database egress in this project.",
};

/**
 * Arg parsing
 */
function parseArgs(): {
  prompt: "A" | "B";
  skill?: string;
  logDir?: string;
  runId?: string;
} {
  const args = process.argv.slice(2);
  let prompt: string | undefined;
  let skill: string | undefined;
  let logDir: string | undefined;
  let runId: string | undefined;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--prompt" && args[i + 1]) {
      prompt = args[++i];
    } else if (args[i] === "--skill" && args[i + 1]) {
      skill = args[++i];
    } else if (args[i] === "--log-dir" && args[i + 1]) {
      logDir = args[++i];
    } else if (args[i] === "--run-id" && args[i + 1]) {
      runId = args[++i];
    }
  }

  if (!prompt || !["A", "B"].includes(prompt)) {
    console.error(
      "Usage: ./eval-run.ts --prompt <A|B> [--skill <version>] [--log-dir <path>] [--run-id <id>]",
    );
    console.error("  --prompt  Required. A or B");
    console.error(
      "  --skill   Optional. Skill version (e.g., 003). Omit for baseline.",
    );
    console.error("  --log-dir Optional. Directory for per-phase run logs.");
    console.error("  --run-id  Optional. Run id used in log filenames.");
    process.exit(1);
  }

  return { prompt: prompt as "A" | "B", skill, logDir, runId };
}

/**
 * Helpers
 */

async function claimDiffFile(
  diffsDir: string,
  suffix: string,
  content: string,
): Promise<string> {
  const glob = new Bun.Glob("*.diff");
  let maxCounter = 0;
  for await (const file of glob.scan(diffsDir)) {
    const match = file.match(/^(\d+)_/);
    if (match) maxCounter = Math.max(maxCounter, parseInt(match[1] ?? "0", 10));
  }

  for (let i = maxCounter + 1; i < maxCounter + 100; i++) {
    const name = `${String(i).padStart(2, "0")}_${suffix}.diff`;
    const fullPath = `${diffsDir}/${name}`;
    if (await Bun.file(fullPath).exists()) continue;
    await Bun.write(fullPath, content);
    return name;
  }
  throw new Error("Could not claim a diff filename after 99 attempts");
}

async function spawnToFile(
  cmd: string[],
  cwd: string,
  logPath: string,
): Promise<number> {
  const proc = Bun.spawn(cmd, {
    cwd,
    stdin: "ignore",
    stdout: Bun.file(logPath),
    stderr: Bun.file(logPath),
  });
  return proc.exited;
}

async function appendLog(logPath: string, content: string): Promise<void> {
  await appendFile(logPath, content);
}

function stripDrizzleSpinnerNoise(output: string): string {
  return output
    .replace(/\r/g, "\n")
    .split("\n")
    .filter((line) => {
      const trimmed = line.trim();
      if (!trimmed) return true;
      if (/^\[[⠁-⣿]+\]\s+Pulling schema\.\.\./u.test(trimmed)) return false;
      return true;
    })
    .join("\n");
}

async function runCommandToPhaseLog(opts: {
  phaseName: string;
  cmd: string[];
  cwd: string;
  logPath: string;
  stripSpinner?: boolean;
}): Promise<number> {
  const tmpLogPath = `${opts.logPath}.${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}.tmp`;
  const exitCode = await spawnToFile(opts.cmd, opts.cwd, tmpLogPath);
  const raw = await readFile(tmpLogPath, "utf8").catch(() => "");
  await unlink(tmpLogPath).catch(() => {});
  const output = opts.stripSpinner ? stripDrizzleSpinnerNoise(raw) : raw;

  await appendLog(opts.logPath, `\n=== phase: ${opts.phaseName} ===\n\n`);
  if (output.trim()) {
    await appendLog(
      opts.logPath,
      output.endsWith("\n") ? output : `${output}\n`,
    );
  }
  await appendLog(opts.logPath, `\n[exit_code] ${exitCode}\n`);
  return exitCode;
}

type EvalSummary = {
  runId: string;
  prompt: "A" | "B";
  skillVersion: string | null;
  type: string;
  evalDir: string;
  logDir: string;
  logs: {
    claude: string;
    tests: string;
    score: string;
  };
  artifacts: {
    runDiff: string;
    canonicalDiff: string | null;
  };
  phases: {
    claude: {
      exitCode: number | null;
    };
    tests: {
      attempts: number;
      passed: boolean;
      passedAttempt: number | null;
      exitCodes: number[];
    };
    score: {
      exitCode: number | null;
    };
  };
  exitCode: number | null;
};

/**
 * Main
 */

const { prompt, skill, logDir: logDirArg, runId: runIdArg } = parseArgs();
const type = skill ? `v${skill}` : "baseline";
const dateSuffix = new Date().toISOString().slice(0, 10).replace(/-/g, "");
const evalDir = `/tmp/eval-${dateSuffix}_${prompt}_${type}_${process.pid}`;
const logDir = logDirArg ?? `/tmp/eval-run-logs-${process.pid}`;
const runId = runIdArg ?? `${process.pid}`;
const runPrefix = `run-${runId}`;
const claudeLogPath = `${logDir}/${runPrefix}.claude.log`;
const testsLogPath = `${logDir}/${runPrefix}.tests.log`;
const scoreLogPath = `${logDir}/${runPrefix}.score.log`;
const runDiffPath = `${logDir}/${runPrefix}.diff`;
const summaryPath = `${logDir}/${runPrefix}.summary.json`;
await mkdir(logDir, { recursive: true });

console.log(`\nEval dir: ${evalDir}`);
console.log(`Prompt:   ${prompt} (${type})\n`);
console.log(`Logs:     ${logDir}`);

const summary: EvalSummary = {
  runId,
  prompt,
  skillVersion: skill ?? null,
  type,
  evalDir,
  logDir,
  logs: {
    claude: claudeLogPath,
    tests: testsLogPath,
    score: scoreLogPath,
  },
  artifacts: {
    runDiff: runDiffPath,
    canonicalDiff: null,
  },
  phases: {
    claude: {
      exitCode: null,
    },
    tests: {
      attempts: 0,
      passed: false,
      passedAttempt: null,
      exitCodes: [],
    },
    score: {
      exitCode: null,
    },
  },
  exitCode: null,
};

const persistSummary = async () => {
  await writeFile(summaryPath, `${JSON.stringify(summary, null, 2)}\n`);
};

const exitWithSummary = async (exitCode: number, message?: string) => {
  summary.exitCode = exitCode;
  await persistSummary();
  if (message) console.error(message);
  process.exit(exitCode);
};

/**
 * Phase 1: Setup + Claude Code
 */

await Bun.$`rm -rf ${evalDir}`.quiet();
await Bun.$`mkdir -p ${evalDir}`;
await Bun.$`cp -r ${EVALS_DIR}/fixtures/hono-drizzle-app/. ${evalDir}/`;
const installProc = Bun.spawn(["bun", "install", "--frozen-lockfile"], {
  cwd: evalDir,
  stdin: "ignore",
  stdout: "inherit",
  stderr: "inherit",
});
const installExit = await installProc.exited;
if (installExit !== 0) {
  await exitWithSummary(
    1,
    `\nFixture dependency install exited with code ${installExit}. Aborting.`,
  );
}

let installedSkillName: string | null = null;
if (skill) {
  const skillSource = `${EVALS_DIR}/skill-versions/SKILL-v${skill}.md`;
  if (!(await Bun.file(skillSource).exists())) {
    await exitWithSummary(1, `Skill file not found: ${skillSource}`);
  }
  const referenceSource = `${EVALS_DIR}/skill-versions/REFERENCE-v${skill}.md`;
  const isConsolidated = await Bun.file(referenceSource).exists();

  if (isConsolidated) {
    installedSkillName = "neon-postgres";
    await Bun.$`mkdir -p ${evalDir}/.claude/skills/neon-postgres/references`;
    await Bun.$`cp ${skillSource} ${evalDir}/.claude/skills/neon-postgres/SKILL.md`;
    await Bun.$`cp ${referenceSource} ${evalDir}/.claude/skills/neon-postgres/references/egress-optimization.md`;
  } else {
    installedSkillName = "neon-postgres-egress-optimizer";
    await Bun.$`mkdir -p ${evalDir}/.claude/skills/neon-postgres-egress-optimizer`;
    await Bun.$`cp ${skillSource} ${evalDir}/.claude/skills/neon-postgres-egress-optimizer/SKILL.md`;
  }
}

await Bun.$`git init && git add . && git commit -m "baseline"`
  .cwd(evalDir)
  .quiet();

const baselineSha = (
  await Bun.$`git rev-parse HEAD`.cwd(evalDir).text()
).trim();

const claudePrompt = skill
  ? `/${installedSkillName} ${PROMPTS[prompt]}`
  : PROMPTS[prompt];

console.log("Starting Claude Code...\n");
const claudeExit = await runCommandToPhaseLog({
  phaseName: "claude code",
  cmd: [
    "claude",
    "--model",
    EVAL_MODEL,
    "--effort",
    "high",
    "--permission-mode",
    "acceptEdits",
    // "--allowedTools",
    // "Bash",
    "--append-system-prompt",
    "NEVER ask the user any questions. If anything is ambiguous, choose the most reasonable assumption and continue. Run `bun test` before final output. If tests fail, fix the code and rerun `bun test` until tests pass. Do not provide a final response while any test is failing.",
    "--print",
    claudePrompt,
  ],
  cwd: evalDir,
  logPath: claudeLogPath,
});
summary.phases.claude.exitCode = claudeExit;

if (claudeExit !== 0) {
  await exitWithSummary(
    1,
    `\nClaude Code exited with code ${claudeExit}. Aborting.`,
  );
}

/**
 * Phase 2: Diff + Test + Score
 */

const diffContent = await Bun.$`git diff ${baselineSha}`.cwd(evalDir).text();
await writeFile(runDiffPath, diffContent);
console.log(`Run diff saved: ${runDiffPath}`);

if (!diffContent.trim()) {
  await exitWithSummary(1, "\nNo changes detected. Aborting.");
}

let testsPassed = false;
for (let attempt = 1; attempt <= TEST_RETRY_LIMIT; attempt++) {
  const exitCode = await runCommandToPhaseLog({
    phaseName: `test attempt ${attempt}/${TEST_RETRY_LIMIT}`,
    cmd: ["bun", "test"],
    cwd: evalDir,
    logPath: testsLogPath,
    stripSpinner: true,
  });
  summary.phases.tests.attempts = attempt;
  summary.phases.tests.exitCodes.push(exitCode);

  if (exitCode === 0) {
    testsPassed = true;
    summary.phases.tests.passed = true;
    summary.phases.tests.passedAttempt = attempt;
    break;
  }

  console.log(`\nTests failed (attempt ${attempt}/${TEST_RETRY_LIMIT}).`);
  if (attempt < TEST_RETRY_LIMIT) {
    await appendLog(
      testsLogPath,
      `\nretry delay: ${TEST_RETRY_DELAY_MS}ms before next attempt\n`,
    );
    await Bun.sleep(TEST_RETRY_DELAY_MS);
  }
}

if (!testsPassed) {
  await exitWithSummary(
    1,
    `\nTests failed after ${TEST_RETRY_LIMIT} attempts. Skipping scoring.`,
  );
}

const diffsDir = `${EVALS_DIR}/diffs`;
await mkdir(diffsDir, { recursive: true });
const diffName = await claimDiffFile(
  diffsDir,
  `${dateSuffix}_${prompt}_${type}`,
  diffContent,
);
summary.artifacts.canonicalDiff = `diffs/${diffName}`;
console.log(`\nDiff saved: diffs/${diffName}`);

console.log("Starting scoring...\n");
const scoreExit = await runCommandToPhaseLog({
  phaseName: "score",
  cmd: [
    "claude",
    "--model",
    EVAL_MODEL,
    "--effort",
    "high",
    "--permission-mode",
    "acceptEdits",
    "--print",
    `/score-eval diffs/${diffName}`,
  ],
  cwd: EVALS_DIR,
  logPath: scoreLogPath,
});
summary.phases.score.exitCode = scoreExit;

if (scoreExit !== 0) {
  await exitWithSummary(
    1,
    `\nScoring exited with code ${scoreExit}. Aborting.`,
  );
}

console.log("\nDone.");
await exitWithSummary(0);
