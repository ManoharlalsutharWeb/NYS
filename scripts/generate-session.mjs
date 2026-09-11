/**
 * GURUJI — Session Generator (command-line)
 * Generates 390 one-minute records for a given date.
 *
 * Usage: node scripts/generate-session.mjs 2026-09-11
 * Output: guruji_2026-09-11_NY_session.json
 */

import fs from "node:fs";
import { calculate } from "../ephemeris/adapter.mjs";
import { buildSessionMinutes } from "../ephemeris/time-utils.mjs";

const date = process.argv[2];
if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
  console.error("Usage: node scripts/generate-session.mjs YYYY-MM-DD");
  process.exitCode = 1;
  process.exit();
}

const LAT = Number(process.argv[3] ?? 40.7128);
const LON = Number(process.argv[4] ?? -74.006);

console.log(`GURUJI v20 — Generating session for ${date}`);
console.log(`Location : ${LAT}°, ${LON}°  (New York)`);
console.log(`Ayanamsa : Lahiri (Drik Panchang)`);
console.log("─".repeat(50));

const minutes = buildSessionMinutes(date);
const records = [];

process.stdout.write("Progress: ");
for (const { local_time, utc } of minutes) {
  const c = calculate({ utcDate: utc, latitude: LAT, longitude: LON, ayanamsa: "Lahiri" });
  records.push({
    date, local_time, utc_time: utc.toISOString(),
    timezone: "America/New_York", latitude: LAT, longitude: LON, ...c,
  });
  if (records.length % 78 === 0) process.stdout.write("█");
}
process.stdout.write(" Done\n\n");

if (records.length !== 390) throw new Error(`Expected 390, got ${records.length}`);

const payload = {
  schema_version: "guruji.production.v2",
  engine_version: "20.0",
  generated_at: new Date().toISOString(),
  date,
  session: {
    timezone: "America/New_York", location: "New York, USA",
    latitude: LAT, longitude: LON,
    start_local: "09:30:00", end_local_exclusive: "16:00:00",
    record_count: records.length,
  },
  ephemeris: { engine: "@swisseph/node", source: "swiss", ayanamsa: "Lahiri" },
  records,
};

const outFile = `guruji_${date}_NY_session.json`;
fs.writeFileSync(outFile, JSON.stringify(payload, null, 2));

console.log(`✅  ${records.length} records written to: ${outFile}`);
console.log(`    First  : ${records[0].local_time}  UTC: ${records[0].utc_time}`);
console.log(`    Last   : ${records.at(-1).local_time}  UTC: ${records.at(-1).utc_time}`);
