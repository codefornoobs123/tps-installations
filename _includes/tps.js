/**
 * Loads content.json and derives everything the templates need.
 * This is the ONLY place content.json is read. Templates never touch the file directly.
 */
const fs = require("fs");
const path = require("path");

const FILE = path.join(__dirname, "..", "..", "content.json");
const FONT_CSS = path.join(__dirname, "..", "assets", "css", "fonts.css");

function slugify(s) {
  return String(s).toLowerCase().trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/* ---------------------------------------------------------------------------
   UNFINISHED CONTENT NEVER RENDERS (2026-09-27)
   Anything still written as TPS_SOMETHING or containing [square-bracket
   instructions] is treated as not there. Pages built from it are not built,
   links to them are not drawn, and lines holding it are dropped. Each item
   comes back by itself the moment the real words go into content.json.
   The build log lists everything that is being held back.
   --------------------------------------------------------------------------- */
const UNFINISHED = /TPS_[A-Z_]+|\[[^\]]{3,}\]/;
function unfinished(v) {
  if (v == null) return false;
  if (typeof v === "string") return UNFINISHED.test(v);
  if (Array.isArray(v)) return v.some(unfinished);
  if (typeof v === "object") return Object.values(v).some(unfinished);
  return false;
}
const held = [];

module.exports = function () {
  held.length = 0;
  const raw = JSON.parse(fs.readFileSync(FILE, "utf8"));

  // --- Services -----------------------------------------------------------
  const services = (raw.services || []).map((s) => ({
    ...s,
    slug: s.slug || slugify(s.name),
    url: `/services/${s.slug || slugify(s.name)}/`,
  }));
  const serviceBySlug = Object.fromEntries(services.map((s) => [s.slug, s]));

  // --- Areas --------------------------------------------------------------
  const areas = (raw.areas || []).map((a) => ({
    ...a,
    localReference: unfinished(a.localReference) ? (held.push(`areas/${a.slug || slugify(a.name)} localReference`), "") : a.localReference,
    slug: a.slug || slugify(a.name),
    url: `/areas/${a.slug || slugify(a.name)}/`,
  }));
  const areaBySlug = Object.fromEntries(areas.map((a) => [a.slug, a]));

  // --- Location pages (town x service) ------------------------------------
  // Only built where real copy exists. No auto-generated doorway pages.
  const locationPages = [];
  const orphans = [];
  for (let lp of raw.locationPages || []) {
    const area = areaBySlug[lp.areaSlug];
    const service = serviceBySlug[lp.serviceSlug];
    if (!area || !service) {
      orphans.push(`${lp.areaSlug} + ${lp.serviceSlug}`);
      continue;
    }
    if (unfinished([lp.h1, lp.intro, lp.seo])) {
      held.push(`/${lp.areaSlug}-${lp.serviceSlug}/ (page not built: copy still a placeholder)`);
      continue;
    }
    if (unfinished(lp.localReference)) {
      held.push(`/${lp.areaSlug}-${lp.serviceSlug}/ localReference`);
      lp = { ...lp, localReference: "" };
    }
    locationPages.push({
      ...lp,
      area,
      service,
      url: `/${area.slug}-${service.slug}/`,
      gallery: (raw.gallery || []).filter(
        (g) => g.area === area.slug || g.service === service.slug
      ),
    });
  }

  // --- Build-time warnings ------------------------------------------------
  const have = new Set(locationPages.map((l) => `${l.area.slug}|${l.service.slug}`));
  const missing = [];
  for (const a of areas) {
    for (const s of services) {
      if (!have.has(`${a.slug}|${s.slug}`)) missing.push(`/${a.slug}-${s.slug}/`);
    }
  }
  if (missing.length) {
    console.warn(
      `\n[content] ${missing.length} town+service page(s) not built — add an entry to locationPages[] in content.json with unique copy:\n  ${missing.join("\n  ")}\n`
    );
  }
  if (orphans.length) {
    console.warn(
      `\n[content] locationPages[] entries reference a town or service that does not exist:\n  ${orphans.join("\n  ")}\n`
    );
  }

  // --- Derived contact helpers -------------------------------------------
  const c = raw.contact || {};
  const telHref = `tel:${String(c.phoneLink || "").replace(/[^\d+]/g, "") || c.phoneLink}`;
  // A placeholder WhatsApp number would produce a dead wa.me link, so no link.
  const waDigits = unfinished(c.whatsappNumber) ? "" : String(c.whatsappNumber || "").replace(/[^\d]/g, "");
  const waHref = waDigits
    ? `https://wa.me/${waDigits}?text=${encodeURIComponent(c.whatsappMessage || "")}`
    : "";

  const addr = c.address || {};
  const addressLine = [addr.street, addr.locality, addr.region, addr.postcode]
    .filter(Boolean)
    .join(", ");

  const rawUrl = String((raw.site || {}).url || "").replace(/\/+$/, "");
  const siteUrlSet = /^https?:\/\//i.test(rawUrl);
  // Until site.url is a real URL, emit relative canonicals and skip the sitemap line
  // in robots.txt — a canonical of "TPS_SITE_URL/" is invalid and Google drops it.
  const siteUrl = siteUrlSet ? rawUrl : "";
  if (!siteUrlSet) {
    console.warn("[content] site.url is not set — canonical tags will be relative and robots.txt will omit the sitemap. Set it before launch.");
  }

  // --- Trust lines: only what is confirmed ------------------------------
  const t = raw.trust || {};
  const credentials = (t.credentials || []).filter((cr) => {
    const hide = !!cr.flag || unfinished([cr.title, cr.body]);
    if (hide) held.push(`credential "${cr.title}" (${cr.flag || "placeholder"}). Clear its flag once confirmed`);
    return !hide;
  });
  const accreditations = (t.accreditations || []).filter((b) => {
    const file = path.join(__dirname, "..", String(b.logo || "").replace(/^\//, ""));
    const placeholder = fs.existsSync(file) && /PLACEHOLDER/i.test(fs.readFileSync(file, "utf8"));
    if (placeholder) held.push(`accreditation logo ${b.logo} (placeholder artwork)`);
    return !placeholder;
  });
  const insuranceConfirmed = !unfinished(t.insuranceValue);
  if (!insuranceConfirmed) held.push("hero stat \"Insured\" (trust.insuranceValue not confirmed)");
  const site = { ...(raw.site || {}) };
  for (const k of ["companyNumber", "vatNumber"]) {
    if (unfinished(site[k])) { held.push(`site.${k}`); site[k] = ""; }
  }
  const contact = { ...(raw.contact || {}) };
  for (const k of ["email", "whatsappNumber"]) {
    if (unfinished(contact[k])) { held.push(`contact.${k}`); contact[k] = ""; }
  }

  if (held.length) {
    console.warn(`\n[content] Held back until real (not rendered):\n  ${held.join("\n  ")}\n`);
  }

  return {
    ...raw,
    site,
    contact,
    trust: { ...t, credentials, accreditations, insuranceConfirmed },
    services,
    areas,
    serviceBySlug,
    areaBySlug,
    locationPages,
    derived: {
      telHref,
      waHref,
      addressLine,
      siteUrl,
      siteUrlSet,
      selfHostedFonts: fs.existsSync(FONT_CSS),
      currentYear: new Date().getFullYear(),
      hasSocial: Object.values(raw.social || {}).some(Boolean),
      globalFaqs: (raw.faqs || []).filter((f) => !f.scope || f.scope === "global"),
    },
  };
};
