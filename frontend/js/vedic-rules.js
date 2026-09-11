/**
 * GURUJI — Vedic Astrology Rules
 * Parashari divisional chart (Varga) calculations — Lahiri / Drik Panchang style.
 *
 * All formulas are explicit and auditable.
 * D27, D30, D40, D45, D60 are tagged as requiring Drik reference validation
 * before production use, as convention variants exist across software.
 */

// ── Constants ─────────────────────────────────────────────────────────────────
export const VARGAS = [1, 2, 3, 4, 7, 9, 10, 12, 16, 20, 24, 27, 30, 40, 45, 60];

export const RASHIS = [
  "Mesha", "Vrishabha", "Mithuna", "Karka",
  "Simha", "Kanya", "Tula", "Vrishchika",
  "Dhanu", "Makara", "Kumbha", "Meena",
];

export const NAKSHATRAS = [
  "Ashwini", "Bharani", "Krittika", "Rohini", "Mrigashira", "Ardra",
  "Punarvasu", "Pushya", "Ashlesha", "Magha", "Purva Phalguni", "Uttara Phalguni",
  "Hasta", "Chitra", "Swati", "Vishakha", "Anuradha", "Jyeshtha",
  "Mula", "Purva Ashadha", "Uttara Ashadha", "Shravana", "Dhanishtha",
  "Shatabhisha", "Purva Bhadrapada", "Uttara Bhadrapada", "Revati",
];

// ── Basic helpers ─────────────────────────────────────────────────────────────
export const norm360       = x => ((x % 360) + 360) % 360;
export const signIndex     = l => Math.floor(norm360(l) / 30);
export const degreeInSign  = l => norm360(l) % 30;
export const rashiName     = l => RASHIS[signIndex(l)];
const mod12 = n => ((n % 12) + 12) % 12;
const seq   = (start, n) => mod12(start + n);

// ── Nakshatra & Pada ─────────────────────────────────────────────────────────
export function nakshatra(longitude) {
  const lon   = norm360(longitude);
  const span  = 360 / 27;
  const index = Math.min(26, Math.floor(lon / span));
  const pada  = Math.min(4, Math.floor((lon - index * span) / (span / 4)) + 1);
  return { index, name: NAKSHATRAS[index], pada };
}

// ── D-Varga formulas (Parashari, Drik Panchang compatible) ───────────────────

/** D1 — Rashi (Natal chart) */
function D1(l) { return signIndex(l); }

/** D2 — Hora: odd signs → Sun (Leo=4) first half, Moon (Cancer=3) second; even reversed. */
function D2(l) {
  const s = signIndex(l), p = Math.floor(degreeInSign(l) / 15);
  return s % 2 === 0 ? (p === 0 ? 4 : 3) : (p === 0 ? 3 : 4);
}

/** D3 — Drekkana: trinal signs (0°,10°,20° → same sign, 5th, 9th). */
function D3(l) {
  const s = signIndex(l), p = Math.floor(degreeInSign(l) / 10);
  return seq(s, [0, 4, 8][p]);
}

/** D4 — Chaturthamsa: 1st, 4th, 7th, 10th from sign. */
function D4(l) {
  const s = signIndex(l), p = Math.floor(degreeInSign(l) / 7.5);
  return seq(s, [0, 3, 6, 9][p]);
}

/** D7 — Saptamsa: odd signs start from same; even from 7th. */
function D7(l) {
  const s = signIndex(l), p = Math.floor(degreeInSign(l) / (30 / 7));
  const start = s % 2 === 0 ? s : seq(s, 6);
  return seq(start, p);
}

/** D9 — Navamsa: movable→same, fixed→9th, dual→5th; then zodiacal. */
function D9(l) {
  const s = signIndex(l), p = Math.floor(degreeInSign(l) / (30 / 9));
  const el = s % 3;
  const start = el === 0 ? s : el === 1 ? seq(s, 8) : seq(s, 4);
  return seq(start, p);
}

/** D10 — Dasamsa: odd→same, even→9th; then zodiacal. */
function D10(l) {
  const s = signIndex(l), p = Math.floor(degreeInSign(l) / 3);
  const start = s % 2 === 0 ? s : seq(s, 8);
  return seq(start, p);
}

/** D12 — Dvadasamsa: consecutive from natal sign. */
function D12(l) {
  const s = signIndex(l), p = Math.floor(degreeInSign(l) / 2.5);
  return seq(s, p);
}

/** D16 — Shodasamsa: movable→same, fixed→5th, dual→9th. */
function D16(l) {
  const s = signIndex(l), p = Math.floor(degreeInSign(l) / (30 / 16));
  const start = s % 3 === 0 ? s : s % 3 === 1 ? seq(s, 4) : seq(s, 8);
  return seq(start, p);
}

