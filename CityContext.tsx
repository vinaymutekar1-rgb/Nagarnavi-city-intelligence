import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { DEMO_CITIES } from '../lib/demoData'
import {
  fetchPlacesUntilReady,
  fetchWeather,
  reverseGeocode,
  type Category,
  type Place,
  type Weather,
} from '../lib/geo'
import type { CommunityReport, Mission, ReportCategory } from '../lib/recommend'

const ALL_CATEGORIES: Category[] = ['attraction', 'heritage', 'restaurant', 'park', 'market', 'hotel']
const REPORTS_KEY = 'nagarnavi.reports.v2'

export interface LocationInfo {
  name: string
  latitude: number
  longitude: number
  zoom: number
  /** how the location was chosen — shown in the UI for transparency */
  origin: 'default' | 'search' | 'geolocation' | 'map'
  detail?: string | null
}

export type LocateStatus = 'idle' | 'requesting' | 'granted' | 'denied' | 'unavailable' | 'error'

interface CityContextValue {
  location: LocationInfo
  setLocation: (loc: LocationInfo) => void
  places: Place[]
  demoPlaces: Place[]
  allPlaces: Place[]
  loadingPlaces: boolean
  warming: boolean
  placesError: string | null
  degraded: string[]
  sources: string[]
  placesUpdatedAt: string | null
  refreshPlaces: () => void
  reports: CommunityReport[]
  addReport: (r: Omit<CommunityReport, 'id' | 'isDemo' | 'corroborations' | 'status'> & { status?: CommunityReport['status'] }) => void
  corroborate: (id: string) => void
  weather: Weather | null
  weatherError: string | null
  loadingWeather: boolean
  loadWeather: () => void
  comparison: string[]
  toggleCompare: (id: string) => void
  clearCompare: () => void
  mission: Mission | null
  setMission: (m: Mission | null) => void
  pinned: Place[]
  pinPlace: (p: Place) => void
  unpinPlace: (id: string) => void
  locateStatus: LocateStatus
  locateMe: () => void
  lastLocated: { latitude: number; longitude: number } | null
}

const CityContext = createContext<CityContextValue | null>(null)

/* ------------------------- demo report seeds ------------------------- */

function seedReports(city: string, lat: number, lng: number): CommunityReport[] {
  const base = new Date()
  const day = 24 * 60 * 60 * 1000
  const mk = (
    i: number,
    category: ReportCategory,
    description: string,
    dLat: number,
    dLng: number,
    ageDays: number,
    status: CommunityReport['status'],
    corroborations: number,
  ): CommunityReport => ({
    id: `demo-${city}-${i}`,
    city,
    category,
    description,
    latitude: lat + dLat,
    longitude: lng + dLng,
    address: `${city} (approx. demo location)`,
    reportTime: new Date(base.getTime() - ageDays * day).toISOString(),
    status,
    corroborations,
    isDemo: true,
  })
  return [
    mk(1, 'poor-lighting', 'Street lights out along the stretch near the bus stop after 8pm.', 0.006, 0.004, 3, 'corroborated', 3),
    mk(2, 'cleanliness', 'Overflowing bins near the market entrance for the past week.', -0.004, 0.007, 6, 'unverified', 1),
    mk(3, 'accessibility', 'No ramp at the underpass; wheelchair users must detour about 400 m.', -0.008, -0.005, 12, 'corroborated', 2),
    mk(4, 'accident', 'Sharp unsignalised junction — two minor collisions seen this month.', 0.011, -0.009, 20, 'unverified', 0),
    mk(5, 'infrastructure', 'Footpath dug up for cable work, no barricade at night.', 0.003, 0.012, 1, 'verified', 5),
  ]
}

function loadStoredReports(): CommunityReport[] {
  try {
    const raw = localStorage.getItem(REPORTS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as CommunityReport[]) : []
  } catch {
    return []
  }
}

/* ----------------------------- provider ----------------------------- */

