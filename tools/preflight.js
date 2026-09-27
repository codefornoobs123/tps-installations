#!/usr/bin/env node
/**
 * Runs before every build.
 *
 * The site was flattened in September 2026: page templates moved from
 * src/pages/ up into src/, layouts and partials merged into src/_includes/,
 * and the two data files moved from src/_data/ up into src/.
 *
 * If the OLD folders are still sitting there, their templates render to the
 * same permalinks as the new ones and Eleventy dies with an unhelpful
 * "output conflict". This catches that and says so in plain English.
 *
 * If it fires: double-click FINISH-TIDY-UP.bat in the project root.
 */
const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..");

const exists = (p) => fs.existsSync(path.join(root, p));
const hasFiles = (p) => exists(p) && fs.readdirSync(path.join(root, p)).length > 0;

const stale = [];
const blocking = [];

// Old folders from before the flatten. src/pages/ is the dangerous one —
// it renders to the same URLs as the pages now in src/.
for (const dir of ["src/pages", "src/_data", "src/_includes/layouts", "src/_includes/partials"]) {
  if (hasFiles(dir)) {
    stale.push(dir + "/");
    if (dir === "src/pages" || dir === "src/_data") blocking.push(dir + "/");
  }
}

// Individually retired files
for (const f of [
  "src/_includes/trust-bar.njk",
  "src/_includes/partials/trust-bar.njk",
  "CLIENT-CHECKLIST.md",
  "src/assets/img/service-1.svg",
  "src/assets/img/service-2.svg",
  "src/assets/img/service-3.svg",
  "src/assets/img/badge-gas-safe.svg",
]) {
  if (exists(f)) stale.push(f);
}

// The flatten should have left these sitting directly in src/.
const required = ["src/index.njk", "src/_includes/tps.js", "src/_includes/eleventyComputed.js", "src/_includes/base.njk"];
const missing = required.filter((f) => !exists(f));

if (missing.length) {
  console.error("\n" + "─".repeat(66));
  console.error("  Files the build needs are missing:\n");
  for (const f of missing) console.error(`    ${f}`);
  console.error("\n  These should sit directly inside src/ (and src/_includes/).");
  console.error("  If you moved something by hand, put it back.");
  console.error("─".repeat(66) + "\n");
  process.exit(1);
}

if (stale.length) {
  console.error("\n" + "─".repeat(66));
  console.error("  Leftover folders from before the tidy-up:\n");
  for (const f of stale) console.error(`    ${f}`);
  console.error("\n  Double-click FINISH-TIDY-UP.bat in the project folder to sweep");
  console.error("  them into _OLD\\, then run this again.");
  if (blocking.length) {
    console.error("\n  (These WILL break the build — the pages inside them write to");
    console.error("   the same URLs as the ones now in src/.)");
  }
  console.error("─".repeat(66) + "\n");
  if (blocking.length) process.exit(1);
}
