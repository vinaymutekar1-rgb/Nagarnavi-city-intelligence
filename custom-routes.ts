// SPDX-License-Identifier: Apache-2.0
/**
 * NAGARNAVI custom API routes.
 *
 * All external data access is proxied through this server so that:
 *  - we can send a proper User-Agent (required by public provider policy),
 *  - we cache aggressively and respect public rate limits (≈1 req/s),
 *  - the browser never talks to a provider directly.
 *
 * Providers (all public / keyless):
 *  - OpenStreetMap Nominatim → city search, reverse geocode, category search
 *    ("restaurants in Pune" style special phrases → real OSM POIs)
 *  - Wikipedia REST + MediaWiki geosearch → sourced heritage / culture + notable
 *    places near a coordinate
 *  - Open-Meteo → weather + forecast
 *
 * The public Overpass instance is NOT reachable from this environment (the
 * mirrors refuse connections and the main endpoint times out), so place
 * discovery is built on Nominatim + Wikipedia instead. Everything is labelled
 * with its real source and every failure is surfaced honestly.
 */

import { Hono } from 'hono'
import { DEMO_CITIES, DEMO_PLACES } from './src/lib/demoData'

const app = new Hono()

const UA = 'NAGARNAVI/2.0 (city intelligence hackathon demo; contact: hackathon@nagarnavi.app)'
const round = (n: number, d = 2) => Math.round(n * 10 ** d) / 10 ** d
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/* ------------------------------------------------------------------ */
/* tiny in-memory TTL cache                                            */
/* ------------------------------------------------------------------ */
type Entry = { at: number; data: unknown; ttl: number }
const cache = new Map<string, Entry>()
function cacheGet<T>(key: string, ttlMs: number): T | null {
  const hit = cache.get(key)
  if (!hit) return null
  if (Date.now() - hit.at > (hit.ttl || ttlMs)) {
    cache.delete(key)
    return null
  }
  return hit.data as T
}
function cacheSet(key: string, data: unknown, ttlMs = 0) {
  cache.set(key, { at: Date.now(), data, ttl: ttlMs })
  if (cache.size > 500) {
    const oldest = [...cache.entries()].sort((a, b) => a[1].at - b[1].at)[0]
    if (oldest) cache.delete(oldest[0])
  }
}

async function fetchJson(url: string, init?: RequestInit & { timeoutMs?: number }) {
  const timeoutMs = init?.timeoutMs ?? 15000
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(url, {
      ...init,
      signal: ctrl.signal,
      headers: { 'User-Agent': UA, Accept: 'application/json', ...(init?.headers || {}) },
    })
    const text = await res.text()
    let json: unknown = null
    try {
      json = text ? JSON.parse(text) : null
    } catch {
      json = null
    }
    return { ok: res.ok, status: res.status, json, text }
  } finally {
    clearTimeout(timer)
  }
}

/* ------------------------------------------------------------------ */
/* Nominatim politeness: a global serial queue (max ~1 request/second)  */
/* for background jobs. Interactive user searches bypass the queue so   */
/* they stay fast, but still nudge the shared clock forward.           */
/* ------------------------------------------------------------------ */
const NOMINATIM_MIN_GAP_MS = 1150
let nominatimChain: Promise<unknown> = Promise.resolve()
let lastNominatimAt = 0

/** Fail fast rather than retrying: a 429 is a bucket-wide limiter, so retrying
 *  only wastes the request budget. Callers fall back to Wikipedia instead. */
async function nominatimFetch(url: string, priority = false): Promise<Awaited<ReturnType<typeof fetchJson>>> {
  const run = async () => {
    const wait = Math.max(0, NOMINATIM_MIN_GAP_MS - (Date.now() - lastNominatimAt))
    if (wait > 0) await sleep(wait)
    lastNominatimAt = Date.now()
    return fetchJson(url, { timeoutMs: 10000 })
  }
  if (priority) return run()
  const p = nominatimChain.then(run, run)
  nominatimChain = p.then(
    () => undefined,
    () => undefined,
  )
  return p
}

