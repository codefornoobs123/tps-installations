/* Runs in <head>, before anything paints.
 *
 * The reveal animations are gated on html:not(.no-js), so the class has to
 * come off BEFORE the first paint. main.js is deferred, which means it runs
 * after the document has been parsed and drawn — so leaving the job to it
 * made the page render fully, then blank every revealable section, then fade
 * them back in. A flash of content disappearing is worse than no animation
 * at all.
 *
 * Deliberately its own file rather than an inline script: the CSP forbids
 * inline scripts, and adding a hash for one would have to survive the HTML
 * minifier rewriting it. Sixty bytes over an already-open connection is the
 * cheaper answer. */
document.documentElement.classList.remove("no-js");
