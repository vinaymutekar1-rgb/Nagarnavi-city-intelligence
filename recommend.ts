/** Deterministic recommendation engine, comparison model and decision receipt.
 *  No LLM is called — every number here is derived from real application data
 *  and is reproducible. Missing data is never treated as negative evidence. */

import {
  type Category,
  type Place,
  type Transport,
  type Weather,
  DURATION_HOURS,
  TRANSPORT_SPEED_KMH,
  formatDuration,
  haversineKm,
} from './geo'

export type Priority = 'affordability' | 'culture' | 'cleanliness' | 'safety' | 'accessibility' | 'proximity'

export interface Mission {
  city: string
  startLabel: string
  start: { latitude: number; longitude: number }
  interests: Category[]
  budget: number
  duration: string
  transport: Transport
  accessibility: string[]
  priorities: Priority[]
  date?: string
}

export type ReportCategory =
  | 'unsafe-area'
  | 'accident'
  | 'cleanliness'
  | 'poor-lighting'
  | 'accessibility'
  | 'infrastructure'

export interface CommunityReport {
  id: string
  city: string
  category: ReportCategory
  description: string
  latitude: number
  longitude: number
  address?: string | null
  reportTime: string
  status: 'unverified' | 'corroborated' | 'verified'
  corroborations: number
  isDemo: boolean
  hasImage?: boolean
  hasAudio?: boolean
}

export const REPORT_LABELS: Record<ReportCategory, string> = {
  'unsafe-area': 'Unsafe area',
  accident: 'Accident-prone',
  cleanliness: 'Cleanliness',
  'poor-lighting': 'Poor lighting',
  accessibility: 'Accessibility',
  infrastructure: 'Infrastructure',
}

/* ----------------------------- scoring ----------------------------- */

export interface ScoredPlace {
  place: Place
  distanceKm: number
  score: number
  reasons: string[]
  caveats: string[]
  nearbyReports: number
  recentReports: number
  accessible: 'yes' | 'limited' | 'no' | 'unknown'
  metrics: Record<string, number | null>
}

const CATEGORY_LABEL: Record<string, string> = {
  attraction: 'attraction',
  heritage: 'heritage site',
  restaurant: 'place to eat',
  park: 'park',
  market: 'market',
  hotel: 'stay',
}

function accessibilityOf(place: Place): ScoredPlace['accessible'] {
  const w = (place.wheelchair || '').toLowerCase()
  if (w === 'yes' || w === 'designated') return 'yes'
  if (w === 'limited') return 'limited'
  if (w === 'no') return 'no'
  return 'unknown'
}

function completeness(place: Place): number {
  const fields = [place.address, place.openingHours, place.website, place.wikipedia, place.imageUrl]
  const present = fields.filter(Boolean).length
  return present / fields.length
}

/** Nearby community reports — used as *information*, never as an absence-is-safe proof. */
function reportsNear(place: Place, reports: CommunityReport[], radiusKm = 0.6) {
  const near = reports.filter((r) => haversineKm(place, r) <= radiusKm)
  const recent = near.filter((r) => Date.now() - new Date(r.reportTime).getTime() < 1000 * 60 * 60 * 24 * 30)
  return { nearby: near.length, recent: recent.length }
}

