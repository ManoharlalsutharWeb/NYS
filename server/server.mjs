/**
 * GURUJI Astro Data Engine — v20.0
 * Single-admin, server-side auth, Swiss Ephemeris (Lahiri/Drik Panchang style)
 * Port: 8787 (default)
 */

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const __dir = path.dirname(fileURLToPath(import.meta.url));
const ROOT   = path.resolve(__dir, "..");
const PUBLIC = path.join(ROOT, "frontend");
const PORT   = Number(process.env.PORT || 8787);

// ── Auth config ─────────────────────────────────────────────────────────────
const ADMIN_USER     = process.env.GURUJI_ADMIN_USER     || "Admin";
const ADMIN_PASSWORD = process.env.GURUJI_ADMIN_PASSWORD || "";
const ADMIN_HASH     = process.env.GURUJI_ADMIN_SHA256   || "";

if (!ADMIN_PASSWORD && !ADMIN_HASH) {
  console.warn("⚠  WARNING: Set GURUJI_ADMIN_PASSWORD or GURUJI_ADMIN_SHA256 before deployment.");
}

// ── Session store (in-memory) ────────────────────────────────────────────────
const sessions = new Map();
const SESSION_TTL = 8 * 60 * 60 * 1000; // 8 hours

function cleanSessions() {
  const now = Date.now();
  for (const [token, data] of sessions) {
    if (now - data.created > SESSION_TTL) sessions.delete(token);
  }
}
setInterval(cleanSessions, 15 * 60 * 1000); // clean every 15 min

// ── Helpers ──────────────────────────────────────────────────────────────────
const sha256 = s => crypto.createHash("sha256").update(s).digest("hex");

function passwordMatches(p) {
  if (ADMIN_HASH)     return sha256(p) === ADMIN_HASH;
  if (ADMIN_PASSWORD) return crypto.timingSafeEqual(Buffer.from(p.padEnd(ADMIN_PASSWORD.length)), Buffer.from(ADMIN_PASSWORD));
  return false;
}

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js":   "text/javascript; charset=utf-8",
  ".mjs":  "text/javascript; charset=utf-8",
  ".css":  "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg":  "image/svg+xml",
  ".png":  "image/png",
  ".se1":  "application/octet-stream",
  ".txt":  "text/plain; charset=utf-8",
};

function parseCookies(req) {
  return Object.fromEntries(
    (req.headers.cookie || "").split(";")
      .map(x => x.trim()).filter(Boolean)
      .map(x => { const i = x.indexOf("="); return [x.slice(0, i), decodeURIComponent(x.slice(i + 1))]; })
  );
}

function isAuthenticated(req) {
  const token = parseCookies(req).guruji_session;
  if (!token || !sessions.has(token)) return false;
  const data = sessions.get(token);
  if (Date.now() - data.created > SESSION_TTL) { sessions.delete(token); return false; }
  return true;
}

function sendRaw(res, status, type, body, headers = {}) {
  res.writeHead(status, { "Content-Type": type, ...headers });
  res.end(body);
}

function sendJSON(res, status, obj, headers = {}) {
  sendRaw(res, status, "application/json; charset=utf-8", JSON.stringify(obj), headers);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", chunk => { data += chunk; if (data.length > 100_000) req.destroy(); });
    req.on("end", () => { try { resolve(JSON.parse(data || "{}")); } catch (e) { reject(e); } });
    req.on("error", reject);
  });
}

