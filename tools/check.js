#!/usr/bin/env node
/**
 * Pre-launch audit. Run `npm run check` after `npm run build`.
 * Fails the build on anything that would cost rankings or break accessibility.
 */
const fs = require("fs");
const path = require("path");

const OUT = path.join(__dirname, "..", "_site");
const errors = [];
const warnings = [];


/** Attribute-order-agnostic tag lookup — the HTML is minified and sorted. */
function attr(html, tagName, matchAttr, matchValue, wantAttr) {
  const re = new RegExp(`<${tagName}\\b[^>]*>`, "gi");
  for (const m of html.match(re) || []) {
    const has = new RegExp(`\\b${matchAttr}\\s*=\\s*["']${matchValue}["']`, "i");
    if (!has.test(m)) continue;
    const got = m.match(new RegExp(`\\b${wantAttr}\\s*=\\s*["']([^"']*)["']`, "i"));
    return got ? got[1] : "";
  }
  return undefined;
}

function walk(dir, acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, acc);
    else if (e.name.endsWith(".html")) acc.push(p);
  }
  return acc;
}

if (!fs.existsSync(OUT)) {
  console.error("No _site/ directory. Run `npm run build` first.");
  process.exit(1);
}

const files = walk(OUT);
const titles = new Map();
const descs = new Map();
const urls = new Set();

for (const file of files) {
  const rel = "/" + path.relative(OUT, file).replace(/\\/g, "/").replace(/index\.html$/, "");
  urls.add(rel);
  urls.add(rel.replace(/\/$/, ""));
}

