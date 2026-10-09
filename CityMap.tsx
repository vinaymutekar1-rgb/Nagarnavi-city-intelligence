import { useEffect, useMemo, useRef } from 'react'
import L from 'leaflet'
import { MapContainer, TileLayer, Marker, Popup, useMap, Tooltip } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { type Category, type Place } from '../lib/geo'
import { REPORT_LABELS, type CommunityReport } from '../lib/recommend'

const CATEGORY_COLOR: Record<Category, string> = {
  attraction: '#0f766e',
  heritage: '#b45309',
  restaurant: '#be123c',
  park: '#15803d',
  market: '#7c3aed',
  hotel: '#0369a1',
}

const CATEGORY_GLYPH: Record<Category, string> = {
  attraction: '<path d="M12 3l2.6 5.6 6.1.8-4.5 4.2 1.2 6-5.4-3-5.4 3 1.2-6L3.3 9.4l6.1-.8z"/>',
  heritage: '<path d="M4 21h16M6 21V9m4 12V9m4 12V9m4 12V9M3 9h18L12 3 3 9z"/>',
  restaurant: '<path d="M7 3v8a2 2 0 104 0V3M9 11v10M17 3c-1.6 1.3-2.2 3.1-2.2 5.1S15.4 11.9 17 13v8"/>',
  park: '<path d="M12 22v-4M8.5 18h7M12 18a5.5 5.5 0 10-3-10.1M12 18a5.5 5.5 0 113-10.1"/>',
  market: '<path d="M3 7h18l-1.5 12.5A2 2 0 0117.5 21h-11A2 2 0 014.5 19.5L3 7zM8 7V6a4 4 0 118 0v1"/>',
  hotel: '<path d="M3 20V9m0 5h18v6M3 14h18v-3a2 2 0 00-2-2h-8v5M7.5 12a2 2 0 100-4 2 2 0 000 4z"/>',
}

function markerHtml(color: string, glyphPath: string, selected: boolean) {
  return `<div class="nagar-marker ${selected ? 'nagar-marker--selected' : ''}" style="background:${color}">
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.1"
      stroke-linecap="round" stroke-linejoin="round">${glyphPath}</svg>
  </div>`
}

function placeIcon(place: Place, selected: boolean) {
  const color = place.isDemo ? '#64748b' : CATEGORY_COLOR[place.category] || '#334155'
  return L.divIcon({
    className: '',
    html: markerHtml(color, CATEGORY_GLYPH[place.category] || CATEGORY_GLYPH.attraction, selected),
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    popupAnchor: [0, -16],
  })
}

function reportIcon(report: CommunityReport) {
  const color = report.isDemo ? '#94a3b8' : '#d9534f'
  return L.divIcon({
    className: '',
    html: markerHtml(color, '<path d="M12 9v4m0 4h.01M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z"/>', false),
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    popupAnchor: [0, -16],
  })
}

const userIcon = L.divIcon({ className: '', html: '<div class="nagar-user-marker"></div>', iconSize: [18, 18], iconAnchor: [9, 9] })

interface Props {
  center: { latitude: number; longitude: number }
  zoom: number
  places: Place[]
  selectedId: string | null
  onSelect: (place: Place) => void
  reports?: CommunityReport[]
  showReports?: boolean
  userLocation?: { latitude: number; longitude: number } | null
  fitToResultsToken?: number
  onMapClick?: (lat: number, lng: number) => void
  className?: string
}

