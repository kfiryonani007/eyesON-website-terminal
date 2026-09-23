/* EYESON — site interactions */
(function () {
  "use strict";

  /* gate reveal animations on JS availability (no-JS = content fully visible) */
  document.documentElement.classList.add("js");

  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- sticky header state ---------- */
  var header = document.querySelector(".site-header");
  if (header) {
    var onScroll = function () {
      header.classList.toggle("scrolled", window.scrollY > 24);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }

  /* ---------- mobile nav ---------- */
  var toggle = document.getElementById("navToggle");
  var nav = document.getElementById("mainNav");
  if (toggle && nav) {
    toggle.addEventListener("click", function () {
      var open = nav.classList.toggle("open");
      toggle.setAttribute("aria-expanded", String(open));
      toggle.setAttribute("aria-label", open ? "סגירת תפריט" : "פתיחת תפריט");
    });
    nav.addEventListener("click", function (e) {
      if (e.target.tagName === "A") {
        nav.classList.remove("open");
        toggle.setAttribute("aria-expanded", "false");
      }
    });
  }

  /* ---------- scroll reveal ---------- */
  var revealEls = document.querySelectorAll(".reveal");
  if (reduced || !("IntersectionObserver" in window)) {
    revealEls.forEach(function (el) { el.classList.add("visible"); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15, rootMargin: "0px 0px -40px 0px" });
    revealEls.forEach(function (el) { io.observe(el); });
  }

  /* ---------- animated counters ---------- */
  var counters = document.querySelectorAll(".stat-num[data-count]");
  var animateCount = function (el) {
    var target = parseInt(el.getAttribute("data-count"), 10);
    var prefix = el.getAttribute("data-prefix") || "";
    var duration = 1600;
    var start = null;
    var fmt = new Intl.NumberFormat("he-IL");
    var step = function (ts) {
      if (!start) start = ts;
      var p = Math.min((ts - start) / duration, 1);
      var eased = 1 - Math.pow(1 - p, 3);
      el.textContent = prefix + fmt.format(Math.round(target * eased));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };
  if (!reduced && "IntersectionObserver" in window) {
    var cio = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          animateCount(entry.target);
          cio.unobserve(entry.target);
        }
      });
    }, { threshold: 0.6 });
    counters.forEach(function (el) { cio.observe(el); });
  }

  /* ---------- hero scroll scrub ----------
     The hero never autoplays. #heroScrub is a tall wrapper; the hero inside
     is position:sticky so it stays pinned while scroll progress picks a frame.
     Every frame is mounted as its own <img> layer up front and we only flip
     opacity — swapping a single img.src re-decodes on each step, which is what
     made the old version stutter. Frame 1 is the base layer and always paints,
     so the hero still looks right with JS off or reduced-motion on. */
  var heroWrapper = document.getElementById("heroScrub");
  var heroImg = document.getElementById("heroScrubImg");
  if (heroWrapper && heroImg && !reduced) {
    var frameCount = parseInt(heroWrapper.getAttribute("data-frame-count"), 10) || 1;
    var framePath = function (n) {
      return "assets/hero/frames/frame-" + String(n).padStart(3, "0") + ".jpg";
    };

    /* mount frames 2..N as stacked layers above the base image */
    var layers = [];
    for (var i = 2; i <= frameCount; i++) {
      var layer = document.createElement("img");
      layer.className = "hero-bg hero-frame-layer";
      layer.src = framePath(i);
      layer.alt = "";
      layer.decoding = "sync";
      layer.setAttribute("aria-hidden", "true");
      heroImg.parentNode.insertBefore(layer, heroImg.nextSibling);
      layers.push(layer);
    }

    var activeLayer = null;
    var shownFrame = 1;
    var showFrame = function (n) {
      if (n === shownFrame) return;
      shownFrame = n;
      var next = n === 1 ? null : layers[n - 2];
      if (next === activeLayer) return;
      if (activeLayer) activeLayer.classList.remove("is-active");
      if (next) next.classList.add("is-active");
      activeLayer = next;
    };

    /* pos eases toward target so a flick of the wheel plays through the
       frames instead of snapping — this is the "smooth" part */
    var pos = 1, target = 1, raf = null;
    var tick = function () {
      var diff = target - pos;
      if (Math.abs(diff) < 0.02) {
        pos = target;
        showFrame(Math.round(pos));
        raf = null;
        return;
      }
      pos += diff * 0.3;
      showFrame(Math.round(pos));
      raf = requestAnimationFrame(tick);
    };
    var measure = function () {
      var rect = heroWrapper.getBoundingClientRect();
      var scrollable = rect.height - window.innerHeight;
      var progress = scrollable > 0 ? -rect.top / scrollable : 0;
      progress = Math.min(Math.max(progress, 0), 1);
      target = progress * (frameCount - 1) + 1;
      if (!raf) raf = requestAnimationFrame(tick);
    };
    window.addEventListener("scroll", measure, { passive: true });
    window.addEventListener("resize", measure, { passive: true });
    measure();
  }

  /* ---------- tilt cards ("מי אנחנו") ----------
     Vanilla-JS port of a 3D tilt + cursor-glow hover effect (no React/build
     step needed for this static site): on mousemove, rotate the card toward
     the pointer and update --mx/--my custom properties that drive the glow
     layer in CSS. Desktop pointers only, skipped for reduced-motion. */
  var finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  if (finePointer && !reduced) {
    document.querySelectorAll("#about .cards-3 .card").forEach(function (card) {
      var resetTilt = function () {
        card.style.transform = "perspective(900px) rotateX(0deg) rotateY(0deg)";
      };
      card.addEventListener("mousemove", function (e) {
        var rect = card.getBoundingClientRect();
        var px = (e.clientX - rect.left) / rect.width;
        var py = (e.clientY - rect.top) / rect.height;
        var rotateY = (px - 0.5) * 8;
        var rotateX = (0.5 - py) * 6;
        card.style.transform = "perspective(900px) rotateX(" + rotateX + "deg) rotateY(" + rotateY + "deg)";
        card.style.setProperty("--mx", (px * 100) + "%");
        card.style.setProperty("--my", (py * 100) + "%");
      });
      card.addEventListener("mouseleave", resetTilt);
    });
  }

  /* ---------- footer year ---------- */
  document.querySelectorAll("#year, .js-year").forEach(function (el) {
    el.textContent = String(new Date().getFullYear());
  });

  /* ---------- contact form ----------
     No backend is wired up yet (TODO(client) — see README): on submit we
     validate, then hand the filled-in details to the user's own mail app
     via a mailto: link. The target address lives in content/site.json and is
     written onto the form as data-contact-email by build.js. */
  document.querySelectorAll("form.contact-form").forEach(function (form) {
    var fields = {
      fullName: { label: "שם מלא", required: true },
      phone: { label: "טלפון", required: true },
      email: { label: "אימייל", required: true },
      business: { label: "שם העסק", required: false },
      businessType: { label: "סוג העסק", required: false },
      cameraCount: { label: "כמות מצלמות", required: false },
      message: { label: "פרטים נוספים", required: false }
    };
    var status = form.querySelector(".form-status");
    var phonePattern = /^[\d\s\-+()]{9,}$/;

    var setError = function (name, message) {
      var el = form.querySelector('[data-error-for="' + name + '"]');
      if (el) el.textContent = message || "";
    };

    var validate = function () {
      var ok = true;
      var firstInvalid = null;
      Object.keys(fields).forEach(function (name) {
        var input = form.elements[name];
        if (!input) return;
        setError(name, "");
        var value = input.value.trim();
        var def = fields[name];
        if (def.required && !value) {
          setError(name, "שדה חובה");
          ok = false;
          firstInvalid = firstInvalid || input;
          return;
        }
        if (name === "email" && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
          setError(name, "כתובת אימייל לא תקינה");
          ok = false;
          firstInvalid = firstInvalid || input;
          return;
        }
        if (name === "phone" && value && !phonePattern.test(value)) {
          setError(name, "מספר טלפון לא תקין");
          ok = false;
          firstInvalid = firstInvalid || input;
        }
      });
      if (firstInvalid) firstInvalid.focus();
      return ok;
    };

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      status.className = "form-status";
      status.textContent = "";

      if (!validate()) {
        status.textContent = "יש לתקן את השדות המסומנים למעלה.";
        status.classList.add("show", "err");
        return;
      }

      var lines = [];
      Object.keys(fields).forEach(function (name) {
        var input = form.elements[name];
        var value = input && input.value.trim();
        if (value) lines.push(fields[name].label + ": " + value);
      });

      var subject = "פנייה חדשה מאתר EYESON — " + (form.elements.fullName.value.trim() || "");
      // address comes from the form's data attribute so the CMS owns it
      // (build.js keeps data-contact-email in sync with content/site.json)
      var to = form.getAttribute("data-contact-email") || "info@eyeson.co.il";
      var mailto = "mailto:" + to
        + "?subject=" + encodeURIComponent(subject)
        + "&body=" + encodeURIComponent(lines.join("\n"));

      window.location.href = mailto;
      status.textContent = "נפתחת תוכנת המייל שלכם עם הפרטים שמילאתם — נשאר רק לשלוח. אפשר גם לפנות ישירות בוואטסאפ או בטלפון.";
      status.classList.add("show", "ok");
    });
  });
})();
