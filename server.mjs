import express from "express";

const app = express();
const PORT = process.env.PORT || 8080;

// ========== Allowlist (แนะนำใช้ ALLOW_HOSTS) ==========
const ALLOW_HOSTS = (process.env.ALLOW_HOSTS || "dolive.thaim3u.com,keela2.com")
  .split(",").map(s => s.trim().toLowerCase());

// ตั้งค่า timeout/retry ได้จาก env
const CONNECT_TIMEOUT = Number(process.env.BRIDGE_TIMEOUT_MS || 25000);
const RETRIES         = Number(process.env.BRIDGE_RETRIES || 2);

app.get("/health", (req, res) => res.type("text").send("ok"));

async function fetchWithTimeout(url, opts = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), CONNECT_TIMEOUT);
  try { return await fetch(url, { ...opts, signal: ctrl.signal }); }
  finally { clearTimeout(t); }
}

app.get("/f", async (req, res) => {
  try {
    const raw = String(req.query.u || "");
    // รองรับทั้งแบบ encode และไม่ encode
    const u = raw.startsWith("http") ? raw : decodeURIComponent(raw);
    let host;
    try { host = new URL(u).hostname.toLowerCase(); }
    catch { return res.status(400).json({ error: "invalid url" }); }

    // อนุญาตถ้า host ตรงหรือเป็น subdomain ของรายการที่กำหนด
    const ok = ALLOW_HOSTS.some(h => host === h || host.endsWith("." + h));
    if (!ok) return res.status(400).json({ error: "invalid upstream" });

    // forward headers ที่จำเป็น
    const fwd = new Headers();
    const ref = req.get("referer");  if (ref)  fwd.set("Referer", ref);
    const ua  = req.get("user-agent"); if (ua) fwd.set("User-Agent", ua);
    const rng = req.get("range");    if (rng)  fwd.set("Range", rng);
    const acc = req.get("accept");   if (acc)  fwd.set("Accept", acc);

    let resp, lastErr;
    for (let i = 0; i <= RETRIES; i++) {
      try { resp = await fetchWithTimeout(u, { headers: fwd }); break; }
      catch (e) { lastErr = e; if (i === RETRIES) throw e; await new Promise(r=>setTimeout(r, 500*(i+1))); }
    }

    res.status(resp.status);
    resp.headers.forEach((v, k) => {
      if (!/^transfer-encoding|connection|keep-alive|proxy-/.test(k)) res.setHeader(k, v);
    });
    res.setHeader("cache-control", "no-store");
    if (resp.body) for await (const chunk of resp.body) res.write(chunk);
    res.end();

  } catch (err) {
    console.error(err);
    res.status(502).json({ error: "bridge fetch failed" });
  }
});

app.listen(PORT, () => console.log(`tv-bridge running :${PORT}`));
