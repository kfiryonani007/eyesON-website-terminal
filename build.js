#!/usr/bin/env node
/* EYESON — שלב בנייה: מזריק את content/site.json לתוך קבצי ה-HTML.
 *
 * הגישה: הזרקה ממוקדת, לא תבניות.
 * ה-HTML נשאר HTML תקין וערוך ביד. אלמנט שניתן לעריכה מסומן בתכונה:
 *
 *     <p data-cms="footer.tagline">הטקסט הנוכחי</p>
 *     <a data-cms-attr="href:contact.whatsappUrl" href="https://wa.me/...">
 *
 * הסקריפט מחליף רק את התוכן של האלמנטים המסומנים. כל השאר, כולל תיקוני
 * ה-RTL העדינים (bdi, מרכאות, רווחים), לא נגעים בו. אם מפתח חסר ב-JSON,
 * ה-HTML נשאר כמו שהוא — בנייה לא מוחקת תוכן בטעות.
 *
 *   node build.js           כתיבה בפועל
 *   node build.js --check   הרצה יבשה, מדווחת מה היה משתנה
 *
 * אפס תלויות. רץ על Node מובנה בלבד.
 */
"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const CONTENT = path.join(ROOT, "content", "site.json");
const CHECK = process.argv.includes("--check");

/* ---------- helpers ---------- */

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
function escapeAttr(s) {
  return escapeHtml(s).replace(/"/g, "&quot;");
}

/* Inline text is escaped FIRST, then a tiny, closed set of markers is turned
   back into tags. Nothing an editor types can introduce markup of its own:
     **text**  ->  <strong>text</strong>
   A literal non-breaking space (U+00A0) in the JSON survives as-is. */
function inlineFormat(s) {
  return escapeHtml(s).replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
}
function getPath(obj, dotted) {
  return dotted.split(".").reduce(
    (o, k) => (o === null || o === undefined ? undefined : o[k]),
    obj
  );
}

/* Find the index just past the matching closing tag for an element whose
   opening tag ends at `openEnd`. Counts nested elements of the same name.
   Returns { inner, closeStart } or null when the markup is unbalanced. */
function findElementBody(html, tagName, openEnd) {
  const open = new RegExp("<" + tagName + "[\\s>/]", "gi");
  const close = new RegExp("</" + tagName + "\\s*>", "gi");
  let depth = 1;
  let cursor = openEnd;

  while (depth > 0) {
    close.lastIndex = cursor;
    const c = close.exec(html);
    if (!c) return null;

    open.lastIndex = cursor;
    let nested = 0;
    let o;
    while ((o = open.exec(html)) !== null && o.index < c.index) {
      // ignore self-closing occurrences
      const tagEnd = html.indexOf(">", o.index);
      if (tagEnd !== -1 && html[tagEnd - 1] !== "/") nested++;
    }

    depth += nested - 1;
    cursor = c.index + c[0].length;
    if (depth === 0) {
      return { inner: html.slice(openEnd, c.index), closeStart: c.index };
    }
  }
  return null;
}

/* ---------- the two rewrites ---------- */

function applyText(html, data, report) {
  // matches: <tag ... data-cms="some.path" ...>
  const re = /<([a-zA-Z][\w-]*)\b([^>]*?)\bdata-cms="([^"]+)"([^>]*)>/g;
  let out = "";
  let last = 0;
  let m;

  while ((m = re.exec(html)) !== null) {
    const [full, tag, , dotted] = m;
    const openEnd = m.index + full.length;
    const value = getPath(data, dotted);

    if (value === undefined || value === null || typeof value === "object") {
      report.skipped.push(dotted);
      continue;
    }

    const body = findElementBody(html, tag, openEnd);
    if (!body) {
      report.unbalanced.push(dotted);
      continue;
    }

    const next = inlineFormat(value);
    if (body.inner !== next) report.changed.push(dotted);

    out += html.slice(last, openEnd) + next;
    last = body.closeStart;
    re.lastIndex = body.closeStart;
  }
  return out + html.slice(last);
}

