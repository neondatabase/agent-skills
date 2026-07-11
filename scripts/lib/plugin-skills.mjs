import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

/** Plugin skill bundles: source of truth is skills/<name>. */
export const PLUGIN_SKILL_BUNDLES = [
  {
    pluginDir: "plugins/neon-postgres",
    skills: ["neon", "neon-postgres", "neon-postgres-branches"],
  },
];

async function walkEntries(rootDir) {
  const entries = [];
  const stack = [rootDir];
  while (stack.length > 0) {
    const current = stack.pop();
    const children = await fs.readdir(current, { withFileTypes: true });
    for (const child of children) {
      const childPath = path.join(current, child.name);
      if (child.isSymbolicLink()) {
        entries.push({
          relativePath: path.relative(rootDir, childPath),
          type: "symlink",
        });
        continue;
      }
      if (child.isDirectory()) {
        stack.push(childPath);
        continue;
      }
      if (child.isFile()) {
        const content = await fs.readFile(childPath);
        entries.push({
          relativePath: path.relative(rootDir, childPath),
          type: "file",
          content,
        });
      }
    }
  }
  return entries.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
}

function hashContent(content) {
  return createHash("sha256").update(content).digest("hex");
}

export async function syncPluginSkills(repoRoot) {
  for (const bundle of PLUGIN_SKILL_BUNDLES) {
    const pluginSkillsDir = path.join(repoRoot, bundle.pluginDir, "skills");
    await fs.mkdir(pluginSkillsDir, { recursive: true });

    const existing = await fs.readdir(pluginSkillsDir, { withFileTypes: true });
    const expected = new Set(bundle.skills);
    for (const entry of existing) {
      if (!expected.has(entry.name)) {
        await fs.rm(path.join(pluginSkillsDir, entry.name), {
          recursive: true,
          force: true,
        });
      }
    }

    for (const skillName of bundle.skills) {
      const sourceDir = path.join(repoRoot, "skills", skillName);
      const destDir = path.join(pluginSkillsDir, skillName);
      await fs.rm(destDir, { recursive: true, force: true });
      await fs.cp(sourceDir, destDir, { recursive: true });
    }
  }
}

export async function validatePluginSkills(repoRoot) {
  const errors = [];

  for (const bundle of PLUGIN_SKILL_BUNDLES) {
    const pluginSkillsDir = path.join(repoRoot, bundle.pluginDir, "skills");

    let pluginEntries;
    try {
      pluginEntries = await fs.readdir(pluginSkillsDir, { withFileTypes: true });
    } catch {
      errors.push(
        `${bundle.pluginDir}: skills directory is missing (${pluginSkillsDir}). Run npm run sync:plugin-skills.`,
      );
      continue;
    }

    const onDisk = new Set(
      pluginEntries
        .filter((entry) => entry.isDirectory() || entry.isSymbolicLink())
        .map((entry) => entry.name),
    );
    const expected = new Set(bundle.skills);

    for (const skillName of bundle.skills) {
      const destDir = path.join(pluginSkillsDir, skillName);
      const sourceDir = path.join(repoRoot, "skills", skillName);

      let destStat;
      try {
        destStat = await fs.lstat(destDir);
      } catch {
        errors.push(
          `${bundle.pluginDir}: missing bundled skill "${skillName}". Run npm run sync:plugin-skills.`,
        );
        continue;
      }

      if (destStat.isSymbolicLink()) {
        errors.push(
          `${bundle.pluginDir}/skills/${skillName} is a symlink. Plugin checkouts must ship real skill files. Run npm run sync:plugin-skills.`,
        );
        continue;
      }

      if (!destStat.isDirectory()) {
        errors.push(
          `${bundle.pluginDir}/skills/${skillName} must be a directory.`,
        );
        continue;
      }

      let sourceStat;
      try {
        sourceStat = await fs.stat(sourceDir);
      } catch {
        errors.push(`skills/${skillName} is missing but required by ${bundle.pluginDir}.`);
        continue;
      }
      if (!sourceStat.isDirectory()) {
        errors.push(`skills/${skillName} must be a directory.`);
        continue;
      }

      const [sourceEntries, destEntries] = await Promise.all([
        walkEntries(sourceDir),
        walkEntries(destDir),
      ]);

      const destSymlinks = destEntries.filter((entry) => entry.type === "symlink");
      if (destSymlinks.length > 0) {
        for (const entry of destSymlinks) {
          errors.push(
            `${bundle.pluginDir}/skills/${skillName}/${entry.relativePath} is a symlink. Run npm run sync:plugin-skills.`,
          );
        }
        continue;
      }

      const sourceFiles = sourceEntries.filter((entry) => entry.type === "file");
      const destFiles = destEntries.filter((entry) => entry.type === "file");
      const sourceMap = new Map(
        sourceFiles.map((entry) => [entry.relativePath, entry.content]),
      );
      const destMap = new Map(
        destFiles.map((entry) => [entry.relativePath, entry.content]),
      );

      for (const [relativePath, content] of sourceMap) {
        if (!destMap.has(relativePath)) {
          errors.push(
            `${bundle.pluginDir}/skills/${skillName} is missing ${relativePath}. Run npm run sync:plugin-skills.`,
          );
          continue;
        }
        if (hashContent(content) !== hashContent(destMap.get(relativePath))) {
          errors.push(
            `${bundle.pluginDir}/skills/${skillName}/${relativePath} is out of sync with skills/${skillName}/${relativePath}. Run npm run sync:plugin-skills.`,
          );
        }
      }

      for (const relativePath of destMap.keys()) {
        if (!sourceMap.has(relativePath)) {
          errors.push(
            `${bundle.pluginDir}/skills/${skillName}/${relativePath} is not present in skills/${skillName}. Run npm run sync:plugin-skills.`,
          );
        }
      }
    }

    for (const skillName of onDisk) {
      if (!expected.has(skillName)) {
        errors.push(
          `${bundle.pluginDir}/skills/${skillName} is not bundled. Remove it or add it to PLUGIN_SKILL_BUNDLES.`,
        );
      }
    }
  }

  return errors;
}