/** Wikipedia fallback geocoder — reliable when Nominatim is rate-limited. */
async function wikipediaPlacesSearch(q: string, limit: number) {
  const url =
    `https://en.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(q)}` +
    `&gsrlimit=${limit}&prop=coordinates|description&format=json&origin=*`
  const { ok, json } = await fetchJson(url, { timeoutMs: 10000 })
  if (!ok || !json) return []
  const pages = Object.values((json as any).query?.pages || {}) as Record<string, any>[]
  return pages
    .filter((p) => Array.isArray(p.coordinates) && p.coordinates[0])
    .map((p) => ({
      id: `wiki-${p.pageid}`,
      displayName: [p.title, p.description].filter(Boolean).join(' · '),
      name: p.title as string,
      latitude: p.coordinates[0].lat as number,
      longitude: p.coordinates[0].lon as number,
      type: 'place',
      category: 'place',
      address: {},
      source: 'Wikipedia (Nominatim unavailable)',
      sourceUrl: `https://en.wikipedia.org/wiki/${encodeURIComponent(String(p.title).replace(/ /g, '_'))}`,
    }))
}

export interface PlaceDto {
  id: string
  name: string
  category: string
  latitude: number
  longitude: number
  address: string | null
  openingHours: string | null
  website: string | null
  phone: string | null
  wheelchair: string | null
  cuisine: string | null
  fee: string | null
  heritageType: string | null
  wikipedia: string | null
  imageUrl: string | null
  source: string
  sourceUrl: string | null
  isDemo: boolean
}

/* ------------------------------------------------------------------ */
/* GET /api/geo/search → Nominatim forward geocoding                   */
/* ------------------------------------------------------------------ */
app.get('/geo/search', async (c) => {
  const q = (c.req.query('q') || '').trim()
  const limit = Math.min(Number(c.req.query('limit') || 6), 10)
  if (q.length < 2) return c.json({ results: [], query: q })

  const key = `search:${q.toLowerCase()}:${limit}`
  const cached = cacheGet<unknown>(key, 1000 * 60 * 10)
  if (cached) return c.json({ results: cached, query: q, cached: true })

  // 1. Known demo cities resolve instantly, with no provider call at all.
  const lower = q.toLowerCase()
  const known = DEMO_CITIES.find((city) => city.aliases.some((a) => a === lower || lower.startsWith(`${a} `)))
  if (known) {
    const results = [
      {
        id: `demo-city-${known.name}`,
        displayName: `${known.name}, city centre`,
        name: known.name,
        latitude: known.latitude,
        longitude: known.longitude,
        type: 'city',
        category: 'place',
        address: {},
        source: 'NAGARNAVI city index',
      },
    ]
    return c.json({ results, query: q, source: 'city-index' })
  }

  // 2. Photon (OpenStreetMap-based, keyless, generous limits) — primary.
  try {
    const photon = await fetchJson(
      `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=${limit}&lang=en`,
      { timeoutMs: 9000 },
    )
    const features: Record<string, any>[] = photon.ok ? ((photon.json as any)?.features ?? []) : []
    if (features.length > 0) {
      const results = features.map((f) => {
        const p = f.properties || {}
        const [lon, lat] = f.geometry?.coordinates ?? [null, null]
        return {
          id: `photon-${p.osm_type ?? 'X'}${p.osm_id ?? Math.random()}`,
          displayName: [p.name, p.street, p.district, p.city, p.state, p.country].filter(Boolean).join(', '),
          name: p.name || p.city || q,
          latitude: lat,
          longitude: lon,
          type: p.osm_value || p.type || 'place',
          category: p.osm_key || 'place',
          address: { city: p.city, state: p.state, country: p.country, postcode: p.postcode },
          source: 'Photon · OpenStreetMap',
          sourceUrl:
            p.osm_type && p.osm_id
              ? `https://www.openstreetmap.org/${String(p.osm_type).toLowerCase()}/${p.osm_id}`
              : undefined,
        }
      })
      const usable = results.filter((r) => Number.isFinite(r.latitude) && Number.isFinite(r.longitude))
      if (usable.length > 0) {
        cacheSet(key, usable, 1000 * 60 * 10)
        return c.json({ results: usable, query: q, attribution: '© OpenStreetMap contributors (via Photon)' })
      }
    }
  } catch {
    /* fall through to Nominatim */
  }

  // 3. Nominatim as a secondary.
  const url =
    `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=${limit}` +
    `&q=${encodeURIComponent(q)}`
  try {
    const { ok, status, json } = await nominatimFetch(url, true)
    if (!ok || !Array.isArray(json)) {
      // 4. Wikipedia search as a last resort.
      const fallback = await wikipediaPlacesSearch(q, limit).catch(() => [])
      if (fallback.length > 0) {
        return c.json({
          results: fallback,
          query: q,
          degraded: true,
          notice: `Geocoders were unavailable (OpenStreetMap returned ${status}); showing Wikipedia matches instead.`,
        })
      }
      return c.json(
        {
          error: `Search is temporarily unavailable (providers returned ${status}). Try again shortly, or use a quick city button.`,
          results: [],
          query: q,
        },
        502,
      )
    }
    const results = json.map((r: Record<string, any>) => ({
      id: `osm-${r.osm_type}-${r.osm_id}`,
      displayName: r.display_name as string,
      name: (r.name as string) || String(r.display_name || '').split(',')[0],
      latitude: Number(r.lat),
      longitude: Number(r.lon),
      type: r.type as string,
      category: (r.category || r.class) as string,
      importance: r.importance as number,
      address: r.address || {},
      source: 'OpenStreetMap Nominatim',
      sourceUrl: `https://www.openstreetmap.org/${r.osm_type}/${r.osm_id}`,
    }))
    cacheSet(key, results, 1000 * 60 * 10)
    return c.json({ results, query: q, attribution: '© OpenStreetMap contributors' })
  } catch (err) {
    return c.json({ error: `Geocoding unavailable: ${(err as Error).message}`, results: [], query: q }, 502)
  }
})