export function scorePlace(place: Place, mission: Mission, reports: CommunityReport[]): ScoredPlace {
  const distanceKm = haversineKm(mission.start, place)
  const hoursAvailable = DURATION_HOURS[mission.duration] ?? 4
  const speed = TRANSPORT_SPEED_KMH[mission.transport]
  const maxKm = Math.max(1.5, speed * hoursAvailable * 0.6)

  const { nearby, recent } = reportsNear(place, reports)
  const accessible = accessibilityOf(place)
  const completenessRatio = completeness(place)

  // Each metric is 0..1, or null when we have no data for it.
  const interest = mission.interests.includes(place.category) ? 1 : 0.15
  const proximity = Math.max(0, 1 - distanceKm / maxKm)
  const culture = place.category === 'heritage' ? 1 : place.heritageType ? 0.85 : place.category === 'attraction' ? 0.6 : 0.25
  const cleanliness = null // we hold no cleanliness data per place — never invented
  const affordability = place.fee === 'no' ? 1 : place.fee === 'yes' ? 0.4 : null
  const accessibility =
    mission.accessibility.length === 0 ? null : accessible === 'yes' ? 1 : accessible === 'limited' ? 0.6 : accessible === 'unknown' ? null : 0.05
  const safety = nearby === 0 ? null : Math.max(0.15, 1 - recent * 0.3)

  const priorityWeight: Record<Priority, number> = {
    affinity: 0,
    proximity: 0,
    affordability: 0,
    culture: 0,
    cleanliness: 0,
    safety: 0,
    accessibility: 0,
  } as unknown as Record<Priority, number>
  priorityWeight.proximity = mission.priorities.includes('proximity') ? 1.4 : 0.8
  priorityWeight.affordability = mission.priorities.includes('affordability') ? 1.3 : 0.6
  priorityWeight.culture = mission.priorities.includes('culture') ? 1.4 : 0.7
  priorityWeight.cleanliness = mission.priorities.includes('cleanliness') ? 1.0 : 0.3
  priorityWeight.safety = mission.priorities.includes('safety') ? 1.2 : 0.5
  priorityWeight.accessibility = mission.priorities.includes('accessibility') ? 1.4 : 0.5

  const contributions: { value: number | null; weight: number }[] = [
    { value: interest, weight: 1.6 },
    { value: proximity, weight: priorityWeight.proximity },
    { value: culture, weight: priorityWeight.culture },
    { value: affordability, weight: priorityWeight.affordability },
    { value: cleanliness, weight: priorityWeight.cleanliness },
    { value: safety, weight: priorityWeight.safety },
    { value: accessibility, weight: priorityWeight.accessibility },
  ]
  // Data completeness nudges well-documented places up without punishing thin ones.
  contributions.push({ value: completenessRatio, weight: 0.5 })

  const usable = contributions.filter((c) => c.value !== null)
  const totalWeight = usable.reduce((s, c) => s + c.weight, 0)
  const raw = usable.reduce((s, c) => s + (c.value as number) * c.weight, 0) / (totalWeight || 1)
  const score = Math.round(Math.max(0, Math.min(1, raw)) * 100)

  const reasons: string[] = []
  const caveats: string[] = []

  if (mission.interests.includes(place.category))
    reasons.push(`Matches your interest in ${CATEGORY_LABEL[place.category] ?? place.category}`)
  if (distanceKm <= maxKm) reasons.push(`Reachable in your ${hoursAvailable}h window (${distanceKm.toFixed(1)} km)`)
  else caveats.push(`About ${distanceKm.toFixed(1)} km — beyond a comfortable ${mission.transport} trip in ${hoursAvailable}h`)
  if (accessible === 'yes') reasons.push('Listed with step-free / wheelchair access (OpenStreetMap)')
  else if (accessible === 'limited') reasons.push('Partial accessibility recorded')
  else if (mission.accessibility.length > 0 && accessible === 'unknown')
    caveats.push('Accessibility not recorded in OpenStreetMap — verify before you go')
  if (place.category === 'heritage') reasons.push('Heritage value: ' + (place.heritageType ? String(place.heritageType).replace(/_/g, ' ') : 'historic site'))
  if (place.openingHours) reasons.push(`Opening hours published: ${place.openingHours}`)
  else caveats.push('Opening hours not published in the source data')
  if (place.fee === 'no') reasons.push('Listed as free entry')
  if (place.fee === null) caveats.push('No price information in source data')
  if (nearby > 0) caveats.push(`${nearby} community report${nearby > 1 ? 's' : ''} within 600 m (${recent} in the last 30 days)`)
  if (place.source === 'Wikipedia') reasons.push('Notable place with a sourced Wikipedia article')
  if (place.isDemo) caveats.push('Demo dataset entry — not a live provider result')

  return {
    place,
    distanceKm,
    score,
    reasons,
    caveats,
    nearbyReports: nearby,
    recentReports: recent,
    accessible,
    metrics: { interest, proximity, culture, affordability, accessibility, cleanliness, safety, completeness: completenessRatio },
  }
}

/* --------------------------- itinerary ----------------------------- */

export interface ItineraryStop {
  order: number
  place: Place
  distanceFromStartKm: number
  legFromPrevKm: number
  legMinutes: number
  score: number
  reasons: string[]
  caveats: string[]
}

export interface Itinerary {
  stops: ItineraryStop[]
  totalDistanceKm: number
  totalMinutes: number
  reachable: boolean
  transport: Transport
  durationLabel: string
  knownCosts: number
  costNotes: string[]
  skipped: { place: Place; reason: string }[]
}

