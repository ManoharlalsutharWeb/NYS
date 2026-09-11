/**
 * GURUJI — Time utilities
 * Converts a local wall-clock time in a given IANA timezone to UTC.
 * Uses Intl.DateTimeFormat to resolve DST correctly — no manual offset tables.
 */

/**
 * Convert local time (YYYY-MM-DD, HH:MM:SS) in given IANA timezone → UTC Date.
 * Converges in ≤5 iterations for any DST transition.
 *
 * @param {string} date       "YYYY-MM-DD"
 * @param {string} time       "HH:MM:SS"
 * @param {string} timezone   IANA zone, e.g. "America/New_York"
 * @returns {Date}
 */
export function localToUTC(date, time, timezone = "America/New_York") {
  const [y, mo, d]       = date.split("-").map(Number);
  const [hh, mm, ss = 0] = time.split(":").map(Number);

  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hourCycle: "h23",
  });

  // Start with a naive UTC guess
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

/**
 * Build all 390 local-time + UTC pairs for a US equity session day.
 * 09:30:00 through 15:59:00 inclusive in America/New_York.
 *
 * @param {string} date   "YYYY-MM-DD"
 * @returns {{ local_time: string, utc: Date }[]}
 */
export function buildSessionMinutes(date) {
  const START = 9 * 60 + 30;  // 09:30
  const END   = 16 * 60;      // 16:00 exclusive

  const minutes = [];
  for (let m = START; m < END; m++) {
    const hh = String(Math.floor(m / 60)).padStart(2, "0");
    const mm = String(m % 60).padStart(2, "0");
    const local_time = `${hh}:${mm}:00`;
    const utc = localToUTC(date, local_time, "America/New_York");
    minutes.push({ local_time, utc });
  }

  // DST sanity guard
  const firstUTCHour = minutes[0].utc.getUTCHours();
  if (firstUTCHour < 12 || firstUTCHour > 15) {
    throw new Error(`DST_CONVERSION_FAILED: 09:30 New York mapped to UTC ${firstUTCHour}h — expected 13 or 14`);
  }

  return minutes;
}
