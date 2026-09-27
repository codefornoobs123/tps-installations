/**
 * Central SEO + breadcrumb derivation.
 * Pages declare `pageKey` (a key under pages{} in content.json) or a
 * `schemaType` of service / location / area, and everything below follows.
 * Keeping it here means <title>, description, OG tags, breadcrumbs and JSON-LD
 * can never drift apart.
 */

function seoFor(data) {
  const t = data.tps || {};
  if (data.schemaType === "service" && data.service) return data.service.seo || {};
  if (data.schemaType === "location" && data.loc) return data.loc.seo || {};
  if (data.schemaType === "area" && data.area) return data.area.seo || {};
  if (data.pageKey && t.pages && t.pages[data.pageKey]) return t.pages[data.pageKey].seo || {};
  return {};
}

module.exports = {
  title: (data) => seoFor(data).title || data.title || (data.tps && data.tps.site.name),

  description: (data) =>
    seoFor(data).description ||
    data.description ||
    (data.tps && data.tps.seo.defaultDescription),

  ogImage: (data) => {
    const t = data.tps || {};
    if (data.ogImage) return data.ogImage;
    if (data.schemaType === "service" && data.service) return data.service.image;
    if (data.schemaType === "location" && data.loc) return data.loc.service.image;
    return t.site && t.site.defaultOgImage;
  },

  ogImageAlt: (data) => {
    const t = data.tps || {};
    if (data.ogImageAlt) return data.ogImageAlt;
    if (data.schemaType === "service" && data.service) return data.service.imageAlt;
    if (data.schemaType === "location" && data.loc) return data.loc.service.imageAlt;
    return t.site && t.site.defaultOgImageAlt;
  },

  crumbs: (data) => {
    if (data.crumbs) return data.crumbs;
    const home = { label: "Home", url: "/" };
    if (data.schemaType === "service" && data.service) {
      return [home, { label: "Services", url: "/services/" }, { label: data.service.name, url: data.service.url }];
    }
    if (data.schemaType === "area" && data.area) {
      return [home, { label: "Areas We Cover", url: "/areas/" }, { label: data.area.name, url: data.area.url }];
    }
    if (data.schemaType === "location" && data.loc) {
      return [
        home,
        { label: "Areas We Cover", url: "/areas/" },
        { label: data.loc.area.name, url: data.loc.area.url },
        { label: data.loc.service.name, url: data.loc.url },
      ];
    }
    if (data.pageKey && data.pageKey !== "home" && data.tps && data.tps.pages[data.pageKey]) {
      return [home, { label: data.tps.pages[data.pageKey].h1 || data.tps.pages[data.pageKey].seo.title, url: data.page.url }];
    }
    return [];
  },

  /** FAQ items for both the visible accordion and the FAQPage schema. */
  faqItems: (data) => {
    const all = (data.tps && data.tps.faqs) || [];
    if (!data.faqScope) return [];
    if (data.faqScope === "global") return all.filter((f) => !f.scope || f.scope === "global");
    return all.filter((f) => f.scope === data.faqScope || !f.scope || f.scope === "global");
  },
};
