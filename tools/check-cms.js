#!/usr/bin/env node
/**
 * Guards the one thing about Decap that silently destroys content:
 * Decap writes back ONLY the fields declared in src/admin/config.yml.
 * Any key in content.json that the config doesn't declare gets DELETED
 * the next time someone saves in the CMS.
 *
 * This walks content.json and fails if a key is missing from config.yml.
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const content = JSON.parse(fs.readFileSync(path.join(root, "content.json"), "utf8"));
const config = fs.readFileSync(path.join(root, "src", "admin", "config.yml"), "utf8");

const declared = new Set(
  [...config.matchAll(/(?:^|[-{,]\s*)name:\s*"?([A-Za-z0-9_]+)"?/gm)].map((m) => m[1])
);

const missing = new Set();
const seen = new Set();

function walk(node, trail) {
  if (Array.isArray(node)) {
    node.forEach((n) => walk(n, trail));
    return;
  }
  if (node === null || typeof node !== "object") return;
  for (const [key, value] of Object.entries(node)) {
    const p = trail ? `${trail}.${key}` : key;
    if (p.startsWith("_README")) continue;
    seen.add(key);
    if (!declared.has(key)) missing.add(p);
    walk(value, p);
  }
}
walk(content, "");

if (missing.size) {
  console.log(`\nCMS CONFIG OUT OF SYNC (${missing.size}):`);
  console.log("  These content.json fields are NOT declared in src/admin/config.yml.");
  console.log("  Decap will delete them the next time anyone saves at /admin.\n");
  for (const m of [...missing].sort()) console.log(`  ✗ ${m}`);
  console.log("");
  process.exit(1);
}
console.log(`CMS config covers all ${seen.size} content.json fields.\n`);
