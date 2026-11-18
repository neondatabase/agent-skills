#!/usr/bin/env node
/**
 * Fails when a code sample in the neon-functions skill has an anonymous default
 * export (`export default { fetch }`, `export default function (req)`, ...).
 * Agents paste these samples into users' repos, and eslint-config-next (what
 * create-next-app generates) warns on them through
 * import/no-anonymous-default-export. Assign the value to a name first:
 *
 *   const handler = { fetch(request) { ... } };
 *   export default handler;
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import process from "node:process";

const skillRoot = path.join(process.cwd(), "skills", "neon-functions");
const anonymousDefaultExport =
  /^\s*export default (?:\{|(?:async\s*)?\(|(?:async\s+)?function\s*\*?\s*\(|(?:async\s+)?[\w$]+\s*=>)/;

async function markdownFiles(dir) {
  const files = [];
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await markdownFiles(full)));
    } else if (entry.name.endsWith(".md")) {
      files.push(full);
    }
  }
  return files;
}

const problems = [];
for (const file of await markdownFiles(skillRoot)) {
  let inFence = false;
  const lines = (await fs.readFile(file, "utf8")).split("\n");
  lines.forEach((line, index) => {
    if (line.trimStart().startsWith("```")) inFence = !inFence;
    else if (inFence && anonymousDefaultExport.test(line)) {
      problems.push(
        `${path.relative(process.cwd(), file)}:${index + 1}: ${line.trim()}`,
      );
    }
  });
}

if (problems.length > 0) {
  console.error("Anonymous default exports in neon-functions code samples:");
  for (const problem of problems) console.error(`  ${problem}`);
  console.error(
    "\nAssign the value to a name and export that, e.g. `const handler = { ... };` then `export default handler;`.",
  );
  process.exit(1);
}
console.log(
  "[OK] No anonymous default exports in neon-functions code samples.",
);
