/* EYESON admin — session + password helpers.
 *
 * A file whose name starts with "_" is not routed by Vercel, so this module
 * is shared by the real endpoints without being reachable on its own.
 *
 * Required environment variables (set them in the Vercel dashboard, never in
 * the repo):
 *   ADMIN_PASSWORD_HASH   scrypt hash, produced by scripts/hash-password.js
 *   SESSION_SECRET        long random string, used to sign the session cookie
 */
"use strict";

const crypto = require("crypto");

const COOKIE = "eyeson_admin";
const TTL_MS = 8 * 60 * 60 * 1000; // 8 hours

/* ---------- password ---------- */

/* Two stored formats are accepted:
 *   scrypt$<N>$<saltHex>$<keyHex>        produced by scripts/hash-password.js
 *   pbkdf2$<iters>$<saltHex>$<keyHex>    produced by scripts/make-password.html
 *
 * Both are salted and slow. pbkdf2 exists because WebCrypto has no scrypt, and
 * generating the hash in a browser turned out to be the only password prompt
 * that works reliably on every machine. */
function verifyPassword(password, stored) {
  if (!stored) return false;
  const parts = String(stored).trim().split("$");
  if (parts.length !== 4) return false;

  const scheme = parts[0];
  const cost = Number(parts[1]);
  let salt, expected;
  try {
    salt = Buffer.from(parts[2], "hex");
    expected = Buffer.from(parts[3], "hex");
  } catch (e) {
    return false;
  }
  if (!cost || !salt.length || !expected.length) return false;

  let actual;
  try {
    if (scheme === "scrypt") {
      actual = crypto.scryptSync(String(password), salt, expected.length, { N: cost, r: 8, p: 1 });
    } else if (scheme === "pbkdf2") {
      actual = crypto.pbkdf2Sync(String(password), salt, cost, expected.length, "sha256");
    } else {
      return false;
    }
  } catch (e) {
    return false;
  }
  // constant time — never a plain ===
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

/* ---------- session cookie ---------- */

function sign(payload, secret) {
  return crypto.createHmac("sha256", secret).update(payload).digest("base64url");
}

function issue(secret) {
  const expires = Date.now() + TTL_MS;
  const payload = "admin." + expires;
  return payload + "." + sign(payload, secret);
}

function verifyToken(token, secret) {
  if (!token || !secret) return false;
  const idx = token.lastIndexOf(".");
  if (idx === -1) return false;

  const payload = token.slice(0, idx);
  const given = Buffer.from(token.slice(idx + 1));
  const want = Buffer.from(sign(payload, secret));
  if (given.length !== want.length || !crypto.timingSafeEqual(given, want)) return false;

  const expires = Number(payload.split(".")[1]);
  return Number.isFinite(expires) && Date.now() < expires;
}

function readCookie(req) {
  const raw = req.headers.cookie || "";
  const hit = raw.split(";").map((c) => c.trim()).find((c) => c.startsWith(COOKIE + "="));
  return hit ? decodeURIComponent(hit.slice(COOKIE.length + 1)) : null;
}

function setCookie(res, token) {
  res.setHeader(
    "Set-Cookie",
    `${COOKIE}=${encodeURIComponent(token)}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${TTL_MS / 1000}`
  );
}

function clearCookie(res) {
  res.setHeader("Set-Cookie", `${COOKIE}=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`);
}

function isAuthed(req) {
  return verifyToken(readCookie(req), process.env.SESSION_SECRET);
}

/* Reject anything that did not come from our own admin page.
   The cookie is SameSite=Strict already; this is the second lock. */
function sameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true; // same-origin GETs don't send Origin
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  try {
    return new URL(origin).host === host;
  } catch (e) {
    return false;
  }
}

/* ---------- login throttling ----------
   Serverless instances are not shared, so this slows an attacker down on a
   warm instance but is NOT a complete rate limiter. For a hard guarantee put
   the counter in Vercel KV. Documented in admin/README.md. */
const attempts = new Map();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 8;

function tooManyAttempts(ip) {
  const rec = attempts.get(ip);
  if (!rec) return false;
  if (Date.now() - rec.first > WINDOW_MS) {
    attempts.delete(ip);
    return false;
  }
  return rec.count >= MAX_ATTEMPTS;
}

function noteFailure(ip) {
  const rec = attempts.get(ip);
  if (!rec || Date.now() - rec.first > WINDOW_MS) {
    attempts.set(ip, { first: Date.now(), count: 1 });
  } else {
    rec.count++;
  }
}

function clearAttempts(ip) {
  attempts.delete(ip);
}

function clientIp(req) {
  return (req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "unknown";
}

module.exports = {
  verifyPassword,
  issue,
  isAuthed,
  setCookie,
  clearCookie,
  sameOrigin,
  tooManyAttempts,
  noteFailure,
  clearAttempts,
  clientIp,
};
