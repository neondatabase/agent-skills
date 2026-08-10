#!/usr/bin/env node

// Propagates the version in package.json into every manifest that declares
// one. package.json is the single source of truth and the manifests are
// generated from it, the same way plugins/*/skills is generated from skills/.
// Releasing is therefore one edit: bump package.json and commit.
//
// Edits are surgical text replacements rather than a JSON re-serialize, so
// each file's existing formatting survives byte for byte. Every rewrite is
// re-parsed and compared against the expected result, and nothing is written
// until all of them verify, so a stray match cannot corrupt a file.
//
// package-lock.json also carries the version, but it repeats "version" for
// every dependency, which makes it unsafe to rewrite by text match. npm owns
// it, so it is checked and never written; the fix is to run npm version.
//
// Every path rewritten is printed to stdout, one per line, so the pre-commit
// hook can stage exactly those. Apart from the version field these files are
// hand-authored, so staging them wholesale would sweep an unstaged edit into
// someone's commit. Status goes to stderr.
//
// Usage:
//   node scripts/sync-versions.mjs           # write versions
//   node scripts/sync-versions.mjs --check    # verify versions, no writes

import { promises as fs } from "node:fs";
import path from "node:path";
import process from "node:process";

// The suggested pattern from https://semver.org.
const SEMVER_PATTERN =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;

const SOURCE = "package.json";
const LOCKFILE = "package-lock.json";
const CATALOGS = [
  ".claude-plugin/marketplace.json",
  ".cursor-plugin/marketplace.json",
];
const CLIENT_MANIFESTS = [
  ".claude-plugin/plugin.json",
  ".cursor-plugin/plugin.json",
];

const repoRoot = process.cwd();
const checkMode = process.argv.includes("--check");
const problems = [];
const writes = [];
// Set when a problem is one that a write-mode run would actually repair, so
// the "run sync:versions" hint never appears next to a problem it cannot fix.
let hasStaleManifest = false;

function fail(message) {
  problems.push(message);
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// A missing file is skipped. Which packaging formats a repo ships is not this
// script's business, and the validators already require the ones that matter.
// Anything else - an unreadable file, a bad mode - is a real failure, and
// swallowing it would report a file this script never read as in sync.
async function readFileOrNull(relativePath) {
  try {
    return await fs.readFile(path.join(repoRoot, relativePath), "utf8");
  } catch (error) {
    if (error.code === "ENOENT" || error.code === "ENOTDIR") {
      return null;
    }
    throw error;
  }
}

function getAt(data, pointer) {
  return pointer.reduce(
    (node, key) => (node == null ? undefined : node[key]),
    data,
  );
}

function setAt(data, pointer, value) {
  const parent = pointer.slice(0, -1).reduce((node, key) => node[key], data);
  parent[pointer[pointer.length - 1]] = value;
}

function formatPointer(pointer) {
  return pointer
    .map((key, index) => {
      // The lockfile's own entry is keyed by the empty string, which would
      // otherwise print as "packages..version".
      if (typeof key === "number" || !/^[A-Za-z_$][\w$]*$/.test(key)) {
        return `[${JSON.stringify(key)}]`;
      }
      return index === 0 ? key : `.${key}`;
    })
    .join("");
}

// Every version a packaging format declares for the plugin. A catalog carries
// one for the catalog itself and one per plugin entry; a lockfile repeats the
// package's own version in two places.
function versionPointers(data, kind) {
  if (!isPlainObject(data)) {
    return [];
  }

  const pointers = [];
  if (kind === "catalog") {
    if (isPlainObject(data.metadata) && data.metadata.version !== undefined) {
      pointers.push(["metadata", "version"]);
    }
    if (Array.isArray(data.plugins)) {
      data.plugins.forEach((entry, index) => {
        if (isPlainObject(entry) && entry.version !== undefined) {
          pointers.push(["plugins", index, "version"]);
        }
      });
    }
    return pointers;
  }

  if (data.version !== undefined) {
    pointers.push(["version"]);
  }
  if (
    kind === "lockfile" &&
    isPlainObject(data.packages) &&
    isPlainObject(data.packages[""]) &&
    data.packages[""].version !== undefined
  ) {
    pointers.push(["packages", "", "version"]);
  }
  return pointers;
}

function describeStale(data, stale) {
  return stale
    .map(
      (pointer) =>
        `${formatPointer(pointer)} = ${JSON.stringify(getAt(data, pointer))}`,
    )
    .join(", ");
}

async function planFile(relativePath, kind, version) {
  let original;
  try {
    original = await readFileOrNull(relativePath);
  } catch (error) {
    fail(`${relativePath} could not be read: ${error.message}`);
    return;
  }
  if (original === null) {
    return;
  }

  let data;
  try {
    data = JSON.parse(original);
  } catch (error) {
    fail(`${relativePath} is not valid JSON: ${error.message}`);
    return;
  }

  const pointers = versionPointers(data, kind);
  if (pointers.length === 0) {
    // Skipping silently would let a deleted field pass as "in sync" forever.
    fail(
      `${relativePath} exists but declares no version. Add one, or drop the file if the packaging is gone.`,
    );
    return;
  }

  const stale = pointers.filter((pointer) => getAt(data, pointer) !== version);
  if (stale.length === 0) {
    return;
  }

  // npm owns the lockfile, and its per-dependency "version" fields make a
  // text rewrite unsafe, so report it instead of touching it.
  if (kind === "lockfile") {
    fail(
      `${relativePath} declares ${describeStale(data, stale)}, expected "${version}". npm owns this file; run: npm install --ignore-scripts`,
    );
    return;
  }

  if (checkMode) {
    hasStaleManifest = true;
    fail(
      `${relativePath} declares ${describeStale(data, stale)}, expected "${version}".`,
    );
    return;
  }

  // Match on the value currently in the file, so an unrelated nested
  // "version" holding something else is never touched.
  let updated = original;
  for (const current of new Set(
    stale.map((pointer) => JSON.stringify(getAt(data, pointer))),
  )) {
    const pattern = new RegExp(
      `("version"\\s*:\\s*)${escapeRegExp(current)}`,
      "g",
    );
    updated = updated.replace(pattern, `$1${JSON.stringify(version)}`);
  }
  if (updated === original) {
    fail(
      `${relativePath}: could not find the version literal in the file text. Update it by hand.`,
    );
    return;
  }

  const expected = JSON.parse(original);
  for (const pointer of pointers) {
    setAt(expected, pointer, version);
  }
  let actual;
  try {
    actual = JSON.parse(updated);
  } catch (error) {
    fail(`${relativePath}: rewriting the version broke the JSON. ${error}`);
    return;
  }
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    fail(
      `${relativePath}: rewriting the version would have changed another field. Update this file by hand.`,
    );
    return;
  }

  writes.push({ relativePath, contents: updated });
}

