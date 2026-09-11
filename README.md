# 🔮 GURUJI Astro Data Engine v20

**Vedic Astrology Data Generator — Single-admin, Swiss Ephemeris, Lahiri (Drik Panchang), New York session.**

---

## What is this?

GURUJI generates minute-by-minute planetary position data for US equity market sessions (09:30–15:59 New York time) using:

- **Swiss Ephemeris** (`@swisseph/node`) — the same engine used by Drik Panchang
- **Lahiri Ayanamsa** — standard Indian sidereal calculation
- **D1–D60 Varga charts** — all 16 Parashari divisional charts
- **Single-admin login** — server-side session cookie (not frontend JS)
- **390 records/day** — one record per minute of the US equity session

---

## Requirements

- **Node.js 18 or higher** (Node 20+ recommended)
- Git
- A GitHub account (for GitHub Codespaces)

---

## Quick Start (Local Machine)

```bash
# 1. Clone or extract the project
git clone https://github.com/YOUR_USERNAME/guruji-astro.git
cd guruji-astro

# 2. Install dependencies
npm install

# 3. Copy ephemeris data files to frontend
npm run prepare:ephemeris

# 4. Set your admin password
export GURUJI_ADMIN_USER=Admin
export GURUJI_ADMIN_PASSWORD=YourStrongPassword123

# 5. Run preflight checks
npm run preflight

# 6. Start the server
npm start
```

Open `http://localhost:8787` and login with `Admin` / your password.

---

## GitHub Codespaces (Run in Browser — No Local Install)

This is the easiest way to run GURUJI without installing anything on your computer.

### Step 1 — Push to GitHub

```bash
git init
git add .
git commit -m "GURUJI v20 initial"
git remote add origin https://github.com/YOUR_USERNAME/guruji-astro.git
git push -u origin main
```

### Step 2 — Open in Codespaces

1. Go to your repository on GitHub
2. Click the green **Code** button
3. Click **Codespaces** tab
4. Click **Create codespace on main**
5. Wait ~60 seconds for it to start

### Step 3 — Set Up in Codespaces Terminal

```bash
# Install dependencies
npm install

# Copy ephemeris files
npm run prepare:ephemeris

# Set admin credentials
export GURUJI_ADMIN_USER=Admin
export GURUJI_ADMIN_PASSWORD=YourStrongPassword123

# Run all checks
npm run test:all

# Start the server
npm start
```

### Step 4 — Open the App

1. In Codespaces, look for the **Ports** tab at the bottom
2. Find port **8787**
3. Click **Open in Browser** (or the globe icon)
4. Login with `Admin` / your password

> **Tip:** Right-click port 8787 in the Ports tab → **Port Visibility** → **Private** to keep it secure.

---

## Usage

### Login
- Open the app URL
- Enter `Admin` as username, your password
- Click LOGIN

### Generate a Single Minute
1. Click **INITIALIZE ENGINE** (first time only — loads ephemeris)
2. Set Date, Time (New York time)
3. Select which Vargas (D-charts) you want
4. Click **CALCULATE SINGLE**

### Generate Full Session (390 records)
1. Go to Dashboard
2. Set Date
3. Click **GENERATE 390 RECORDS**
4. Wait ~30 seconds for all records
5. Download as **CSV** or **JSON**

### Verify Ephemeris is Working
- Go to **Ephemeris Status** page
- Click **RUN SERVER SELF-TEST** — should show ✅ PASS

---

## Test Commands (Terminal)

```bash
# Check all packages and files are ready
npm run preflight

# Test Swiss Ephemeris calculation (Lahiri)
npm run swiss:selftest

# Generate + validate 390 records for today
npm run test:session

# Run all tests
npm run test:all

# Generate a session JSON file from command line
node scripts/generate-session.mjs 2026-09-11
```

---

## Pages / Screens

