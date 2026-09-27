#!/usr/bin/env node
/**
 * Builds preview/ — a set of standalone HTML files you can double-click in
 * Explorer and browse offline. No server, no Node, no assets folder: the CSS,
 * the JavaScript and every image are inlined into each page.
 *
 * FLAT ON PURPOSE. The real site uses folder-per-page so addresses come out
 * as /gallery/ rather than /gallery.html — which means thirty-one files all
 * called index.html, which is miserable to browse in Explorer. This folder
 * exists only to be clicked through, so it drops that convention: one folder,
 * one distinctly-named file per page, links rewritten to match. The built
 * site in _site/ is untouched and still uses proper addresses.
 *
 *     npm run preview
 *
 * It is throwaway. Delete the folder whenever you like — it's gitignored and
 * never deployed. The real workflow is `npm start`.
 */
const fs = require("fs");
const path = require("path");

const SITE = path.join(__dirname, "..", "_site");
const OUT = path.join(__dirname, "..", "preview");

if (!fs.existsSync(SITE)) {
  console.error("No _site/ yet. Run `npm run build` first.");
  process.exit(1);
}

const mime = { ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".avif": "image/avif", ".woff2": "font/woff2" };
const dataUriCache = new Map();
function dataUri(sitePath) {
  if (dataUriCache.has(sitePath)) return dataUriCache.get(sitePath);
  const file = path.join(SITE, sitePath.replace(/^\//, ""));
  if (!fs.existsSync(file)) return null;
  const type = mime[path.extname(file).toLowerCase()];
  if (!type) return null;
  const uri = `data:${type};base64,${fs.readFileSync(file).toString("base64")}`;
  dataUriCache.set(sitePath, uri);
  return uri;
}

/** "gallery/index.html" -> "gallery.html", "index.html" -> "home.html". */
function flatName(rel) {
  const parts = rel.split(path.sep);
  if (parts.length === 1) return parts[0] === "index.html" ? "home.html" : parts[0];
  return parts.slice(0, -1).join("-") + ".html";
}

/** "/services/kitchens/" -> "services-kitchens.html", "/" -> "home.html". */
function flatHref(val) {
  const trimmed = val.replace(/^\/+|\/+$/g, "");
  if (!trimmed) return "home.html";
  // Things that are not pages in this folder — sitemap.xml, site.webmanifest,
  // robots.txt, /admin/ — are left exactly as they are. Renaming them would
  // produce nonsense like sitemap.xml.html.
  if (/\.[a-z0-9]+$/i.test(trimmed) && !/\.html$/i.test(trimmed)) return val;
  if (trimmed === "admin" || trimmed.startsWith("admin/")) return val;
  const joined = trimmed.split("/").join("-");
  return /\.html$/i.test(joined) ? joined : joined + ".html";
}

function walk(dir, acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, acc);
    else if (e.name.endsWith(".html")) acc.push(p);
  }
  return acc;
}

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
const js = fs.readFileSync(path.join(SITE, "assets", "js", "main.js"), "utf8");
const bootJs = fs.readFileSync(path.join(SITE, "assets", "js", "boot.js"), "utf8");

/* No preview banner. It used to inject a black strip above the header, which
   sat on top of the site on every page and made the preview misrepresent the
   real thing -- the whole point of the preview is to show the site as it is.
   The "this is a preview" message lives in the README and in
   OPEN-THE-WEBSITE.html instead, where it isn't covering the design. */

