import { useMemo } from 'react'
import { AlertTriangle, Compass, MapPin, Pin, Route, Wallet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DecisionReceipt } from './DecisionReceipt'
import { CategoryChip, SourceTag } from './PlaceCard'
import { useCity } from '../context/CityContext'
import { DURATION_HOURS, formatDistance, formatDuration } from '../lib/geo'
import { buildItinerary, buildReceipt, scorePlace, type Itinerary, type Mission } from '../lib/recommend'

interface Props {
  onPlanAnother: () => void
}

export function MissionView({ onPlanAnother }: Props) {
  const { mission, allPlaces, reports, weather, pinned, unpinPlace, location, clearCompare } = useCity()

  const effectiveMission: Mission | null = useMemo(() => {
    if (mission) return mission
    if (pinned.length === 0) return null
    const cats = Array.from(new Set(pinned.map((p) => p.category)))
    return {
      city: location.name,
      startLabel: `${location.name} centre`,
      start: { latitude: location.latitude, longitude: location.longitude },
      interests: cats,
      budget: 2500,
      duration: 'half-day',
      transport: 'walking',
      accessibility: [],
      priorities: ['proximity', 'culture'],
    }
  }, [mission, pinned, location])

  const { itinerary, receipt, scored } = useMemo(() => {
    if (!effectiveMission) return { itinerary: null as Itinerary | null, receipt: null, scored: [] }
    const live = allPlaces.filter((p) => !p.isDemo)
    const scored = live.map((p) => scorePlace(p, effectiveMission, reports))

    const base = buildItinerary(scored, effectiveMission)

    // Pinned places are honoured first and clearly marked.
    const pinnedStopIds = new Set(pinned.map((p) => p.id))
    const pinnedStops = pinned.map((place, idx) => {
      const s = scored.find((x) => x.place.id === place.id)
      return {
        order: idx + 1,
        place,
        distanceFromStartKm: s?.distanceKm ?? 0,
        legFromPrevKm: 0,
        legMinutes: 0,
        score: s?.score ?? 0,
        reasons: ['Added to your mission by hand', ...(s?.reasons ?? [])],
        caveats: s?.caveats ?? [],
      }
    })
    const rest = base.stops
      .filter((s) => !pinnedStopIds.has(s.place.id))
      .map((s, idx) => ({ ...s, order: pinnedStops.length + idx + 1 }))

    const merged: Itinerary = { ...base, stops: [...pinnedStops, ...rest] }
    const receipt = buildReceipt(effectiveMission, merged, reports, weather)
    return { itinerary: merged, receipt, scored }
  }, [effectiveMission, allPlaces, reports, weather, pinned])

  if (!effectiveMission || !itinerary || !receipt) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 text-center sm:px-6">
        <span className="grid h-14 w-14 place-items-center rounded-full bg-secondary mx-auto">
          <Compass className="h-7 w-7 text-ink-soft" />
        </span>
        <h1 className="mt-5 font-display text-3xl font-semibold text-ink">No City Mission yet</h1>
        <p className="mx-auto mt-3 max-w-md text-ink-soft">
          Plan a mission to get a personalised, explained itinerary — or add individual places to a mission from the Explore view.
        </p>
        <Button className="mt-6 bg-ink text-paper hover:bg-ink/90" onClick={onPlanAnother}>
          Plan a City Mission
        </Button>
      </div>
    )
  }

  const hours = DURATION_HOURS[effectiveMission.duration] ?? 4
  const travelTime = formatDuration(itinerary.totalMinutes)
  const topScored = [...scored].sort((a, b) => b.score - a.score).slice(0, 4)
  const plannedCats = new Set(itinerary.stops.map((s) => s.place.category))
  const unmetInterests = effectiveMission.interests.filter((i) => !plannedCats.has(i))

  return (
    <div className="mx-auto max-w-[1200px] space-y-8 px-4 py-8 sm:px-6">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-line pb-6">
        <div>
          <span className="text-[11px] uppercase tracking-[0.16em] text-ink-soft">City mission</span>
          <h1 className="mt-1 font-display text-3xl font-semibold text-ink sm:text-4xl">{effectiveMission.city}</h1>
          <p className="mt-2 max-w-2xl text-ink-soft">
            {itinerary.stops.length} stops · {formatDistance(itinerary.totalDistanceKm)} total · ~{travelTime} of travel by{' '}
            {effectiveMission.transport} within your {hours}h window.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onPlanAnother}>
            Plan another
          </Button>
          <Button
            className="bg-ink text-paper hover:bg-ink/90"
            onClick={() => {
              clearCompare()
              onPlanAnother()
            }}
          >
            Adjust preferences
          </Button>
        </div>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Budget', value: `₹${effectiveMission.budget.toLocaleString('en-IN')}`, hint: 'Given by you' },
          { label: 'Time window', value: `${hours} h`, hint: effectiveMission.duration },
          { label: 'Stops planned', value: String(itinerary.stops.length), hint: `${pinned.length} added by hand` },
          { label: 'Total travel', value: formatDistance(itinerary.totalDistanceKm), hint: `~${travelTime}` },
        ].map((s) => (
          <div key={s.label} className="border border-line bg-surface p-4">
            <div className="text-[11px] uppercase tracking-wide text-ink-soft">{s.label}</div>
            <div className="mt-1 font-display text-2xl font-semibold text-ink">{s.value}</div>
            <div className="text-xs text-ink-soft">{s.hint}</div>
          </div>
        ))}
      </div>

      {unmetInterests.length > 0 && (
        <div className="flex items-start gap-2 rounded-md border border-coral/40 bg-coral/10 p-3 text-sm text-ink">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-coral" />
          <span>
            No live stops matched these interests in {effectiveMission.city}: <strong>{unmetInterests.join(', ')}</strong>. The open
            data provider is currently rate-limiting category searches. Tick “Demo data” in Explore to see labelled sample places
            for those categories, or try again shortly.
          </span>
        </div>
      )}

      {itinerary.stops.length === 0 ? (
        <div className="border border-line bg-surface p-10 text-center">
          <AlertTriangle className="mx-auto h-8 w-8 text-coral" />
          <h2 className="mt-3 font-display text-xl font-semibold text-ink">No stops could be planned</h2>
          <p className="mx-auto mt-2 max-w-lg text-sm text-ink-soft">
            The live place data for {effectiveMission.city} did not contain stops within your {hours}h {effectiveMission.transport}{' '}
            window. Try a longer window, a faster transport mode, or a different city.
          </p>
        </div>
      ) : (
        <section>
          <h2 className="font-display text-2xl font-semibold text-ink">Suggested itinerary</h2>
          <p className="mt-1 text-sm text-ink-soft">
            Ordered to reduce travel from your start point. Each stop lists the reasons it matched your preferences.
          </p>

          <ol className="mt-5 space-y-0">
            {itinerary.stops.map((stop, idx) => (
              <li key={stop.place.id} className="relative flex gap-4 pb-6">
                <div className="flex flex-col items-center">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-ink font-display text-sm font-semibold text-paper">
                    {stop.order}
                  </span>
                  {idx < itinerary.stops.length - 1 && <span className="mt-1 w-px flex-1 bg-line" />}
                </div>

                <div className="min-w-0 flex-1 border border-line bg-surface p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-display text-lg font-semibold text-ink">{stop.place.name}</h3>
                        {pinned.some((p) => p.id === stop.place.id) && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-brand/25 px-2 py-0.5 text-[11px] font-medium text-ink">
                            <Pin className="h-3 w-3" /> Your pick
                          </span>
                        )}
                      </div>
                      <div className="mt-1.5 flex flex-wrap items-center gap-2">
                        <CategoryChip category={stop.place.category} />
                        <span className="inline-flex items-center gap-1 text-xs text-ink-soft">
                          <MapPin className="h-3 w-3" /> {formatDistance(stop.distanceFromStartKm)} from start
                        </span>
                        {idx > 0 && stop.legFromPrevKm > 0 && (
                          <span className="inline-flex items-center gap-1 text-xs text-ink-soft">
                            <Route className="h-3 w-3" /> {formatDistance(stop.legFromPrevKm)} · ~{stop.legMinutes} min
                          </span>
                        )}
                        <SourceTag place={stop.place} />
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="font-display text-2xl font-semibold text-ink">{stop.score}</div>
                      <div className="text-[10px] uppercase tracking-wide text-ink-soft">match</div>
                    </div>
                  </div>

                  <ul className="mt-3 space-y-1 text-sm text-ink-soft">
                    {stop.reasons.slice(0, 4).map((r) => (
                      <li key={r}>· {r}</li>
                    ))}
                  </ul>

                  {stop.caveats.length > 0 && (
                    <div className="mt-3 flex items-start gap-2 rounded border border-coral/30 bg-coral/10 p-2.5 text-xs text-ink">
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-coral" />
                      <span>{stop.caveats.slice(0, 2).join(' · ')}</span>
                    </div>
                  )}

                  {pinned.some((p) => p.id === stop.place.id) && (
                    <button onClick={() => unpinPlace(stop.place.id)} className="mt-3 text-xs text-ink-soft underline hover:text-ink">
                      Remove from mission
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="border border-line bg-surface p-5">
          <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-ink">
            <Wallet className="h-4 w-4" /> Budget guidance
          </h2>
          <p className="mt-2 text-sm text-ink-soft">
            Known paid-entry stops: <strong className="text-ink">{itinerary.knownCosts > 0 ? `₹${itinerary.knownCosts}` : 'none recorded'}</strong>
          </p>
          <ul className="mt-3 space-y-1.5 text-xs text-ink-soft">
            {itinerary.costNotes.map((n) => (
              <li key={n}>· {n}</li>
            ))}
          </ul>
        </section>

        <section className="border border-line bg-surface p-5">
          <h2 className="font-display text-lg font-semibold text-ink">Strongest matches</h2>
          <ul className="mt-3 space-y-2.5">
            {topScored.map((s) => (
              <li key={s.place.id} className="flex items-center justify-between gap-3 text-sm">
                <span className="min-w-0">
                  <span className="block truncate font-medium text-ink">{s.place.name}</span>
                  <span className="block text-xs text-ink-soft">
                    {s.place.category} · {formatDistance(s.distanceKm)}
                  </span>
                </span>
                <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-ink">{s.score}</span>
              </li>
            ))}
            {topScored.length === 0 && <li className="text-sm text-ink-soft">No live places were available to score.</li>}
          </ul>
        </section>
      </div>

      {itinerary.skipped.length > 0 && (
        <section className="border border-line bg-surface p-5">
          <h2 className="font-display text-lg font-semibold text-ink">Considered but not included</h2>
          <ul className="mt-3 divide-y divide-line">
            {itinerary.skipped.map((s) => (
              <li key={s.place.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                <span className="text-ink">{s.place.name}</span>
                <span className="text-xs text-ink-soft">{s.reason}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <DecisionReceipt receipt={receipt} />
    </div>
  )
}
