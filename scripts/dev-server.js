#!/usr/bin/env node
/* Local dev server for the admin panel.
 *
 *   node scripts/dev-server.js
 *   -> http://localhost:4000/admin/
 *
 * Serves the site, and mounts the REAL auth endpoints from api/ so login and
 * sessions behave exactly as they will in production. /api/content is the one
 * difference: here it reads and writes content/site.json on disk instead of
 * committing to GitHub, so you can try the whole flow without a token.
 *
 * Dev password: whatever you set in ADMIN_PASSWORD, default "eyeson-dev-password".
 */
"use strict";

const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { execFileSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const PORT = Number(process.env.PORT) || 4000;
const CONTENT = path.join(ROOT, "content", "site.json");

/* ---- generate dev credentials so the real login code path is exercised ---- */
const DEV_PASSWORD = process.env.ADMIN_PASSWORD || "eyeson-dev-password";
const N = 16384;
const salt = crypto.randomBytes(16);
const key = crypto.scryptSync(DEV_PASSWORD, salt, 32, { N, r: 8, p: 1 });
process.env.ADMIN_PASSWORD_HASH = `scrypt$${N}$${salt.toString("hex")}$${key.toString("hex")}`;
process.env.SESSION_SECRET = crypto.randomBytes(48).toString("base64url");

const auth = require(path.join(ROOT, "api", "_auth.js"));
const loginHandler = require(path.join(ROOT, "api", "login.js"));
const sessionHandler = require(path.join(ROOT, "api", "session.js"));

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

function shim(req, res) {
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (obj) => {
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify(obj));
  };
}

function readBody(req) {
  return new Promise((resolve) => {
    let raw = "";
    req.on("data", (c) => { raw += c; });
    req.on("end", () => {
      try { resolve(JSON.parse(raw || "{}")); } catch (e) { resolve({}); }
    });
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://" + req.headers.host);
  const pathname = decodeURIComponent(url.pathname);
  shim(req, res);

  /* ---------- api ---------- */
  if (pathname === "/api/session") return sessionHandler(req, res);

  if (pathname === "/api/login") {
    req.body = await readBody(req);
    return loginHandler(req, res);
  }

  if (pathname === "/api/content") {
    if (!auth.isAuthed(req)) return res.status(401).json({ error: "not authenticated" });

    if (req.method === "GET") {
      return res.status(200).json(JSON.parse(fs.readFileSync(CONTENT, "utf8")));
    }
    if (req.method === "POST") {
      const body = await readBody(req);
      if (!body || typeof body !== "object" || !body.contact) {
        return res.status(400).json({ error: "content must be an object with a contact section" });
      }
      fs.writeFileSync(CONTENT, JSON.stringify(body, null, 2) + "\n", "utf8");
      // in production this is what the Vercel build does after the commit
      try {
        execFileSync(process.execPath, [path.join(ROOT, "build.js")], { cwd: ROOT, stdio: "pipe" });
      } catch (e) {
        return res.status(500).json({ error: "saved, but the build failed" });
      }
      console.log("  saved + rebuilt");
      return res.status(200).json({ ok: true });
    }
    return res.status(405).json({ error: "method not allowed" });
  }

  /* ---------- static ---------- */
  let file = path.join(ROOT, pathname);
  if (pathname.endsWith("/")) file = path.join(file, "index.html");
  if (!file.startsWith(ROOT)) { res.statusCode = 403; return res.end("forbidden"); }

  fs.readFile(file, (err, buf) => {
    if (err) { res.statusCode = 404; return res.end("not found"); }
    res.setHeader("Content-Type", TYPES[path.extname(file)] || "application/octet-stream");
    res.setHeader("Cache-Control", "no-store");
    res.end(buf);
  });
});

server.listen(PORT, () => {
  console.log(`\n  site   http://localhost:${PORT}/`);
  console.log(`  admin  http://localhost:${PORT}/admin/`);
  console.log(`  password: ${DEV_PASSWORD}\n`);
});