| Page | URL | Description |
|------|-----|-------------|
| Login | `/login.html` | Admin login |
| Dashboard | `/dashboard.html` | Main generator — single + session |
| Minute Explorer | `/minute-explorer.html` | Detailed planet table for any minute |
| Varga Matrix | `/varga-matrix.html` | D1–D60 for all planets |
| Ephemeris Status | `/ephemeris-status.html` | Server self-test + file check |
| Validation | `/validation.html` | Validate exported JSON files |

---

## File Structure

```
guruji-astro/
├── server/
│   └── server.mjs              ← Main Node.js server (auth + API + static)
├── ephemeris/
│   ├── adapter.mjs             ← @swisseph/node wrapper (Lahiri, 9 planets)
│   └── time-utils.mjs         ← DST-safe UTC conversion
├── frontend/
│   ├── login.html              ← Login page (server-side auth)
│   ├── dashboard.html          ← Main UI
│   ├── minute-explorer.html    ← Single-minute planet table
│   ├── varga-matrix.html       ← D1–D60 grid
│   ├── ephemeris-status.html   ← Ephemeris health check
│   ├── validation.html         ← JSON file validator
│   ├── css/main.css            ← Dark theme CSS
│   ├── js/
│   │   ├── engine.js           ← Browser WASM engine (Lahiri)
│   │   └── vedic-rules.js      ← D1–D60 Parashari formulas
│   └── ephemeris/              ← Swiss Ephemeris data files (after prepare)
│       ├── sepl_18.se1
│       ├── semo_18.se1
│       ├── seas_18.se1
│       ├── sefstars.txt
│       └── seorbel.txt
├── scripts/
│   ├── copy-ephemeris.mjs      ← Copies data files to frontend/ephemeris/
│   ├── preflight.mjs           ← Checks all deps + files
│   ├── swiss-selftest.mjs      ← Tests @swisseph/node calculation
│   ├── test-session.mjs        ← Generates + validates 390 records
│   └── generate-session.mjs   ← CLI session generator
├── .env.example                ← Copy to .env
├── .gitignore
└── package.json
```

---

## Security

- **Login is server-side** — the admin password never touches the browser JS
- **Session cookie** is HttpOnly, SameSite=Lax, 8-hour TTL
- **All API routes** are auth-guarded (except `/api/login` and `/api/session`)
- **Never commit `.env`** to git — it's in `.gitignore`

---

## Calculations

### Ayanamsa
**Lahiri** — identical to what Drik Panchang uses. This is the standard ayanamsa for Indian Vedic astrology.

### Planets (9 Grahas)
Sun, Moon, Mars, Mercury, Jupiter, Venus, Saturn, Rahu (Mean Node), Ketu (opposite Rahu)

### Vargas (D-charts)
All 16 Parashari divisional charts: D1, D2, D3, D4, D7, D9, D10, D12, D16, D20, D24, D27, D30, D40, D45, D60

### Session
09:30:00 through 15:59:00 New York time = 390 one-minute records.
DST is handled automatically via `Intl.DateTimeFormat`.

---

## Troubleshooting

**"Ephemeris file missing"**
```bash
npm run prepare:ephemeris
```

**"@swisseph/node not installed"**
```bash
npm install
```

**Login shows "Invalid username or password"**
- Check `GURUJI_ADMIN_USER` matches what you typed (default: `Admin`)
- Check `GURUJI_ADMIN_PASSWORD` is set in environment

**Port 8787 not accessible in Codespaces**
- Go to Ports tab → right-click 8787 → Make Public (or Private for secure access)

**Moshier fallback warning**
- This means ephemeris data files are missing
- Run `npm run prepare:ephemeris` to fix

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `GURUJI_ADMIN_USER` | `Admin` | Login username |
| `GURUJI_ADMIN_PASSWORD` | (none) | Login password (plaintext) |
| `GURUJI_ADMIN_SHA256` | (none) | SHA256 of password (alternative to above) |
| `PORT` | `8787` | Server port |

---

## License

Private / proprietary. Single-admin use only.