function MapSync({
  center,
  zoom,
  places,
  fitToken,
  onMapClick,
}: {
  center: { latitude: number; longitude: number }
  zoom: number
  places: Place[]
  fitToken?: number
  onMapClick?: (lat: number, lng: number) => void
}) {
  const map = useMap()
  const lastCenter = useRef<string>('')
  const lastFit = useRef<number | undefined>(undefined)

  useEffect(() => {
    const key = `${center.latitude.toFixed(4)},${center.longitude.toFixed(4)}`
    if (lastCenter.current !== key) {
      lastCenter.current = key
      map.setView([center.latitude, center.longitude], zoom, { animate: true })
    }
  }, [center.latitude, center.longitude, zoom, map])

  useEffect(() => {
    if (fitToken === undefined || lastFit.current === fitToken) return
    lastFit.current = fitToken
    const pts = places.filter((p) => Number.isFinite(p.latitude) && Number.isFinite(p.longitude))
    if (pts.length < 2) {
      if (pts.length === 1) map.setView([pts[0].latitude, pts[0].longitude], 14, { animate: true })
      return
    }
    const bounds = L.latLngBounds(pts.map((p) => [p.latitude, p.longitude] as [number, number]))
    map.fitBounds(bounds, { padding: [48, 48], maxZoom: 15, animate: true })
  }, [fitToken, places, map])

  useEffect(() => {
    if (!onMapClick) return
    const handler = (e: L.LeafletMouseEvent) => onMapClick(e.latlng.lat, e.latlng.lng)
    map.on('click', handler)
    return () => {
      map.off('click', handler)
    }
  }, [map, onMapClick])

  useEffect(() => {
    const t = setTimeout(() => map.invalidateSize(), 220)
    return () => clearTimeout(t)
  }, [map])

  return null
}

export function CityMap({
  center,
  zoom,
  places,
  selectedId,
  onSelect,
  reports = [],
  showReports = false,
  userLocation,
  fitToResultsToken,
  onMapClick,
  className,
}: Props) {
  const icons = useMemo(() => {
    const m = new Map<string, L.DivIcon>()
    for (const p of places) m.set(p.id, placeIcon(p, p.id === selectedId))
    return m
  }, [places, selectedId])

  const reportIcons = useMemo(() => {
    const m = new Map<string, L.DivIcon>()
    if (showReports) for (const r of reports) m.set(r.id, reportIcon(r))
    return m
  }, [reports, showReports])

  return (
    <div className={className}>
      <MapContainer
        center={[center.latitude, center.longitude]}
        zoom={zoom}
        scrollWheelZoom
        style={{ height: '100%', width: '100%' }}
        preferCanvas
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          maxZoom={19}
        />
        <MapSync center={center} zoom={zoom} places={places} fitToken={fitToResultsToken} onMapClick={onMapClick} />

        {userLocation && Number.isFinite(userLocation.latitude) && (
          <Marker position={[userLocation.latitude, userLocation.longitude]} icon={userIcon} zIndexOffset={900}>
            <Tooltip>Your current location</Tooltip>
          </Marker>
        )}

        {showReports &&
          reports.map((r) => (
            <Marker
              key={r.id}
              position={[r.latitude, r.longitude]}
              icon={reportIcons.get(r.id)}
              alt={`Community report: ${REPORT_LABELS[r.category]}`}
              zIndexOffset={400}
            >
              <Popup>
                <strong>{REPORT_LABELS[r.category]}</strong>
                <div style={{ marginTop: 4 }}>{r.description}</div>
                <div style={{ marginTop: 6, color: '#64748b' }}>
                  {r.status} · {r.corroborations} corroboration{r.corroborations === 1 ? '' : 's'}
                  {r.isDemo ? ' · demo' : ''}
                </div>
              </Popup>
            </Marker>
          ))}

        {places.map((p) => (
          <Marker
            key={p.id}
            position={[p.latitude, p.longitude]}
            icon={icons.get(p.id)}
            alt={`${p.category}: ${p.name}`}
            title={p.name}
            keyboard
            zIndexOffset={p.id === selectedId ? 800 : 0}
            eventHandlers={{ click: () => onSelect(p) }}
          >
            <Tooltip direction="top" offset={[0, -14]} opacity={1}>
              {p.name}
            </Tooltip>
          </Marker>
        ))}
      </MapContainer>
    </div>
  )
}