export function CityProvider({ children }: { children: ReactNode }) {
  const defaultCity = DEMO_CITIES[0]
  const [location, setLocationState] = useState<LocationInfo>({
    name: defaultCity.name,
    latitude: defaultCity.latitude,
    longitude: defaultCity.longitude,
    zoom: defaultCity.zoom,
    origin: 'default',
  })

  const [places, setPlaces] = useState<Place[]>([])
  const [demoPlaces, setDemoPlaces] = useState<Place[]>([])
  const [loadingPlaces, setLoadingPlaces] = useState(false)
  const [warming, setWarming] = useState(false)
  const [placesError, setPlacesError] = useState<string | null>(null)
  const [degraded, setDegraded] = useState<string[]>([])
  const [sources, setSources] = useState<string[]>([])
  const [placesUpdatedAt, setPlacesUpdatedAt] = useState<string | null>(null)
  const [refreshToken, setRefreshToken] = useState(0)

  const [weather, setWeather] = useState<Weather | null>(null)
  const [weatherError, setWeatherError] = useState<string | null>(null)
  const [loadingWeather, setLoadingWeather] = useState(false)

  const [userReports, setUserReports] = useState<CommunityReport[]>([])
  const [demoReports, setDemoReports] = useState<CommunityReport[]>([])
  const [comparison, setComparison] = useState<string[]>([])
  const [mission, setMission] = useState<Mission | null>(null)
  const [pinned, setPinned] = useState<Place[]>([])
  const [locateStatus, setLocateStatus] = useState<LocateStatus>('idle')
  const [lastLocated, setLastLocated] = useState<{ latitude: number; longitude: number } | null>(null)

  const requestId = useRef(0)

  useEffect(() => {
    setUserReports(loadStoredReports())
  }, [])

  useEffect(() => {
    setDemoReports(seedReports(location.name, location.latitude, location.longitude))
  }, [location.name, location.latitude, location.longitude])

  const setLocation = useCallback((loc: LocationInfo) => {
    setLocationState(loc)
    setComparison([])
    setMission(null)
    setWeather(null)
    setWeatherError(null)
  }, [])

  /* -------- load places whenever the location changes -------- */
  useEffect(() => {
    const id = ++requestId.current
    let cancelled = false
    setLoadingPlaces(true)
    setPlacesError(null)
    setWarming(false)
    setPlaces([])
    setDemoPlaces([])

    fetchPlacesUntilReady(
      location.latitude,
      location.longitude,
      location.name,
      ALL_CATEGORIES,
      (res) => {
        if (cancelled || id !== requestId.current) return
        setPlaces(res.places ?? [])
        setDemoPlaces(res.demoPlaces ?? [])
        setDegraded(res.degraded ?? [])
        setSources(res.sources ?? [])
        setWarming(Boolean(res.warming))
        if (res.warming) setLoadingPlaces(true)
        else {
          setLoadingPlaces(false)
          if (res.live) setPlacesUpdatedAt(new Date().toISOString())
        }
      },
    )
      .catch((err: Error) => {
        if (cancelled || id !== requestId.current) return
        setPlacesError(err.message || 'Place discovery unavailable')
        setLoadingPlaces(false)
      })
      .finally(() => {
        if (!cancelled && id === requestId.current) setLoadingPlaces(false)
      })

    return () => {
      cancelled = true
    }
  }, [location.latitude, location.longitude, location.name, refreshToken])

  /* ------------------------- weather ------------------------- */
  const loadWeather = useCallback(() => {
    let cancelled = false
    setLoadingWeather(true)
    setWeatherError(null)
    fetchWeather(location.latitude, location.longitude)
      .then((res) => {
        if (!cancelled) setWeather(res.weather)
      })
      .catch((err: Error) => {
        if (!cancelled) {
          setWeather(null)
          setWeatherError(err.message || 'Weather unavailable')
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingWeather(false)
      })
    return () => {
      cancelled = true
    }
  }, [location.latitude, location.longitude])

  useEffect(() => {
    const cancel = loadWeather()
    return cancel
  }, [loadWeather])

  /* ------------------------- reports ------------------------- */
  const addReport: CityContextValue['addReport'] = useCallback(
    (r) => {
      const report: CommunityReport = {
        id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        city: r.city,
        category: r.category,
        description: r.description,
        latitude: r.latitude,
        longitude: r.longitude,
        address: r.address ?? null,
        reportTime: r.reportTime,
        status: r.status ?? 'unverified',
        corroborations: 0,
        isDemo: false,
        hasImage: r.hasImage,
        hasAudio: r.hasAudio,
      }
      setUserReports((prev) => {
        const next = [report, ...prev]
        try {
          localStorage.setItem(REPORTS_KEY, JSON.stringify(next))
        } catch {
          /* storage unavailable — report stays in memory for this session */
        }
        return next
      })
    },
    [],
  )

  const corroborate = useCallback((id: string) => {
    setUserReports((prev) => {
      const next = prev.map((r) => (r.id === id ? { ...r, corroborations: r.corroborations + 1, status: 'corroborated' as const } : r))
      try {
        localStorage.setItem(REPORTS_KEY, JSON.stringify(next))
      } catch {
        /* ignore */
      }
      return next
    })
  }, [])

  /* ----------------------- geolocation ----------------------- */
  const locateMe = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setLocateStatus('unavailable')
      return
    }
    setLocateStatus('requesting')
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords
        setLastLocated({ latitude, longitude })
        setLocateStatus('granted')
        let name = 'Your location'
        let detail: string | null = null
        try {
          const rev = await reverseGeocode(latitude, longitude)
          name = rev.place.name || 'Your location'
          detail = rev.place.displayName
        } catch {
          /* name stays generic */
        }
        setLocation({ name, latitude, longitude, zoom: 14, origin: 'geolocation', detail })
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) setLocateStatus('denied')
        else if (err.code === err.POSITION_UNAVAILABLE) setLocateStatus('unavailable')
        else setLocateStatus('error')
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    )
  }, [setLocation])

  const toggleCompare = useCallback((id: string) => {
    setComparison((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : prev.length >= 4 ? prev : [...prev, id]))
  }, [])
  const clearCompare = useCallback(() => setComparison([]), [])
  const refreshPlaces = useCallback(() => setRefreshToken((t) => t + 1), [])
  const pinPlace = useCallback((p: Place) => {
    setPinned((prev) => (prev.some((x) => x.id === p.id) ? prev : [...prev, p]))
  }, [])
  const unpinPlace = useCallback((id: string) => setPinned((prev) => prev.filter((p) => p.id !== id)), [])

  const allPlaces = useMemo(() => {
    const seen = new Set<string>()
    const merged: Place[] = []
    for (const p of [...places, ...demoPlaces]) {
      const key = `${p.name.toLowerCase()}|${p.latitude.toFixed(3)}`
      if (seen.has(key)) continue
      seen.add(key)
      merged.push(p)
    }
    return merged
  }, [places, demoPlaces])

  const reports = useMemo(() => [...userReports, ...demoReports], [userReports, demoReports])

  const value: CityContextValue = {
    location,
    setLocation,
    places,
    demoPlaces,
    allPlaces,
    loadingPlaces,
    warming,
    placesError,
    degraded,
    sources,
    placesUpdatedAt,
    refreshPlaces,
    reports,
    addReport,
    corroborate,
    weather,
    weatherError,
    loadingWeather,
    loadWeather,
    comparison,
    toggleCompare,
    clearCompare,
    mission,
    setMission,
    pinned,
    pinPlace,
    unpinPlace,
    locateStatus,
    locateMe,
    lastLocated,
  }

  return <CityContext.Provider value={value}>{children}</CityContext.Provider>
}

export function useCity() {
  const ctx = useContext(CityContext)
  if (!ctx) throw new Error('useCity must be used inside <CityProvider>')
  return ctx
}
