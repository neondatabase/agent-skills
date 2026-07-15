#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import process from "node:process";

const repoRoot = process.cwd();
const skillsRoot = path.join(repoRoot, "skills");
const skillsRefBin = path.join(repoRoot, "node_modules", ".bin", "skills-ref");

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

  for (const skillDir of skillDirs) {
    const result = spawnSync(skillsRefBin, ["validate", skillDir], {
      stdio: "inherit",
    });

    if (result.status !== 0) {
      process.exit(result.status ?? 1);
    }
  }
}

await main();