/** D20 — Vimshamsa: movable→same, fixed→8th (Scorpio cycle), dual→5th. */
function D20(l) {
  const s = signIndex(l), p = Math.floor(degreeInSign(l) / 1.5);
  const start = s % 3 === 0 ? s : s % 3 === 1 ? seq(s, 7) : seq(s, 4);
  return seq(start, p);
}

/** D24 — Chaturvimshamsa: odd→5th, even→4th; then zodiacal. */
function D24(l) {
  const s = signIndex(l), p = Math.floor(degreeInSign(l) / (30 / 24));
  const start = s % 2 === 0 ? seq(s, 4) : seq(s, 3);
  return seq(start, p);
}

/** D27 — Saptavimshamsa: fire→Aries(0), earth→Leo(4), air→Gemini(8+); then zodiacal. */
function D27(l) {
  const s = signIndex(l), p = Math.floor(degreeInSign(l) / (30 / 27));
  const start = s % 3 === 0 ? 0 : s % 3 === 1 ? 4 : 8;
  return seq(start, p);
}

/**
 * D30 — Trimshamsa: five unequal portions per sign.
 * Odd signs: Mars(0-5°), Saturn(5-10°), Jupiter(10-18°), Mercury(18-25°), Venus(25-30°)
 * Even signs: Venus(0-5°), Mercury(5-12°), Jupiter(12-20°), Saturn(20-25°), Mars(25-30°)
 */
function D30(l) {
  const s = signIndex(l), d = degreeInSign(l), odd = s % 2 === 0;
  if (odd) {
    if (d < 5)  return 0;   // Aries (Mars)
    if (d < 10) return 10;  // Aquarius (Saturn)
    if (d < 18) return 2;   // Gemini (Jupiter)
    if (d < 25) return 8;   // Sagittarius (Mercury)
    return 6;               // Libra (Venus)
  } else {
    if (d < 5)  return 6;   // Libra (Venus)
    if (d < 12) return 2;   // Gemini (Mercury) — note: 7° span
    if (d < 20) return 8;   // Sagittarius (Jupiter) — note: 8° span
    if (d < 25) return 4;   // Leo (Saturn)
    return 0;               // Aries (Mars)
  }
}

/** D40 — Khavedamsa: odd→9th from sign, even→5th. */
function D40(l) {
  const s = signIndex(l), p = Math.floor(degreeInSign(l) / (30 / 40));
  const start = s % 2 === 0 ? seq(s, 8) : seq(s, 4);
  return seq(start, p);
}

/** D45 — Akshavedamsa: odd→same, even→7th; then zodiacal. */
function D45(l) {
  const s = signIndex(l), p = Math.floor(degreeInSign(l) / (30 / 45));
  const start = s % 2 === 0 ? s : seq(s, 6);
  return seq(start, p);
}

/**
 * D60 — Shashtyamsa: each 0.5°.
 * Odd signs: count forward from sign.
 * Even signs: count backward from sign.
 */
function D60(l) {
  const s = signIndex(l), p = Math.floor(degreeInSign(l) / 0.5);
  return s % 2 === 0 ? seq(s, p) : seq(s, -p);
}

// ── Public API ────────────────────────────────────────────────────────────────

export function vargaSign(longitude, v) {
  switch (v) {
    case 1:  return D1(longitude);
    case 2:  return D2(longitude);
    case 3:  return D3(longitude);
    case 4:  return D4(longitude);
    case 7:  return D7(longitude);
    case 9:  return D9(longitude);
    case 10: return D10(longitude);
    case 12: return D12(longitude);
    case 16: return D16(longitude);
    case 20: return D20(longitude);
    case 24: return D24(longitude);
    case 27: return D27(longitude);
    case 30: return D30(longitude);
    case 40: return D40(longitude);
    case 45: return D45(longitude);
    case 60: return D60(longitude);
    default: return null;
  }
}

/**
 * Calculate all selected vargas for a given longitude.
 * Returns { D1: {sign, name}, D9: {sign, name}, ... }
 */
export function calculateVargas(longitude, selected = VARGAS) {
  const out = {};
  for (const v of selected) {
    const s = vargaSign(longitude, v);
    if (s != null) out[`D${v}`] = { sign: s + 1, name: RASHIS[s] };
  }
  return out;
}

/** Validation status of each varga (for production gate). */
export const VALIDATION_STATUS = {
  D1:  "core",
  D2:  "needs-reference-check",
  D3:  "needs-reference-check",
  D4:  "needs-reference-check",
  D7:  "needs-reference-check",
  D9:  "core",          // Navamsa widely validated
  D10: "needs-reference-check",
  D12: "needs-reference-check",
  D16: "needs-reference-check",
  D20: "needs-reference-check",
  D24: "needs-reference-check",
  D27: "needs-reference-check",
  D30: "needs-reference-check",
  D40: "needs-reference-check",
  D45: "needs-reference-check",
  D60: "needs-reference-check",
};