const STOPS_BY_DURATION: Record<string, number> = {
  '2hours': 3,
  'half-day': 5,
  'full-day': 7,
  weekend: 9,
}

export function buildItinerary(scored: ScoredPlace[], mission: Mission): Itinerary {
  const hours = DURATION_HOURS[mission.duration] ?? 4
  const speed = TRANSPORT_SPEED_KMH[mission.transport]
  const maxKm = Math.max(1.5, speed * hours * 0.6)
  const target = STOPS_BY_DURATION[mission.duration] ?? 4

  const reachable = scored.filter((s) => s.distanceKm <= maxKm && !s.place.isDemo)
  const pool = (reachable.length >= 2 ? reachable : scored.filter((s) => !s.place.isDemo)).sort((a, b) => b.score - a.score)

  const chosen: ScoredPlace[] = []
  const usedCategories = new Set<string>()
  // Greedy nearest-neighbour from the start, with a light category-diversity rule.
  let cursor = { latitude: mission.start.latitude, longitude: mission.start.longitude }
  const remaining = [...pool]
  while (chosen.length < target && remaining.length > 0) {
    let bestIdx = -1
    let bestValue = -Infinity
    for (let i = 0; i < remaining.length; i++) {
      const cand = remaining[i]
      const leg = haversineKm(cursor, cand.place)
      const diversity = usedCategories.has(cand.place.category) ? 0 : 0.12
      const value = cand.score / 100 - leg / Math.max(maxKm, 1) * 0.5 + diversity
      if (value > bestValue) {
        bestValue = value
        bestIdx = i
      }
    }
    if (bestIdx < 0) break
    const picked = remaining.splice(bestIdx, 1)[0]
    chosen.push(picked)
    usedCategories.add(picked.place.category)
    cursor = { latitude: picked.place.latitude, longitude: picked.place.longitude }
  }

  let totalDistanceKm = 0
  let prev = mission.start
  let totalMinutes = 0
  const stops: ItineraryStop[] = chosen.map((s, idx) => {
    const leg = haversineKm(prev, s.place)
    totalDistanceKm += leg
    const legMinutes = Math.round((leg / speed) * 60)
    totalMinutes += legMinutes
    prev = { latitude: s.place.latitude, longitude: s.place.longitude }
    return {
      order: idx + 1,
      place: s.place,
      distanceFromStartKm: haversineKm(mission.start, s.place),
      legFromPrevKm: leg,
      legMinutes,
      score: s.score,
      reasons: s.reasons,
      caveats: s.caveats,
    }
  })

  const knownCosts = stops.reduce((sum, s) => sum + (s.place.fee === 'no' ? 0 : 0), 0)
  const costNotes: string[] = [
    'Only entry-fee flags from OpenStreetMap are used; no prices are invented.',
    stops.some((s) => s.place.category === 'restaurant')
      ? 'Food & drink costs are not published in the source data and are therefore not estimated.'
      : 'No dining stops in this itinerary.',
  ]
  if (knownCosts === 0) costNotes.push(`No paid-entry stops recorded, so estimated known entry cost is ₹0 against your ₹${mission.budget.toLocaleString('en-IN')} budget.`)

  const skipped = scored
    .filter((s) => !stops.some((st) => st.place.id === s.place.id))
    .slice(0, 8)
    .map((s) => ({
      place: s.place,
      reason: s.place.isDemo
        ? 'Demo dataset entry, excluded from the live itinerary'
        : s.distanceKm > maxKm
          ? `${s.distanceKm.toFixed(1)} km away — outside your ${hours}h travel window`
          : 'Lower preference match than the selected stops',
    }))

  return {
    stops,
    totalDistanceKm,
    totalMinutes,
    reachable: stops.length > 0,
    transport: mission.transport,
    durationLabel: mission.duration,
    knownCosts,
    costNotes,
    skipped,
  }
}

/* --------------------------- comparison ---------------------------- */

export interface CompareMetric {
  id: string
  label: string
  /** higher is better; null metric values mean "no data" */
  value: (p: Place, m: Mission) => number | null
  format: (v: number) => string
  explain: (v: number | null) => string
}

