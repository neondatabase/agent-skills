#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import process from "node:process";

const repoRoot = process.cwd();
const skillsRoot = path.join(repoRoot, "skills");
const skillsRefBin = path.join(repoRoot, "node_modules", ".bin", "skills-ref");

// Antigravity reads only the first 24,000 bytes of a SKILL.md body (the text
// after the YAML frontmatter) and truncates the rest. Keep every body under
// this limit by moving detail into references/*.md files.
const MAX_BODY_BYTES = 24_000;

// --size-only skips skills-ref, so the pre-commit hook can run the size check
// quickly.
const sizeOnly = process.argv.includes("--size-only");

async function checkBodySize(skillDir) {
  const text = await fs.readFile(path.join(repoRoot, skillDir, "SKILL.md"), "utf8");
  const match = text.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n/);
  const body = match ? text.slice(match[0].length) : text;
  const bytes = Buffer.byteLength(body, "utf8");
  if (bytes > MAX_BODY_BYTES) {
    console.error(
      `${skillDir}/SKILL.md body is ${bytes} bytes, over the ${MAX_BODY_BYTES}-byte limit. Move detail into references/*.md files.`,
    );
    return false;
  }
  return true;
}

async function main() {
  let entries;
  try {
    entries = await fs.readdir(skillsRoot, { withFileTypes: true });
  } catch (error) {
    console.error(`Failed to read skills directory: ${error.message}`);
    process.exit(1);
  }

  const skillDirs = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join("skills", entry.name))
    .sort((a, b) => a.localeCompare(b));

  if (skillDirs.length === 0) {
    console.error("No skill directories found under ./skills");
    process.exit(1);
  }

  let oversized = false;
  for (const skillDir of skillDirs) {
    if (!(await checkBodySize(skillDir))) {
      oversized = true;
    }
  }
  if (oversized) {
    process.exit(1);
  }
  if (sizeOnly) {
    return;
  }

  for (const skillDir of skillDirs) {
    console.log(`Validating ${skillDir}`);
    const result = spawnSync(skillsRefBin, ["validate", skillDir], {
      stdio: "inherit",
    });

    if (result.status !== 0) {
      process.exit(result.status ?? 1);
    }
  }
}

await main();
