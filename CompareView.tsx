import { useMemo, useState } from 'react'
import { Check, Info, Scale, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CategoryChip, SourceTag } from './PlaceCard'
import { useCity } from '../context/CityContext'
import { formatDistance, haversineKm } from '../lib/geo'
import { COMPARE_METRICS, comparePlaces, type Mission } from '../lib/recommend'
import { cn } from '@/lib/cn'

export function CompareView({ onGoExplore }: { onGoExplore: () => void }) {
  const { allPlaces, comparison, toggleCompare, clearCompare, mission, location } = useCity()
  const [weights, setWeights] = useState<Record<string, number>>({})

  const places = useMemo(() => allPlaces.filter((p) => comparison.includes(p.id)), [allPlaces, comparison])

  const effectiveMission: Mission = useMemo(
    () =>
      mission ?? {
        city: location.name,
        startLabel: `${location.name} centre`,
        start: { latitude: location.latitude, longitude: location.longitude },
        interests: ['attraction', 'heritage', 'restaurant', 'park', 'market', 'hotel'],
        budget: 2500,
        duration: 'half-day',
        transport: 'walking',
        accessibility: [],
        priorities: ['proximity'],
      },
    [mission, location],
  )

  const rows = useMemo(() => comparePlaces(places, effectiveMission, weights), [places, effectiveMission, weights])

  const best = rows[0]
  const worst = rows.length > 1 ? rows[rows.length - 1] : null

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-8 sm:px-6">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-line pb-6">
        <div>
          <span className="text-[11px] uppercase tracking-[0.16em] text-ink-soft">Place face-off</span>
          <h1 className="mt-1 font-display text-3xl font-semibold text-ink sm:text-4xl">Compare places for your preferences</h1>
          <p className="mt-2 max-w-2xl text-ink-soft">
            Weighted, transparent comparison. Missing data is shown as “No data” and is never scored as zero or treated as a
            negative.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onGoExplore}>
            Add places
          </Button>
          {places.length > 0 && (
            <Button variant="outline" onClick={clearCompare}>
              Clear selection
            </Button>
          )}
        </div>
      </header>

      {places.length < 2 ? (
        <div className="mt-10 border border-dashed border-line bg-surface p-10 text-center">
          <Scale className="mx-auto h-9 w-9 text-ink-soft" />
          <h2 className="mt-3 font-display text-xl font-semibold text-ink">Select two or more places</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-ink-soft">
            Tick “Compare” on any place card in Explore, or use the Compare button inside a place's details.
          </p>
          {places.length === 1 && (
            <p className="mt-3 text-sm text-ink">
              Currently selected: <strong>{places[0].name}</strong>
            </p>
          )}
          <Button className="mt-5 bg-ink text-paper hover:bg-ink/90" onClick={onGoExplore}>
            Go to Explore
          </Button>
        </div>
      ) : (
        <>
          <div className="mt-6 flex flex-wrap gap-2">
            {places.map((p) => (
              <span key={p.id} className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1.5 text-sm">
                <CategoryChip category={p.category} />
                <span className="font-medium text-ink">{p.name}</span>
                <button onClick={() => toggleCompare(p.id)} aria-label={`Remove ${p.name}`}>
                  <X className="h-3.5 w-3.5 text-ink-soft hover:text-coral" />
                </button>
              </span>
            ))}
          </div>

          {/* weights */}
          <section className="mt-6 border border-line bg-surface p-5">
            <h2 className="font-display text-lg font-semibold text-ink">How much do these matter to you?</h2>
            <p className="mt-1 text-xs text-ink-soft">Change the weights and watch the ranking respond immediately.</p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {COMPARE_METRICS.map((m) => {
                const w = weights[m.id] ?? 1
                return (
                  <div key={m.id}>
                    <div className="flex items-center justify-between text-sm">
                      <label htmlFor={`w-${m.id}`} className="text-ink">
                        {m.label}
                      </label>
                      <span className="text-xs text-ink-soft">{w.toFixed(1)}×</span>
                    </div>
                    <input
                      id={`w-${m.id}`}
                      type="range"
                      min={0}
                      max={3}
                      step={0.5}
                      value={w}
                      onChange={(e) => setWeights((prev) => ({ ...prev, [m.id]: Number(e.target.value) }))}
                      className="mt-2 w-full accent-[oklch(0.9_0.19_118)]"
                    />
                  </div>
                )
              })}
            </div>
          </section>

          {best && (
            <section className="mt-6 grid gap-4 lg:grid-cols-2">
              <div className="border border-brand/60 bg-brand/10 p-5">
                <div className="text-[11px] uppercase tracking-wide text-ink-soft">Best match for your preferences</div>
                <h3 className="mt-1 font-display text-2xl font-semibold text-ink">{best.place.name}</h3>
                <p className="mt-1 text-sm text-ink-soft">
                  Weighted score {best.total !== null ? best.total.toFixed(1) : '—'}/100 across {COMPARE_METRICS.length} metrics
                  {best.missing.length > 0 ? ` · ${best.missing.length} metric(s) had no data` : ''}.
                </p>
                <p className="mt-2 text-xs text-ink-soft">
                  Distance from start: {formatDistance(haversineKm(effectiveMission.start, best.place))}
                </p>
              </div>
              {worst && (
                <div className="border border-coral/40 bg-coral/10 p-5">
                  <div className="text-[11px] uppercase tracking-wide text-ink-soft">Needs further checking</div>
                  <h3 className="mt-1 font-display text-2xl font-semibold text-ink">{worst.place.name}</h3>
                  <p className="mt-1 text-sm text-ink-soft">
                    Scores lower against your current weights{worst.missing.length > 0 ? `, and ${worst.missing.length} metric(s) are missing data` : ''}.
                    This is a preference ranking — not a claim that the place is bad.
                  </p>
                  <p className="mt-2 text-xs text-ink-soft">
                    Distance from start: {formatDistance(haversineKm(effectiveMission.start, worst.place))}
                  </p>
                </div>
              )}
            </section>
          )}

          {/* comparison table */}
          <section className="mt-6 overflow-x-auto border border-line bg-surface">
            <table className="w-full min-w-[720px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-line bg-paper">
                  <th className="p-3 text-left font-medium text-ink-soft">Metric</th>
                  {rows.map((r) => (
                    <th key={r.place.id} className="p-3 text-left align-top">
                      <div className="font-display text-base font-semibold text-ink">{r.place.name}</div>
                      <div className="mt-1 flex items-center gap-2">
                        <CategoryChip category={r.place.category} />
                        <SourceTag place={r.place} />
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {COMPARE_METRICS.map((m, mi) => (
                  <tr key={m.id} className={cn('border-b border-line', mi % 2 ? 'bg-paper/60' : 'bg-surface')}>
                    <td className="p-3 align-top">
                      <div className="font-medium text-ink">{m.label}</div>
                      <div className="text-[11px] text-ink-soft">weight {(weights[m.id] ?? 1).toFixed(1)}×</div>
                    </td>
                    {rows.map((r) => {
                      const cell = r.metrics.find((x) => x.id === m.id)!
                      return (
                        <td key={r.place.id} className="p-3 align-top">
                          <div className={cn('font-medium', cell.value === null ? 'text-ink-soft italic' : 'text-ink')}>{cell.display}</div>
                          <div className="text-[11px] text-ink-soft">{cell.note}</div>
                        </td>
                      )
                    })}
                  </tr>
                ))}
                <tr className="bg-ink text-paper">
                  <td className="p-3 font-medium">Weighted score</td>
                  {rows.map((r) => (
                    <td key={r.place.id} className="p-3 font-display text-xl font-semibold">
                      {r.total !== null ? r.total.toFixed(1) : '—'}
                      {r.total === null && <span className="ml-1 text-xs font-normal text-paper/70">no data</span>}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </section>

          <div className="mt-4 flex items-start gap-2 rounded-md border border-line bg-secondary/50 p-3 text-xs text-ink-soft">
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              Two metrics always read “No data” in this build: source ratings and cleanliness — no ratings provider is connected
              and no cleanliness dataset exists for these places. We show them as unavailable rather than guessing. Entry cost uses
              the OpenStreetMap <code>fee</code> tag only; we never invent prices.
            </span>
          </div>

          {/* why */}
          <section className="mt-6 border border-line bg-surface p-5">
            <h2 className="font-display text-lg font-semibold text-ink">Why this result?</h2>
            {best && (
              <ul className="mt-3 space-y-1.5 text-sm text-ink-soft">
                <li className="flex items-start gap-2">
                  <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink" />
                  <span>
                    <strong className="text-ink">{best.place.name}</strong> leads because its available metrics score highest under
                    your current weights.
                  </span>
                </li>
                {best.missing.length > 0 && (
                  <li className="flex items-start gap-2">
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink" />
                    <span>It has no data for: {best.missing.join(', ')} — excluded from the average, not scored as zero.</span>
                  </li>
                )}
                <li className="flex items-start gap-2">
                  <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink" />
                  <span>Distance and travel are straight-line estimates from your start point, not routed distances.</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink" />
                  <span>
                    If two places are very similar, the order may not change when you move a weight — the scores still update, and
                    identical scores are shown to one decimal so you can see how close they are.
                  </span>
                </li>
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  )
}
