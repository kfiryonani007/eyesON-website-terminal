/* POST /api/logout -> clears the session cookie */
"use strict";
const auth = require("./_auth");

module.exports = (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ error: "method not allowed" });
    return;
  }
  auth.clearCookie(res);
  res.status(200).json({ ok: true });
};
