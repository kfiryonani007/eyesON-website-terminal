/* EYESON — תפריט נגישות
   נבנה לפי תקנות שוויון זכויות לאנשים עם מוגבלות (התאמות נגישות לשירות),
   התשע"ג-2013, המפנות לתקן הישראלי ת"י 5568 (מבוסס WCAG 2.0 רמה AA).

   TODO(client): התפריט הוא התאמה טכנית בלבד. חובה גם:
   1. הצהרת נגישות מלאה ומדויקת (accessibility.html) — כולל שם רכז/ת הנגישות,
      דרכי יצירת קשר לפניות נגישות, ותאריך הבדיקה האחרון.
   2. בדיקת נגישות בפועל על ידי מורשה נגישות השירות (בדיקה אנושית, לא רק כלי).
   הקוד כאן לא מהווה ייעוץ משפטי ולא מספיק לבדו כדי לעמוד בדרישות החוק. */
(function () {
  "use strict";

  var STORAGE_KEY = "eyeson-a11y";
  var root = document.documentElement;

  /* כל התאמה: מפתח, תווית, והמחלקה שמופעלת על <html> */
  var TOGGLES = [
    { key: "contrast",  label: "ניגודיות גבוהה",  cls: "a11y-contrast" },
    { key: "invert",    label: "היפוך צבעים",     cls: "a11y-invert" },
    { key: "grayscale", label: "גווני אפור",      cls: "a11y-grayscale" },
    { key: "links",     label: "הדגשת קישורים",   cls: "a11y-links" },
    { key: "readable",  label: "גופן קריא",       cls: "a11y-readable" },
    { key: "spacing",   label: "ריווח שורות",     cls: "a11y-spacing" },
    { key: "noAnim",    label: "עצירת אנימציות",  cls: "a11y-no-anim" },
    { key: "bigCursor", label: "סמן עכבר גדול",   cls: "a11y-big-cursor" }
  ];

  var MIN_SCALE = 1, MAX_SCALE = 1.6, STEP = 0.1;

  var state = { scale: 1 };
  TOGGLES.forEach(function (t) { state[t.key] = false; });

  /* ---------- persistence ---------- */
  function load() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      var saved = JSON.parse(raw);
      Object.keys(state).forEach(function (k) {
        if (typeof saved[k] === typeof state[k]) state[k] = saved[k];
      });
    } catch (e) { /* private mode / blocked storage — run with defaults */ }
  }
  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) {}
  }

  /* ---------- apply ---------- */
  function apply() {
    TOGGLES.forEach(function (t) { root.classList.toggle(t.cls, !!state[t.key]); });
    root.style.setProperty("--a11y-scale", String(state.scale));
    root.classList.toggle("a11y-scaled", state.scale !== 1);
    if (panel) {
      TOGGLES.forEach(function (t) {
        var btn = panel.querySelector('[data-a11y="' + t.key + '"]');
        if (btn) btn.setAttribute("aria-pressed", String(!!state[t.key]));
      });
      var out = panel.querySelector(".a11y-scale-val");
      if (out) out.textContent = Math.round(state.scale * 100) + "%";
    }
  }

  /* ---------- skip link ---------- */
  var main = document.querySelector("main");
  if (main) {
    if (!main.id) main.id = "main";
    var skip = document.createElement("a");
    skip.className = "a11y-skip";
    skip.href = "#" + main.id;
    skip.textContent = "דילוג לתוכן הראשי";
    document.body.insertBefore(skip, document.body.firstChild);
    /* <main> isn't focusable by default, so the skip target would be ignored
       by screen readers after the jump */
    main.setAttribute("tabindex", "-1");
  }

  /* ---------- markup ---------- */
  var openBtn = document.createElement("button");
  openBtn.type = "button";
  openBtn.className = "a11y-fab";
  openBtn.setAttribute("aria-label", "פתיחת תפריט נגישות");
  openBtn.setAttribute("aria-expanded", "false");
  openBtn.setAttribute("aria-controls", "a11yPanel");
  openBtn.innerHTML =
    '<svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true" focusable="false">' +
    '<circle cx="12" cy="3.8" r="1.9" fill="currentColor"/>' +
    '<path fill="currentColor" d="M20 7.4a1 1 0 0 0-1.2-.7l-4.3 1a11 11 0 0 1-5 0l-4.3-1A1 1 0 0 0 4.7 8.6l4.4 1v3.2l-1.8 6.4a1 1 0 0 0 1.9.6l1.8-5.6h.1l1.8 5.6a1 1 0 0 0 1.9-.6l-1.8-6.4V9.6l4.4-1A1 1 0 0 0 20 7.4Z"/>' +
    "</svg>";

  var panel = document.createElement("div");
  panel.className = "a11y-panel";
  panel.id = "a11yPanel";
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-modal", "false");
  panel.setAttribute("aria-label", "תפריט נגישות");
  panel.hidden = true;

  var html =
    '<div class="a11y-head">' +
      "<h2>תפריט נגישות</h2>" +
      '<button type="button" class="a11y-close" aria-label="סגירת תפריט נגישות">&times;</button>' +
    "</div>" +
    '<div class="a11y-row a11y-text-size">' +
      "<span>גודל טקסט</span>" +
      '<div class="a11y-stepper">' +
        '<button type="button" class="a11y-step" data-a11y-scale="-1" aria-label="הקטנת טקסט">&minus;</button>' +
        '<output class="a11y-scale-val" aria-live="polite">100%</output>' +
        '<button type="button" class="a11y-step" data-a11y-scale="1" aria-label="הגדלת טקסט">+</button>' +
      "</div>" +
    "</div>" +
    '<ul class="a11y-list">';
  TOGGLES.forEach(function (t) {
    html +=
      "<li><button type='button' data-a11y='" + t.key + "' aria-pressed='false'>" +
      "<span class='a11y-mark' aria-hidden='true'></span>" + t.label +
      "</button></li>";
  });
  html +=
    "</ul>" +
    '<div class="a11y-foot">' +
      '<button type="button" class="a11y-reset">איפוס כל ההתאמות</button>' +
      '<a href="accessibility.html">להצהרת הנגישות המלאה</a>' +
    "</div>";
  panel.innerHTML = html;

  document.body.appendChild(openBtn);
  document.body.appendChild(panel);

  /* ---------- behaviour ---------- */
  function openPanel() {
    panel.hidden = false;
    openBtn.setAttribute("aria-expanded", "true");
    openBtn.setAttribute("aria-label", "סגירת תפריט נגישות");
    var first = panel.querySelector("button, a");
    if (first) first.focus();
  }
  function closePanel(returnFocus) {
    panel.hidden = true;
    openBtn.setAttribute("aria-expanded", "false");
    openBtn.setAttribute("aria-label", "פתיחת תפריט נגישות");
    if (returnFocus) openBtn.focus();
  }

  openBtn.addEventListener("click", function () {
    if (panel.hidden) openPanel(); else closePanel(true);
  });
  panel.querySelector(".a11y-close").addEventListener("click", function () { closePanel(true); });

  panel.addEventListener("click", function (e) {
    var toggleBtn = e.target.closest("[data-a11y]");
    if (toggleBtn) {
      var key = toggleBtn.getAttribute("data-a11y");
      state[key] = !state[key];
      /* ניגודיות גבוהה והיפוך צבעים סותרים זה את זה */
      if (state[key] && key === "contrast") state.invert = false;
      if (state[key] && key === "invert") state.contrast = false;
      apply(); save();
      return;
    }
    var step = e.target.closest("[data-a11y-scale]");
    if (step) {
      var dir = parseInt(step.getAttribute("data-a11y-scale"), 10);
      var next = Math.round((state.scale + dir * STEP) * 100) / 100;
      state.scale = Math.min(Math.max(next, MIN_SCALE), MAX_SCALE);
      apply(); save();
      return;
    }
    if (e.target.closest(".a11y-reset")) {
      state = { scale: 1 };
      TOGGLES.forEach(function (t) { state[t.key] = false; });
      apply(); save();
    }
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && !panel.hidden) closePanel(true);
  });
  document.addEventListener("click", function (e) {
    if (panel.hidden) return;
    if (!panel.contains(e.target) && !openBtn.contains(e.target)) closePanel(false);
  });

  load();
  apply();
})();
