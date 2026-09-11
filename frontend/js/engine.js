/**
 * GURUJI — Browser-side Swiss Ephemeris Engine
 * Uses @kuntay/swisseph (WASM) with local ephemeris data files.
 * Lahiri ayanamsa — Drik Panchang compatible.
 *
 * All calculations MUST return source: "swiss".
 * If Moshier is used (no data files), calculations are rejected.
 */

import { createSwissEph, Body, Flag, HouseSystem } from "@kuntay/swisseph";
import { rashiName, nakshatra, calculateVargas } from "./vedic-rules.js";

let swe = null;
let dataState = { loaded: false, files: [], missing: [], bytes: 0 };

// ── Planets to calculate ──────────────────────────────────────────────────────
const BODIES = {
  sun:     Body.Sun,
  moon:    Body.Moon,
  mars:    Body.Mars,
  mercury: Body.Mercury,
  jupiter: Body.Jupiter,
  venus:   Body.Venus,
  saturn:  Body.Saturn,
};

// ── Local time → UTC (DST-aware via Intl) ────────────────────────────────────
export function localToUTC(date, time, timezone = "America/New_York") {
  const [y, mo, d]      = date.split("-").map(Number);
  const [hh, mm, ss=0]  = time.split(":").map(Number);

  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hourCycle: "h23",
  });

  let u = Date.UTC(y, mo - 1, d, hh, mm, ss);
  for (let i = 0; i < 5; i++) {
    const parts = Object.fromEntries(
      fmt.formatToParts(new Date(u))
        .filter(p => p.type !== "literal")
        .map(p => [p.type, Number(p.value)])
    );
    const wall   = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
    const target = Date.UTC(y, mo - 1, d, hh, mm, ss);
    const delta  = target - wall;
    if (delta === 0) break;
    u += delta;
  }
  return new Date(u);
}

// ── Load local ephemeris data and init WASM engine ────────────────────────────
async function readLocalAsset(url) {
  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) throw new Error(`Ephemeris file missing: ${url} (${r.status})`);
  return new Uint8Array(await r.arrayBuffer());
}

export async function initEngine() {
  if (swe) return swe;

  const fileNames = [
    "sepl_18.se1",   // Planets 1800–2399
    "semo_18.se1",   // Moon 1800–2399
    "seas_18.se1",   // Asteroids 1800–2399
    "sefstars.txt",  // Fixed stars
    "seorbel.txt",   // Orbital elements
  ];

  const files = {};
  const missing = [];
  let bytes = 0;

  for (const name of fileNames) {
    try {
      files[name] = await readLocalAsset(`ephemeris/${name}`);
      bytes += files[name].byteLength;
    } catch (e) {
      missing.push(name);
      console.warn("Missing ephemeris file:", name, e.message);
    }
  }

  if (missing.length > 0) {
    throw new Error(`Missing ephemeris files: ${missing.join(", ")}\nRun: npm run prepare:ephemeris`);
  }

  swe = await createSwissEph({ files });

  // Set Lahiri ayanamsa (SE_SIDM_LAHIRI = 1)
  const lahiri = swe.Ayanamsa?.Lahiri ?? swe.Ayanamsa?.LAHIRI ?? 1;
  swe.setSiderealMode(lahiri);

  dataState = { loaded: true, files: fileNames, missing: [], bytes };
  return swe;
}

export function engineStatus() { return { ...dataState }; }

