/**
 * GURUJI — Full Session Test
 * Generates all 390 records for 2026-09-11 and validates them.
 * Run: npm run test:session
 */

import fs from "node:fs";
import { calculate } from "../ephemeris/adapter.mjs";
import { buildSessionMinutes } from "../ephemeris/time-utils.mjs";

const DATE = process.argv[2] || "2026-09-11";
const LAT  = 40.7128;
const LON  = -74.0060;

console.log(`GURUJI v20 — Full Session Test: ${DATE}`);
console.log("─".repeat(50));

const minutes = buildSessionMinutes(DATE);
const records = [];
let failed    = 0;

process.stdout.write("Calculating 390 records");
for (const { local_time, utc } of minutes) {
  try {
    const c = calculate({ utcDate: utc, latitude: LAT, longitude: LON, ayanamsa: "Lahiri" });
    records.push({
      date: DATE, local_time, utc_time: utc.toISOString(),
      timezone: "America/New_York", latitude: LAT, longitude: LON, ...c,
    });
    if (records.length % 50 === 0) process.stdout.write(".");
  } catch (e) {
    console.error(`\n❌ Failed at ${local_time}: ${e.message}`);
    failed++;
  }
}
process.stdout.write("\n");

// Validate
const checks = {
  count_390:        records.length === 390,
  no_failures:      failed === 0,
  first_minute:     records[0]?.local_time === "09:30:00",
  last_minute:      records.at(-1)?.local_time === "15:59:00",
  all_swiss:        records.every(r => r.source === "swiss"),
  all_9_planets:    records.every(r => Object.keys(r.planets || {}).length === 9),
  all_ascendant:    records.every(r => typeof r.ascendant?.longitude === "number"),
  no_duplicates:    new Set(records.map(r => r.utc_time)).size === records.length,
  contiguous:       records.slice(1).every((r, i) => new Date(r.utc_time) - new Date(records[i].utc_time) === 60000),
};

const allPass = Object.values(checks).every(Boolean);

console.log("\nValidation Checks:");
for (const [name, pass] of Object.entries(checks)) {
  console.log(`  ${pass ? "✅" : "❌"}  ${name}`);
}

// Write output
const outFile = `guruji_${DATE}_NY_session.json`;
const payload = {
  schema_version: "guruji.production.v2",
  engine_version: "20.0",
  generated_at: new Date().toISOString(),
  date: DATE,
  session: { timezone: "America/New_York", location: "New York, USA", latitude: LAT, longitude: LON, start_local: "09:30:00", end_local_exclusive: "16:00:00", record_count: records.length },
  ephemeris: { engine: "@swisseph/node", source: "swiss", ayanamsa: "Lahiri" },
  records,
};
fs.writeFileSync(outFile, JSON.stringify(payload, null, 2));

console.log("\n" + "─".repeat(50));
console.log(`Records : ${records.length}`);
console.log(`Output  : ${outFile}`);
console.log(allPass ? "✅  PASS" : "❌  FAIL");

if (!allPass) process.exitCode = 2;