// ── Ephemeris status (server-side check) ─────────────────────────────────────
async function getEphemerisStatus() {
  const status = {
    engine: "@swisseph/node",
    installed: false,
    version: null,
    selftest: null,
    pass: false,
    error: null,
  };

  try {
    // Check package installed
    const pkgPath = path.join(ROOT, "node_modules/@swisseph/node/package.json");
    if (!fs.existsSync(pkgPath)) {
      status.error = "Package @swisseph/node not installed. Run: npm install";
      return status;
    }
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
    status.installed = true;
    status.version = pkg.version;

    // Run a quick calculation
    const { calculate } = await import("../ephemeris/adapter.mjs");
    const testDate = new Date("2026-09-11T13:30:00Z");
    const result = calculate({ utcDate: testDate, latitude: 40.7128, longitude: -74.006, ayanamsa: "Lahiri" });

    const planetNames = Object.keys(result.planets);
    const ok =
      result.source === "swiss" &&
      result.ephemeris === "swiss" &&
      planetNames.length === 9 &&
      planetNames.includes("rahu") &&
      planetNames.includes("ketu") &&
      typeof result.ascendant.longitude === "number";

    status.selftest = {
      date: "2026-09-11T13:30:00Z",
      planet_count: planetNames.length,
      planets: planetNames,
      ascendant: result.ascendant.longitude,
      source: result.source,
      engine: result.engine,
    };
    status.pass = ok;
    if (!ok) status.error = "Self-test calculation did not meet quality criteria.";

  } catch (e) {
    status.error = e.message;
  }
  return status;
}

