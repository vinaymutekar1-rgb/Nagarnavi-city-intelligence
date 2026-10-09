import { useMemo, useState } from 'react'
import { Layers, Maximize2, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CityMap } from './CityMap'
import { PlacePanel } from './PlacePanel'
import { useCity } from '../context/CityContext'
import { CATEGORIES, haversineKm, type Category, type Place } from '../lib/geo'
import { cn } from '@/lib/cn'

interface Props {
  onAddToMission: (p: Place) => void
}

export function MapView({ onAddToMission }: Props) {
  const { location, allPlaces, reports, comparison, toggleCompare, lastLocated, refreshPlaces, warming } = useCity()
  const [activeCats, setActiveCats] = useState<Category[]>(CATEGORIES.map((c) => c.id))
  const [showReports, setShowReports] = useState(true)
  const [selected, setSelected] = useState<Place | null>(null)
  const [fitToken, setFitToken] = useState(0)

  const places = useMemo(
    () => allPlaces.filter((p) => activeCats.includes(p.category)),
    [allPlaces, activeCats],
  )

  const toggleCat = (id: Category) =>
    setActiveCats((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]))

  const selectedId: string | null = selected ? selected.id : null

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      <div className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
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
          <div className="ml-auto flex items-center gap-2">
            <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs text-ink-soft">
              <input type="checkbox" checked={showReports} onChange={(e) => setShowReports(e.target.checked)} className="h-3.5 w-3.5 accent-[oklch(0.9_0.19_118)]" />
              Community reports
            </label>
            {warming && <span className="text-xs text-ink-soft">loading live places…</span>}
            <Button variant="outline" size="sm" className="gap-1.5" onClick={refreshPlaces}>
              <RefreshCw className="h-3.5 w-3.5" /> Refresh
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setFitToken((t) => t + 1)}>
              <Maximize2 className="h-3.5 w-3.5" /> Fit all
            </Button>
          </div>
        </div>
      </div>

      <div className="relative flex flex-1 overflow-hidden">
        <CityMap
          center={{ latitude: location.latitude, longitude: location.longitude }}
          zoom={location.zoom}
          places={places}
          selectedId={selectedId}
          onSelect={setSelected}
          reports={reports}
          showReports={showReports}
          userLocation={lastLocated}
          fitToResultsToken={fitToken}
          className="h-full w-full"
        />

        <div className="pointer-events-none absolute left-3 top-3 z-[500] space-y-2">
          <div className="rounded-md border border-line bg-surface/95 px-3 py-2 text-xs text-ink shadow-sm">
            <div className="flex items-center gap-1.5 font-medium">
              <Layers className="h-3.5 w-3.5" /> {places.length} places · {location.name}
            </div>
            <div className="mt-1.5 space-y-0.5 text-ink-soft">
              {CATEGORIES.map((c) => (
                <div key={c.id} className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: c.color }} />
                  {c.label}
                </div>
              ))}
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-coral" />
                Community reports
              </div>
            </div>
          </div>
        </div>

        {selected && (
          <div className="absolute right-0 top-0 z-[600] h-full w-full max-w-[420px] shadow-2xl">
            <PlacePanel
              place={selected}
              distanceKm={haversineKm(location, selected)}
              inComparison={comparison.includes(selected.id)}
              onClose={() => setSelected(null)}
              onToggleCompare={(p) => toggleCompare(p.id)}
              onAddToMission={onAddToMission}
              start={location}
            />
          </div>
        )}
      </div>
    </div>
  )
}
