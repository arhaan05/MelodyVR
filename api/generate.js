/* api/generate.js — the key keeper.
   This tiny function runs on Vercel's servers, NOT in the browser.
   It holds the Blockade Labs API key as an environment variable
   (BLOCKADE_API_KEY) and forwards requests, so the key never appears
   in the public repository or in anyone's browser.

   POST  /api/generate          body {prompt}  -> {id}
   GET   /api/generate?id=123                  -> {status, progress, fileUrl}
   GET   /api/generate                         -> {ok: true}  (health check) */

const BLOCKADE_BASE = "https://backend.blockadelabs.com/api/v1";

// Only these sites may use this proxy (protects your generation credits)
const ALLOWED_ORIGINS = [
  "https://arhaan05.github.io",
  "http://localhost",
  "http://127.0.0.1",
];

module.exports = async (req, res) => {
  const origin = req.headers.origin || "";
  if (ALLOWED_ORIGINS.some((o) => origin === o || origin.startsWith(o + ":"))) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();

  const key = process.env.BLOCKADE_API_KEY;

  // Health check (also works before the key is configured)
  if (req.method === "GET" && !req.query.id) {
    return res.status(200).json({
      ok: true,
      message: key ? "MelodyVR proxy is alive and has its key." : "Proxy is alive, but BLOCKADE_API_KEY is not set yet.",
    });
  }

  if (!key) return res.status(500).json({ error: "Server is missing its API key." });

  try {
    if (req.method === "POST") {
      const prompt = (req.body && req.body.prompt || "").toString().trim();
      if (!prompt || prompt.length > 600) {
        return res.status(400).json({ error: "Please send a scenery description under 600 characters." });
      }
      const r = await fetch(`${BLOCKADE_BASE}/skybox`, {
        method: "POST",
        headers: { "x-api-key": key, "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      if (r.status === 429) return res.status(429).json({ error: "rate-limited" });
      const data = await r.json();
      if (!r.ok || !data.id) {
        return res.status(502).json({ error: data.error || "Generation could not be started." });
      }
      return res.status(200).json({ id: data.id });
    }

    if (req.method === "GET") {
      const id = req.query.id;
      if (!/^\d+$/.test(String(id))) return res.status(400).json({ error: "Invalid id." });
      const r = await fetch(`${BLOCKADE_BASE}/imagine/requests/${id}`, {
        headers: { "x-api-key": key },
      });
      if (r.status === 429) return res.status(429).json({ error: "rate-limited" });
      const data = await r.json();
      const reqData = data.request || data;
      return res.status(200).json({
        status: reqData.status,
        progress: reqData.progress,
        fileUrl: reqData.file_url || null,
      });
    }

    return res.status(405).json({ error: "Method not allowed." });
  } catch (err) {
    return res.status(502).json({ error: "Upstream service unavailable." });
  }
};