/* ------------------------------------------------------------------ */
/* GET /api/geo/reverse → Nominatim reverse geocoding                  */
/* ------------------------------------------------------------------ */
app.get('/geo/reverse', async (c) => {
  const lat = Number(c.req.query('lat'))
  const lng = Number(c.req.query('lng'))
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return c.json({ error: 'lat and lng are required' }, 400)
  }
  const key = `rev:${round(lat, 3)},${round(lng, 3)}`
  const cached = cacheGet<unknown>(key, 1000 * 60 * 60)
  if (cached) return c.json({ place: cached, cached: true })

  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1&zoom=14&lat=${lat}&lon=${lng}`
  try {
    const { ok, status, json } = await nominatimFetch(url, true)
    if (!ok || !json) return c.json({ error: `Reverse geocoding returned ${status}` }, 502)
    const r = json as Record<string, any>
    const place = {
      displayName: r.display_name as string,
      name: (r.name as string) || String(r.display_name || '').split(',')[0],
      latitude: Number(r.lat ?? lat),
      longitude: Number(r.lon ?? lng),
      address: r.address || {},
      source: 'OpenStreetMap Nominatim',
    }
    cacheSet(key, place, 1000 * 60 * 60)
    return c.json({ place })
  } catch (err) {
    return c.json({ error: `Reverse geocoding unavailable: ${(err as Error).message}` }, 502)
  }
})

/* ------------------------------------------------------------------ */
/* GET /api/geo/places → place discovery (Nominatim + Wikipedia)       */
/* ------------------------------------------------------------------ */
/** One well-supported phrase per category keeps us inside the Nominatim
 *  rate limit while still returning real, categorised POIs. */
const NOMINATIM_PHRASES: Record<string, string> = {
  restaurant: 'restaurants',
  hotel: 'hotels',
  park: 'parks',
  market: 'supermarkets',
  attraction: 'museums',
  heritage: 'churches',
}

/** Map an OSM POI type to our category buckets. */
function categoryFromOsmType(type: string): string | null {
  const t = (type || '').toLowerCase()
  if (/^(restaurant|cafe|fast_food|food_court|ice_cream|bar|pub|biergarten)$/.test(t)) return 'restaurant'
  if (/^(hotel|hostel|guest_house|motel|apartment|chalet)$/.test(t)) return 'hotel'
  if (/^(museum|cinema|theatre|viewpoint|attraction|artwork|gallery|theme_park|zoo|aquarium|information)$/.test(t)) return 'attraction'
  if (/^(park|garden|nature_reserve|playground)$/.test(t)) return 'park'
  if (/^(supermarket|marketplace|mall|department_store|convenience|shop)$/.test(t)) return 'market'
  if (/^(church|mosque|synagogue|temple|place_of_worship|monument|memorial|castle|fort|ruins|archaeological_site|city_gate|palace|tower|wayside_shrine)$/.test(t)) return 'heritage'
  return null
}

const HERITAGE_RE =
  /fort|wada|temple|mandir|palace|masjid|church|monument|cave|museum|ganpati|haveli|stupa|tomb|darwaza|dargah|mahal|killa|qila|samadhi|math|ashram|basilica|synagogue|cathedral/i
const CULTURE_RE =
  /museum|gallery|theatre|theater|cinema|observatory|planetarium|library|smarak|mandal|vidyapeeth|institute|auditorium|stadium|garden|zoo|aquarium|fort|wada|temple|mandir|palace|mosque|masjid|church|cave|monument|mahal|park/i
/** Drop pages that are administrative areas, transport, roads or subdivisions
 *  rather than places a visitor would go. */
const NON_POI_RE =
  /constituency|assembly|metro station|railway station|junction|highway|\bNH\s?\d|road$|roads$|expressway|ward\b|division|district|taluka|village|society|housing|colony|residency|layout|nagar$|peth$|subdistrict|municipal|corporation|police station|court|hospital|school|college|university$|institute of technology/i

function heritageFromTitle(title: string) {
  return HERITAGE_RE.test(title)
}

async function nominatimPhrase(phrase: string, city: string, cats: string[]): Promise<PlaceDto[]> {
  const url =
    `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=12` +
    `&q=${encodeURIComponent(`${phrase} in ${city}`)}`
  const { ok, status, json } = await nominatimFetch(url)
  if (!ok) throw new Error(`Nominatim returned ${status}`)
  if (!Array.isArray(json)) return []
  const out: PlaceDto[] = []
  for (const r of json as Record<string, any>[]) {
    const category = categoryFromOsmType(r.type)
    if (!category || !cats.includes(category)) continue
    const name = r.name || String(r.display_name || '').split(',')[0]
    if (!name) continue
    out.push({
      id: `osm-${r.osm_type}-${r.osm_id}`,
      name,
      category,
      latitude: Number(r.lat),
      longitude: Number(r.lon),
      address: r.display_name ? String(r.display_name).split(',').slice(0, 3).join(',').trim() : null,
      openingHours: null,
      website: null,
      phone: null,
      wheelchair: null,
      cuisine: null,
      fee: null,
      heritageType: r.type || null,
      wikipedia: null,
      imageUrl: null,
      source: 'OpenStreetMap Nominatim',
      sourceUrl: `https://www.openstreetmap.org/${r.osm_type}/${r.osm_id}`,
      isDemo: false,
    })
  }
  return out
}

