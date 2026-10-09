# NAGARNAVI — City Intelligence & Exploration

> **Discover Your City. Navigate It Smarter.**

NAGARNAVI turns scattered city information into context-aware urban decisions. It pairs a
**real interactive OpenStreetMap** with a **transparent recommendation engine** that always
explains *why* it suggested something — and says plainly what it does **not** know.

---

## Table of contents

1. [What it does](#what-it-does)
2. [Tech stack](#tech-stack)
3. [Run locally](#run-locally)
4. [Environment variables](#environment-variables)
5. [External data integrations & status](#external-data-integrations--status)
6. [How the recommendation engine works](#how-the-recommendation-engine-works)
7. [Test the main user journey](#test-the-main-user-journey)
8. [Publish to GitHub / deploy](#publish-to-github--deploy)
9. [Live demo script](#live-demo-script)
10. [Known limitations](#known-limitations)

---

## What it does

| Area | What you get |
| --- | --- |
| **Explore (map-first)** | A real Leaflet + OpenStreetMap map (~65% of the workspace) beside a scrollable place panel. Category chips, text filter, sort, “Fit all”, marker↔list sync, click-to-detail. |
| **Locate Me** | Real `navigator.geolocation` with an explicit consent dialog, a distinct blue “you are here” marker, graceful denial/unavailable/timeout handling, and reverse-geocoded naming. |
| **Search** | Debounced city/area/place search with suggestions, keyboard navigation, and a resilient provider chain (city index → Photon → Nominatim → Wikipedia). |
| **City Mission** | A single form (city, start, interests, budget ₹, time, transport, accessibility, priorities) that generates a real ordered itinerary with per-stop reasons, travel legs, budget guidance and “considered but not included”. |
| **City Decision Receipt** | The differentiator: an expandable, downloadable receipt explaining why each stop was chosen, which preferences it satisfies, the evidence behind each number, what to verify, which sources were used, and what remains unknown. |
| **Culture** | Wikipedia-sourced heritage/nearby-notable places, auto-chained heritage walks, sourced historical extracts, plus a live Open-Meteo conditions card. |
| **Safety Signals** | Community reports with category, location, timestamp, source type and verification state; report submission with optional photo and voice note (microphone consent first). Reports are stored **locally in your browser** and labelled as such. |
| **Compare Places** | Weighted, adjustable comparison across distance, accessibility, data completeness, entry cost, cultural value, ratings and cleanliness. Missing data is shown as “No data” — never scored as zero. |
| **Data & Trust** | Live provider health checks, freshness per record, degraded-category reporting, “how recommendations work”, and an explicit limitations list. |

**Consistency guarantee:** one shared `CityContext` is the single source of truth. Search,
mission form, map, place list, weather, culture, comparison and reports all key off the same
selected location — changing city updates all of them together.

---

## Tech stack

- **Frontend:** React 19 + TypeScript + Vite 7, Tailwind CSS v4, shadcn-style UI primitives, `lucide-react`.
- **Mapping:** Leaflet 1.9 + react-leaflet 5 with OpenStreetMap raster tiles.
- **Server:** Hono (mounted by `server.tsx`) with custom keyless proxy routes in `custom-routes.ts`.
- **Data:** Prisma 7 + SQLite (generated CRUD routes available; the live experience is driven by public APIs).
- **Design:** warm off-white “editorial” paper, deep-navy ink, restrained electric-lime accent. Mobile-first responsive.

---

## Run locally

```bash
bun install

# development (Vite dev server + API server)
bun run dev:full          # client on :5173, API on :3001

# or run them separately
bun run dev:server        # Hono API + static server
bun run dev               # Vite client

# production build + serve
bun run build
bun run start
```

Other useful scripts: `bun run db:push` (apply the Prisma schema), `bun run db:studio`.

> Geo features need a **secure context**: `https://` or `localhost`. Geolocation will not
> prompt on an insecure origin.

---

## Environment variables

**None are required.** Every data provider is public and keyless. See [`.env.example`](./.env.example)
for the (all-optional) list. Copy `.env.example` to `.env` only if you want to override defaults.
Never commit a real `.env` — it is already git-ignored.

---

## External data integrations & status

All provider calls are proxied through `custom-routes.ts` so the server can send a proper
User-Agent, cache aggressively, and respect usage policies (≈1 request/second for Nominatim,
with a global serial queue for background jobs).

| Provider | Used for | Key required | Status |
| --- | --- | --- | --- |
| **Open-Meteo** | Live weather + 4-day forecast | No | ✅ Working — verified HTTP 200, ~0.5 s |
| **Wikipedia REST** (`/page/summary`) | Sourced heritage & culture extracts | No | ✅ Working — verified HTTP 200, ~20 ms |
| **Wikipedia MediaWiki API** (`list=geosearch`) | Notable places near a coordinate | No | ✅ Working — verified HTTP 200, ~230 ms |
| **Photon** (OpenStreetMap) | City/place/area search | No | ✅ Working — verified HTTP 200, ~1.4 s |
| **OpenStreetMap Nominatim** | Category place discovery (restaurants, hotels, parks, markets) | No | ⚠️ **Rate-limited (HTTP 429) from this host during testing** — works when the IP is not throttled; the app degrades honestly and says so |
| **OpenStreetMap Overpass API** | (Alternative POI source, evaluated) | No | ❌ Unreachable from this environment (connections refused / HTTP 500, mirrors down) — **not used** |

### How the app behaves when a provider is throttled

It never invents data. Instead it:

1. still shows live Wikipedia-sourced heritage/attraction places,
2. lists exactly which categories could not be loaded and why (rate limit),
3. offers a **retry** and, separately, a clearly-badged **“Demo data”** toggle so every category
   is still explorable,
4. stamps every demo record `DEMO` and excludes demo records from mission recommendations,
5. surfaces it all in **Data & Trust**.

---

## How the recommendation engine works

Deterministic and reproducible — **no LLM is called**, and the UI says so.

1. Filter places that cannot serve your selected interests/transport window.
2. Compute straight-line distance and travel time from your start point
   (walking 4.5, cycling 15, transit 20, driving 28 km/h).
3. Score each place 0–100 on: interest match, proximity, cultural value, cost flag
   (OSM `fee` tag only), accessibility (OSM `wheelchair` tag), community-report recency,
   and data completeness — weighted by the priorities you chose. **Missing data is excluded
   from the average, never counted as zero.**
4. Build an ordered itinerary with a greedy nearest-neighbour walk and a light
   category-diversity rule.
5. Emit a **Decision Receipt** from the actual computed values.

Match scores are explicitly labelled a *transparent product heuristic*, not an official or
safety rating. **Absence of community reports is never described as safety.**

---

## Test the main user journey

1. Open the app. Confirm the hero (“Your City. Better Explored.”) and a **real OSM map with tiles** load.
2. Type `Mumbai` in the nav search → pick the suggestion. Use the quick-city chips (Pune / Mumbai /
   Delhi / Bengaluru) to confirm the **hero label, map centre, place panel and counts all follow**.
3. In Explore, toggle a category chip (e.g. *Food & Drink*) and confirm the **count and list both change**,
   then restore it. Use **Fit all** to re-fit the map.
4. Click a place card → the detail panel shows distance, opening hours, entry cost, accessibility,
   coordinates and a Wikipedia culture section. Click **Source** to open the OSM record.
5. Click **Locate Me** → read the consent dialog → allow → the map centres on you with a blue marker.
   Deny it in a second run and confirm the graceful message + manual-search fallback.
6. Fill the mission form and click **Generate My City Mission**. Confirm an ordered itinerary,
   per-stop reasons, totals, budget guidance, and a **Decision Receipt** whose travel-time string
   is identical to the header. Try **Copy** and **Download**.
7. Tick **Compare** on two different-category places → **Compare Places** → move the
   **Distance from start** weight to 0 → the weighted score changes (e.g. 73.3 → 60.0).
   Confirm ratings and cleanliness show **“No data”**.
8. Open **Safety Signals** → confirm demo reports are badged and verification states are shown →
   submit a report with a description >10 chars → success message and it appears at the top.
   Click **Record voice note** → consent dialog appears *before* the microphone is requested.
9. Open **Culture** → select a heritage place → a Wikipedia extract loads; the conditions card shows live weather.
10. Open **Data & Trust** → provider statuses, freshness, and the limitations list render.
11. Narrow the window to ~390 px: the nav collapses to a hamburger, Explore switches between
    Map and List, and primary buttons stay reachable.

Automated QA evidence for these journeys is in `.shogo/reports/` (runtime-only, git-ignored).

---

## Publish to GitHub / deploy

Nothing is deployed by NAGARNAVI — publish it yourself when you are happy with it.

**No GitHub repository is connected to this project**, so use these exact commands:

```bash
cd <this project directory>

git init -b main
git add .
git commit -m "feat: NAGARNAVI 2.0 — city intelligence platform with real OSM map, resilient keyless data layer and decision receipt"

# create an empty repo on GitHub first, then:
git remote add origin https://github.com/<your-user>/<your-repo>.git
git push -u origin main
```

A `.gitignore` is included (ignores `node_modules`, `dist`, `.env*`, `.shogo/`, and the dev
SQLite database). **No secrets are committed** — the app needs none.

### Deploying the built app

`bun run build` produces a static `dist/` plus the Hono API in `server.tsx`/`custom-routes.ts`.
Deploy the server process somewhere that supports Bun/Hono (the server serves `dist/` and mounts
the API under `/api/*` on the same origin, so there is no proxy config to write).

---

## Live demo script

**0:00 — Frame it.** “Maps tell you where things are. NAGARNAVI tells you why to go — and what it doesn’t know.”

**0:20 — Real data, real map.** Load the app; point out actual OpenStreetMap tiles and markers. Search
*Mumbai*, then click back to *Pune* — the hero, map and place list all move together.

**1:00 — Locate Me.** Click **Locate Me**, read the consent line aloud, allow it, and show the blue
marker plus the reverse-geocoded place name. “Permission-first, and it degrades gracefully.”

**1:30 — City Mission.** Fill the form (Heritage + Food & Drink, ₹2,500, half-day, walking, step-free)
and hit **Generate My City Mission**. Walk one stop: interest match, distance, travel leg, caveats.

**2:40 — The Decision Receipt.** Expand it. “Every recommendation answers: why, which preference,
what evidence, which source, how fresh, and what to verify.” Hit **Download**.

**3:30 — Compare Places.** Two different-category places; drag the Distance weight to 0 → 73.3 drops to 60.0.
“Missing data shows as *No data* — never as zero.”

**4:10 — Safety Signals.** Show badged demo reports with verification states, submit one, and
demonstrate the **microphone consent** step.

**4:40 — Data & Trust.** “And when a public provider rate-limits us, we say so here — and we never
invent the missing data.” Close on the footer attribution line.

---

## Known limitations

- **Provider rate limiting.** OpenStreetMap's public Nominatim endpoint rate-limited this test host
  (HTTP 429), so restaurant/hotel/park/market discovery can be sparse until the bucket frees up. The
  UI reports this precisely and offers retry + labelled demo data. Overpass was unreachable from this
  environment and is not used.
- **No live traffic, closures or accident statistics** are connected; travel times are straight-line
  estimates by transport-mode speed, not routed distances.
- **No ratings/review provider** is connected — ratings are shown as “No data”.
- Opening hours and prices appear only when the upstream source publishes them.
- **Reports and media are local to your browser** for this build (no shared backend); they are labelled
  accordingly. Photo/voice attachments live in the session only.
- Community reports are user-generated and may be inaccurate or stale.
- Confidence/match figures are a product heuristic, **not** an official or scientific safety score.
- The app is decision support only — it is not an emergency service.

---

## Project layout

```
src/
  App.tsx                    # shell: nav + view switching + mission/pin wiring
  context/CityContext.tsx    # single source of truth for city, places, reports, weather
  lib/
    geo.ts                   # typed client data access + geo maths + formatters
    recommend.ts             # deterministic scoring, itinerary, comparison, decision receipt
    demoData.ts              # clearly-labelled DEMO city index + places
  components/
    TopNav, CitySearch, HeroSearch, ExploreView, MapView, CityMap,
    PlaceCard, PlacePanel, ConditionsCard, CultureView, SafetyView,
    CompareView, MissionView, DecisionReceipt, TrustView
custom-routes.ts             # keyless provider proxy: search, places, weather, wiki, status
prisma/schema.prisma         # generated CRUD models (available, not required by the live UX)
```

## Attribution

© OpenStreetMap contributors · Wikipedia (CC BY-SA) · Open-Meteo · Photon.
