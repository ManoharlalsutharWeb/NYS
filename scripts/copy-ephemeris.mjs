/**
 * GURUJI — Copy Swiss Ephemeris data files to frontend/ephemeris/
 * Run: npm run prepare:ephemeris
 *
 * Copies the 5 required files from @kuntay/swisseph-data to frontend/ephemeris/
 * so the browser-side WASM engine can load them.
 */

import fs   from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEST = path.join(ROOT, "frontend", "ephemeris");

// Required files
const FILES = [
  "sepl_18.se1",   // Planets 1800–2399
  "semo_18.se1",   // Moon 1800–2399
  "seas_18.se1",   // Asteroids 1800–2399
  "sefstars.txt",  // Fixed stars
  "seorbel.txt",   // Orbital elements
];

// Candidate source directories (in priority order)
const SOURCES = [
  path.join(ROOT, "node_modules/@kuntay/swisseph-data"),
  path.join(ROOT, "node_modules/@kuntay/swisseph-data/ephe"),
  path.join(ROOT, "node_modules/@kuntay/swisseph/ephe"),
  path.join(ROOT, "node_modules/@swisseph/node/ephe"),
];

fs.mkdirSync(DEST, { recursive: true });

let anyMissing = false;

for (const fileName of FILES) {
  let found = false;

  for (const srcDir of SOURCES) {
    const srcPath = path.join(srcDir, fileName);
    if (fs.existsSync(srcPath)) {
      const destPath = path.join(DEST, fileName);
      fs.copyFileSync(srcPath, destPath);
      const bytes = fs.statSync(destPath).size;
      console.log(`✅  ${fileName}  (${(bytes / 1024).toFixed(1)} KB)`);
      found = true;
      break;
    }
  }

  if (!found) {
    console.error(`❌  ${fileName}  — NOT FOUND in any known location`);
    console.error(`    Searched:`);
    SOURCES.forEach(s => console.error(`      ${path.join(s, fileName)}`));
    anyMissing = true;
  }
}

if (anyMissing) {
  console.error("\n⚠  Some ephemeris files are missing.");
  console.error("   Make sure @kuntay/swisseph-data is installed:");
  console.error("   npm install\n");
  process.exitCode = 2;
} else {
  const destFiles = fs.readdirSync(DEST);
  const totalBytes = destFiles.reduce((n, f) => n + fs.statSync(path.join(DEST, f)).size, 0);
  console.log(`\n✅  All ${FILES.length} ephemeris files ready in frontend/ephemeris/`);
  console.log(`   Total: ${(totalBytes / 1024 / 1024).toFixed(2)} MB`);
  console.log(`\nNext step: npm start\n`);
}