function applyAttrs(html, data, report) {
  // matches: data-cms-attr="href:some.path" (several pairs separated by ;)
  const re = /<([a-zA-Z][\w-]*)\b([^>]*?)\bdata-cms-attr="([^"]+)"([^>]*)>/g;

  return html.replace(re, (full, tag, pre, spec, post) => {
    let openTag = full;
    spec.split(";").forEach((pair) => {
      const idx = pair.indexOf(":");
      if (idx === -1) return;
      const attr = pair.slice(0, idx).trim();
      const dotted = pair.slice(idx + 1).trim();
      const value = getPath(data, dotted);
      if (value === undefined || value === null || typeof value === "object") {
        report.skipped.push(dotted);
        return;
      }
      const attrRe = new RegExp("(\\s" + attr + '=")([^"]*)(")', "i");
      if (!attrRe.test(openTag)) {
        report.missingAttr.push(attr + " <- " + dotted);
        return;
      }
      openTag = openTag.replace(attrRe, (whole, a, current, c) => {
        const next = escapeAttr(value);
        if (current !== next) report.changed.push(attr + "=" + dotted);
        return a + next + c;
      });
    });
    return openTag;
  });
}

/* ---------- run ---------- */

function main() {
  if (!fs.existsSync(CONTENT)) {
    console.error("content/site.json not found");
    process.exit(1);
  }

  let data;
  try {
    data = JSON.parse(fs.readFileSync(CONTENT, "utf8"));
  } catch (e) {
    console.error("content/site.json is not valid JSON:", e.message);
    process.exit(1);
  }

  // derived link targets — the admin only stores the raw number / address,
  // so tel:, wa.me and mailto: can never drift apart from what is displayed
  const c = data.contact || {};
  if (c.phoneIntl) c.phoneHref = "tel:+" + String(c.phoneIntl).replace(/\D/g, "");
  if (c.whatsappIntl) c.whatsappUrl = "https://wa.me/" + String(c.whatsappIntl).replace(/\D/g, "");
  if (c.email) c.emailHref = "mailto:" + c.email;

  // chart bars: the drawn height is derived from the number itself, so the
  // picture can never disagree with the figure printed above it
  const bars = data.home && data.home.shrink && data.home.shrink.chart && data.home.shrink.chart.bars;
  if (Array.isArray(bars) && bars.length) {
    const nums = bars.map((b) => Number(String(b.value).replace(/[^\d.]/g, "")) || 0);
    const max = Math.max.apply(null, nums) || 1;
    bars.forEach((b, i) => {
      b.style = "--h:" + Math.max(4, Math.round((nums[i] / max) * 96)) + "%";
    });
  }

  const pages = fs
    .readdirSync(ROOT)
    .filter((f) => f.endsWith(".html"))
    .sort();

  let totalChanged = 0;
  let totalMarked = 0;
  const problems = [];

  for (const file of pages) {
    const full = path.join(ROOT, file);
    const before = fs.readFileSync(full, "utf8");
    const report = { changed: [], skipped: [], unbalanced: [], missingAttr: [] };

    let after = applyText(before, data, report);
    after = applyAttrs(after, data, report);

    const marked =
      (before.match(/data-cms="/g) || []).length +
      (before.match(/data-cms-attr="/g) || []).length;
    totalMarked += marked;

    if (report.unbalanced.length) {
      problems.push(`${file}: unbalanced markup at ${report.unbalanced.join(", ")}`);
    }
    if (report.missingAttr.length) {
      problems.push(`${file}: attribute not present: ${report.missingAttr.join(", ")}`);
    }

    if (after !== before) {
      totalChanged += report.changed.length;
      if (!CHECK) fs.writeFileSync(full, after, "utf8");
      console.log(
        `${CHECK ? "would update" : "updated"}  ${file}  (${report.changed.length} value${
          report.changed.length === 1 ? "" : "s"
        })`
      );
    } else if (marked) {
      console.log(`unchanged     ${file}  (${marked} marked)`);
    }
  }

  console.log(
    `\n${totalMarked} marked spots across ${pages.length} pages · ${totalChanged} value(s) ${
      CHECK ? "would change" : "written"
    }`
  );

  if (problems.length) {
    console.error("\nproblems:");
    problems.forEach((p) => console.error("  " + p));
    process.exit(1);
  }
}

main();
