#!/usr/bin/env node

import { promises as fs } from "node:fs";
import path from "node:path";
import process from "node:process";

const repoRoot = process.cwd();
const manifestPath = ".antigravity-plugin/plugin.json";
const problems = [];
const warnings = [];
const semverPattern =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;

function fail(message) {
  problems.push(message);
}

function warn(message) {
  warnings.push(message);
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

async function readJson(relativePath) {
  try {
    return JSON.parse(
      await fs.readFile(path.join(repoRoot, relativePath), "utf8"),
    );
  } catch (error) {
    fail(`${relativePath}: ${error.message}`);
    return null;
  }
}

function localPath(value, field) {
  const absolute = path.resolve(repoRoot, value);
  const relative = path.relative(repoRoot, absolute);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    fail(`${field} must resolve inside the plugin root: ${value}`);
    return null;
  }
  return { absolute, relative: relative || "." };
}

async function validateLogo(value) {
  if (typeof value !== "string" || value.length === 0) {
    fail("logo must be a non-empty string");
    return;
  }
  if (/^https:\/\//.test(value)) {
    return;
  }

  const resolved = localPath(value, "logo");
  if (!resolved) return;

  let data;
  try {
    data = await fs.readFile(resolved.absolute);
  } catch (error) {
    fail(`logo does not exist: ${value} (${error.message})`);
    return;
  }

  const extension = path.extname(value).toLowerCase();
  let width;
  let height;
  if (extension === ".svg") {
    const svg = data.toString("utf8");
    const tag = svg.match(/<svg\b[^>]*>/i)?.[0] ?? "";
    width = Number(tag.match(/\bwidth=["']([0-9.]+)(?:px)?["']/i)?.[1]);
    height = Number(tag.match(/\bheight=["']([0-9.]+)(?:px)?["']/i)?.[1]);
  } else if (
    extension === ".png" &&
    data.length >= 24 &&
    data.subarray(1, 4).toString("ascii") === "PNG"
  ) {
    width = data.readUInt32BE(16);
    height = data.readUInt32BE(20);
  } else {
    fail("logo must be an SVG or PNG file, or an https:// URL");
    return;
  }

  if (!Number.isFinite(width) || !Number.isFinite(height)) {
    fail(`could not determine logo dimensions from ${value}`);
  } else if (width !== height || width < 128) {
    fail(`logo must be square and at least 128x128; found ${width}x${height}`);
  }
}

async function validateComponentPaths(manifest) {
  const skills = manifest.skills ?? ["skills"];
  if (!Array.isArray(skills) || skills.length === 0) {
    fail("skills must be a non-empty array of relative paths when provided");
  } else {
    for (const skillPath of skills) {
      if (typeof skillPath !== "string") {
        fail("every skills entry must be a string");
        continue;
      }
      const resolved = localPath(skillPath, "skills");
      if (!resolved) continue;
      try {
        if (!(await fs.stat(resolved.absolute)).isDirectory()) {
          fail(`skills path is not a directory: ${skillPath}`);
        }
      } catch (error) {
        fail(`skills path does not exist: ${skillPath} (${error.message})`);
      }
    }
  }

  const mcpPath = manifest.mcpServers ?? "mcp_config.json";
  if (typeof mcpPath !== "string" || mcpPath.length === 0) {
    fail("mcpServers must be a non-empty relative path when provided");
    return;
  }
  const resolved = localPath(mcpPath, "mcpServers");
  if (!resolved) return;

  const config = await readJson(resolved.relative);
  if (!config) return;
  if (
    !isObject(config.mcpServers) ||
    Object.keys(config.mcpServers).length === 0
  ) {
    fail(`${resolved.relative}: mcpServers must be a non-empty object`);
    return;
  }
  for (const [name, server] of Object.entries(config.mcpServers)) {
    if (!isObject(server)) {
      fail(`${resolved.relative}: mcpServers.${name} must be an object`);
    } else if (server.serverUrl !== undefined) {
      if (
        typeof server.serverUrl !== "string" ||
        !server.serverUrl.startsWith("https://")
      ) {
        fail(
          `${resolved.relative}: mcpServers.${name}.serverUrl must be an https:// URL`,
        );
      }
    } else if (
      typeof server.command !== "string" ||
      server.command.length === 0
    ) {
      fail(
        `${resolved.relative}: mcpServers.${name} needs serverUrl or command`,
      );
    }
  }
}

async function main() {
  const manifest = await readJson(manifestPath);
  if (!manifest) return;

  if (
    typeof manifest.name !== "string" ||
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(manifest.name)
  ) {
    fail("name must use strict lowercase kebab-case");
  } else if (manifest.name.length > 64) {
    fail("name must be 1-64 characters");
  }

  if (
    typeof manifest.description !== "string" ||
    manifest.description.length === 0
  ) {
    fail("description must be a non-empty string");
  } else if (
    manifest.description.length < 120 ||
    manifest.description.length > 160
  ) {
    warn(
      `description is ${manifest.description.length} characters; Marketplace recommends 120-160`,
    );
  }

  if (
    typeof manifest.displayName !== "string" ||
    manifest.displayName.trim().length === 0
  ) {
    fail("displayName is required for Marketplace publishing");
  }
  if (
    typeof manifest.version !== "string" ||
    !semverPattern.test(manifest.version)
  ) {
    fail("version must be a semantic version");
  }

  await validateLogo(manifest.logo);

  if (
    !Array.isArray(manifest.suggestedPrompts) ||
    manifest.suggestedPrompts.length === 0
  ) {
    fail("suggestedPrompts must contain at least one actionable prompt");
  } else {
    if (manifest.suggestedPrompts.length > 3) {
      fail("suggestedPrompts may contain at most 3 entries");
    }
    manifest.suggestedPrompts.forEach((prompt, index) => {
      if (typeof prompt !== "string" || prompt.trim().length === 0) {
        fail(`suggestedPrompts[${index}] must be a non-empty string`);
      }
    });
  }

  if (manifest.category === undefined) {
    warn("category is recommended for Marketplace publishing");
  } else if (!(
    (typeof manifest.category === "string" && manifest.category.length > 0) ||
    (Array.isArray(manifest.category) &&
      manifest.category.length > 0 &&
      manifest.category.every(
        (entry) => typeof entry === "string" && entry.length > 0,
      ))
  )) {
    fail("category must be a non-empty string or array of non-empty strings");
  }

  if (!(
    (typeof manifest.author === "string" &&
      manifest.author.trim().length > 0) ||
    (isObject(manifest.author) &&
      typeof manifest.author.name === "string" &&
      manifest.author.name.trim().length > 0)
  )) {
    fail("author must be a non-empty string or an object with a name");
  }

  for (const field of ["homepage", "repository"]) {
    const value = manifest[field];
    if (value === undefined) continue;
    const url = typeof value === "string" ? value : value?.url;
    if (typeof url !== "string" || !url.startsWith("https://")) {
      fail(
        `${field} must be an https:// URL or an object with an https:// url`,
      );
    }
  }

  if (manifest.license === undefined) {
    warn("license is recommended for Marketplace publishing");
  } else if (
    typeof manifest.license !== "string" ||
    manifest.license.length === 0
  ) {
    fail("license must be a non-empty SPDX identifier");
  }

  if (manifest.keywords === undefined && manifest.tags === undefined) {
    warn("keywords or tags are recommended for Marketplace search");
  } else {
    const keywords = manifest.keywords ?? manifest.tags;
    if (
      !Array.isArray(keywords) ||
      keywords.length === 0 ||
      !keywords.every(
        (entry) =>
          typeof entry === "string" &&
          entry.length > 0 &&
          entry === entry.toLowerCase(),
      )
    ) {
      fail("keywords or tags must be a non-empty array of lowercase strings");
    }
  }

  try {
    const entries = await fs.readdir(
      path.join(repoRoot, ".antigravity-plugin"),
    );
    const unexpected = entries.filter((entry) => entry !== "plugin.json");
    if (unexpected.length > 0) {
      fail(
        `only plugin.json belongs in .antigravity-plugin/: ${unexpected.join(", ")}`,
      );
    }
  } catch (error) {
    fail(`.antigravity-plugin could not be read: ${error.message}`);
  }

  await validateComponentPaths(manifest);
}

await main();

for (const warning of warnings) {
  process.stderr.write(`Warning: ${warning}\n`);
}
if (problems.length > 0) {
  process.stderr.write(
    `Antigravity plugin validation failed:\n- ${problems.join("\n- ")}\n`,
  );
  process.exitCode = 1;
} else {
  process.stdout.write("Antigravity plugin validation passed.\n");
}