let count = 0;
for (const file of walk(SITE)) {
  const rel = path.relative(SITE, file);
  if (rel.startsWith("admin")) continue;
  let html = fs.readFileSync(file, "utf8");

  // The CSP forbids inline scripts. That's right for the live site and wrong
  // for a file:// preview, where everything has to be inline.
  html = html.replace(/<meta\b[^>]*Content-Security-Policy[^>]*>/i, "");

  // Point every <img> at the LARGEST candidate in its own srcset, then drop
  // srcset/sizes and the <source> siblings.
  //
  // This used to just strip srcset and trust `src`. It was wrong, and quietly
  // so: eleventy-img sets `src` to the SMALLEST variant as a fallback, so the
  // preview was blowing a 480px image up across the whole screen and every
  // page looked far softer than the real site. Nothing 404s and nothing warns
  // — it just looks bad, which is the worst kind of bug in a preview whose
  // entire job is showing you what the site looks like.
  html = html.replace(/<img\b[^>]*>/g, (tag) => {
    const set = tag.match(/\ssrcset="([^"]+)"/);
    if (!set) return tag;
    // Largest candidate up to CAP. Not the outright largest: every image is
    // base64'd into the page, so the 2016px originals pushed the homepage to
    // 6.6MB and the folder to 33MB — enough to fill a disk. 1200px is still
    // sharp at any normal window size and roughly halves the weight.
    const CAP = 1200;
    const cands = set[1]
      .split(",")
      .map((c) => c.trim().split(/\s+/))
      .map(([url, w]) => ({ url, w: parseInt(w, 10) || 0 }))
      .sort((a, b) => b.w - a.w);
    const best = cands.find((c) => c.w <= CAP) || cands[cands.length - 1];
    return best && best.url ? tag.replace(/\ssrc="[^"]*"/, ` src="${best.url}"`) : tag;
  });
  html = html.replace(/\s(?:srcset|sizes)="[^"]*"/g, "");
  html = html.replace(/<source[^>]*>/g, "");

  // Inline every image.
  html = html.replace(/(src|href)="(\/assets\/[^"]+)"/g, (m, attr, val) => {
    const uri = dataUri(val);
    return uri ? `${attr}="${uri}"` : m;
  });

  // Inline the FONTS, and drop their preload tags.
  //
  // These were left pointing at /assets/fonts/... — absolute paths that resolve
  // to nothing off file://, and which Chrome blocks anyway (fonts are subject
  // to CORS, and a file:// page has a null origin). So every preview since this
  // tool was written has rendered in fallback system fonts, with no Lora, no
  // Plus Jakarta Sans and no Space Mono. The preview was showing a different
  // typeface to the one the site actually ships. Data URIs are the only thing
  // that works from a local file.
  html = html.replace(/<link\b[^>]*rel="preload"[^>]*\/assets\/fonts\/[^>]*>/g, "");
  html = html.replace(/url\((['"]?)(\/assets\/fonts\/[^'")]+)\1\)/g, (m, q, val) => {
    const uri = dataUri(val);
    return uri ? `url(${uri})` : m;
  });

  // Inline the JS, drop the external references. boot.js has to stay first —
  // it strips the no-js class before anything paints.
  html = html.replace(/<script\b[^>]*src="\/assets\/js\/boot\.js"[^>]*>\s*<\/script>/, `<script>${bootJs}</script>`);
  html = html.replace(/<script\b[^>]*src="\/assets\/js\/main\.js"[^>]*>\s*<\/script>/, `<script>${js}</script>`);

  // Every other absolute path becomes a flat sibling filename, so the links
  // work off file:// with everything in one folder.
  html = html.replace(/(href|content)="(\/[^"]*)"/g, (m, attr, val) => {
    if (val.startsWith("//") || val.startsWith("/assets/")) return m;
    return `${attr}="${flatHref(val)}"`;
  });


  fs.writeFileSync(path.join(OUT, flatName(rel)), html);
  count++;
}

// A stub index.html that bounces to home.html.
//
// Josh has double-clicked preview/index.html for weeks. When this folder went
// flat, the old index.html stayed behind — a stale build with none of the new
// work in it — so the habit silently opened the wrong page and it looked like
// nothing had changed. Habits win; make the habit land somewhere correct.
fs.writeFileSync(path.join(OUT, "index.html"), `<!doctype html>
<html lang="en-GB"><head><meta charset="utf-8">
<meta http-equiv="refresh" content="0;url=home.html">
<title>TPS Installations preview</title>
<style>body{font:16px/1.6 system-ui,sans-serif;margin:0;display:grid;place-items:center;min-height:100vh;background:#16140F;color:#F0ECE4}a{color:#D2A044}</style>
</head><body><p>Opening the preview&hellip; <a href="home.html">home.html</a></p></body></html>
`);

// A launcher at the PROJECT ROOT, not just inside preview/.
//
// The root of an Eleventy project has no openable web page, and that has been
// the single most repeated confusion on this job — "where is the index?".
// One obvious file at the top level, pointing into the preview, ends it.
fs.writeFileSync(path.join(__dirname, "..", "OPEN-THE-WEBSITE.html"), `<!doctype html>
<html lang="en-GB"><head><meta charset="utf-8">
<meta http-equiv="refresh" content="0;url=preview/home.html">
<title>TPS Installations &mdash; open the website</title>
<style>body{font:16px/1.6 system-ui,-apple-system,"Segoe UI",sans-serif;margin:0;background:#16140F;color:#F0ECE4;display:grid;place-items:center;min-height:100vh;text-align:center;padding:24px}h1{font:500 26px/1.2 Georgia,serif;margin:0 0 10px}p{margin:0 0 6px;color:rgba(240,236,228,.66);max-width:44ch}a{color:#D2A044}</style>
</head><body><div>
<h1>Opening the website&hellip;</h1>
<p>If nothing happens, click <a href="preview/home.html">preview/home.html</a>.</p>
<p>This is a local preview. The real site is built from <code>src/</code>.</p>
</div></body></html>
`);

console.log(`preview/ ready — ${count} standalone pages, no external files.`);
console.log("Double-click preview/home.html");
