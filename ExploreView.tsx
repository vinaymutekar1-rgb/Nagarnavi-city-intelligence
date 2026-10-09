import { useMemo, useState } from 'react'
import { AlertTriangle, ArrowLeft, Layers, List, Loader2, Maximize2, RefreshCw, Search, SlidersHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CityMap } from './CityMap'
import { PlaceCard } from './PlaceCard'
import { PlacePanel } from './PlacePanel'
import { useCity } from '../context/CityContext'
import { CATEGORIES, haversineKm, type Category, type Place } from '../lib/geo'
import { cn } from '@/lib/cn'

type SortKey = 'distance' | 'name' | 'category'

interface Props {
  onAddToMission: (p: Place) => void
  onOpenMission: () => void
}

export function ExploreView({ onAddToMission, onOpenMission }: Props) {
  const {
    location,
    allPlaces,
    loadingPlaces,
    warming,
    placesError,
    degraded,
    placesUpdatedAt,
    refreshPlaces,
    comparison,
    toggleCompare,
    pinned,
    pinPlace,
    lastLocated,
  } = useCity()

  const [activeCats, setActiveCats] = useState<Category[]>(CATEGORIES.map((c) => c.id))
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<SortKey>('distance')
  const [selected, setSelected] = useState<Place | null>(null)
  const [mobileMode, setMobileMode] = useState<'map' | 'list'>('map')
  const [fitToken, setFitToken] = useState(0)
  // Demo entries are shown by default so every category is explorable, but each
  // one is stamped DEMO and they are excluded from mission recommendations.
  const [showDemo, setShowDemo] = useState(true)

  const withDistance = useMemo(
    () =>
      allPlaces.map((p) => ({
        place: p,
        distanceKm: haversineKm(location, p),
      })),
    [allPlaces, location],
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    let list = withDistance.filter(({ place }) => activeCats.includes(place.category))
    if (!showDemo) list = list.filter(({ place }) => !place.isDemo)
    if (q) {
      list = list.filter(
        ({ place }) =>
          place.name.toLowerCase().includes(q) ||
          (place.address || '').toLowerCase().includes(q) ||
          place.category.includes(q),
      )
    }
    list.sort((a, b) => {
      if (sort === 'distance') return a.distanceKm - b.distanceKm
      if (sort === 'name') return a.place.name.localeCompare(b.place.name)
      return a.place.category.localeCompare(b.place.category) || a.distanceKm - b.distanceKm
    })
    return list
  }, [withDistance, activeCats, query, sort, showDemo])

  const mapPlaces = filtered.map((f) => f.place)
  const selectedDistance = selected ? haversineKm(location, selected) : undefined
  const selectedId: string | null = selected ? selected.id : null

  const toggleCat = (id: Category) =>
    setActiveCats((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]))

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      {/* Filter bar */}
      <div className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
          <div className="relative min-w-[200px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Filter places in ${location.name}…`}
              aria-label="Filter places"
              className="h-10 w-full rounded-md border border-line bg-paper pl-9 pr-3 text-sm text-ink placeholder:text-ink-soft/70 focus:border-ink focus:outline-none focus:ring-2 focus:ring-brand/60"
            />
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {CATEGORIES.map((c) => (
              <button
                key={c.id}
                onClick={() => toggleCat(c.id)}
                aria-pressed={activeCats.includes(c.id)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-xs font-medium transition-colors',
                  activeCats.includes(c.id) ? 'border-ink bg-ink text-paper' : 'border-line bg-surface text-ink-soft hover:border-ink',
                )}
              >
                <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: activeCats.includes(c.id) ? 'oklch(0.9 0.19 118)' : c.color }} />
                {c.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5">
            <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs text-ink-soft">
              <input type="checkbox" checked={showDemo} onChange={(e) => setShowDemo(e.target.checked)} className="h-3.5 w-3.5 accent-[oklch(0.9_0.19_118)]" />
              Demo data
            </label>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              aria-label="Sort results"
              className="h-9 rounded-md border border-line bg-paper px-2 text-xs text-ink focus:border-ink focus:outline-none"
            >
              <option value="distance">Nearest first</option>
              <option value="name">Name A–Z</option>
              <option value="category">Category</option>
            </select>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setFitToken((t) => t + 1)}>
              <Maximize2 className="h-3.5 w-3.5" /> Fit all
            </Button>
            <Button variant="outline" size="icon" className="lg:hidden" onClick={() => setMobileMode((m) => (m === 'map' ? 'list' : 'map'))} aria-label="Toggle map or list">
              {mobileMode === 'map' ? <List className="h-4 w-4" /> : <Layers className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        {(warming || placesError || degraded.length > 0) && (
          <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-x-4 gap-y-1 px-4 pb-2 text-xs sm:px-6">
            {warming && (
              <span className="inline-flex items-center gap-1.5 text-ink-soft">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading live places from OpenStreetMap & Wikipedia…
              </span>
            )}
            {placesError && (
              <span className="inline-flex items-center gap-1.5 text-coral">
                <AlertTriangle className="h-3.5 w-3.5" /> {placesError}
                <button onClick={refreshPlaces} className="inline-flex items-center gap-1 underline">
                  <RefreshCw className="h-3 w-3" /> retry
                </button>
              </span>
            )}
            {degraded.length > 0 && !warming && (
              <span className="inline-flex flex-wrap items-center gap-1.5 text-ink-soft">
                <AlertTriangle className="h-3.5 w-3.5 text-coral" />
                Some categories could not be loaded right now ({degraded.join(', ')}) — the provider was rate-limited. Showing
                what we have.
                <button onClick={refreshPlaces} className="inline-flex items-center gap-1 underline">
                  <RefreshCw className="h-3 w-3" /> retry
                </button>
              </span>
            )}
            {placesUpdatedAt && !warming && <span className="text-ink-soft">Live data retrieved {new Date(placesUpdatedAt).toLocaleTimeString()}</span>}
          </div>
        )}
      </div>

      {/* Workspace */}
      <div className="mx-auto flex w-full max-w-[1600px] flex-1 flex-col overflow-hidden lg:flex-row">
        <div className={cn('relative flex-1 border-line lg:border-r', mobileMode === 'map' ? 'block' : 'hidden lg:block')}>
          <CityMap
            center={{ latitude: location.latitude, longitude: location.longitude }}
            zoom={location.zoom}
            places={mapPlaces}
            selectedId={selected?.id ?? null}
            onSelect={setSelected}
            userLocation={lastLocated}
            fitToResultsToken={fitToken}
            className="h-full w-full"
          />
          <div className="pointer-events-none absolute left-3 top-3 z-[500] rounded-md border border-line bg-surface/95 px-3 py-1.5 text-xs text-ink shadow-sm">
            <strong className="font-semibold">{filtered.length}</strong> places · {location.name}
          </div>
          {mapPlaces.length === 0 && !loadingPlaces && (
            <div className="pointer-events-none absolute inset-0 z-[500] grid place-items-center">
              <div className="rounded-lg border border-line bg-surface/95 px-5 py-4 text-center text-sm text-ink-soft shadow-lg">
                No places match these filters.
                <br />
                Turn on “Demo data” or widen the categories.
              </div>
            </div>
          )}
        </div>

        <div className={cn('flex w-full flex-col overflow-hidden lg:w-[380px] xl:w-[420px]', mobileMode === 'list' ? 'flex' : 'hidden lg:flex')}>
          {selected ? (
            <>
              <button
                onClick={() => setSelected(null)}
                className="flex items-center gap-2 border-b border-line bg-surface px-4 py-2.5 text-sm font-medium text-ink-soft hover:text-ink"
              >
                <ArrowLeft className="h-4 w-4" /> Back to results
              </button>
              <div className="flex-1 overflow-hidden">
                <PlacePanel
                  place={selected}
                  distanceKm={selectedDistance}
                  inComparison={comparison.includes(selected.id)}
                  onClose={() => setSelected(null)}
                  onToggleCompare={(p) => toggleCompare(p.id)}
                  onAddToMission={onAddToMission}
                  start={location}
                />
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between border-b border-line bg-surface px-4 py-3">
                <div>
                  <h2 className="font-display text-lg font-semibold text-ink">Places</h2>
                  <p className="text-xs text-ink-soft">
                    {loadingPlaces && allPlaces.length === 0 ? 'Loading…' : `${filtered.length} matching · sorted by ${sort === 'distance' ? 'distance' : sort}`}
                  </p>
                </div>
                {pinned.length > 0 && (
                  <Button size="sm" className="gap-1.5 bg-brand text-ink hover:bg-brand/85" onClick={onOpenMission}>
                    Mission ({pinned.length})
                  </Button>
                )}
              </div>

              <div className="nagar-scroll flex-1 overflow-y-auto bg-surface">
                {loadingPlaces && allPlaces.length === 0 && (
                  <div className="space-y-px">
                    {[0, 1, 2, 3, 4].map((i) => (
                      <div key={i} className="animate-pulse border-b border-line p-4">
                        <div className="flex gap-3">
                          <div className="h-16 w-16 rounded-md bg-secondary" />
                          <div className="flex-1 space-y-2 py-1">
                            <div className="h-4 w-2/3 rounded bg-secondary" />
                            <div className="h-3 w-1/3 rounded bg-secondary" />
                            <div className="h-3 w-1/2 rounded bg-secondary" />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {!loadingPlaces && filtered.length === 0 && allPlaces.length === 0 && (
                  <div className="p-8 text-center">
                    <AlertTriangle className="mx-auto h-8 w-8 text-coral" />
                    <p className="mt-3 text-sm font-medium text-ink">No live places loaded for {location.name} yet</p>
                    <p className="mt-1 text-xs text-ink-soft">
                      The open data provider may be rate-limiting us. Retry, or tick “Demo data” to explore with the labelled
                      sample set.
                    </p>
                    <Button variant="outline" size="sm" className="mt-3 gap-1.5" onClick={refreshPlaces}>
                      <RefreshCw className="h-3.5 w-3.5" /> Retry loading places
                    </Button>
                  </div>
                )}

                {!loadingPlaces && filtered.length === 0 && allPlaces.length > 0 && (
                  <div className="p-8 text-center">
                    <SlidersHorizontal className="mx-auto h-8 w-8 text-ink-soft" />
                    <p className="mt-3 text-sm text-ink-soft">
                      No places match these filters.
                      <br />
                      Enable “Demo data”, or turn another category back on.
                    </p>
                  </div>
                )}

                {filtered.map(({ place, distanceKm }) => (
                  <PlaceCard
                    key={place.id}
                    place={place}
                    distanceKm={distanceKm}
                    selected={selectedId === place.id}
                    inComparison={comparison.includes(place.id)}
                    onOpen={(p) => setSelected(p)}
                    onToggleCompare={(p) => toggleCompare(p.id)}
                    onViewOnMap={(p) => setSelected(p)}
                    onAddToMission={pinPlace}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
