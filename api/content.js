/* GET  /api/content -> the current content/site.json
 * POST /api/content -> commits a new content/site.json to GitHub
 *
 * Committing to the repo is what makes a save reach the site: the push
 * triggers Vercel, Vercel runs `node build.js`, and the HTML is regenerated
 * from the JSON. There is no separate database to drift out of sync, and
 * every save is an ordinary commit with history and a one-click revert.
 *
 * Environment variables:
 *   GITHUB_TOKEN    fine-grained token, write access to THIS repo only
 *   GITHUB_REPO     e.g. kfiryonani007/eyesON-website-terminal
 *   GITHUB_BRANCH   defaults to main
 */
"use strict";

const auth = require("./_auth");

const FILE = "content/site.json";
const MAX_BYTES = 512 * 1024;

function repoConfig() {
  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPO;
  const branch = process.env.GITHUB_BRANCH || "main";
  if (!token || !repo) return null;
  return { token, repo, branch };
}

function gh(cfg, path, init) {
  return fetch("https://api.github.com/repos/" + cfg.repo + path,
    Object.assign({}, init, {
      headers: Object.assign(
        {
          Authorization: "Bearer " + cfg.token,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
          "User-Agent": "eyeson-admin",
        },
        (init && init.headers) || {}
      ),
    })
  );
}

/* Shape check. Not a full schema — enough to stop a malformed or hostile
   payload from replacing the site's content wholesale. */
function validate(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return "content must be an object";
  }
  for (const key of ["contact", "home", "footer"]) {
    if (!body[key] || typeof body[key] !== "object") {
      return "missing required section: " + key;
    }
  }
  const c = body.contact;
  if (typeof c.email === "string" && c.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email)) {
    return "contact.email is not a valid address";
  }
  for (const k of ["instagram", "tiktok"]) {
    const v = c[k];
    if (typeof v === "string" && v && !/^https:\/\//.test(v)) {
      return "contact." + k + " must start with https://";
    }
  }
  return null;
}

module.exports = async (req, res) => {
  if (!auth.isAuthed(req)) {
    res.status(401).json({ error: "not authenticated" });
    return;
  }

  const cfg = repoConfig();
  if (!cfg) {
    res.status(500).json({ error: "GITHUB_TOKEN / GITHUB_REPO are not set" });
    return;
  }

  /* ---------- read ---------- */
  if (req.method === "GET") {
    try {
      const r = await gh(cfg, `/contents/${FILE}?ref=${encodeURIComponent(cfg.branch)}`);
      if (!r.ok) {
        res.status(502).json({ error: "could not read content from GitHub (" + r.status + ")" });
        return;
      }
      const meta = await r.json();
      const json = JSON.parse(Buffer.from(meta.content, "base64").toString("utf8"));
      res.status(200).json(json);
    } catch (e) {
      res.status(502).json({ error: "could not read content" });
    }
    return;
  }

  /* ---------- write ---------- */
  if (req.method === "POST") {
    if (!auth.sameOrigin(req)) {
      res.status(403).json({ error: "bad origin" });
      return;
    }

    const body = req.body;
    const problem = validate(body);
    if (problem) {
      res.status(400).json({ error: problem });
      return;
    }

    const text = JSON.stringify(body, null, 2) + "\n";
    if (Buffer.byteLength(text, "utf8") > MAX_BYTES) {
      res.status(413).json({ error: "content is too large" });
      return;
    }

    try {
      // the current sha is required so two editors cannot silently
      // overwrite each other — GitHub rejects a stale sha
      const head = await gh(cfg, `/contents/${FILE}?ref=${encodeURIComponent(cfg.branch)}`);
      if (!head.ok) {
        res.status(502).json({ error: "could not read current file (" + head.status + ")" });
        return;
      }
      const sha = (await head.json()).sha;

      const put = await gh(cfg, `/contents/${FILE}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: "Update site content via admin panel",
          content: Buffer.from(text, "utf8").toString("base64"),
          sha,
          branch: cfg.branch,
        }),
      });

      if (put.status === 409) {
        res.status(409).json({ error: "התוכן השתנה בינתיים. רעננו את העמוד ונסו שוב." });
        return;
      }
      if (!put.ok) {
        const detail = await put.text();
        res.status(502).json({ error: "commit failed (" + put.status + ")", detail: detail.slice(0, 200) });
        return;
      }

      const out = await put.json();
      res.status(200).json({ ok: true, commit: out.commit && out.commit.sha });
    } catch (e) {
      res.status(502).json({ error: "commit failed" });
    }
    return;
  }

  res.status(405).json({ error: "method not allowed" });
};