async function wikipediaGeosearch(lat: number, lng: number, city: string, cats: string[]): Promise<PlaceDto[]> {
  const wantCulture = cats.includes('heritage') || cats.includes('attraction')
  if (!wantCulture) return []
  const key = `wgeo:${round(lat, 2)},${round(lng, 2)}`
  type GeoItem = { title: string; lat: number; lon: number }
  const cachedGeo = cacheGet<GeoItem[]>(key, 1000 * 60 * 60 * 24)
  let geo: GeoItem[] = cachedGeo ?? []
  if (!cachedGeo) {
    const url =
      `https://en.wikipedia.org/w/api.php?action=query&list=geosearch&gscoord=${lat}%7C${lng}` +
      `&gsradius=10000&gslimit=50&format=json&origin=*`
    const { ok, json } = await fetchJson(url, { timeoutMs: 12000 })
    const items = ok && json ? (json as any).query?.geosearch || [] : []
    geo = items.map((g: any) => ({ title: g.title as string, lat: g.lat as number, lon: g.lon as number }))
    if (geo.length) cacheSet(key, geo, 1000 * 60 * 60 * 24)
  }
  const cityToken = city.toLowerCase().replace(/[^a-z]/g, '')
  return geo
    .filter((g) => {
      const t = g.title
      if (t.length < 5) return false
      // skip pure locality/administrative pages that merely share the city name
      if (cityToken && t.toLowerCase().includes(cityToken)) return false
      if (/^\d/.test(t)) return false
      // only keep pages that actually look like a visitor-facing place
      if (NON_POI_RE.test(t)) return false
      if (!CULTURE_RE.test(t)) return false
      return true
    })
    .slice(0, 14)
    .map((g) => {
      const category = heritageFromTitle(g.title) ? 'heritage' : 'attraction'
      return {
        id: `wiki-${g.title.replace(/\s+/g, '_')}`,
        name: g.title,
        category,
        latitude: g.lat,
        longitude: g.lon,
        address: null,
        openingHours: null,
        website: null,
        phone: null,
        wheelchair: null,
        cuisine: null,
        fee: null,
        heritageType: null,
        wikipedia: `https://en.wikipedia.org/wiki/${encodeURIComponent(g.title.replace(/ /g, '_'))}`,
        imageUrl: null,
        source: 'Wikipedia',
        sourceUrl: `https://en.wikipedia.org/wiki/${encodeURIComponent(g.title.replace(/ /g, '_'))}`,
        isDemo: false,
      } as PlaceDto
    })
    .filter((p) => cats.includes(p.category))
}