// Walks plugins/ rather than resolving each catalog's "source", so a plugin
// directory not listed in a catalog yet is still kept in step.
async function pluginManifests() {
  let entries;
  try {
    entries = await fs.readdir(path.join(repoRoot, "plugins"), {
      withFileTypes: true,
    });
  } catch {
    return [];
  }

  const manifests = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (entry.isDirectory()) {
      for (const manifest of CLIENT_MANIFESTS) {
        manifests.push(`plugins/${entry.name}/${manifest}`);
      }
    }
  }
  return manifests;
}

async function main() {
  const raw = await readFileOrNull(SOURCE);
  if (raw === null) {
    throw new Error(
      `${SOURCE} is missing; it holds the version every manifest derives from.`,
    );
  }

  let version;
  try {
    version = JSON.parse(raw).version;
  } catch (error) {
    throw new Error(`${SOURCE} is not valid JSON: ${error.message}`);
  }
  if (typeof version !== "string" || !SEMVER_PATTERN.test(version)) {
    throw new Error(
      `${SOURCE} "version" must be a semantic version, got ${JSON.stringify(version)}.`,
    );
  }

  await planFile(LOCKFILE, "lockfile", version);
  await planFile("plugin.json", "manifest", version);
  await planFile("kimi.plugin.json", "manifest", version);
  for (const catalog of CATALOGS) {
    await planFile(catalog, "catalog", version);
  }
  for (const manifest of await pluginManifests()) {
    await planFile(manifest, "manifest", version);
  }

  // Nothing is written unless every file verified, so a rejected rewrite
  // cannot leave the tree half-updated.
  if (problems.length > 0) {
    process.stderr.write(
      checkMode
        ? `Versions are out of sync with ${SOURCE}:\n`
        : "Version sync failed:\n",
    );
    for (const problem of problems) {
      process.stderr.write(`- ${problem}\n`);
    }
    if (checkMode && hasStaleManifest) {
      process.stderr.write("Run: npm run sync:versions\n");
    }
    process.exit(1);
  }

  for (const { relativePath, contents } of writes) {
    await fs.writeFile(path.join(repoRoot, relativePath), contents);
    process.stderr.write(`Set ${relativePath} to ${version}\n`);
    process.stdout.write(`${relativePath}\n`);
  }

  process.stderr.write(
    checkMode
      ? `Versions are in sync at ${version}.\n`
      : `Versions synced to ${version}.\n`,
  );
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exit(1);
});