// ── Main request handler ──────────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    const pathname = url.pathname;
    const method   = req.method;

    // ── POST /api/login ──────────────────────────────────────────────────────
    if (method === "POST" && pathname === "/api/login") {
      let body;
      try { body = await readBody(req); }
      catch { return sendJSON(res, 400, { ok: false, error: "INVALID_BODY" }); }

      if (body.username !== ADMIN_USER || !passwordMatches(String(body.password ?? ""))) {
        return sendJSON(res, 401, { ok: false, error: "INVALID_LOGIN" });
      }

      const token = crypto.randomBytes(32).toString("hex");
      sessions.set(token, { created: Date.now(), user: ADMIN_USER });

      return sendJSON(res, 200, { ok: true, user: ADMIN_USER }, {
        "Set-Cookie": `guruji_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=28800`,
      });
    }

    // ── POST /api/logout ─────────────────────────────────────────────────────
    if (method === "POST" && pathname === "/api/logout") {
      const c = parseCookies(req);
      if (c.guruji_session) sessions.delete(c.guruji_session);
      return sendJSON(res, 200, { ok: true }, {
        "Set-Cookie": "guruji_session=; Max-Age=0; HttpOnly; SameSite=Lax; Path=/",
      });
    }

    // ── GET /api/session ─────────────────────────────────────────────────────
    if (method === "GET" && pathname === "/api/session") {
      const auth = isAuthenticated(req);
      return sendJSON(res, auth ? 200 : 401,
        auth ? { ok: true, user: ADMIN_USER } : { ok: false, error: "NOT_AUTHENTICATED" });
    }

    // ── All other /api/* require auth ────────────────────────────────────────
    if (pathname.startsWith("/api/") && !isAuthenticated(req)) {
      return sendJSON(res, 401, { ok: false, error: "ADMIN_LOGIN_REQUIRED" });
    }

    // ── GET /api/health ──────────────────────────────────────────────────────
    if (method === "GET" && pathname === "/api/health") {
      return sendJSON(res, 200, {
        ok: true, version: "20.0",
        auth: "server-side-cookie",
        ephemeris: "local-swiss-ephemeris",
        timezone: "America/New_York",
        ayanamsa: "Lahiri",
        session_count: sessions.size,
      });
    }

    // ── GET /api/ephemeris/status ─────────────────────────────────────────────
    if (method === "GET" && pathname === "/api/ephemeris/status") {
      const st = await getEphemerisStatus();
      return sendJSON(res, st.pass ? 200 : 503, st);
    }

    // ── POST /api/generate (single minute) ───────────────────────────────────
    if (method === "POST" && pathname === "/api/generate") {
      let body;
      try { body = await readBody(req); }
      catch { return sendJSON(res, 400, { ok: false, error: "INVALID_BODY" }); }

      if (!body.date) return sendJSON(res, 400, { ok: false, error: "date required (YYYY-MM-DD)" });
      if (!body.time) return sendJSON(res, 400, { ok: false, error: "time required (HH:MM:SS)" });

      try {
        const { calculate } = await import("../ephemeris/adapter.mjs");
        const { localToUTC } = await import("../ephemeris/time-utils.mjs");

        const utcDate = localToUTC(body.date, body.time, "America/New_York");
        const lat = Number(body.lat ?? 40.7128);
        const lon = Number(body.lon ?? -74.006);
        const result = calculate({ utcDate, latitude: lat, longitude: lon, ayanamsa: "Lahiri" });

        return sendJSON(res, 200, { ok: true, record: { date: body.date, local_time: body.time, utc_time: utcDate.toISOString(), ...result } });
      } catch (e) {
        return sendJSON(res, 503, { ok: false, error: e.message });
      }
    }

    // ── POST /api/session/generate (full 390-record session) ──────────────────
    if (method === "POST" && pathname === "/api/session/generate") {
      let body;
      try { body = await readBody(req); }
      catch { return sendJSON(res, 400, { ok: false, error: "INVALID_BODY" }); }

      if (!body.date) return sendJSON(res, 400, { ok: false, error: "date required (YYYY-MM-DD)" });

      try {
        const { calculate } = await import("../ephemeris/adapter.mjs");
        const { localToUTC } = await import("../ephemeris/time-utils.mjs");

        const lat = Number(body.lat ?? 40.7128);
        const lon = Number(body.lon ?? -74.006);
        const startMin = body.startMinute ?? 570; // 9:30
        const endMin   = body.endMinute   ?? 960; // 16:00
        const expected = endMin - startMin;

        const records = [];
        for (let i = 0; i < expected; i++) {
          const m  = startMin + i;
          const hh = String(Math.floor(m / 60)).padStart(2, "0");
          const mm = String(m % 60).padStart(2, "0");
          const localTime = `${hh}:${mm}:00`;
          const utcDate = localToUTC(body.date, localTime, "America/New_York");
          const c = calculate({ utcDate, latitude: lat, longitude: lon, ayanamsa: "Lahiri" });
          records.push({ date: body.date, local_time: localTime, utc_time: utcDate.toISOString(), timezone: "America/New_York", latitude: lat, longitude: lon, ...c });
        }

        if (records.length !== 390) {
          return sendJSON(res, 500, { ok: false, error: `Expected 390 records, got ${records.length}` });
        }

        const payload = {
          schema_version: "guruji.production.v2",
          engine_version: "20.0",
          generated_at: new Date().toISOString(),
          date: body.date,
          session: { timezone: "America/New_York", location: "New York, USA", latitude: lat, longitude: lon, start_local: "09:30:00", end_local_exclusive: "16:00:00", record_count: records.length },
          ephemeris: { engine: "@swisseph/node", source: "swiss", ayanamsa: "Lahiri" },
          records,
        };

        return sendJSON(res, 200, { ok: true, payload });
      } catch (e) {
        return sendJSON(res, 503, { ok: false, error: e.message });
      }
    }

    // ── Static file server ────────────────────────────────────────────────────
    if (method === "GET") {
      // Root → login page
      let filePath = pathname === "/" ? "login.html" : pathname;

      // Strip leading slash
      const resolved = path.normalize(path.join(PUBLIC, filePath));

      // Security: must stay inside PUBLIC
      if (!resolved.startsWith(PUBLIC)) {
        return sendRaw(res, 403, "text/plain", "Forbidden");
      }

      if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) {
        return sendRaw(res, 404, "text/plain", "Not found");
      }

      const ext = path.extname(resolved).toLowerCase();
      const contentType = MIME[ext] || "application/octet-stream";
      return sendRaw(res, 200, contentType, fs.readFileSync(resolved));
    }

    sendRaw(res, 405, "text/plain", "Method not allowed");

  } catch (e) {
    console.error("Server error:", e);
    sendJSON(res, 500, { ok: false, error: e.message });
  }
});

server.listen(PORT, () => {
  console.log(`\n🔮 GURUJI Astro Data Engine v20.0`);
  console.log(`   Listening on http://localhost:${PORT}`);
  console.log(`   Admin user  : ${ADMIN_USER}`);
  console.log(`   Auth        : Server-side cookie (8h TTL)`);
  console.log(`   Ephemeris   : Local Swiss Ephemeris (@swisseph/node)`);
  console.log(`   Ayanamsa    : Lahiri (Drik Panchang compatible)`);
  console.log(`   Session     : 09:30–15:59 New York (390 records)\n`);
});
