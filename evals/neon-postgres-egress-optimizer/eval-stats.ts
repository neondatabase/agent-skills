#!/usr/bin/env bun

const RESULTS_CSV = `${import.meta.dir}/results.csv`;

const PROBLEMS = ["p1", "p2", "p3", "p4", "p5"] as const;
const LABELS: Record<string, string> = {
  p1: "P1: SELECT * unused columns",
  p2: "P2: Missing pagination",
  p3: "P3: High-frequency query",
  p4: "P4: Application-side aggregation",
  p5: "P5: Join duplication",
};

type Row = Record<string, string>;

function parseCsv(text: string): Row[] {
  const [headerLine, ...dataLines] = text.trimEnd().split("\n");
  if (!headerLine) return [];
  const headers = headerLine.split(",");
  return dataLines.map((line) => {
    const values = line.split(",");
    return Object.fromEntries(headers.map((h, i) => [h, values[i] ?? ""]));
  });
}

function pct(n: number, total: number): string {
  return total === 0 ? "0%" : `${Math.round((n / total) * 100)}%`;
}

const rows = parseCsv(await Bun.file(RESULTS_CSV).text());

const groups = new Map<string, Row[]>();
for (const row of rows) {
  const key = row["skill_version"]?.trim() || "baseline";
  groups.set(key, [...(groups.get(key) ?? []), row]);
}

const ordered = [
  "baseline",
  ...[...groups.keys()].filter((k) => k !== "baseline").sort(),
];

// Baseline table
const bl = groups.get("baseline") ?? [];
console.log("baseline table");
console.log(
  "| Problem                          | Without skill                        |",
);
console.log(
  "| -------------------------------- | ------------------------------------ |",
);
for (const p of PROBLEMS) {
  const det = bl.filter((r) => r[`${p}_detected`] === "yes").length;
  const fix = bl.filter((r) => r[`${p}_fixed`] === "yes").length;
  console.log(
    `| ${LABELS[p]!.padEnd(32)} | ${`${det}/${bl.length} detected, ${fix}/${bl.length} fixed`.padEnd(36)} |`,
  );
}

// Summary table
console.log("\nresults summary table");
const header = [
  "Problem",
  ...ordered.map((k) => `${k} (${groups.get(k)?.length ?? 0} runs)`),
];
console.log(`| ${header.join(" | ")} |`);
console.log(`| ${header.map(() => "---").join(" | ")} |`);
for (const p of PROBLEMS) {
  const cells = [
    LABELS[p]!,
    ...ordered.map((k) => {
      const g = groups.get(k) ?? [];
      return pct(
        g.filter((r) => r[`${p}_detected`] === "yes").length,
        g.length,
      );
    }),
  ];
  console.log(`| ${cells.join(" | ")} |`);
}

const totalRuns = rows.length;
const totalPass = rows.filter((r) => r["tests_pass"] === "yes").length;
console.log(`\ntests passed on ${totalPass}/${totalRuns} total runs`);