export const COMPARE_METRICS: CompareMetric[] = [
  {
    id: 'proximity',
    label: 'Distance from start',
    value: (p, m) => 1 - Math.min(1, haversineKm(m.start, p) / 10),
    format: (v) => `${((1 - v) * 10).toFixed(1)} km`,
    explain: (v) => (v === null ? 'Start point not set' : 'Closer to your start scores higher'),
  },
  {
    id: 'accessibility',
    label: 'Accessibility',
    value: (p) => {
      const a = accessibilityOf(p)
      return a === 'yes' ? 1 : a === 'limited' ? 0.6 : a === 'no' ? 0.05 : null
    },
    format: (v) => (v >= 1 ? 'Step-free' : v >= 0.5 ? 'Partial' : 'Not accessible'),
    explain: (v) => (v === null ? 'Not recorded in OpenStreetMap' : 'From the OSM wheelchair tag'),
  },
  {
    id: 'accuracy',
    label: 'Data completeness',
    value: (p) => completeness(p),
    format: (v) => `${Math.round(v * 100)}%`,
    explain: () => 'How many of address / hours / website / article / image are present',
  },
  {
    id: 'cost',
    label: 'Entry cost',
    value: (p) => (p.fee === 'no' ? 1 : p.fee === 'yes' ? 0.35 : null),
    format: (v) => (v === 1 ? 'Free entry' : v < 0.5 ? 'Paid entry' : 'Unknown'),
    explain: (v) => (v === null ? 'No entry-fee data in the source' : 'From the OSM fee tag — no price is invented'),
  },
  {
    id: 'culture',
    label: 'Cultural value',
    value: (p) => (p.category === 'heritage' ? 1 : p.heritageType ? 0.8 : p.category === 'attraction' ? 0.55 : 0.2),
    format: (v) => (v >= 1 ? 'Heritage' : v >= 0.5 ? 'Cultural' : 'General'),
    explain: () => 'Heritage designations and historic tags in OpenStreetMap',
  },
  {
    id: 'rating',
    label: 'Source rating',
    value: () => null,
    format: () => 'No data',
    explain: () => 'No ratings are available from the connected open data sources — not shown as zero',
  },
  {
    id: 'cleanliness',
    label: 'Cleanliness',
    value: () => null,
    format: () => 'No data',
    explain: () => 'No cleanliness dataset exists for these places — kept explicit rather than guessed',
  },
]

export interface CompareRow {
  place: Place
  total: number | null
  metrics: { id: string; label: string; value: number | null; display: string; note: string }[]
  missing: string[]
}

export function comparePlaces(places: Place[], mission: Mission, weights: Record<string, number>): CompareRow[] {
  const rows: CompareRow[] = places.map((place) => {
    const metrics = COMPARE_METRICS.map((m) => {
      const v = m.value(place, mission)
      return { id: m.id, label: m.label, value: v, display: v === null ? 'No data' : m.format(v), note: m.explain(v) }
    })
    const usable = metrics.filter((m) => m.value !== null)
    const totalWeight = usable.reduce((s, m) => s + (weights[m.id] ?? 1), 0)
    // One decimal so small weight changes are actually visible.
    const total =
      totalWeight > 0
        ? Math.round((usable.reduce((s, m) => s + (m.value as number) * (weights[m.id] ?? 1), 0) / totalWeight) * 1000) / 10
        : null
    return {
      place,
      total,
      metrics,
      missing: metrics.filter((m) => m.value === null).map((m) => m.label),
    }
  })
  return rows.sort((a, b) => (b.total ?? -1) - (a.total ?? -1))
}

/* ------------------------ decision receipt ------------------------- */

export interface ReceiptLine {
  label: string
  value: string
  kind: 'fact' | 'estimate' | 'community' | 'unknown'
}

export interface ReceiptStop {
  order: number
  name: string
  category: string
  why: string[]
  matchedPreferences: string[]
  evidence: ReceiptLine[]
  verify: string[]
  sources: string[]
}

export interface DecisionReceipt {
  mission: Mission
  generatedAt: string
  summary: string
  stops: ReceiptStop[]
  dataSources: { name: string; used: number; note: string }[]
  unknowns: string[]
  weather?: { condition: string; temperature: number; source: string; retrievedAt: string }
}