// ── Single-minute calculation ─────────────────────────────────────────────────
export async function calculate({ date, time, lat, lon, enabledVargas = [1, 9] }) {
  const e = await initEngine();

  const utc = localToUTC(date, time);
  const jd  = e.julianDay(
    utc.getUTCFullYear(), utc.getUTCMonth() + 1, utc.getUTCDate(),
    utc.getUTCHours() + utc.getUTCMinutes() / 60 + utc.getUTCSeconds() / 3600,
  );

  const row = {
    date, local_time: time, timezone: "America/New_York",
    utc_time: utc.toISOString(), julian_day: jd,
    latitude: Number(lat), longitude: Number(lon),
    ayanamsa: "Lahiri", ephemeris_source: "swiss",
    ephemeris_files: dataState.files,
    ephemeris_bytes: dataState.bytes,
  };

  const sources = new Set();

  // 7 classical planets
  for (const [name, body] of Object.entries(BODIES)) {
    const p = e.calc(jd, body, { flags: Flag.Sidereal, ephemeris: "swiss" });
    sources.add(p.ephemeris);
    if (p.ephemeris !== "swiss") {
      throw new Error(`${name}: Swiss ephemeris not used — got "${p.ephemeris}". Ensure ephemeris files are loaded.`);
    }
    row[`${name}_longitude`]  = p.longitude;
    row[`${name}_speed`]      = p.longitudeSpeed;
    row[`${name}_retrograde`] = p.longitudeSpeed < 0;
  }

  // Rahu / Ketu (True Node)
  const nodeBody = Body.TrueNode ?? Body.MeanNode;
  if (nodeBody === undefined) throw new Error("Node body not available in this WASM build.");
  const node = e.calc(jd, nodeBody, { flags: Flag.Sidereal, ephemeris: "swiss" });
  sources.add(node.ephemeris);
  if (node.ephemeris !== "swiss") {
    throw new Error(`Rahu: Swiss ephemeris not used — got "${node.ephemeris}".`);
  }

  row.rahu_longitude = node.longitude;
  row.ketu_longitude = (node.longitude + 180) % 360;
  row.rahu_speed     = node.longitudeSpeed;
  row.rahu_retrograde = true;
  row.ketu_retrograde = true;

  // Nakshatra & Rashi from Moon
  const moonNk = nakshatra(row.moon_longitude);
  row.moon_rashi     = rashiName(row.moon_longitude);
  row.moon_nakshatra = moonNk.name;
  row.moon_pada      = moonNk.pada;

  // Ascendant (Placidus, sidereal)
  const hs = e.houses(jd, Number(lat), Number(lon), HouseSystem.Placidus);
  row.ascendant_longitude = hs.ascendant;
  row.ascendant_rashi     = rashiName(hs.ascendant);

  // Vargas for all planetary longitudes
  row.vargas = {};
  for (const [key, value] of Object.entries(row)) {
    if (key.endsWith("_longitude") && typeof value === "number") {
      row.vargas[key] = calculateVargas(value, enabledVargas);
    }
  }

  row.ephemeris_used = [...sources].join(",");
  return row;
}

// ── Session generator (390 records, 09:30–15:59 New York) ────────────────────
export async function calculateUSSession({
  date, lat = 40.7128, lon = -74.0060,
  startMinute = 570,  // 9:30
  endMinute   = 960,  // 16:00
  enabledVargas = [1, 9, 60],
  onProgress = null,
}) {
  const e = await initEngine();
  if (endMinute <= startMinute) throw new Error("Invalid session window.");
  const expected = endMinute - startMinute;
  const records  = new Array(expected);

  for (let i = 0; i < expected; i++) {
    const m  = startMinute + i;
    const hh = String(Math.floor(m / 60)).padStart(2, "0");
    const mm = String(m % 60).padStart(2, "0");
    records[i] = await calculate({ date, time: `${hh}:${mm}:00`, lat, lon, enabledVargas });

    if (onProgress && (i === 0 || (i + 1) % 10 === 0 || i === expected - 1)) {
      onProgress({ done: i + 1, total: expected, percent: ((i + 1) / expected) * 100 });
    }
    // Keep browser responsive
    if ((i + 1) % 25 === 0) await new Promise(requestAnimationFrame);
  }

  if (records.length !== 390) {
    throw new Error(`US regular session must contain 390 records; got ${records.length}`);
  }

  return {
    schema_version: "guruji.minute.v1",
    engine_version: "20.0",
    generated_at:   new Date().toISOString(),
    date,
    session: {
      timezone: "America/New_York",
      location: "New York, USA",
      latitude: Number(lat), longitude: Number(lon),
      start_local: "09:30:00", end_local_exclusive: "16:00:00",
      record_count: records.length,
    },
    ephemeris: {
      engine: "Swiss Ephemeris WASM (@kuntay/swisseph)",
      source: "swiss",
      data_files: dataState.files,
      data_bytes: dataState.bytes,
    },
    ayanamsa: "Lahiri",
    records,
  };
}
