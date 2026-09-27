/* TPS Installations — progressive enhancement.
   Everything here is optional: the site works with JavaScript disabled.
   The FAQ accordion is native <details>. Images use native loading="lazy".
   Form validation falls back to the browser's own when this doesn't run. */
(function () {
  "use strict";

  /* ---------------------------------------------------------------------
     Mobile navigation
     --------------------------------------------------------------------- */
  var toggle = document.querySelector(".nav-toggle");
  var nav = document.getElementById("site-nav");

  if (toggle && nav) {
    var setOpen = function (open) {
      toggle.setAttribute("aria-expanded", String(open));
      nav.setAttribute("data-open", String(open));
      toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
      document.body.classList.toggle("is-locked", open);
    };

    toggle.addEventListener("click", function () {
      setOpen(toggle.getAttribute("aria-expanded") !== "true");
    });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && toggle.getAttribute("aria-expanded") === "true") {
        setOpen(false);
        toggle.focus();
      }
    });

    nav.addEventListener("click", function (e) {
      if (e.target.closest("a")) setOpen(false);
    });

    var mq = window.matchMedia("(min-width: 1000px)");
    var sync = function () { if (mq.matches) setOpen(false); };
    if (mq.addEventListener) mq.addEventListener("change", sync); else mq.addListener(sync);
  }

  /* ---------------------------------------------------------------------
     One FAQ answer open at a time
     --------------------------------------------------------------------- */
  var faqs = document.querySelectorAll(".faq details");
  Array.prototype.forEach.call(faqs, function (d) {
    var panel = d.querySelector("div");

    d.addEventListener("toggle", function () {
      if (d.open) {
        d.classList.add("is-open");
        Array.prototype.forEach.call(faqs, function (other) {
          if (other !== d && other.open) closeSmoothly(other);
        });
      }
    });

    // <details> drops the content the instant `open` is removed, which kills
    // the closing animation. Hold it open until the transition finishes.
    d.addEventListener("click", function (e) {
      if (!d.open) return;
      if (!e.target.closest("summary")) return;
      e.preventDefault();
      closeSmoothly(d);
    });

    function closeSmoothly(el) {
      el.classList.remove("is-open");
      var p = el.querySelector("div");
      if (!p || !window.getComputedStyle(p).transitionDuration.startsWith("0")) {
        var done = function () {
          el.open = false;
          p.removeEventListener("transitionend", done);
        };
        p.addEventListener("transitionend", done);
        // Belt and braces if the transition never fires.
        setTimeout(function () { if (!el.classList.contains("is-open")) el.open = false; }, 500);
      } else {
        el.open = false;
      }
    }
  });


  /* =====================================================================
     MOTION
     All of this is enhancement. With JS off, the `no-js` class stays on
     <html> and every element is simply visible.
     ===================================================================== */
  var root = document.documentElement;
  root.classList.remove("no-js");

  var REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* --- Scroll reveal, with a stagger inside groups --------------------- */
  if ("IntersectionObserver" in window && !REDUCED) {
    // Direct children of a group become reveal items and get a delay each.
    Array.prototype.forEach.call(document.querySelectorAll("[data-reveal-group]"), function (group) {
      Array.prototype.forEach.call(group.children, function (child, i) {
        if (!child.hasAttribute("data-reveal")) child.setAttribute("data-reveal", "");
        child.style.setProperty("--stagger", Math.min(i, 6) * 70 + "ms");
      });
    });

    var revealer = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.classList.add("is-in");
        revealer.unobserve(e.target);
      });
    }, { rootMargin: "0px 0px -12% 0px", threshold: 0.08 });

    Array.prototype.forEach.call(document.querySelectorAll("[data-reveal]"), function (el) {
      revealer.observe(el);
    });

    // The rule above each process step draws itself in.
    var stepObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (e, i) {
        if (!e.isIntersecting) return;
        e.target.classList.add("is-in");
        stepObserver.unobserve(e.target);
      });
    }, { threshold: 0.3 });
    Array.prototype.forEach.call(document.querySelectorAll(".steps li"), function (el) {
      stepObserver.observe(el);
    });
  }

  /* --- Counters: numbers count up the first time you see them ---------- */
  if ("IntersectionObserver" in window) {
    var counters = document.querySelectorAll("[data-count]");
    var countObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        countObserver.unobserve(e.target);
        var el = e.target;
        var raw = el.textContent.trim();
        var num = parseFloat(raw.replace(/[^0-9.]/g, ""));
        // Placeholders like TPS_YEARS aren't numbers — leave them alone.
        if (!isFinite(num) || num <= 0 || REDUCED) return;
        var suffix = raw.replace(/[0-9.,]/g, "");
        var start = null;
        var dur = 1100;
        var step = function (t) {
          if (start === null) start = t;
          var p = Math.min((t - start) / dur, 1);
          // ease-out cubic
          var v = Math.round(num * (1 - Math.pow(1 - p, 3)));
          el.textContent = v + suffix;
          if (p < 1) requestAnimationFrame(step);
          else el.textContent = raw;
        };
        el.textContent = "0" + suffix;
        requestAnimationFrame(step);
      });
    }, { threshold: 0.5 });
    Array.prototype.forEach.call(counters, function (el) { countObserver.observe(el); });
  }

  /* --- Header state + sticky bar, on one rAF-throttled scroll listener -- */
  var header = document.querySelector(".site-header");
  var stickyBar = document.querySelector(".sticky-cta");
  var lastY = window.scrollY;
  var ticking = false;

  function onScroll() {
    var y = window.scrollY;
    if (header) {
      header.classList.toggle("is-solid", y > 8);
      var menuOpen = toggle && toggle.getAttribute("aria-expanded") === "true";
      // Hide going down, reveal coming up — but never while the menu is open
      // and never right at the top.
      if (!menuOpen && y > 260 && y > lastY + 4) header.classList.add("is-hidden");
      else if (y < lastY - 4 || y < 260) header.classList.remove("is-hidden");
    }
    if (stickyBar) stickyBar.classList.toggle("is-in", y > 420);
    lastY = y;
    ticking = false;
  }

  window.addEventListener("scroll", function () {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(onScroll);
  }, { passive: true });
  onScroll();

  /* --- Before/after compare sliders ------------------------------------ */
  Array.prototype.forEach.call(document.querySelectorAll(".job__compare"), function (box) {
    var range = box.querySelector(".job__range");
    if (!range) return;
    var beforeTag = box.querySelector(".job__tag--before");
    var afterTag = box.querySelector(".job__tag--after");

    var apply = function () {
      var v = range.value;
      box.style.setProperty("--pos", v + "%");
      // Fade a label out when the handle is sitting on top of it.
      if (beforeTag) beforeTag.style.opacity = v < 18 ? 0 : 1;
      if (afterTag) afterTag.style.opacity = v > 82 ? 0 : 1;
    };

    range.addEventListener("input", apply);
    // Dragging anywhere on the image should move the handle, not just the thumb.
    var drag = function (e) {
      var rect = box.getBoundingClientRect();
      var x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
      range.value = Math.max(0, Math.min(100, (x / rect.width) * 100));
      apply();
    };
    var stop = function () {
      window.removeEventListener("pointermove", drag);
      window.removeEventListener("pointerup", stop);
    };
    box.addEventListener("pointerdown", function (e) {
      drag(e);
      window.addEventListener("pointermove", drag);
      window.addEventListener("pointerup", stop);
    });
    apply();
  });

  /* ---------------------------------------------------------------------
     Analytics bootstrap. Lives here rather than in an inline <script> so the
     Content Security Policy can forbid inline scripts entirely.
     Plausible needs no bootstrap; GA4 does.
     --------------------------------------------------------------------- */
  /* GA4 sets cookies, so under UK PECR it may only load after the visitor
     says yes. The choice is kept in localStorage (strictly necessary, so it
     needs no consent itself). Nothing from Google is requested before
     "Accept": not gtag.js, not a pixel, nothing. */
  var ga4 = document.querySelector('meta[name="ga4-measurement-id"]');
  var CONSENT_KEY = "tps-consent";
  function getConsent() { try { return localStorage.getItem(CONSENT_KEY); } catch (e) { return null; } }
  function setConsent(v) { try { localStorage.setItem(CONSENT_KEY, v); } catch (e) {} }

  var gaLoaded = false;
  function loadGA() {
    if (gaLoaded || !ga4 || !ga4.content) return;
    gaLoaded = true;
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag("js", new Date());
    window.gtag("config", ga4.content, { anonymize_ip: true });
    var s = document.createElement("script");
    s.async = true;
    s.src = "https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(ga4.content);
    document.head.appendChild(s);
  }
  // On withdrawal, stop sending and clear Google's cookies for this site.
  function unloadGA() {
    if (ga4 && ga4.content) window["ga-disable-" + ga4.content] = true;
    var host = location.hostname.replace(/^www\./, "");
    document.cookie.split(";").forEach(function (c) {
      var name = c.split("=")[0].replace(/^\s+/, "");
      if (/^_ga/.test(name) || name === "_gid") {
        ["", "; domain=" + host, "; domain=." + host].forEach(function (d) {
          document.cookie = name + "=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/" + d;
        });
      }
    });
  }

  var banner = document.querySelector("[data-consent]");
  function showBanner(focus) {
    if (!banner) return;
    banner.hidden = false;
    requestAnimationFrame(function () { banner.classList.add("is-in"); });
    if (focus) { var b = banner.querySelector("button"); if (b) b.focus(); }
  }
  function hideBanner() {
    if (!banner) return;
    banner.classList.remove("is-in");
    setTimeout(function () { banner.hidden = true; }, 250);
  }

  if (ga4 && ga4.content) {
    var choice = getConsent();
    if (choice === "granted") loadGA();
    else if (choice !== "denied") showBanner(false);

    if (banner) {
      Array.prototype.forEach.call(banner.querySelectorAll("[data-consent-choice]"), function (b) {
        b.addEventListener("click", function () {
          var v = b.getAttribute("data-consent-choice");
          setConsent(v);
          if (v === "granted") { window["ga-disable-" + ga4.content] = false; loadGA(); }
          else unloadGA();
          hideBanner();
        });
      });
    }
    Array.prototype.forEach.call(document.querySelectorAll("[data-consent-open]"), function (b) {
      b.addEventListener("click", function () { showBanner(true); });
    });
  }

  /* ---------------------------------------------------------------------
     Conversion tracking. Fires only if an analytics provider is loaded —
     nothing here creates a tracker of its own.
     --------------------------------------------------------------------- */
  function track(name, props) {
    try {
      if (window.plausible) window.plausible(name, props ? { props: props } : undefined);
      else if (window.gtag) window.gtag("event", name, props || {});
    } catch (e) { /* tracking must never break the page */ }
  }

  document.addEventListener("click", function (e) {
    var a = e.target.closest("a");
    if (!a) return;
    var href = a.getAttribute("href") || "";
    if (href.indexOf("tel:") === 0) track("Phone click", { location: a.closest(".sticky-cta") ? "sticky bar" : "page" });
    else if (href.indexOf("wa.me") > -1) track("WhatsApp click");
    else if (href.indexOf("mailto:") === 0) track("Email click");
  });

  /* ---------------------------------------------------------------------
     Quote form: inline validation, live tidy-up of phone and postcode,
     progress bar, valid ticks, auto-growing message box, loading state.
     Everything here is enhancement: with JS off the form still submits.
     --------------------------------------------------------------------- */
  var MESSAGES = {
    name: "Please tell us your name.",
    phone: "Please enter a number we can reach you on.",
    postcode: "Please enter the property postcode.",
    email: "That email address doesn't look right."
  };
  var FORMAT_MESSAGES = {
    phone: "That number looks too short. Please check it.",
    postcode: "That postcode doesn't look right. It should look like BH22 9AB."
  };

  // UK numbers: accept spaces, brackets, dashes and +44, store as 0xxxx xxxxxx.
  function phoneDigits(v) {
    var d = String(v).replace(/[^\d+]/g, "");
    if (d.indexOf("+44") === 0) d = "0" + d.slice(3);
    else if (d.indexOf("0044") === 0) d = "0" + d.slice(4);
    return d.replace(/\+/g, "");
  }
  function phoneOk(v) { var d = phoneDigits(v); return /^0\d{9,10}$/.test(d); }
  function phonePretty(v) {
    var d = phoneDigits(v);
    if (!/^0\d{9,10}$/.test(d)) return v;
    if (/^0(20|23|24|28|29)/.test(d) && d.length === 11) return d.slice(0, 3) + " " + d.slice(3, 7) + " " + d.slice(7);
    return d.slice(0, 5) + " " + d.slice(5);
  }
  // Full UK postcode, any spacing, any case.
  var POSTCODE = /^([A-Z]{1,2}\d[A-Z\d]?)\s*(\d[A-Z]{2})$/;
  function postcodeClean(v) { return String(v).toUpperCase().replace(/\s+/g, " ").replace(/^\s|\s$/g, ""); }
  function postcodeOk(v) { return POSTCODE.test(postcodeClean(v).replace(/\s/g, "")); }
  function postcodePretty(v) {
    var m = postcodeClean(v).replace(/\s/g, "").match(POSTCODE);
    return m ? m[1] + " " + m[2] : postcodeClean(v);
  }

  function fieldError(input, show, message) {
    var wrap = input.closest(".field");
    if (!wrap) return;
    var err = wrap.querySelector(".field-error");
    if (!err) {
      err = document.createElement("p");
      err.className = "field-error";
      err.id = input.id + "-error";
      err.setAttribute("role", "alert");
      wrap.appendChild(err);
    }
    if (show) {
      err.textContent = message;
      err.hidden = false;
      input.setAttribute("aria-invalid", "true");
      input.setAttribute("aria-describedby", err.id);
    } else {
      err.hidden = true;
      input.removeAttribute("aria-invalid");
      input.removeAttribute("aria-describedby");
    }
  }

  // Returns true/false without touching the UI.
  function isValid(input) {
    var v = input.value.replace(/^\s+|\s+$/g, "");
    if (input.required && !v) return false;
    if (!v) return true;
    if (input.dataset.kind === "phone") return phoneOk(v);
    if (input.dataset.kind === "postcode") return postcodeOk(v);
    return input.checkValidity();
  }

  function validate(input) {
    var ok = isValid(input);
    var empty = !input.value.replace(/\s/g, "");
    var msg = (!empty && FORMAT_MESSAGES[input.dataset.kind]) || MESSAGES[input.name] || "Please check this field.";
    fieldError(input, !ok, msg);
    input.classList.toggle("is-valid", ok && !empty);
    return ok;
  }

  Array.prototype.forEach.call(document.querySelectorAll("form[data-netlify]"), function (form) {
    var card = form.closest("[data-quote-form]");
    var inputs = form.querySelectorAll("input[required], select[required], textarea[required], input[type=email]");
    var tracked = form.querySelectorAll("[data-track]");
    var btn = form.querySelector('button[type="submit"]');
    var label = btn && btn.querySelector(".qf-submit__label");

    // Take over from the browser's default bubbles so the messages are
    // styled, announced, and don't vanish on the next keystroke.
    form.setAttribute("novalidate", "novalidate");

    /* ---- Steps ---------------------------------------------------- */
    var steps = card ? card.querySelectorAll(".qf-step") : [];
    var status = card && card.querySelector(".qf-status");
    var current = 1;
    var total = steps.length;
    var stepped = total > 1;

    function stepEl(n) { return steps[n - 1]; }
    function jobPicked() { return !!form.querySelector('input[name="job-type"]:checked'); }

    // How much of the current step is done, 0 to 1.
    function stepDone(n) {
      var el = stepEl(n);
      if (!el) return 0;
      if (el.querySelector('input[name="job-type"]')) return jobPicked() ? 1 : 0;
      var req = el.querySelectorAll("[data-track]");
      if (!req.length) return 1;
      var d = 0;
      Array.prototype.forEach.call(req, function (i) { if (isValid(i) && i.value.replace(/\s/g, "")) d++; });
      return d / req.length;
    }

    function progress() {
      if (!card) return;
      var p, ready;
      if (stepped) {
        p = (current - 1 + stepDone(current)) / total;
        ready = current === total && stepDone(total) === 1;
      } else {
        var done = 0;
        Array.prototype.forEach.call(tracked, function (i) { if (isValid(i) && i.value.replace(/\s/g, "")) done++; });
        p = tracked.length ? done / tracked.length : 0;
        ready = done === tracked.length;
      }
      card.style.setProperty("--qf-p", p.toFixed(3));
      if (ready && !card.classList.contains("is-ready")) card.classList.add("is-ready");
      else if (!ready) card.classList.remove("is-ready");
    }

    function setCounter(animate) {
      if (!status) return;
      var c = status.querySelector(".qf-status__count");
      c.textContent = (status.getAttribute("data-counter") || "Step {n} of {total}")
        .replace("{n}", current).replace("{total}", total);
      if (animate) { status.classList.remove("is-changing"); void status.offsetWidth; status.classList.add("is-changing"); }
    }

    function show(n, dir) {
      Array.prototype.forEach.call(steps, function (el, i) {
        var on = i + 1 === n;
        el.hidden = !on;
        el.classList.remove("is-entering", "is-entering-back");
        if (on && dir) { void el.offsetWidth; el.classList.add(dir < 0 ? "is-entering-back" : "is-entering"); }
      });
      current = n;
      setCounter(!!dir);
      progress();
      if (dir) {
        // Keep the top of the card in view on a phone, then put focus on the
        // new step's title so screen readers announce where they are.
        var r = card.getBoundingClientRect();
        if (r.top < 0 || r.top > window.innerHeight * 0.5) card.scrollIntoView({ block: "start", behavior: "smooth" });
        var t = stepEl(n).querySelector(".qf-step__title");
        if (t) t.focus({ preventScroll: true });
      }
    }

    function groupError(fs, show, msg) {
      var err = fs.querySelector(".field-error");
      if (!err) {
        err = document.createElement("p");
        err.className = "field-error field-error--group";
        err.setAttribute("role", "alert");
        fs.appendChild(err);
      }
      err.hidden = !show;
      if (show) err.textContent = msg;
    }

    // Validate one step. Returns the first bad control, or null.
    function checkStep(n) {
      var el = stepEl(n), bad = null;
      var jobs = el.querySelector(".chips--jobs");
      if (jobs) {
        var ok = jobPicked();
        groupError(jobs, !ok, jobs.getAttribute("data-pick-message") || "Please pick one.");
        if (!ok) bad = jobs.querySelector("input");
      }
      Array.prototype.forEach.call(el.querySelectorAll("input[required], select[required], textarea[required]"), function (input) {
        if (!validate(input) && !bad) bad = input;
      });
      return bad;
    }

    function next() {
      var bad = checkStep(current);
      if (bad) { bad.focus(); return; }
      if (current < total) show(current + 1, 1);
    }

    if (stepped) {
      card.classList.add("is-stepped");
      show(1, 0);
      Array.prototype.forEach.call(card.querySelectorAll("[data-next]"), function (b) { b.addEventListener("click", next); });
      Array.prototype.forEach.call(card.querySelectorAll("[data-back]"), function (b) {
        b.addEventListener("click", function () { if (current > 1) show(current - 1, -1); });
      });

      // Tapping a job moves straight on. Keyboard users arrowing through the
      // group are NOT moved on (arrow keys fire "change" too), so this only
      // follows a real pointer press.
      var pointerPick = false;
      Array.prototype.forEach.call(form.querySelectorAll('input[name="job-type"]'), function (r) {
        r.addEventListener("pointerdown", function () { pointerPick = true; });
        r.addEventListener("change", function () {
          var jobs = form.querySelector(".chips--jobs");
          if (jobs) groupError(jobs, false);
          progress();
          if (pointerPick && current === 1) setTimeout(function () { if (current === 1) next(); }, 380);
          pointerPick = false;
        });
      });
    }

    Array.prototype.forEach.call(inputs, function (input) {
      input.addEventListener("blur", function () {
        if (input.dataset.kind === "phone" && phoneOk(input.value)) input.value = phonePretty(input.value);
        if (input.dataset.kind === "postcode") input.value = postcodePretty(input.value);
        if (input.value.replace(/\s/g, "") || input.getAttribute("aria-invalid") === "true") validate(input);
        progress();
      });
      input.addEventListener("input", function () {
        if (input.dataset.kind === "postcode") {
          // Upper-case as they type without making the caret jump.
          var pos = input.selectionStart, up = input.value.toUpperCase();
          if (up !== input.value) { input.value = up; try { input.setSelectionRange(pos, pos); } catch (e) {} }
        }
        // Once a field has shown an error, re-check on every keystroke so it
        // clears the moment it's right. Otherwise only tick it green.
        if (input.getAttribute("aria-invalid") === "true") validate(input);
        else input.classList.toggle("is-valid", isValid(input) && !!input.value.replace(/\s/g, ""));
        progress();
      });
    });

    // Message box grows with what's typed instead of scrolling inside itself.
    Array.prototype.forEach.call(form.querySelectorAll("textarea[data-autogrow]"), function (ta) {
      function grow() { ta.style.height = "auto"; ta.style.height = (ta.scrollHeight + 2) + "px"; }
      ta.addEventListener("input", grow);
    });

    // Picking a job type is the natural first move; nudge them on to the name.
    Array.prototype.forEach.call(form.querySelectorAll('input[name="job-type"]'), function (r) {
      r.addEventListener("change", function () { track("Quote form job type", { type: r.value }); });
    });

    progress();

    form.addEventListener("submit", function (e) {
      if (stepped && current < total) { e.preventDefault(); next(); return; }
      var firstBad = null;
      Array.prototype.forEach.call(inputs, function (input) {
        if (!validate(input) && !firstBad) firstBad = input;
      });

      if (firstBad) {
        e.preventDefault();
        if (stepped) {
          var host = firstBad.closest(".qf-step");
          var n = Array.prototype.indexOf.call(steps, host) + 1;
          if (n && n !== current) show(n, -1);
        }
        firstBad.focus();
        firstBad.scrollIntoView({ block: "center", behavior: "smooth" });
        return;
      }

      // Send the tidy versions.
      Array.prototype.forEach.call(inputs, function (input) {
        if (input.dataset.kind === "phone") input.value = phonePretty(input.value);
        if (input.dataset.kind === "postcode") input.value = postcodePretty(input.value);
      });

      if (btn) {
        btn.disabled = true;
        btn.setAttribute("aria-busy", "true");
        if (label) { btn.dataset.label = label.textContent; label.textContent = "Sending…"; }
      }
      track("Quote form submit", { page: window.location.pathname });

      // If the POST fails (offline, Netlify hiccup) the browser shows its own
      // error page and this form is gone, so re-enable after a beat in case
      // the navigation was cancelled instead.
      setTimeout(function () {
        if (btn && btn.disabled) {
          btn.disabled = false;
          btn.removeAttribute("aria-busy");
          if (label) label.textContent = btn.dataset.label || "Send my enquiry";
        }
      }, 12000);
    });
  });

  /* ---------------------------------------------------------------------
     Photo lightbox. Every content photo in <main> can be opened full size:
     click or tap it (or Enter / Space with the keyboard). Built on the native
     <dialog>, so focus is trapped, Esc closes and the page behind is inert
     for free. Closes with the X, Esc, or a click on the dark background.
     Photos in the same grid can be stepped through with the arrows (or the
     arrow keys and a swipe on phones).
     Skipped on purpose: the hero background, the logo, and photos inside a
     link (service cards, orb panels), where a click already goes somewhere.
     --------------------------------------------------------------------- */
  (function () {
    if (typeof HTMLDialogElement !== "function") return;
    var imgs = Array.prototype.filter.call(document.querySelectorAll("main img"), function (img) {
      return !img.closest("a, button, .hero__media, .site-logo, .badge-row") &&
             !/\.svg(\?|$)/i.test(img.getAttribute("src") || "");
    });
    if (!imgs.length) return;

    // Largest candidate in the same format the browser already chose.
    function bestSrc(img) {
      var cur = img.currentSrc || img.src;
      var pic = img.parentElement && img.parentElement.tagName === "PICTURE" ? img.parentElement : null;
      var sets = [];
      if (pic) Array.prototype.forEach.call(pic.querySelectorAll("source"), function (s) { sets.push(s.getAttribute("srcset") || ""); });
      sets.push(img.getAttribute("srcset") || "");
      var chosen = null;
      sets.forEach(function (set) {
        if (chosen || !set) return;
        var parts = set.split(/,\s+(?=\S+\s+\d+w)/).map(function (c) {
          var m = c.trim().match(/^(\S+)\s+(\d+)w$/); return m ? { url: m[1], w: +m[2] } : null;
        }).filter(Boolean);
        if (!parts.length) return;
        if (parts.some(function (p) { return cur.indexOf(p.url) > -1 || p.url.indexOf(cur) > -1; }) || sets.length === 1) {
          parts.sort(function (a, b) { return b.w - a.w; });
          chosen = parts[0].url;
        }
      });
      return chosen || cur;
    }

    var dlg = document.createElement("dialog");
    dlg.className = "lightbox";
    dlg.setAttribute("aria-label", "Photo");
    dlg.innerHTML =
      '<figure class="lightbox__frame"><img class="lightbox__img" alt=""></figure>' +
      '<p class="lightbox__count" aria-hidden="true"></p>' +
      '<button class="lightbox__btn lightbox__close" type="button" aria-label="Close"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>' +
      '<button class="lightbox__btn lightbox__prev" type="button" aria-label="Previous photo"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg></button>' +
      '<button class="lightbox__btn lightbox__next" type="button" aria-label="Next photo"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg></button>';
    document.body.appendChild(dlg);
    var big = dlg.querySelector(".lightbox__img");
    var count = dlg.querySelector(".lightbox__count");
    var set = [], idx = 0, opener = null;

    function show(i) {
      idx = (i + set.length) % set.length;
      var img = set[idx];
      big.classList.remove("is-in");
      big.onload = function () { big.classList.add("is-in"); };
      big.src = bestSrc(img);
      big.alt = img.alt || "";
      var many = set.length > 1;
      dlg.classList.toggle("is-single", !many);
      count.textContent = many ? (idx + 1) + " / " + set.length : "";
    }
    function open(img) {
      var group = img.closest(".work-grid, .gallery");
      set = group ? imgs.filter(function (x) { return group.contains(x); }) : [img];
      opener = img;
      show(set.indexOf(img));
      dlg.showModal();
      document.body.classList.add("is-locked");
      requestAnimationFrame(function () { dlg.classList.add("is-open"); });
    }
    function close() {
      dlg.classList.remove("is-open");
      document.body.classList.remove("is-locked");
      dlg.close();
    }
    dlg.addEventListener("close", function () {
      document.body.classList.remove("is-locked");
      dlg.classList.remove("is-open");
      big.removeAttribute("src");
      if (opener) opener.focus({ preventScroll: true });
    });
    dlg.querySelector(".lightbox__close").addEventListener("click", close);
    dlg.querySelector(".lightbox__prev").addEventListener("click", function () { show(idx - 1); });
    dlg.querySelector(".lightbox__next").addEventListener("click", function () { show(idx + 1); });
    // A click on the dark area (the dialog itself, not the photo or a button) closes it.
    dlg.addEventListener("click", function (e) { if (e.target === dlg || e.target.classList.contains("lightbox__frame")) close(); });
    dlg.addEventListener("keydown", function (e) {
      if (set.length < 2) return;
      if (e.key === "ArrowLeft") { e.preventDefault(); show(idx - 1); }
      if (e.key === "ArrowRight") { e.preventDefault(); show(idx + 1); }
    });
    var sx = null;
    dlg.addEventListener("touchstart", function (e) { sx = e.touches[0].clientX; }, { passive: true });
    dlg.addEventListener("touchend", function (e) {
      if (sx === null || set.length < 2) return;
      var dx = e.changedTouches[0].clientX - sx; sx = null;
      if (Math.abs(dx) > 50) show(idx + (dx < 0 ? 1 : -1));
    });

    imgs.forEach(function (img) {
      img.classList.add("is-zoomable");
      img.setAttribute("tabindex", "0");
      img.setAttribute("role", "button");
      img.setAttribute("aria-haspopup", "dialog");
      img.setAttribute("aria-label", "Enlarge photo" + (img.alt ? ": " + img.alt : ""));
      img.addEventListener("click", function () { open(img); });
      img.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(img); }
      });
    });
  })();

  /* ---------------------------------------------------------------------
     Ambient cursor glow. A soft warm light that trails the pointer across
     the plain page ground (it sits at z-index -1, so coloured bands and
     cards cover it). Mouse and trackpad only, never touch, and off for
     reduced motion. Transform only, one rAF loop that stops when settled.
     --------------------------------------------------------------------- */
  if (window.matchMedia &&
      window.matchMedia("(hover: hover) and (pointer: fine)").matches &&
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    var glow = document.createElement("div");
    glow.className = "ambient-glow";
    glow.setAttribute("aria-hidden", "true");
    document.body.appendChild(glow);
    var gx = -9999, gy = -9999, tx = gx, ty = gy, running = false, idle;
    var step = function () {
      gx += (tx - gx) * 0.12;
      gy += (ty - gy) * 0.12;
      glow.style.transform = "translate3d(" + gx.toFixed(1) + "px," + gy.toFixed(1) + "px,0)";
      if (Math.abs(tx - gx) > 0.4 || Math.abs(ty - gy) > 0.4) requestAnimationFrame(step);
      else running = false;
    };
    document.addEventListener("pointermove", function (e) {
      if (e.pointerType && e.pointerType !== "mouse") return;
      tx = e.clientX; ty = e.clientY;
      if (gx < -9000) { gx = tx; gy = ty; }
      glow.classList.add("is-on");
      clearTimeout(idle);
      idle = setTimeout(function () { glow.classList.remove("is-on"); }, 4000);
      if (!running) { running = true; requestAnimationFrame(step); }
    }, { passive: true });
    document.documentElement.addEventListener("mouseleave", function () { glow.classList.remove("is-on"); });
  }

  /* ---------------------------------------------------------------------
     Netlify Identity. The widget is only downloaded when someone follows an
     invite or password-recovery link, so it costs a normal visitor nothing.
     --------------------------------------------------------------------- */
  var hash = window.location.hash || "";
  if (/invite_token=|recovery_token=|confirmation_token=|email_change_token=/.test(hash)) {
    var s = document.createElement("script");
    s.src = "https://identity.netlify.com/v1/netlify-identity-widget.js";
    s.onload = function () {
      if (!window.netlifyIdentity) return;
      window.netlifyIdentity.on("init", function (user) {
        if (!user) {
          window.netlifyIdentity.on("login", function () { document.location.href = "/admin/"; });
        }
      });
    };
    document.head.appendChild(s);
  }
})();