const warming = new Set<string>()

function demoPlacesFor(demoCity: string | null) {
  return DEMO_PLACES.filter((p) => demoCity && p.city === demoCity).map((p) => ({
    ...p,
    openingHours: null,
    website: null,
    phone: null,
    wheelchair: null,
    cuisine: null,
    fee: null,
    heritageType: null,
    wikipedia: null,
    imageUrl: null,
    sourceUrl: null,
    source: 'demo',
    isDemo: true,
  }))
}

/** Background job: fill the place cache without blocking the HTTP response
 *  (the preview proxy in front of /api has a short request budget). */
function startWarm(key: string, cats: string[], lat: number, lng: number, city: string | null, demoCity: string | null) {
  if (warming.has(key)) return
  warming.add(key)
  ;(async () => {
    try {
      const collected: PlaceDto[] = []
      const degraded: string[] = []
      const cityName = city || demoCity || ''

      // Wikipedia geosearch first (fast, reliably reachable)
      try {
        collected.push(...(await wikipediaGeosearch(lat, lng, cityName, cats)))
      } catch {
        degraded.push('wikipedia')
      }

      // Nominatim special-phrase search. Requests are serialised by the global
      // queue at ~1 req/s, so this stays inside the usage policy.
      if (cityName) {
        let rateLimited = false
        for (const cat of cats) {
          if (rateLimited) {
            degraded.push(cat)
            continue
          }
          const phrase = NOMINATIM_PHRASES[cat]
          if (!phrase) {
            degraded.push(cat)
            continue
          }
          try {
            const res = await nominatimPhrase(phrase, cityName, [cat])
            if (res.length) collected.push(...res)
            else degraded.push(cat)
          } catch (err) {
            degraded.push(cat)
            // A 429 applies to the whole bucket — stop hammering and finish with
            // whatever Wikipedia already gave us.
            if (/429|rate.?limit/i.test((err as Error).message)) rateLimited = true
          }
        }
      }

      // de-duplicate by name+rounded coords
      const seen = new Set<string>()
      const places = collected.filter((p) => {
        const k = `${p.name.toLowerCase()}|${round(p.latitude, 3)},${round(p.longitude, 3)}`
        if (seen.has(k)) return false
        seen.add(k)
        return Number.isFinite(p.latitude) && Number.isFinite(p.longitude)
      })

      // Only report a category as degraded if we truly ended up with none of it.
      const emptyCats = cats.filter((cat) => !places.some((p) => p.category === cat))
      void degraded
      cacheSet(
        key,
        {
          places,
          demoPlaces: demoPlacesFor(demoCity),
          count: places.length,
          degraded: emptyCats,
          partial: emptyCats.length > 0,
          live: places.length > 0,
          warming: false,
          demoCity,
          sources: Array.from(new Set(places.map((p) => p.source))),
          attribution: '© OpenStreetMap contributors · Wikipedia',
        },
        places.length > 0 ? 30 * 60 * 1000 : 90 * 1000,
      )
    } catch {
      /* leave uncached so the next request retries */
    } finally {
      warming.delete(key)
    }
  })()
}

