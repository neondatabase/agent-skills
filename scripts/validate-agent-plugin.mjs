#!/usr/bin/env node

// Validates the repo root as an Agent Plugins v1.0.0 portable package:
// the root plugin.json manifest, the optional root mcp.json, and the skill
// discovery rules for skills/. The client-specific packaging under plugins/
// is a compatibility layer and is validated separately.
//
// Spec: https://agent-plugins.org/specification

import { promises as fs } from "node:fs";
import path from "node:path";
import process from "node:process";

const SPEC_VERSION = "1.0.0";
const SCHEMA_BASE = `https://agent-plugins.org/schemas/${SPEC_VERSION}`;
const PLUGIN_SCHEMA = `${SCHEMA_BASE}/plugin.schema.json`;
const MCP_SCHEMA = `${SCHEMA_BASE}/mcp.schema.json`;

// Names are 1-64 chars, lowercase alphanumerics with hyphens and periods,
// bounded by alphanumerics, and may not contain "--" or "..".
const NAME_PATTERN = /^(?!.*(?:--|\.\.))[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/;
const NAMESPACE_PATTERN = /^[a-z0-9]+(?:[.-][a-z0-9]+)+$/i;
const CWD_PATTERN =
  /^(?:\.\/|\$\{PLUGIN_ROOT\}(?:\/|$)|\$\{PLUGIN_DATA\}(?:\/|$))/;
// RFC 9110 field name (token) and field value (visible ASCII, space, tab).
const HEADER_NAME_PATTERN = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/;
const HEADER_VALUE_PATTERN = /^[\t\x20-\x7e\x80-\xff]*$/;

const MANIFEST_FIELDS = new Set([
  "$schema",
  "name",
  "version",
  "description",
  "author",
  "homepage",
  "repository",
  "license",
  "keywords",
  "extensions",
]);
const STRING_FIELDS = [
  "version",
  "description",
  "homepage",
  "repository",
  "license",
];
const AUTHOR_FIELDS = new Set(["name", "email", "url"]);
const RESERVED_ENV = new Set(["PLUGIN_ROOT", "PLUGIN_DATA"]);

const TRANSPORTS = {
  stdio: {
    required: ["type", "command"],
    allowed: ["type", "command", "args", "env", "cwd"],
  },
  "streamable-http": {
    required: ["type", "url"],
    allowed: ["type", "url", "headers"],
  },
  sse: {
    required: ["type", "url"],
    allowed: ["type", "url", "headers"],
  },
};

const repoRoot = process.cwd();
const errors = [];

function addError(message) {
  errors.push(message);
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

// True when a plugin-relative or ${PLUGIN_*}-rooted path climbs out of its
// root once "." and ".." segments are collapsed.
function escapesRoot(value) {
  const rooted = value.replace(/^\$\{PLUGIN_(?:ROOT|DATA)\}\/?/, "");
  const normalized = path.posix.normalize(rooted.replace(/\\/g, "/"));
  return normalized === ".." || normalized.startsWith("../");
}

// §4.1 requires containment of the *filesystem-resolved* path, so a lexical
// check alone would miss a symlink pointing outside. Resolve bundled paths
// that exist on disk; anything absent can only be checked lexically.
async function escapesRootOnDisk(value) {
  if (value.startsWith("${PLUGIN_DATA}")) {
    // PLUGIN_DATA is a client-managed directory outside the package.
    return false;
  }
  const relative = value.replace(/^\$\{PLUGIN_ROOT\}\/?/, "");
  try {
    const root = await fs.realpath(repoRoot);
    const resolved = await fs.realpath(path.resolve(root, relative));
    return resolved !== root && !resolved.startsWith(root + path.sep);
  } catch {
    return false;
  }
}

function isLoopback(hostname) {
  return (
    hostname === "localhost" ||
    hostname === "[::1]" ||
    /^127\.\d+\.\d+\.\d+$/.test(hostname)
  );
}

async function readJsonFile(filePath, context) {
  let stat;
  try {
    stat = await fs.lstat(filePath);
  } catch {
    return { found: false };
  }
  if (!stat.isFile()) {
    // Stricter than §4.1, which allows a symlink that stays inside the
    // package. Kept deliberately: this repo bans symlinks in distributed
    // packaging because Cursor and Claude silently drop them on install.
    const relative = path.relative(repoRoot, filePath);
    addError(`${context} must be a regular file: ${relative}`);
    return { found: true };
  }

  try {
    return {
      found: true,
      data: JSON.parse(await fs.readFile(filePath, "utf8")),
    };
  } catch (error) {
    addError(`${context} could not be read as JSON: ${error.message}`);
    return { found: true };
  }
}

function validateManifest(manifest) {
  if (!isPlainObject(manifest)) {
    addError("plugin.json must be a JSON object.");
    return;
  }

  if (manifest.$schema !== PLUGIN_SCHEMA) {
    addError(`plugin.json: "$schema" must be "${PLUGIN_SCHEMA}".`);
  }

  if (typeof manifest.name !== "string") {
    addError('plugin.json: "name" is required and must be a string.');
  } else if (manifest.name.length > 64 || !NAME_PATTERN.test(manifest.name)) {
    addError(
      `plugin.json: "name" must be 1-64 lowercase alphanumerics, hyphens, or periods bounded by alphanumerics, with no "--" or "..": "${manifest.name}"`,
    );
  }

  // The v1 manifest schema is closed. Client fields such as "skills",
  // "mcpServers", or "hooks" belong in mcp.json or an extension namespace.
  for (const field of Object.keys(manifest)) {
    if (!MANIFEST_FIELDS.has(field)) {
      addError(
        `plugin.json: "${field}" is not an allowed top-level field. Use "extensions" for client-specific data.`,
      );
    }
  }

  for (const field of STRING_FIELDS) {
    if (field in manifest && typeof manifest[field] !== "string") {
      addError(`plugin.json: "${field}" must be a string.`);
    }
  }

  if ("author" in manifest) {
    const { author } = manifest;
    if (!isPlainObject(author)) {
      addError('plugin.json: "author" must be an object.');
    } else {
      for (const field of Object.keys(author)) {
        if (!AUTHOR_FIELDS.has(field)) {
          addError(`plugin.json: "author.${field}" is not an allowed field.`);
        } else if (typeof author[field] !== "string") {
          addError(`plugin.json: "author.${field}" must be a string.`);
        }
      }
    }
  }

  if ("keywords" in manifest) {
    const { keywords } = manifest;
    const valid =
      Array.isArray(keywords) && keywords.every((k) => typeof k === "string");
    if (!valid) {
      addError('plugin.json: "keywords" must be an array of strings.');
    }
  }

  if ("extensions" in manifest) {
    const { extensions } = manifest;
    if (!isPlainObject(extensions)) {
      addError('plugin.json: "extensions" must be an object.');
    } else {
      for (const [namespace, value] of Object.entries(extensions)) {
        if (!NAMESPACE_PATTERN.test(namespace)) {
          addError(
            `plugin.json: extension namespace "${namespace}" must be a reverse-domain identifier such as "com.vendor.client".`,
          );
        }
        if (!isPlainObject(value)) {
          addError(
            `plugin.json: extension "${namespace}" must map to an object.`,
          );
        }
      }
    }
  }
}

function validateServerUrl(name, url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    addError(`mcp.json: server "${name}" has an invalid "url": "${url}"`);
    return;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    addError(`mcp.json: server "${name}" requires an http or https "url".`);
    return;
  }
  if (parsed.username || parsed.password) {
    addError(`mcp.json: server "${name}" must not embed credentials in "url".`);
  }
  if (parsed.hash) {
    addError(`mcp.json: server "${name}" must not put a fragment in "url".`);
  }
  if (parsed.protocol !== "https:" && !isLoopback(parsed.hostname)) {
    addError(
      `mcp.json: server "${name}" must use HTTPS for a non-loopback URL.`,
    );
  }
}

// §7.2.1: command MUST be either a bare executable name or a plugin-relative
// path beginning with "./". Absolute paths are neither form.
async function validateCommand(name, command) {
  if (command.startsWith("./")) {
    // A plugin-relative path is a single token even when it contains spaces,
    // so only containment matters here.
    if (escapesRoot(command) || (await escapesRootOnDisk(command))) {
      addError(
        `mcp.json: server "${name}" has a "command" that escapes the plugin: "${command}"`,
      );
    }
    return;
  }
  if (/\s/.test(command)) {
    addError(
      `mcp.json: server "${name}" has "command" with whitespace. Use one executable token and pass the rest via "args".`,
    );
    return;
  }
  if (/[\\/]/.test(command)) {
    addError(
      `mcp.json: server "${name}" has "command" path "${command}". Use a bare executable name or a plugin-relative path beginning with "./".`,
    );
  }
}

function validateEnv(name, env) {
  if (!isPlainObject(env)) {
    addError(`mcp.json: server "${name}" requires "env" to be an object.`);
    return;
  }
  for (const [key, value] of Object.entries(env)) {
    if (RESERVED_ENV.has(key)) {
      addError(
        `mcp.json: server "${name}" must not set the reserved env variable "${key}".`,
      );
    }
    if (typeof value !== "string") {
      addError(`mcp.json: server "${name}" env "${key}" must be a string.`);
    }
  }
}

function validateHeaders(name, headers) {
  if (!isPlainObject(headers)) {
    addError(`mcp.json: server "${name}" requires "headers" to be an object.`);
    return;
  }
  const seen = new Set();
  for (const [key, value] of Object.entries(headers)) {
    const lower = key.toLowerCase();
    if (seen.has(lower)) {
      addError(
        `mcp.json: server "${name}" repeats header "${key}" under a different casing.`,
      );
    }
    seen.add(lower);
    if (!HEADER_NAME_PATTERN.test(key)) {
      addError(
        `mcp.json: server "${name}" header "${key}" is not a valid HTTP header name.`,
      );
    }
    if (typeof value !== "string") {
      addError(`mcp.json: server "${name}" header "${key}" must be a string.`);
    } else if (!HEADER_VALUE_PATTERN.test(value)) {
      addError(
        `mcp.json: server "${name}" header "${key}" has a value that is not a valid HTTP field value.`,
      );
    }
  }
}

async function validateServerFields(name, server) {
  if ("args" in server) {
    const { args } = server;
    const valid =
      Array.isArray(args) && args.every((a) => typeof a === "string");
    if (!valid) {
      addError(
        `mcp.json: server "${name}" requires "args" to be an array of strings.`,
      );
    }
  }

  if ("env" in server) {
    validateEnv(name, server.env);
  }

  if ("cwd" in server) {
    const { cwd } = server;
    if (typeof cwd !== "string" || !CWD_PATTERN.test(cwd)) {
      addError(
        `mcp.json: server "${name}" requires "cwd" to start with "./", "\${PLUGIN_ROOT}", or "\${PLUGIN_DATA}".`,
      );
    } else if (escapesRoot(cwd) || (await escapesRootOnDisk(cwd))) {
      addError(
        `mcp.json: server "${name}" has a "cwd" that escapes the plugin: "${cwd}"`,
      );
    }
  }

  if ("headers" in server) {
    validateHeaders(name, server.headers);
  }
}

async function validateMcp(config) {
  if (!isPlainObject(config)) {
    addError("mcp.json must be a JSON object.");
    return;
  }

  if (config.$schema !== MCP_SCHEMA) {
    addError(
      `mcp.json: "$schema" must be "${MCP_SCHEMA}" so the MCP configuration targets the same Agent Plugins version as plugin.json.`,
    );
  }
  for (const field of Object.keys(config)) {
    if (field !== "$schema" && field !== "mcpServers") {
      addError(`mcp.json: "${field}" is not an allowed top-level field.`);
    }
  }

  const servers = config.mcpServers;
  if (!isPlainObject(servers)) {
    addError('mcp.json: "mcpServers" is required and must be an object.');
    return;
  }

  for (const [name, server] of Object.entries(servers)) {
    if (!isPlainObject(server)) {
      addError(`mcp.json: server "${name}" must be an object.`);
      continue;
    }

    // Own-property lookup: "constructor" and friends are truthy on a plain
    // object and would sail past this guard into a crash below.
    const transport = Object.hasOwn(TRANSPORTS, server.type)
      ? TRANSPORTS[server.type]
      : undefined;
    if (!transport) {
      addError(
        `mcp.json: server "${name}" has type "${server.type}". Use "stdio", "streamable-http", or "sse".`,
      );
      continue;
    }

    for (const field of transport.required) {
      if (typeof server[field] !== "string" || server[field].length === 0) {
        addError(`mcp.json: server "${name}" requires a non-empty "${field}".`);
      }
    }
    for (const field of Object.keys(server)) {
      if (!transport.allowed.includes(field)) {
        addError(
          `mcp.json: server "${name}" (${server.type}) does not allow "${field}".`,
        );
      }
    }

    await validateServerFields(name, server);

    if (server.type === "stdio") {
      if (typeof server.command === "string") {
        await validateCommand(name, server.command);
      }
    } else if (typeof server.url === "string") {
      validateServerUrl(name, server.url);
    }
  }
}

// Unwraps a YAML scalar the way a real parser would, so a quoted name or a
// trailing comment does not disagree with skills-ref over the same file.
function parseScalar(raw) {
  const value = raw.trim();
  const quote = value[0];
  if (quote === '"' || quote === "'") {
    const closing = value.indexOf(quote, 1);
    if (closing !== -1) {
      return value.slice(1, closing);
    }
  }
  const comment = value.search(/\s#/);
  return comment === -1 ? value : value.slice(0, comment).trim();
}

function parseFrontmatter(content) {
  const normalized = content.replace(/\r\n/g, "\n");
  if (!normalized.startsWith("---\n")) {
    return null;
  }
  const closingIndex = normalized.indexOf("\n---\n", 4);
  if (closingIndex === -1) {
    return null;
  }

  const fields = {};
  for (const line of normalized.slice(4, closingIndex).split("\n")) {
    const trimmed = line.trimStart();
    const separator = line.indexOf(":");
    // Skip comments and indented lines so only top-level keys are collected.
    if (separator === -1 || trimmed !== line || trimmed.startsWith("#")) {
      continue;
    }
    fields[line.slice(0, separator).trim()] = parseScalar(
      line.slice(separator + 1),
    );
  }
  return fields;
}

async function validateSkill(skillsRoot, name) {
  // Only immediate children of skills/ are discovered.
  const skillFile = path.join(skillsRoot, name, "SKILL.md");
  let stat;
  try {
    stat = await fs.lstat(skillFile);
  } catch {
    addError(`skills/${name} is missing a SKILL.md file.`);
    return;
  }
  if (!stat.isFile()) {
    addError(`skills/${name}/SKILL.md must be a regular file.`);
    return;
  }

  const frontmatter = parseFrontmatter(await fs.readFile(skillFile, "utf8"));
  if (!frontmatter) {
    addError(`skills/${name}/SKILL.md is missing YAML frontmatter.`);
    return;
  }
  if (frontmatter.name !== name) {
    addError(
      `skills/${name}/SKILL.md declares name "${frontmatter.name === undefined ? "(missing)" : frontmatter.name}", which must match its directory.`,
    );
  }
  if (!frontmatter.description) {
    addError(`skills/${name}/SKILL.md is missing a "description".`);
  }
}

// §4.1 requires every path in the package to resolve inside it. The caller
// rejects a symlinked skill directory outright; a nested symlink is legal so
// long as it stays contained, so those are resolved rather than banned.
//
// Resolves here rather than through escapesRootOnDisk, which reports an
// unresolvable path as contained. That is right for the MCP command and cwd
// callers, which may name paths that do not exist until the server runs, but
// here it would pass a link whose containment was never established.
async function validateSkillContainment(dir, root) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const entryPath = path.join(dir, entry.name);
    if (entry.isSymbolicLink()) {
      const relative = path.relative(repoRoot, entryPath);
      let resolved;
      try {
        resolved = await fs.realpath(entryPath);
      } catch {
        addError(
          `${relative} is a symlink that does not resolve, so it cannot be shown to stay inside the plugin.`,
        );
        continue;
      }
      if (resolved !== root && !resolved.startsWith(root + path.sep)) {
        addError(`${relative} is a symlink that resolves outside the plugin.`);
      }
      continue;
    }
    if (entry.isDirectory()) {
      await validateSkillContainment(entryPath, root);
    }
  }
}