export function buildReceipt(
  mission: Mission,
  itinerary: Itinerary,
  reports: CommunityReport[],
  weather: Weather | null,
): DecisionReceipt {
  const stops: ReceiptStop[] = itinerary.stops.map((s) => {
    const matched: string[] = []
    if (mission.interests.includes(s.place.category)) matched.push(`Interest: ${s.place.category}`)
    if (mission.priorities.includes('proximity') && s.distanceFromStartKm <= 5) matched.push('Priority: proximity')
    if (mission.priorities.includes('culture') && (s.place.category === 'heritage' || s.place.heritageType))
      matched.push('Priority: cultural value')
    if (mission.priorities.includes('accessibility') && s.place.wheelchair === 'yes') matched.push('Priority: accessibility')
    if (mission.priorities.includes('affordability') && s.place.fee === 'no') matched.push('Priority: affordability')
    if (mission.priorities.includes('safety') && s.caveats.some((c) => c.includes('community report'))) matched.push('Priority: safety signals')

    const evidence: ReceiptLine[] = [
      { label: 'Location', value: `${s.place.latitude.toFixed(4)}, ${s.place.longitude.toFixed(4)}`, kind: 'fact' },
      { label: 'Distance from start', value: `${s.distanceFromStartKm.toFixed(1)} km`, kind: 'estimate' },
      {
        label: 'Travel to this stop',
        value: `${s.legFromPrevKm.toFixed(1)} km · ~${s.legMinutes} min ${mission.transport}`,
        kind: 'estimate',
      },
      { label: 'Match score', value: `${s.score}/100 (heuristic)`, kind: 'estimate' },
      {
        label: 'Opening hours',
        value: s.place.openingHours || 'Not published in source',
        kind: s.place.openingHours ? 'fact' : 'unknown',
      },
      {
        label: 'Entry fee',
        value: s.place.fee === 'no' ? 'Free (OSM fee tag)' : s.place.fee === 'yes' ? 'Paid — amount not published' : 'Not recorded',
        kind: s.place.fee ? 'fact' : 'unknown',
      },
      {
        label: 'Accessibility',
        value:
          s.place.wheelchair === 'yes'
            ? 'Wheelchair accessible (OSM)'
            : s.place.wheelchair === 'limited'
              ? 'Partially accessible (OSM)'
              : 'Not recorded in OpenStreetMap',
        kind: s.place.wheelchair ? 'fact' : 'unknown',
      },
      {
        label: 'Community reports nearby',
        value: s.caveats.find((c) => c.includes('community report')) || 'None within 600 m',
        kind: 'community',
      },
    ]

    const verify: string[] = []
    if (!s.place.openingHours) verify.push('Opening hours — not published by the source')
    if (!s.place.fee) verify.push('Entry price — not published by the source')
    if (mission.accessibility.length > 0 && !s.place.wheelchair) verify.push('Step-free access — not recorded in OpenStreetMap')
    if (s.caveats.some((c) => c.includes('community report'))) verify.push('Nearby community reports — recency and accuracy')
    if (s.place.isDemo) verify.push('This stop comes from the demo dataset')

    return {
      order: s.order,
      name: s.place.name,
      category: s.place.category,
      why: s.reasons.slice(0, 5),
      matchedPreferences: matched,
      evidence,
      verify,
      sources: [s.place.source],
    }
  })

  const sourceCounts = new Map<string, number>()
  itinerary.stops.forEach((s) => sourceCounts.set(s.place.source, (sourceCounts.get(s.place.source) ?? 0) + 1))
  const dataSources = [...sourceCounts.entries()].map(([name, used]) => ({
    name,
    used,
    note:
      name === 'Wikipedia'
        ? 'Sourced article summaries and notable-place coordinates'
        : name === 'OpenStreetMap Nominatim'
          ? 'Place names, categories and coordinates from OpenStreetMap'
          : 'Demo dataset (clearly labelled in the UI)',
  }))

  const unknowns = [
    'Live traffic conditions — no traffic provider is connected',
    'Real-time ride/taxi availability and fares',
    'User ratings and review counts — no ratings source is connected',
    'Room availability and prices for stays',
    'Whether any community report applies to your exact time of travel',
  ]

  return {
    mission,
    generatedAt: new Date().toISOString(),
    summary: `${itinerary.stops.length} stops · ${itinerary.totalDistanceKm.toFixed(1)} km · ~${formatDuration(itinerary.totalMinutes)} of travel by ${mission.transport}. Scored deterministically from ${reports.length} community reports and live open data.`,
    stops,
    dataSources,
    unknowns,
    weather: weather
      ? { condition: weather.condition, temperature: weather.temperature, source: weather.source, retrievedAt: weather.retrievedAt }
      : undefined,
  }
}
