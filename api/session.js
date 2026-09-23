/* GET /api/session -> { authenticated: boolean } */
"use strict";
const auth = require("./_auth");

module.exports = (req, res) => {
  if (req.method !== "GET") {
    res.status(405).json({ error: "method not allowed" });
    return;
  }
  res.status(200).json({ authenticated: auth.isAuthed(req) });
};
