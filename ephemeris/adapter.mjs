/**
 * GURUJI — Swiss Ephemeris Adapter (Lahiri / Drik Panchang style)
 * Uses @swisseph/node (CommonJS) — NO online fallback, NO Moshier fallback.
 *
 * Planets: Sun, Moon, Mars, Mercury, Jupiter, Venus, Saturn, Rahu (MeanNode=10), Ketu
 * Ayanamsa: Lahiri (SiderealMode.Lahiri = 1)
 * Houses: Placidus
 */

import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const swe = require("@swisseph/node");

// ── Normalise longitude to [0, 360) ──────────────────────────────────────────
const norm = x => ((Number(x) % 360) + 360) % 360;

// ── Planet IDs (Swiss Ephemeris constants) ────────────────────────────────────
// These are the SE_* body numbers used by @swisseph/node
const PLANET_IDS = {
  sun:     swe.Planet.Sun,      // 0
  moon:    swe.Planet.Moon,     // 1
  mercury: swe.Planet.Mercury,  // 2
  venus:   swe.Planet.Venus,    // 3
  mars:    swe.Planet.Mars,     // 4
  jupiter: swe.Planet.Jupiter,  // 5
  saturn:  swe.Planet.Saturn,   // 6
};
const MEAN_NODE = 10; // SE_MEAN_NODE — Rahu

// ── Set Lahiri once at module load ───────────────────────────────────────────
swe.setSiderealMode(swe.SiderealMode.Lahiri); // = 1

/**
 * Calculate all planetary positions for a given UTC moment.
 *
 * @param {{ utcDate: Date, latitude: number, longitude: number, ayanamsa?: string }} opts
 * @returns {{ julian_day, ayanamsa, planets, ascendant, source, ephemeris, engine }}
 */
export function calculate({ utcDate, latitude, longitude, ayanamsa = "Lahiri" }) {
  const d = utcDate instanceof Date ? utcDate : new Date(utcDate);
  if (Number.isNaN(d.getTime())) throw new Error("INVALID_UTC_DATE");

  const jd = swe.dateToJulianDay(d);
  const planets = {};

  // ── 7 classical planets ───────────────────────────────────────────────────
  for (const [name, planetId] of Object.entries(PLANET_IDS)) {
    const r = swe.calculatePosition(jd, planetId);
    if (!r || typeof r.longitude !== "number") {
      throw new Error(`SWISS_${name.toUpperCase()}_FAILED`);
    }
    planets[name] = {
      longitude:  norm(r.longitude),
      latitude:   r.latitude  ?? null,
      speed:      r.longitudeSpeed ?? null,
      retrograde: (r.longitudeSpeed ?? 0) < 0,
    };
  }

  // ── Rahu (Mean Node = 10) & Ketu ─────────────────────────────────────────
  const node = swe.calculatePosition(jd, MEAN_NODE);
  if (!node || typeof node.longitude !== "number") throw new Error("SWISS_RAHU_FAILED");

  const rahuLon = norm(node.longitude);
  const ketuLon = norm(rahuLon + 180);

  planets.rahu = {
    longitude:  rahuLon,
    latitude:   node.latitude ?? null,
    speed:      node.longitudeSpeed ?? null,
    retrograde: true, // Rahu always retrograde (negative speed)
  };
  planets.ketu = {
    longitude:  ketuLon,
    latitude:   node.latitude != null ? -node.latitude : null,
    speed:      node.longitudeSpeed ?? null,
    retrograde: true,
  };

  // ── Houses (Placidus, Lahiri sidereal) ────────────────────────────────────
  const houses = swe.calculateHouses(jd, latitude, longitude, swe.HouseSystem.Placidus);
  const ascLon = typeof houses.ascendant === "number"
    ? houses.ascendant
    : houses.ascendant?.longitude;

  if (typeof ascLon !== "number") throw new Error("SWISS_ASCENDANT_FAILED");

  return {
    julian_day: jd,
    ayanamsa,
    planets,
    ascendant: { longitude: norm(ascLon) },
    source:    "swiss",
    ephemeris: "swiss",
    engine:    "@swisseph/node",
  };
}
