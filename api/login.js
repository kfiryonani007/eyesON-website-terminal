/* POST /api/login  body: { password } -> sets the session cookie */
"use strict";
const auth = require("./_auth");

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ error: "method not allowed" });
    return;
  }
  if (!auth.sameOrigin(req)) {
    res.status(403).json({ error: "bad origin" });
    return;
  }

  const hash = process.env.ADMIN_PASSWORD_HASH;
  const secret = process.env.SESSION_SECRET;
  if (!hash || !secret) {
    // fail closed: an unconfigured deployment must never let anyone in
    res.status(500).json({ error: "admin is not configured" });
    return;
  }

  const ip = auth.clientIp(req);
  if (auth.tooManyAttempts(ip)) {
    res.status(429).json({ error: "too many attempts, try again later" });
    return;
  }

  const password = req.body && req.body.password;
  if (typeof password !== "string" || password.length > 200) {
    auth.noteFailure(ip);
    res.status(401).json({ error: "invalid" });
    return;
  }

  if (!auth.verifyPassword(password, hash)) {
    auth.noteFailure(ip);
    // a small delay blunts online guessing further
    await new Promise((r) => setTimeout(r, 400));
    res.status(401).json({ error: "invalid" });
    return;
  }

  auth.clearAttempts(ip);
  auth.setCookie(res, auth.issue(secret));
  res.status(200).json({ ok: true });
};
