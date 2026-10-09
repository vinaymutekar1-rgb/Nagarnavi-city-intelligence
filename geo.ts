/** Client-side data access + geo maths. Everything goes through our own
 *  /api/geo/* proxy so the browser never talks to a provider directly. */

export type Category = 'attraction' | 'heritage' | 'restaurant' | 'park' | 'market' | 'hotel'

export const CATEGORIES: { id: Category; label: string; color: string }[] = [
  { id: 'attraction', label: 'Attractions', color: '#0f766e' },
  { id: 'heritage', label: 'Heritage', color: '#b45309' },
  { id: 'restaurant', label: 'Food & Drink', color: '#be123c' },
  { id: 'park', label: 'Parks', color: '#15803d' },
  { id: 'market', label: 'Markets', color: '#7c3aed' },
  { id: 'hotel', label: 'Stay', color: '#0369a1' },
]

export interface Place {
  id: string
  name: string
  category: Category
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

export interface SearchResult {
  id: string
  displayName: string
  name: string
  latitude: number
  longitude: number
  type: string
  category: string
  address: Record<string, string>
  source: string
  sourceUrl?: string
}

export interface PlacesResponse {
  places: Place[]
  demoPlaces: Place[]
  count: number
  degraded: string[]
  partial: boolean
  live: boolean
  warming?: boolean
  cached?: boolean
  demoCity: string | null
  sources?: string[]
}

export interface Weather {
  temperature: number
  feelsLike: number
  humidity: number
  windSpeed: number
  precipitation: number
  code: number
  condition: string
  timezone: string
  observedAt: string
  forecast: { date: string; code: number; condition: string; max: number; min: number; rainChance: number }[]
  source: string
  retrievedAt: string
}

export interface WikiArticle {
  title: string
  extract: string
  description?: string
  thumbnail: string | null
  url: string | null
  source: string
}

export interface ProviderStatus {
  name: string
  note: string
  ok: boolean
  status: number
  latencyMs?: number
  error?: string
}

async function getJson<T>(url: string, timeoutMs = 20000): Promise<T> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(url, { signal: ctrl.signal })
    const body = await res.json().catch(() => ({}))
    if (!res.ok) {
      const message = (body as { error?: string }).error || `HTTP ${res.status}`
      throw new Error(message)
    }
    return body as T
  } finally {
    clearTimeout(timer)
  }
}

export const searchLocations = (q: string, limit = 6) =>
  getJson<{ results: SearchResult[]; error?: string }>(`/api/geo/search?q=${encodeURIComponent(q)}&limit=${limit}`)

export const reverseGeocode = (lat: number, lng: number) =>
  getJson<{ place: { displayName: string; name: string; latitude: number; longitude: number; address: Record<string, string> } }>(
    `/api/geo/reverse?lat=${lat}&lng=${lng}`,
  )

export const fetchWeather = (lat: number, lng: number) =>
  getJson<{ weather: Weather }>(`/api/geo/weather?lat=${lat}&lng=${lng}`)

export const fetchWiki = (title: string) =>
  getJson<{ article: WikiArticle }>(`/api/geo/wiki?title=${encodeURIComponent(title)}`)

export const fetchStatus = () =>
  getJson<{ providers: ProviderStatus[]; checkedAt: string }>('/api/geo/status')

export const fetchPlaces = (
  lat: number,
  lng: number,
  city: string | null,
  categories: Category[],
  signal?: AbortSignal,
) =>
  getJson<PlacesResponse>(
    `/api/geo/places?lat=${lat}&lng=${lng}&city=${encodeURIComponent(city || '')}&categories=${categories.join(',')}`,
    20000,
  )

/** Fetch places, then poll while the server warms its cache in the background. */
export async function fetchPlacesUntilReady(
  lat: number,
  lng: number,
  city: string | null,
  categories: Category[],
  onUpdate: (res: PlacesResponse) => void,
  attempts = 9,
  intervalMs = 3000,
): Promise<void> {
  const res = await fetchPlaces(lat, lng, city, categories)
  onUpdate(res)
  if (!res.warming) return
  for (let i = 0; i < attempts; i++) {
    await new Promise((r) => setTimeout(r, intervalMs))
    try {
      const next = await fetchPlaces(lat, lng, city, categories)
      onUpdate(next)
      if (!next.warming) return
    } catch {
      /* keep polling */
    }
  }
}

/* ------------------------------- maths ------------------------------- */

export function haversineKm(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) {
  const R = 6371
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180
  const dLng = ((b.longitude - a.longitude) * Math.PI) / 180
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.latitude * Math.PI) / 180) * Math.cos((b.latitude * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(s))
}

export function formatDistance(km: number) {
  if (!Number.isFinite(km)) return '—'
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`
}

/** Single source of truth for travel-time formatting (used by the mission
 *  summary and the decision receipt so they can never disagree). */
export function formatDuration(minutes: number) {
  const m = Math.max(0, Math.round(minutes))
  return `${Math.floor(m / 60)}h ${m % 60}m`
}

export function formatAge(iso: string | null | undefined) {
  if (!iso) return 'unknown'
  const ms = Date.now() - new Date(iso).getTime()
  if (!Number.isFinite(ms)) return 'unknown'
  const min = Math.round(ms / 60000)
  if (min < 1) return 'just now'
  if (min < 60) return `${min} min ago`
  const hrs = Math.round(min / 60)
  if (hrs < 24) return `${hrs} h ago`
  return `${Math.round(hrs / 24)} d ago`
}

export function debounce<A extends unknown[]>(fn: (...args: A) => void, wait = 350) {
  let t: ReturnType<typeof setTimeout> | undefined
  return (...args: A) => {
    if (t) clearTimeout(t)
    t = setTimeout(() => fn(...args), wait)
  }
}

export const TRANSPORT_SPEED_KMH: Record<Transport, number> = {
  walking: 4.5,
  cycling: 15,
  driving: 28,
  transit: 20,
}

export type Transport = 'walking' | 'cycling' | 'driving' | 'transit'

export const DURATION_HOURS: Record<string, number> = {
  '2hours': 2,
  'half-day': 4,
  'full-day': 8,
  weekend: 12,
}
