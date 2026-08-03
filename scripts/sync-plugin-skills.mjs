#!/usr/bin/env node

// Vendors real copies of the mapped skills from the top-level `skills/`
// (the source of truth) into each plugin's `skills/` directory. Plugins are
// distributed as git repositories, and consumers (Cursor, Claude) reject or
// ignore symlinks that escape the plugin root, so the copies must be real
// files committed to the repo.
//
// Usage:
//   node scripts/sync-plugin-skills.mjs           # write copies
//   node scripts/sync-plugin-skills.mjs --check    # verify copies, no writes

import { promises as fs } from "node:fs";
import path from "node:path";
import process from "node:process";

// Which skills each plugin vendors, keyed by plugin directory name under
// plugins/. "*" vendors every skill under skills/ (new skills ship
// automatically); an array vendors only the named skill directories, e.g.
// ["neon", "neon-postgres"].
const PLUGIN_SKILLS = {
  "neon-postgres": "*",
};

const repoRoot = process.cwd();
const skillsRoot = path.join(repoRoot, "skills");
const pluginsRoot = path.join(repoRoot, "plugins");

const checkMode = process.argv.includes("--check");
const problems = [];

function fail(message) {
  problems.push(message);
}

function readMapping() {
  for (const [plugin, skills] of Object.entries(PLUGIN_SKILLS)) {
    const valid =
      skills === "*" ||
      (Array.isArray(skills) &&
        skills.every((skill) => typeof skill === "string"));
    if (!valid) {
      throw new Error(
        `PLUGIN_SKILLS entry for "${plugin}" must be an array of skill names or "*" (all skills).`,
      );
    }
  }
  return PLUGIN_SKILLS;
}

// Resolves a mapping value to a concrete, sorted list of skill directory
// names. "*" auto-discovers every skill under skills/ so new skills ship
// without editing the mapping.
async function resolveSkills(value) {
  if (value !== "*") {
    return value;
  }
  const entries = await fs.readdir(skillsRoot, { withFileTypes: true });
  const skills = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }
    if (await pathExists(path.join(skillsRoot, entry.name, "SKILL.md"))) {
      skills.push(entry.name);
    }
  }
  return skills.sort();
}

async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

// Recursively lists files relative to `root`, following the entry types on
// disk. Errors on any symlink so vendored copies never contain links.
async function walkRelativeFiles(root, { rejectSymlinks = false } = {}) {
  const files = [];
  const stack = [""];
  while (stack.length > 0) {
    const relDir = stack.pop();
    const absDir = path.join(root, relDir);
    const entries = await fs.readdir(absDir, { withFileTypes: true });
    for (const entry of entries) {
      const relPath = relDir ? path.join(relDir, entry.name) : entry.name;
      if (entry.isSymbolicLink()) {
        if (rejectSymlinks) {
          fail(
            `Symlink found in vendored skills (must be a real file): ${path.join(
              path.relative(repoRoot, root),
              relPath,
            )}`,
          );
        }
        continue;
      }
      if (entry.isDirectory()) {
        stack.push(relPath);
      } else if (entry.isFile()) {
        files.push(relPath);
      }
    }
  }
  return files.sort();
}

async function copySkill(srcDir, destDir) {
  await fs.rm(destDir, { recursive: true, force: true });
  await fs.mkdir(path.dirname(destDir), { recursive: true });
  await fs.cp(srcDir, destDir, { recursive: true, dereference: true });
}

// Compares the source skill tree against the vendored copy. Reports missing
// files, extra files, and content mismatches.
async function compareSkill(srcDir, destDir, label) {
  if (!(await pathExists(destDir))) {
    fail(`Missing vendored skill: ${label} (run "npm run sync:plugins")`);
    return;
  }
  const srcFiles = await walkRelativeFiles(srcDir);
  const destFiles = await walkRelativeFiles(destDir, { rejectSymlinks: true });
  const srcSet = new Set(srcFiles);
  const destSet = new Set(destFiles);
  for (const file of srcFiles) {
    if (!destSet.has(file)) {
      fail(`${label}: missing file in vendored copy: ${file}`);
    }
  }
  for (const file of destFiles) {
    if (!srcSet.has(file)) {
      fail(`${label}: stale file in vendored copy: ${file}`);
    }
  }
  for (const file of srcFiles) {
    if (!destSet.has(file)) {
      continue;
    }
    const [srcContent, destContent] = await Promise.all([
      fs.readFile(path.join(srcDir, file)),
      fs.readFile(path.join(destDir, file)),
    ]);
    if (!srcContent.equals(destContent)) {
      fail(`${label}: content differs from source: ${file}`);
    }
  }
}

async function main() {
  const mapping = readMapping();

  for (const [plugin, mappedValue] of Object.entries(mapping)) {
    const skills = await resolveSkills(mappedValue);
    const pluginSkillsDir = path.join(pluginsRoot, plugin, "skills");

    for (const skill of skills) {
      const srcDir = path.join(skillsRoot, skill);
      if (!(await pathExists(srcDir))) {
        fail(
          `Plugin "${plugin}" maps unknown skill "${skill}" (missing skills/${skill}).`,
        );
      }
    }

    if (checkMode) {
      // Reject unmapped directories left behind in the vendored skills dir.
      if (await pathExists(pluginSkillsDir)) {
        const entries = await fs.readdir(pluginSkillsDir, {
          withFileTypes: true,
        });
        const mapped = new Set(skills);
        for (const entry of entries) {
          if (entry.isSymbolicLink()) {
            fail(
              `Symlink found in vendored skills (must be a real directory): plugins/${plugin}/skills/${entry.name}`,
            );
            continue;
          }
          if (entry.isDirectory() && !mapped.has(entry.name)) {
            fail(
              `Unmapped skill directory in plugins/${plugin}/skills/: ${entry.name} (not in PLUGIN_SKILLS in scripts/sync-plugin-skills.mjs)`,
            );
          }
        }
      }
      for (const skill of skills) {
        await compareSkill(
          path.join(skillsRoot, skill),
          path.join(pluginSkillsDir, skill),
          `plugins/${plugin}/skills/${skill}`,
        );
      }
    } else {
      // Rebuild the vendored skills dir from scratch so removed/renamed skills
      // do not linger.
      await fs.rm(pluginSkillsDir, { recursive: true, force: true });
      await fs.mkdir(pluginSkillsDir, { recursive: true });
      for (const skill of skills) {
        await copySkill(
          path.join(skillsRoot, skill),
          path.join(pluginSkillsDir, skill),
        );
        process.stderr.write(
          `Synced skills/${skill} -> plugins/${plugin}/skills/${skill}\n`,
        );
      }
    }
  }

  if (problems.length > 0) {
    process.stderr.write(
      checkMode
        ? "Plugin skills are out of sync:\n"
        : "Plugin skills sync failed:\n",
    );
    for (const problem of problems) {
      process.stderr.write(`- ${problem}\n`);
    }
    process.exit(1);
  }

  process.stderr.write(
    checkMode ? "Plugin skills are in sync.\n" : "Plugin skills synced.\n",
  );
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exit(1);
});