const ALL_CATS = ['attraction', 'heritage', 'restaurant', 'park', 'market', 'hotel']

app.get('/geo/places', async (c) => {
  const lat = Number(c.req.query('lat'))
  const lng = Number(c.req.query('lng'))
  const city = (c.req.query('city') || '').trim() || null
  const cats = (c.req.query('categories') || ALL_CATS.join(','))
    .split(',')
    .map((s) => s.trim())
    .filter((s) => ALL_CATS.includes(s))
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return c.json({ error: 'lat and lng are required' }, 400)
  }
  if (cats.length === 0) return c.json({ error: 'No valid categories requested' }, 400)

  const demoCity = city || nearestDemoCity(lat, lng)?.name || null
  const key = `places:${round(lat, 3)},${round(lng, 3)}:${[...cats].sort().join(',')}:${demoCity || ''}`
  const cached = cacheGet<any>(key, 1000 * 60 * 30)
  if (cached) return c.json({ ...cached, cached: true })

  startWarm(key, cats, lat, lng, city, demoCity)
  return c.json({
    places: [],
    demoPlaces: demoPlacesFor(demoCity),
    count: 0,
    degraded: [],
    partial: true,
    live: false,
    warming: true,
    demoCity,
    sources: [],
    attribution: '© OpenStreetMap contributors · Wikipedia',
  })
})

function nearestDemoCity(lat: number, lng: number) {
  let best: { city: (typeof DEMO_CITIES)[number]; d: number } | null = null
  for (const city of DEMO_CITIES) {
    const d = Math.hypot(city.latitude - lat, city.longitude - lng)
    if (!best || d < best.d) best = { city, d }
  }
  return best && best.d < 0.75 ? best.city : null
}

// Pre-warm the default demo city so the first interaction is instant.
for (const city of DEMO_CITIES.slice(0, 1)) {
  startWarm(
    `places:${round(city.latitude, 3)},${round(city.longitude, 3)}:${[...ALL_CATS].sort().join(',')}:${city.name}`,
    ALL_CATS,
    city.latitude,
    city.longitude,
    city.name,
    city.name,
  )
}

/* ------------------------------------------------------------------ */
/* GET /api/geo/weather → Open-Meteo                                   */
/* ------------------------------------------------------------------ */
const WMO: Record<number, string> = {
  0: 'Clear sky', 1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast', 45: 'Fog', 48: 'Rime fog',
  51: 'Light drizzle', 53: 'Drizzle', 55: 'Dense drizzle', 56: 'Freezing drizzle', 57: 'Freezing drizzle',
  61: 'Light rain', 63: 'Rain', 65: 'Heavy rain', 66: 'Freezing rain', 67: 'Freezing rain',
  71: 'Light snow', 73: 'Snow', 75: 'Heavy snow', 77: 'Snow grains', 80: 'Light showers', 81: 'Showers',
  82: 'Violent showers', 85: 'Snow showers', 86: 'Heavy snow showers', 95: 'Thunderstorm',
  96: 'Thunderstorm + hail', 99: 'Thunderstorm + hail',
}