for (const file of files) {
  const rel = "/" + path.relative(OUT, file).replace(/\\/g, "/").replace(/index\.html$/, "");
  const html = fs.readFileSync(file, "utf8");
  const at = (msg) => `${rel}  ${msg}`;
  const isAdmin = rel.startsWith("/admin");
  if (isAdmin) continue;

  // --- Unrendered template syntax ---------------------------------------
  if (/\{\{|\{%/.test(html)) errors.push(at("contains unrendered Nunjucks syntax"));

  // --- Title -------------------------------------------------------------
  const title = (html.match(/<title>([\s\S]*?)<\/title>/) || [])[1];
  if (!title) errors.push(at("missing <title>"));
  else {
    if (title.length > 60) errors.push(at(`title is ${title.length} chars (max 60): "${title}"`));
    if (titles.has(title)) errors.push(at(`duplicate title, also on ${titles.get(title)}`));
    else titles.set(title, rel);
  }

  // --- Meta description ---------------------------------------------------
  const desc = attr(html, "meta", "name", "description", "content");
  if (!desc) errors.push(at("missing meta description"));
  else {
    if (desc.length > 155) errors.push(at(`meta description is ${desc.length} chars (max 155)`));
    if (descs.has(desc)) errors.push(at(`duplicate meta description, also on ${descs.get(desc)}`));
    else descs.set(desc, rel);
  }

  // --- Canonical ----------------------------------------------------------
  const canonical = attr(html, "link", "rel", "canonical", "href");
  if (!canonical) errors.push(at("missing canonical tag"));
  else if (!/^https?:\/\//i.test(canonical))
    warnings.push(at("canonical is relative — set site.url in content.json before launch"));

  // --- Headings -----------------------------------------------------------
  const h1s = html.match(/<h1[\s>]/g) || [];
  if (h1s.length === 0) errors.push(at("no <h1>"));
  if (h1s.length > 1) errors.push(at(`${h1s.length} <h1> elements (must be exactly 1)`));

  // Heading order: never skip a level going down.
  const levels = [...html.matchAll(/<h([1-4])[\s>]/g)].map((m) => Number(m[1]));
  for (let i = 1; i < levels.length; i++) {
    if (levels[i] - levels[i - 1] > 1) {
      warnings.push(at(`heading jumps from h${levels[i - 1]} to h${levels[i]}`));
      break;
    }
  }

  // --- Images -------------------------------------------------------------
  for (const m of html.matchAll(/<img\b[^>]*>/g)) {
    const tag = m[0];
    if (!/\balt=/.test(tag)) errors.push(at(`<img> without alt: ${tag.slice(0, 90)}`));
    if (!/\bwidth=/.test(tag) || !/\bheight=/.test(tag))
      errors.push(at(`<img> without width+height (causes CLS): ${tag.slice(0, 90)}`));
  }

  // --- Open Graph ---------------------------------------------------------
  for (const prop of ["og:title", "og:description", "og:image", "og:url"]) {
    if (attr(html, "meta", "property", prop, "content") === undefined) errors.push(at(`missing ${prop}`));
  }
  const ogImg = attr(html, "meta", "property", "og:image", "content");
  if (ogImg && !/^https?:\/\//i.test(ogImg))
    warnings.push(at("og:image is relative — social platforms need an absolute URL (set site.url)"));
  if (ogImg && /\.svg$/i.test(ogImg))
    warnings.push(at("og:image is an SVG — Facebook, LinkedIn and X ignore SVG. Use JPG or PNG."));
  if (attr(html, "meta", "name", "twitter:card", "content") === undefined) errors.push(at("missing twitter:card"));

  // --- JSON-LD ------------------------------------------------------------
  const ld = (html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/) || [])[1];
  if (!ld) errors.push(at("no JSON-LD"));
  else {
    try {
      const parsed = JSON.parse(ld);
      const types = (parsed["@graph"] || []).map((n) => n["@type"]);
      if (!types.includes("LocalBusiness")) errors.push(at("JSON-LD has no LocalBusiness node"));
    } catch (e) {
      errors.push(at(`JSON-LD does not parse: ${e.message}`));
    }
  }

  // --- Accessibility: icon-only controls need a name ----------------------
  for (const m of html.matchAll(/<button\b[^>]*>([\s\S]*?)<\/button>/g)) {
    const [tag, inner] = [m[0], m[1]];
    const hasText = inner.replace(/<[^>]*>/g, "").trim().length > 0;
    if (!hasText && !/aria-label=|aria-labelledby=/.test(tag))
      errors.push(at("icon-only <button> without an accessible name"));
  }
  for (const m of html.matchAll(/<a\b[^>]*>([\s\S]*?)<\/a>/g)) {
    const [tag, inner] = [m[0], m[1]];
    // An image's alt text IS the link's accessible name — count it as text.
    const altText = [...inner.matchAll(/\balt\s*=\s*["']([^"']*)["']/g)].map((a) => a[1]).join(" ");
    const hasText = (inner.replace(/<[^>]*>/g, "") + altText).trim().length > 0;
    if (!hasText && !/aria-label=|aria-labelledby=/.test(tag))
      errors.push(at(`icon-only <a> without an accessible name: ${tag.slice(0, 70)}`));
  }

  // --- Referenced assets exist (src=) --------------------------------------
  // href= alone was not enough: a <script src> or <img src> pointing at a file
  // that was never emitted sailed straight through this audit.
  for (const m of html.matchAll(/\ssrc="(\/[^"#?]*)"/g)) {
    const ref = m[1];
    if (!fs.existsSync(path.join(OUT, ref))) errors.push(at(`asset 404: ${ref}`));
  }

  // --- Internal links resolve ---------------------------------------------
  for (const m of html.matchAll(/href="(\/[^"#?]*)"/g)) {
    const href = m[1];
    if (/\.(css|js|svg|png|jpg|jpeg|webp|avif|xml|txt|webmanifest|ico|woff2?|ttf)$/.test(href)) {
      if (!fs.existsSync(path.join(OUT, href))) errors.push(at(`asset 404: ${href}`));
      continue;
    }
    if (href.startsWith("/admin")) continue;
    if (!urls.has(href)) errors.push(at(`internal link 404: ${href}`));
  }

  // --- Placeholders still in place ----------------------------------------
  const tokens = html.match(/TPS_[A-Z_]+/g);
  if (tokens) warnings.push(at(`unfilled placeholders: ${[...new Set(tokens)].join(", ")}`));
}

// --- Forms ----------------------------------------------------------------
const home = fs.readFileSync(path.join(OUT, "index.html"), "utf8");
if (!home.includes('data-netlify="true"')) errors.push("/ quote form is not wired to Netlify Forms");
if (!home.includes('data-netlify-honeypot=')) errors.push("/ quote form has no honeypot");

// --- Report ---------------------------------------------------------------
console.log(`\nChecked ${files.length} pages.\n`);
if (warnings.length) {
  console.log(`WARNINGS (${warnings.length}) — expected before launch, must be zero after:`);
  const grouped = {};
  for (const w of warnings) {
    const key = w.split("  ").slice(1).join("  ");
    (grouped[key] = grouped[key] || []).push(w.split("  ")[0]);
  }
  for (const [msg, pages] of Object.entries(grouped)) {
    console.log(`  • ${msg}  (${pages.length} page${pages.length > 1 ? "s" : ""})`);
  }
  console.log("");
}
if (errors.length) {
  console.log(`ERRORS (${errors.length}):`);
  for (const e of errors) console.log(`  ✗ ${e}`);
  console.log("");
  process.exit(1);
}
console.log("No errors.\n");