async function validateSkills() {
  const skillsRoot = path.join(repoRoot, "skills");
  let rootStat;
  try {
    rootStat = await fs.lstat(skillsRoot);
  } catch {
    // A plugin without skills is valid; it just exposes nothing portable here.
    return;
  }
  if (!rootStat.isDirectory()) {
    addError("skills exists at the plugin root but is not a directory.");
    return;
  }

  // Resolved once: every nested symlink is compared against it.
  const root = await fs.realpath(repoRoot);
  const entries = await fs.readdir(skillsRoot, { withFileTypes: true });
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (entry.isSymbolicLink()) {
      addError(
        `skills/${entry.name} is a symlink; commit a real directory instead.`,
      );
      continue;
    }
    if (!entry.isDirectory()) {
      continue;
    }
    // Stricter than §7.1, which ignores a child directory without a SKILL.md.
    // Kept deliberately: validate-skills.mjs runs skills-ref over every child
    // of skills/, so such a directory already fails CI. Staying silent here
    // would imply it is fine.
    await validateSkill(skillsRoot, entry.name);
    await validateSkillContainment(path.join(skillsRoot, entry.name), root);
  }
}

async function main() {
  const manifest = await readJsonFile(
    path.join(repoRoot, "plugin.json"),
    "Agent Plugins manifest",
  );
  if (!manifest.found) {
    addError("plugin.json is missing from the repository root.");
  } else if (manifest.data !== undefined) {
    validateManifest(manifest.data);
  }

  // mcp.json is optional; validate it only when the plugin ships MCP servers.
  const mcp = await readJsonFile(
    path.join(repoRoot, "mcp.json"),
    "Agent Plugins MCP configuration",
  );
  if (mcp.data !== undefined) {
    await validateMcp(mcp.data);
  }

  await validateSkills();

  if (errors.length > 0) {
    console.error("Agent Plugins validation failed:");
    for (const error of errors) {
      console.error(`- ${error}`);
    }
    process.exit(1);
  }
  console.log(`Agent Plugins v${SPEC_VERSION} validation passed.`);
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exit(1);
});
