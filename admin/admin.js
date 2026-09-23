/* EYESON — ממשק ניהול תוכן.

   הפאנל עורך את content/site.json ותו לא. הוא נשען על שלוש נקודות קצה
   בצד השרת (ראו admin/README.md):
     GET  /api/session  -> { authenticated: boolean }
     POST /api/login    -> { ok: boolean }         (body: { password })
     GET  /api/content  -> site.json
     POST /api/content  -> { ok: boolean }         (body: site.json)

   אזהרה: הקובץ הזה הוא קוד לקוח. הוא לא מאבטח כלום. כל האכיפה חייבת
   להיות בשרת — בלי זה, כל אחד יכול לפנות ישירות ל-POST /api/content.
*/
(function () {
  "use strict";

  var API = {
    session: "/api/session",
    login: "/api/login",
    content: "/api/content"
  };
  var FALLBACK = "../content/site.json";   // תצוגה מקומית בלבד, קריאה בלבד

  var data = null;
  var dirty = false;
  var readOnly = false;
  var activeSection = 0;

  /* ---------------- schema ---------------- */
  var SCHEMA = [
    {
      id: "contact", title: "פרטי קשר",
      hint: "מופיעים בפוטר, בכפתור הוואטסאפ ובעמוד יצירת הקשר, בכל עמודי האתר.",
      fields: [
        { path: "contact.brandName", label: "שם המותג" },
        { path: "contact.companyName", label: "שם החברה המלא" },
        { path: "contact.slogan", label: "סלוגן", hint: "מופיע מתחת ללוגו בהדר" },
        { path: "contact.phoneDisplay", label: "טלפון לתצוגה", type: "tel" },
        { path: "contact.phoneIntl", label: "טלפון בינלאומי", type: "tel", hint: "בלי אפס וללא רווחים, למשל 972552622272" },
        { path: "contact.whatsappIntl", label: "וואטסאפ בינלאומי", type: "tel" },
        { path: "contact.email", label: "אימייל", type: "email" },
        { path: "contact.supportLabel", label: "תווית תמיכה" },
        { path: "contact.responseTime", label: "זמן תגובה" },
        { path: "contact.instagram", label: "אינסטגרם", type: "url" },
        { path: "contact.tiktok", label: "טיקטוק", type: "url" }
      ]
    },
    {
      id: "trial", title: "סרגל עליון",
      hint: "הפס האדום שרץ מעל ההדר בכל העמודים.",
      fields: [
        { path: "trialBar.emoji", label: "אימוג'י" },
        { path: "trialBar.text", label: "טקסט" },
        { path: "trialBar.ctaText", label: "טקסט הקישור" },
        { path: "trialBar.ctaHref", label: "יעד מעמוד הבית", hint: "עוגן בתוך העמוד, למשל #contact" },
        { path: "trialBar.ctaHrefPage", label: "יעד משאר העמודים" },
        { path: "trialBar.ctaHrefForm", label: "יעד מעמוד צור קשר" }
      ]
    },
    {
      id: "nav", title: "תפריט",
      hint: "פריטי הניווט הראשי והכפתור שלצידו.",
      fields: [
        { path: "nav", label: "פריטי תפריט", type: "list",
          item: [ { key: "label", label: "טקסט" }, { key: "href", label: "קישור" } ] },
        { path: "headerCta.label", label: "כפתור בהדר, טקסט" },
        { path: "headerCta.href", label: "כפתור בהדר, קישור מעמוד הבית" },
        { path: "headerCta.hrefPage", label: "כפתור בהדר, קישור משאר העמודים" }
      ]
    },
    {
      id: "hero", title: "מסך פתיחה",
      hint: "החלק העליון של עמוד הבית, מעל רצף התמונות.",
      fields: [
        { path: "home.hero.titleLine1", label: "כותרת, שורה ראשונה", wide: true },
        { path: "home.hero.titleLine2", label: "כותרת, שורה שנייה (באדום)", wide: true },
        { path: "home.hero.subtitle", label: "תת-כותרת", type: "textarea", wide: true },
        { path: "home.hero.primaryCta.label", label: "כפתור ראשי, טקסט" },
        { path: "home.hero.primaryCta.href", label: "כפתור ראשי, קישור" },
        { path: "home.hero.secondaryCta.label", label: "כפתור משני, טקסט" },
        { path: "home.hero.secondaryCta.href", label: "כפתור משני, קישור" },
        { path: "home.hero.chips", label: "תוויות אמון", type: "list", item: null },
        { path: "home.hero.recBadge", label: "תגית ההקלטה" }
      ]
    },
    {
      id: "about", title: "מי אנחנו",
      hint: "רצועת התמונה ושלושת הכרטיסים שמתחתיה.",
      fields: [
        { path: "home.band.kicker", label: "תווית עליונה" },
        { path: "home.band.title", label: "כותרת" },
        { path: "home.band.image", label: "תמונת רקע", type: "image" },
        { path: "home.band.text", label: "טקסט", type: "textarea", wide: true },
        { path: "home.aboutCards", label: "כרטיסים", type: "list",
          item: [ { key: "title", label: "כותרת" }, { key: "text", label: "טקסט", type: "textarea" } ] }
      ]
    },
    {
      id: "edge", title: "הסיפור שלנו",
      hint: "הפאנל הכהה ״מה מייחד אותנו״.",
      fields: [
        { path: "home.edge.kicker", label: "תווית עליונה" },
        { path: "home.edge.titleBefore", label: "כותרת, לפני ההדגשה" },
        { path: "home.edge.titleAccent", label: "מילה מודגשת (באדום)" },
        { path: "home.edge.titleAfter", label: "כותרת, אחרי ההדגשה" },
        { path: "home.edge.lead", label: "פסקה ראשונה", type: "textarea", wide: true },
        { path: "home.edge.punch", label: "משפט הסיום המודגש", type: "textarea", wide: true }
      ]
    },
    {
      id: "stats", title: "רצועת מספרים",
      hint: "שלושת המספרים שמתחת לסיפור.",
      fields: [
        { path: "home.stats", label: "מספרים", type: "list",
          item: [ { key: "value", label: "מספר", type: "number" }, { key: "text", label: "או טקסט חופשי" },
                  { key: "prefix", label: "קידומת" }, { key: "label", label: "תיאור" } ] }
      ]
    },
    {
      id: "process", title: "תהליך העבודה",
      hint: "ארבעת השלבים בעמוד הבית ובעמוד השירות.",
      fields: [
        { path: "home.process.kicker", label: "תווית עליונה" },
        { path: "home.process.titleBefore", label: "כותרת, החלק הרגיל" },
        { path: "home.process.titleAccent", label: "כותרת, החלק האדום" },
        { path: "home.process.subtitle", label: "תת-כותרת", type: "textarea", wide: true },
        { path: "home.process.steps", label: "שלבים", type: "list",
          item: [ { key: "title", label: "שם השלב" }, { key: "text", label: "תיאור", type: "textarea" } ] }
      ]
    },
    {
      id: "shrink", title: "סקשן הבעיה",
      hint: "הנתונים והגרף. גובה העמודות נגזר אוטומטית מהסכומים.",
      warn: "המספרים בגרף הם נתוני הדגמה. אסור לפרסם סכומים שאי אפשר לגבות.",
      fields: [
        { path: "home.shrink.kicker", label: "תווית עליונה" },
        { path: "home.shrink.titleQuote", label: "כותרת, החלק במרכאות" },
        { path: "home.shrink.titleAccent", label: "כותרת, החלק האדום" },
        { path: "home.shrink.subtitle", label: "תת-כותרת", type: "textarea", wide: true },
        { path: "home.shrink.stats", label: "שלושת הנתונים", type: "list",
          item: [ { key: "value", label: "מספר" }, { key: "caption", label: "תיאור", type: "textarea" } ] },
        { path: "home.shrink.chart.title", label: "כותרת הגרף" },
        { path: "home.shrink.chart.note", label: "תווית הסתייגות" },
        { path: "home.shrink.chart.splitLabel", label: "תווית קו ההפרדה" },
        { path: "home.shrink.chart.bars", label: "עמודות הגרף", type: "list",
          item: [ { key: "label", label: "חודש" }, { key: "value", label: "סכום" } ] }
      ]
    },
    {
      id: "screen", title: "EyesOn Screen",
      hint: "דרישות החיבור בעמוד EyesOn Screen.",
      fields: [
        { path: "screen.requirements.kicker", label: "תווית עליונה" },
        { path: "screen.requirements.title", label: "כותרת" },
        { path: "screen.requirements.subtitle", label: "תת-כותרת", type: "textarea", wide: true },
        { path: "screen.requirements.items", label: "תנאי החיבור", type: "list",
          item: [ { key: "title", label: "כותרת" }, { key: "text", label: "הסבר", type: "textarea" } ] }
      ]
    },
    {
      id: "seo", title: "כותרות לגוגל",
      hint: "מה שמופיע בלשונית הדפדפן ובתוצאות החיפוש.",
      fields: [
        { path: "home.seo.title", label: "עמוד הבית, כותרת", wide: true },
        { path: "home.seo.description", label: "עמוד הבית, תיאור", type: "textarea", wide: true },
        { path: "screen.seo.title", label: "EyesOn Screen, כותרת", wide: true },
        { path: "screen.seo.description", label: "EyesOn Screen, תיאור", type: "textarea", wide: true }
      ]
    },
    {
      id: "footer", title: "פוטר",
      hint: "הטקסט והקישורים בתחתית כל עמוד.",
      fields: [
        { path: "footer.tagline", label: "תיאור המותג", type: "textarea", wide: true },
        { path: "footer.credit.text", label: "קרדיט, טקסט" },
        { path: "footer.credit.name", label: "קרדיט, שם" },
        { path: "footer.credit.href", label: "קרדיט, קישור", type: "url" }
      ]
    }
  ];

  /* ---------------- path helpers ---------------- */
  function get(obj, path) {
    return path.split(".").reduce(function (o, k) {
      return (o === null || o === undefined) ? undefined : o[k];
    }, obj);
  }
  function set(obj, path, value) {
    var keys = path.split(".");
    var last = keys.pop();
    var target = keys.reduce(function (o, k) {
      if (o[k] === null || typeof o[k] !== "object") o[k] = {};
      return o[k];
    }, obj);
    target[last] = value;
  }

  /* ---------------- dom helpers ---------------- */
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  }
  function markDirty() {
    if (dirty) return;
    dirty = true;
    document.getElementById("dirtyFlag").hidden = false;
    document.getElementById("saveBtn").disabled = readOnly;
  }
  function toast(msg, isError) {
    var t = document.getElementById("toast");
    t.textContent = msg;
    t.className = "toast" + (isError ? " err" : "");
    t.hidden = false;
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { t.hidden = true; }, 3800);
  }

  /* ---------------- field rendering ---------------- */
  function inputFor(def, value, onChange) {
    var node;
    if (def.type === "textarea") {
      node = el("textarea");
      node.value = value === undefined ? "" : value;
    } else {
      node = el("input");
      node.type = def.type === "number" ? "number"
        : (def.type === "url" || def.type === "email" || def.type === "tel") ? def.type : "text";
      node.value = value === undefined || value === null ? "" : value;
    }
    if (readOnly) node.disabled = true;
    node.addEventListener("input", function () {
      var v = node.value;
      if (def.type === "number") v = v === "" ? null : Number(v);
      onChange(v);
      markDirty();
    });
    return node;
  }

  function field(def, value, onChange) {
    var wrap = el("div", "field" + (def.wide ? " wide" : ""));
    var id = "f_" + Math.random().toString(36).slice(2, 9);
    var label = el("label", null, def.label);
    label.htmlFor = id;
    wrap.appendChild(label);
    var input = inputFor(def, value, onChange);
    input.id = id;
    wrap.appendChild(input);
    if (def.hint) wrap.appendChild(el("p", "hint", def.hint));
    return wrap;
  }

  function listField(def) {
    var wrap = el("div", "repeat");
    var arr = get(data, def.path);
    if (!Array.isArray(arr)) arr = [];
    var heading = el("div", "field wide");
    heading.appendChild(el("label", null, def.label));
    wrap.appendChild(heading);

    arr.forEach(function (entry, i) {
      var item = el("div", "repeat-item");
      var head = el("div", "repeat-head");
      head.appendChild(el("span", null, def.label + " " + (i + 1)));
      item.appendChild(head);

      if (def.item === null) {
        // array of plain strings
        item.appendChild(field({ label: "טקסט", wide: true }, entry, function (v) { arr[i] = v; }));
      } else {
        var grid = el("div", "grid");
        def.item.forEach(function (sub) {
          grid.appendChild(field(
            { label: sub.label, type: sub.type, wide: sub.type === "textarea" },
            entry[sub.key],
            function (v) { entry[sub.key] = v; }
          ));
        });
        item.appendChild(grid);
      }
      wrap.appendChild(item);
    });
    return wrap;
  }

  /* ---------------- panel ---------------- */
  function renderPanel(index) {
    activeSection = index;
    var section = SCHEMA[index];
    var panel = document.getElementById("panel");
    panel.innerHTML = "";
    panel.appendChild(el("h2", null, section.title));
    if (section.hint) panel.appendChild(el("p", "panel-hint", section.hint));

    var grid = el("div", "grid");
    if (section.warn) {
      var w = el("div", "warn");
      w.appendChild(el("strong", null, "שימו לב: "));
      w.appendChild(document.createTextNode(section.warn));
      grid.appendChild(w);
    }
    section.fields.forEach(function (def) {
      if (def.type === "list") {
        grid.appendChild(listField(def));
        return;
      }
      grid.appendChild(field(def, get(data, def.path), function (v) { set(data, def.path, v); }));
    });
    panel.appendChild(grid);

    Array.prototype.forEach.call(document.querySelectorAll(".sidebar button"), function (b, i) {
      b.setAttribute("aria-current", String(i === index));
    });
  }

  function renderSidebar() {
    var nav = document.getElementById("sidebar");
    nav.innerHTML = "";
    SCHEMA.forEach(function (section, i) {
      var b = el("button", null, section.title);
      b.type = "button";
      b.addEventListener("click", function () { renderPanel(i); });
      nav.appendChild(b);
    });
  }

  /* ---------------- save ---------------- */
  function save() {
    var btn = document.getElementById("saveBtn");
    btn.disabled = true;
    fetch(API.content, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(data)
    }).then(function (r) {
      if (r.status === 401 || r.status === 403) throw new Error("ההרשאה פגה. רעננו את העמוד והתחברו שוב.");
      if (!r.ok) throw new Error("השמירה נכשלה (" + r.status + ")");
      dirty = false;
      document.getElementById("dirtyFlag").hidden = true;
      toast("נשמר. השינויים יופיעו באתר לאחר הבנייה מחדש.");
    }).catch(function (e) {
      btn.disabled = false;
      toast(e.message, true);
    });
  }

  /* ---------------- boot ---------------- */
  function startApp() {
    document.getElementById("gate").hidden = true;
    document.getElementById("app").hidden = false;
    renderSidebar();
    renderPanel(0);
    document.getElementById("saveBtn").addEventListener("click", save);
    window.addEventListener("beforeunload", function (e) {
      if (dirty) { e.preventDefault(); e.returnValue = ""; }
    });
  }

  function loadContent() {
    return fetch(API.content, { credentials: "same-origin" })
      .then(function (r) { if (!r.ok) throw new Error("no api"); return r.json(); })
      .catch(function () {
        readOnly = true;
        return fetch(FALLBACK).then(function (r) { return r.json(); });
      })
      .then(function (json) { data = json; });
  }

  function showLogin(message) {
    document.getElementById("gateMsg").textContent = message;
    document.getElementById("gateForm").hidden = false;
    document.getElementById("gatePass").focus();
  }

  var EYE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1.6 12S5.5 5 12 5s10.4 7 10.4 7-3.9 7-10.4 7S1.6 12 1.6 12Z"/><circle cx="12" cy="12" r="3.2"/></svg>';
  var EYE_OFF = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9.9 5.2A9.6 9.6 0 0 1 12 5c6.5 0 10.4 7 10.4 7a17 17 0 0 1-3.2 4"/><path d="M6.3 6.7A17 17 0 0 0 1.6 12S5.5 19 12 19a9.5 9.5 0 0 0 4-.85"/><path d="M9.8 9.9a3.2 3.2 0 0 0 4.4 4.4"/><path d="M3 3l18 18"/></svg>';

  var passToggle = document.getElementById("passToggle");
  if (passToggle) {
    passToggle.addEventListener("click", function () {
      var input = document.getElementById("gatePass");
      var show = input.type === "password";
      input.type = show ? "text" : "password";
      passToggle.innerHTML = show ? EYE_OFF : EYE;
      passToggle.setAttribute("aria-pressed", String(show));
      passToggle.setAttribute("aria-label", show ? "הסתרת הסיסמה" : "הצגת הסיסמה");
      input.focus();
    });
  }

  document.getElementById("gateForm").addEventListener("submit", function (e) {
    e.preventDefault();
    var pass = document.getElementById("gatePass").value;
    var err = document.getElementById("gateError");
    err.textContent = "";
    fetch(API.login, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ password: pass })
    }).then(function (r) {
      if (r.ok) return loadContent().then(startApp);
      // distinguish the real reasons — showing "wrong password" for a lockout
      // or an unconfigured server sends people chasing the wrong problem
      if (r.status === 429) throw new Error("יותר מדי ניסיונות. נסו שוב בעוד כמה דקות.");
      if (r.status === 500) throw new Error("השרת לא מוגדר: חסרים משתני הסביבה.");
      if (r.status === 403) throw new Error("הבקשה נחסמה (origin לא תקין).");
      if (r.status === 401) {
        throw new Error("סיסמה שגויה. בדקו שפריסת המקלדת באנגלית ושה-Caps Lock כבוי.");
      }
      throw new Error("ההתחברות נכשלה (" + r.status + ")");
    }).catch(function (ex) {
      err.textContent = ex.message || "ההתחברות נכשלה";
      document.getElementById("gatePass").value = "";
      document.getElementById("gatePass").focus();
    });
  });

  fetch(API.session, { credentials: "same-origin" })
    .then(function (r) {
      // 404 means there is no API mounted at all (plain static host) — fall through
      // to the read-only local preview rather than asking for a password nobody can answer
      if (r.status === 404) throw new Error("no api");
      return r.ok ? r.json() : { authenticated: false };
    })
    .then(function (s) {
      if (s && s.authenticated) return loadContent().then(startApp);
      showLogin("נדרשת התחברות כדי לערוך את תוכן האתר.");
    })
    .catch(function () {
      // no API at all — local preview of the form against content/site.json
      loadContent().then(function () {
        startApp();
        document.getElementById("saveBtn").disabled = true;
        toast("תצוגה מקומית בלבד: אין שרת, ולכן אי אפשר לשמור.", true);
      });
    });
})();
