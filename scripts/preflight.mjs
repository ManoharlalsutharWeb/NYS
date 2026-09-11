/**
 * GURUJI — Preflight Check
 * Verifies all required packages are installed.
 * Run: npm run preflight
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const packages = [
  "@swisseph/node",
  "@kuntay/swisseph",
  "@kuntay/swisseph-data",
];

const ephemerisFiles = [
  "sepl_18.se1", "semo_18.se1", "seas_18.se1", "sefstars.txt", "seorbel.txt",
];

console.log("GURUJI v20 — Preflight Check");
console.log("─".repeat(50));
console.log(`Node: ${process.version}`);
console.log("");

let allOk = true;

// Check packages
console.log("Packages:");
for (const pkg of packages) {
  const pkgJson = path.join(ROOT, "node_modules", pkg, "package.json");
  if (fs.existsSync(pkgJson)) {
    const { version } = JSON.parse(fs.readFileSync(pkgJson, "utf8"));
    console.log(`  ✅  ${pkg}@${version}`);
  } else {
    console.log(`  ❌  ${pkg}  — NOT INSTALLED`);
    allOk = false;
  }
}

// Check ephemeris files
console.log("\nEphemeris files (frontend/ephemeris/):");
const ephDir = path.join(ROOT, "frontend", "ephemeris");
for (const f of ephemerisFiles) {
  const fp = path.join(ephDir, f);
  if (fs.existsSync(fp)) {
    const bytes = fs.statSync(fp).size;
    console.log(`  ✅  ${f}  (${(bytes / 1024).toFixed(1)} KB)`);
  } else {
    console.log(`  ❌  ${f}  — MISSING  →  run: npm run prepare:ephemeris`);
    allOk = false;
  }
}

// Check .env
console.log("\nEnvironment:");
const hasPassword = process.env.GURUJI_ADMIN_PASSWORD || process.env.GURUJI_ADMIN_SHA256;
if (hasPassword) {
  console.log("  ✅  GURUJI_ADMIN_PASSWORD or GURUJI_ADMIN_SHA256 is set");
} else {
  console.log("  ⚠   GURUJI_ADMIN_PASSWORD not set  →  set it before running");
  // Not fatal for preflight
}

console.log("\n" + "─".repeat(50));
if (allOk) {
  console.log("✅  All checks passed. Run: npm start");
} else {
  console.log("❌  Some checks failed. Fix issues above, then retry.");
  process.exitCode = 2;
}
