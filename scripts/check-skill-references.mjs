#!/usr/bin/env node
/**
 * Skill reference-graph check.
 *
 * Every markdown reference file in a skill must be reachable from its SKILL.md.
 * Starting at SKILL.md we walk the link graph — SKILL.md links to reference
 * files, and reference files may link to each other — and collect every skill
 * file it reaches. Links may be written as relative paths (references/foo.md),
 * full neon.com URLs (https://neon.com/docs/ai/skills/<skill>/references/foo.md),
 * or GitHub blob URLs into this repo; all three resolve to the same on-disk file.
 *
 * Fails when:
 *   - a link points at a skill file that does not exist (broken reference), or
 *   - a markdown file in the skill is never reached from SKILL.md (orphan).
 *
 * Non-markdown files (TypeScript/JS scripts, JSON, .env.example, …) are not
 * required to be linked; orphans among them are reported (by count) but never
 * fail the check. node_modules and .git are ignored entirely.
 *
 * Usage:
 *   node scripts/check-skill-references.mjs            # check every skill
 *   node scripts/check-skill-references.mjs --json     # machine-readable
 *   node scripts/check-skill-references.mjs --skill X  # one skill
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const REPO_ROOT = process.cwd();
const SKILLS_ROOT = path.join(REPO_ROOT, 'skills');

// Directories that are never part of a skill's authored content.
const SKIP_DIRS = new Set(['node_modules', '.git']);

const MD_LINK_RE = /!?\[[^\]]*\]\(\s*(<[^>]+>|[^)\s]+)(?:\s+(?:"[^"]*"|'[^']*'))?\s*\)/g;

function isMarkdown(file) {
  return file.toLowerCase().endsWith('.md');
}

async function walk(dir) {
  const files = [];
  const dirs = [];
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      dirs.push(full);
      const sub = await walk(full);
      files.push(...sub.files);
      dirs.push(...sub.dirs);
    } else if (entry.isFile()) {
      files.push(full);
    }
  }
  return { files, dirs };
}

function extractLinks(markdown) {
  const links = [];
  for (const m of markdown.matchAll(MD_LINK_RE)) {
    const t = m[1].trim().replace(/^<|>$/g, '');
    if (t) links.push(t);
  }
  return links;
}

/**
 * Resolve a markdown link to an absolute path inside `skillDir`, or null if the
 * link doesn't target a file within this skill (external URL, anchor, mailto, or
 * a URL/absolute path pointing outside the skill).
 */
function resolveToSkillFile(rawLink, fromFileAbs, skillDir, skillName) {
  const link = rawLink.split('#')[0].split('?')[0].trim();
  if (!link || link.startsWith('#')) return null;

  const marker = `skills/${skillName}/`;
  const isUrl = /^[a-z][a-z0-9+.-]*:\/\//i.test(link);
  const isSiteAbsolute = link.startsWith('/');

  if (isUrl || isSiteAbsolute) {
    const idx = link.indexOf(marker);
    if (idx === -1) return null; // points outside this skill
    return path.join(skillDir, link.slice(idx + marker.length));
  }
  if (/^[a-z][a-z0-9+.-]*:/i.test(link)) return null; // mailto: and other schemes

  const resolved = path.resolve(path.dirname(fromFileAbs), link);
  const rel = path.relative(skillDir, resolved);
  if (rel.startsWith('..') || path.isAbsolute(rel)) return null; // escapes the skill
  return resolved;
}

async function checkSkill(skillName) {
  const skillDir = path.join(SKILLS_ROOT, skillName);
  const skillMd = path.join(skillDir, 'SKILL.md');
  const problems = [];
  const ignoredOrphans = [];

  try {
    await fs.access(skillMd);
  } catch {
    return { skillName, problems: ['no SKILL.md at skill root'], ignoredOrphans };
  }

  const { files: allFiles, dirs: allDirs } = await walk(skillDir);
  const existing = new Set(allFiles.map((f) => path.resolve(f)));
  const existingDirs = new Set(allDirs.map((d) => path.resolve(d)));

  // BFS the reference graph from SKILL.md.
  const reached = new Set([path.resolve(skillMd)]);
  const queue = [path.resolve(skillMd)];
  while (queue.length) {
    const file = queue.shift();
    if (!isMarkdown(file)) continue; // only markdown carries onward links
    let content;
    try {
      content = await fs.readFile(file, 'utf8');
    } catch {
      continue;
    }
    for (const link of extractLinks(content)) {
      const target = resolveToSkillFile(link, file, skillDir, skillName);
      if (!target) continue;
      const abs = path.resolve(target);
      if (existing.has(abs)) {
        if (!reached.has(abs)) {
          reached.add(abs);
          queue.push(abs);
        }
        continue;
      }
      if (existingDirs.has(abs)) continue; // link to a directory (e.g. scripts/) — valid
      // A missing target only fails when it looks like a markdown reference file;
      // missing non-markdown targets (e.g. .env.example) are left to other tooling.
      if (isMarkdown(abs)) {
        problems.push(`broken reference in ${path.relative(skillDir, file)}: ${link}`);
      }
    }
  }

  // Orphans: files in the skill never reached from SKILL.md.
  for (const f of allFiles) {
    const abs = path.resolve(f);
    if (reached.has(abs)) continue;
    const rel = path.relative(skillDir, f);
    if (isMarkdown(f)) {
      problems.push(`orphan markdown file (not reachable from SKILL.md): ${rel}`);
    } else {
      ignoredOrphans.push(rel);
    }
  }

  return { skillName, problems, ignoredOrphans };
}

async function main() {
  const args = process.argv.slice(2);
  const jsonMode = args.includes('--json');
  const skillArg = args.includes('--skill') ? args[args.indexOf('--skill') + 1] : null;

  let entries;
  try {
    entries = await fs.readdir(SKILLS_ROOT, { withFileTypes: true });
  } catch (err) {
    console.error(`Failed to read skills directory: ${err.message}`);
    process.exit(2);
  }

  let skillNames = entries
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort((a, b) => a.localeCompare(b));
  if (skillArg) skillNames = skillNames.filter((n) => n === skillArg);

  const results = [];
  for (const name of skillNames) results.push(await checkSkill(name));

  if (jsonMode) {
    console.log(JSON.stringify(results, null, 2));
  } else {
    console.log('Skill reference-graph check\n');
    for (const r of results) {
      const note = r.ignoredOrphans.length
        ? `  (${r.ignoredOrphans.length} non-markdown file(s) not linked, ignored)`
        : '';
      if (r.problems.length === 0) {
        console.log(`  [OK]   ${r.skillName}${note}`);
      } else {
        console.log(`  [FAIL] ${r.skillName}${note}`);
        for (const p of r.problems) console.log(`           - ${p}`);
      }
    }
  }

  const failed = results.filter((r) => r.problems.length > 0);
  if (failed.length > 0) {
    if (!jsonMode) {
      console.error(
        `\n[FAIL] ${failed.length} skill(s) have unreachable or broken references.\n` +
          `Every markdown reference file must be reachable from SKILL.md via a link\n` +
          `(relative path, full neon.com URL, or GitHub blob URL). Fix by linking the\n` +
          `file from the graph, or delete it if it's no longer used.`
      );
    }
    process.exit(1);
  }
  if (!jsonMode) console.log(`\n[OK] All ${results.length} skill(s) have a fully-linked reference graph.`);
}

await main();