app.get('/geo/weather', async (c) => {
  const lat = Number(c.req.query('lat'))
  const lng = Number(c.req.query('lng'))
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return c.json({ error: 'lat and lng are required' }, 400)
  const key = `wx:${round(lat, 2)},${round(lng, 2)}`
  const cached = cacheGet<unknown>(key, 1000 * 60 * 10)
  if (cached) return c.json({ weather: cached, cached: true })

  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}` +
    `&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m` +
    `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max` +
    `&timezone=auto&forecast_days=4`

  try {
    const { ok, status, json } = await fetchJson(url)
    if (!ok || !json) return c.json({ error: `Weather provider returned ${status}` }, 502)
    const j = json as any
    const cur = j.current || {}
    const daily = j.daily || {}
    const weather = {
      temperature: cur.temperature_2m,
      feelsLike: cur.apparent_temperature,
      humidity: cur.relative_humidity_2m,
      windSpeed: cur.wind_speed_10m,
      precipitation: cur.precipitation,
      code: cur.weather_code,
      condition: WMO[cur.weather_code] || 'Unknown',
      timezone: j.timezone,
      observedAt: cur.time,
      forecast: (daily.time || []).slice(0, 4).map((d: string, i: number) => ({
        date: d,
        code: daily.weather_code?.[i],
        condition: WMO[daily.weather_code?.[i]] || 'Unknown',
        max: daily.temperature_2m_max?.[i],
        min: daily.temperature_2m_min?.[i],
        rainChance: daily.precipitation_probability_max?.[i],
      })),
      source: 'Open-Meteo',
      sourceUrl: 'https://open-meteo.com/',
      retrievedAt: new Date().toISOString(),
    }
    cacheSet(key, weather, 1000 * 60 * 10)
    return c.json({ weather })
  } catch (err) {
    return c.json({ error: `Weather unavailable: ${(err as Error).message}` }, 502)
  }
})

/* ------------------------------------------------------------------ */
/* GET /api/geo/wiki → Wikipedia summary (heritage / culture)          */
/* ------------------------------------------------------------------ */
app.get('/geo/wiki', async (c) => {
  const title = (c.req.query('title') || '').trim()
  const lang = (c.req.query('lang') || 'en').replace(/[^a-z-]/gi, '') || 'en'
  if (!title) return c.json({ error: 'title is required' }, 400)
  const key = `wiki:${lang}:${title.toLowerCase()}`
  const cached = cacheGet<unknown>(key, 1000 * 60 * 60 * 24)
  if (cached) return c.json({ article: cached, cached: true })

  const url = `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`
  try {
    const { ok, status, json } = await fetchJson(url)
    if (!ok || !json) return c.json({ error: `Wikipedia returned ${status}` }, 502)
    const j = json as any
    const article = {
      title: j.title,
      extract: j.extract,
      description: j.description,
      thumbnail: j.thumbnail?.source || null,
      url: j.content_urls?.desktop?.page || null,
      source: 'Wikipedia',
    }
    cacheSet(key, article, 1000 * 60 * 60 * 24)
    return c.json({ article })
  } catch (err) {
    return c.json({ error: `Wikipedia unavailable: ${(err as Error).message}` }, 502)
  }
})

/* ------------------------------------------------------------------ */
/* GET /api/geo/status → provider health for the Trust Center          */
/* ------------------------------------------------------------------ */
app.get('/geo/status', async (c) => {
  const checks: { name: string; url: string; note: string }[] = [
    { name: 'OpenStreetMap Nominatim', url: 'https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=Pune', note: 'City search, geocoding & place discovery' },
    { name: 'Open-Meteo', url: 'https://api.open-meteo.com/v1/forecast?latitude=18.52&longitude=73.85&current=temperature_2m', note: 'Weather & forecast' },
    { name: 'Wikipedia REST', url: 'https://en.wikipedia.org/api/rest_v1/page/summary/Pune', note: 'Heritage & culture summaries' },
    { name: 'Wikipedia Geosearch', url: 'https://en.wikipedia.org/w/api.php?action=query&list=geosearch&gscoord=18.52%7C73.85&gsradius=5000&gslimit=1&format=json', note: 'Notable places near a location' },
  ]
  const results = await Promise.all(
    checks.map(async (ch) => {
      const started = Date.now()
      try {
        const res = await fetch(ch.url, { headers: { 'User-Agent': UA } })
        return { name: ch.name, note: ch.note, ok: res.ok, status: res.status, latencyMs: Date.now() - started }
      } catch (err) {
        return { name: ch.name, note: ch.note, ok: false, status: 0, error: (err as Error).message }
      }
    }),
  )
  return c.json({ providers: results, checkedAt: new Date().toISOString() })
})

export default app
