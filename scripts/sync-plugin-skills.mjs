#!/usr/bin/env node

import process from "node:process";
import { syncPluginSkills } from "./lib/plugin-skills.mjs";

const repoRoot = process.cwd();

await syncPluginSkills(repoRoot);
console.log("Synced plugin skill bundles from skills/.");
