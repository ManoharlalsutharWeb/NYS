/**
 * GURUJI — Swiss Ephemeris Self-Test
 * Tests that @swisseph/node can calculate a real planetary position
 * with Lahiri (Drik Panchang) ayanamsa.
 *
 * Run: npm run swiss:selftest
 *
 * Golden test: 2026-09-11 09:30:00 New York (= 13:30:00 UTC during EDT)
 */

import { calculate } from "../ephemeris/adapter.mjs";

const TEST_UTC  = new Date("2026-09-11T13:30:00.000Z"); // 09:30 New York EDT
const LAT       = 40.7128;
const LON       = -74.0060;

console.log("GURUJI v20 — Swiss Ephemeris Self-Test");
console.log("─".repeat(50));
console.log(`Test date : ${TEST_UTC.toISOString()}`);
console.log(`Location  : ${LAT}°N ${Math.abs(LON)}°W (New York)`);
console.log(`Ayanamsa  : Lahiri (Drik Panchang)`);
console.log("");

let result;
try {
  result = calculate({ utcDate: TEST_UTC, latitude: LAT, longitude: LON, ayanamsa: "Lahiri" });
} catch (e) {
  console.error("❌  Calculation failed:", e.message);
  process.exitCode = 2;
  process.exit();
}

const planets = Object.keys(result.planets);
const checks  = {
  source_swiss:      result.source === "swiss",
  ephemeris_swiss:   result.ephemeris === "swiss",
  engine_correct:    result.engine === "@swisseph/node",
  nine_planets:      planets.length === 9,
  has_rahu:          planets.includes("rahu"),
  has_ketu:          planets.includes("ketu"),
  has_ascendant:     typeof result.ascendant.longitude === "number",
  ascendant_range:   result.ascendant.longitude >= 0 && result.ascendant.longitude < 360,
  ayanamsa_lahiri:   result.ayanamsa === "Lahiri",
};

const allPass = Object.values(checks).every(Boolean);

console.log("Checks:");
for (const [name, pass] of Object.entries(checks)) {
  console.log(`  ${pass ? "✅" : "❌"}  ${name}`);
}

console.log("\nPlanet Longitudes (Lahiri sidereal):");
for (const [name, data] of Object.entries(result.planets)) {
  const ret = data.retrograde ? " (R)" : "";
  console.log(`  ${name.padEnd(10)} ${data.longitude.toFixed(4)}°${ret}`);
}
console.log(`  ${"Ascendant".padEnd(10)} ${result.ascendant.longitude.toFixed(4)}°`);
console.log(`  Julian Day : ${result.julian_day}`);

console.log("\n" + "─".repeat(50));
console.log(allPass
  ? "✅  PASS — Swiss Ephemeris + Lahiri working correctly"
  : "❌  FAIL — Some checks did not pass");

if (!allPass) process.exitCode = 2;

console.log(JSON.stringify({ schema_version: "guruji.selftest.v1", pass: allPass, checks, result }, null, 2));
