import { useEffect, useMemo, useState } from 'react'
import { BookOpen, ExternalLink, Footprints, Landmark, Loader2, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ConditionsCard } from './ConditionsCard'
import { CategoryChip, SourceTag } from './PlaceCard'
import { useCity } from '../context/CityContext'
import { fetchWiki, formatDistance, haversineKm, type Place, type WikiArticle } from '../lib/geo'
import { cn } from '@/lib/cn'

interface Props {
  onAddToMission: (p: Place) => void
  onPlanMission: (interests: Place['category'][]) => void
}

/** Deterministic heritage trails: heritage stops chained by proximity (< 3 km legs). */
function buildTrails(heritage: Place[]): Place[][] {
  const remaining = [...heritage]
  const trails: Place[][] = []
  while (remaining.length > 0) {
    const trail: Place[] = [remaining.shift()!]
    let extended = true
    while (extended && trail.length < 5) {
      extended = false
      const last = trail[trail.length - 1]
      let bestIdx = -1
      let bestDist = 3
      remaining.forEach((p, i) => {
        const d = haversineKm(last, p)
        if (d < bestDist) {
          bestDist = d
          bestIdx = i
        }
      })
      if (bestIdx >= 0) {
        trail.push(remaining.splice(bestIdx, 1)[0])
        extended = true
      }
    }
    trails.push(trail)
  }
  return trails.filter((t) => t.length >= 2).slice(0, 4)
}

export function CultureView({ onAddToMission, onPlanMission }: Props) {
  const { allPlaces, location, loadingPlaces, warming } = useCity()
  const [selected, setSelected] = useState<Place | null>(null)
  const [article, setArticle] = useState<WikiArticle | null>(null)
  const [loadingArticle, setLoadingArticle] = useState(false)
  const [articleError, setArticleError] = useState('')

  const heritage = useMemo(
    () => allPlaces.filter((p) => !p.isDemo && (p.category === 'heritage' || p.category === 'attraction')),
    [allPlaces],
  )
  const heritageSites = useMemo(() => allPlaces.filter((p) => !p.isDemo && p.category === 'heritage'), [allPlaces])
  const trails = useMemo(() => buildTrails(heritageSites), [heritageSites])

  useEffect(() => {
    setArticle(null)
    setArticleError('')
    if (!selected?.wikipedia) return
    const title = decodeURIComponent(selected.wikipedia.split('/wiki/')[1] || '')
    if (!title) return
    let cancelled = false
    setLoadingArticle(true)
    fetchWiki(title)
      .then((res) => !cancelled && setArticle(res.article))
      .catch((err: Error) => !cancelled && setArticleError(err.message))
      .finally(() => !cancelled && setLoadingArticle(false))
    return () => {
      cancelled = true
    }
  }, [selected?.id, selected?.wikipedia])

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-8 sm:px-6">
      <header className="border-b border-line pb-6">
        <span className="text-[11px] uppercase tracking-[0.16em] text-ink-soft">Culture & heritage</span>
        <h1 className="mt-1 font-display text-3xl font-semibold text-ink sm:text-4xl">Understand {location.name}</h1>
        <p className="mt-2 max-w-2xl text-ink-soft">
          Sourced historical context and notable places, drawn from Wikipedia and OpenStreetMap. Every description links to its
          source — nothing is written by us.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button className="gap-2 bg-ink text-paper hover:bg-ink/90" onClick={() => onPlanMission(['heritage', 'attraction'])}>
            <Landmark className="h-4 w-4" /> Build a culture mission
          </Button>
        </div>
      </header>

      {(loadingPlaces || warming) && (
        <div className="mt-4 inline-flex items-center gap-2 text-sm text-ink-soft">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading heritage places…
        </div>
      )}

      <div className="mt-8 grid gap-8 lg:grid-cols-[1.6fr_1fr]">
        <div className="space-y-8">
          {trails.length > 0 && (
            <section>
              <h2 className="flex items-center gap-2 font-display text-2xl font-semibold text-ink">
                <Footprints className="h-5 w-5" /> Suggested heritage walks
              </h2>
              <p className="mt-1 text-sm text-ink-soft">
                Chained automatically from heritage places within 3 km of each other. Distances are straight-line estimates.
              </p>
              <div className="mt-4 space-y-4">
                {trails.map((trail, i) => {
                  let total = 0
                  for (let j = 1; j < trail.length; j++) total += haversineKm(trail[j - 1], trail[j])
                  return (
                    <article key={i} className="border border-line bg-surface p-5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h3 className="font-display text-lg font-semibold text-ink">
                          Walk {i + 1} · {trail.length} stops
                        </h3>
                        <span className="text-xs text-ink-soft">≈ {formatDistance(total)} walking</span>
                      </div>
                      <ol className="mt-3 space-y-2">
                        {trail.map((p, idx) => (
                          <li key={p.id} className="flex items-center gap-3 text-sm">
                            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-secondary text-xs font-medium text-ink">
                              {idx + 1}
                            </span>
                            <span className="min-w-0 flex-1 truncate text-ink">{p.name}</span>
                            <span className="shrink-0 text-xs text-ink-soft">{formatDistance(haversineKm(location, p))}</span>
                            <button
                              onClick={() => onAddToMission(p)}
                              className="shrink-0 rounded border border-line p-1 text-ink-soft hover:border-ink hover:text-ink"
                              aria-label={`Add ${p.name} to mission`}
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </button>
                          </li>
                        ))}
                      </ol>
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-3"
                        onClick={() => {
                          trail.forEach(onAddToMission)
                        }}
                      >
                        Add whole walk to mission
                      </Button>
                    </article>
                  )
                })}
              </div>
            </section>
          )}

          <section>
            <h2 className="font-display text-2xl font-semibold text-ink">
              Heritage & notable places <span className="text-base font-normal text-ink-soft">({heritage.length})</span>
            </h2>
            {heritage.length === 0 && !loadingPlaces ? (
              <p className="mt-3 text-sm text-ink-soft">
                No heritage places were returned for {location.name}. Try another city, or enable demo data in Explore.
              </p>
            ) : (
              <ul className="mt-4 divide-y divide-line border border-line bg-surface">
                {heritage.slice(0, 40).map((p) => (
                  <li key={p.id}>
                    <button
                      onClick={() => setSelected(p)}
                      className={cn(
                        'flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-secondary/50',
                        selected?.id === p.id && 'bg-secondary',
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium text-ink">{p.name}</div>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          <CategoryChip category={p.category} />
                          <span className="text-xs text-ink-soft">{formatDistance(haversineKm(location, p))} from centre</span>
                          <SourceTag place={p} />
                        </div>
                      </div>
                      <ExternalLink className="h-4 w-4 shrink-0 text-ink-soft" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <div className="space-y-6 lg:sticky lg:top-20 lg:self-start">
          <section className="border border-line bg-surface p-5">
            <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-ink">
              <BookOpen className="h-4 w-4" /> Cultural context
            </h2>
            {!selected && <p className="mt-2 text-sm text-ink-soft">Select a place to load its sourced historical summary.</p>}
            {selected && (
              <>
                <div className="mt-3">
                  <CategoryChip category={selected.category} />
                  <h3 className="mt-2 font-display text-xl font-semibold text-ink">{selected.name}</h3>
                  {selected.heritageType && <p className="text-xs text-ink-soft">Designation: {String(selected.heritageType).replace(/_/g, ' ')}</p>}
                </div>
                {loadingArticle && (
                  <div className="mt-3 flex items-center gap-2 text-sm text-ink-soft">
                    <Loader2 className="h-4 w-4 animate-spin" /> Loading Wikipedia summary…
                  </div>
                )}
                {articleError && (
                  <p className="mt-3 rounded-md border border-coral/40 bg-coral/10 p-3 text-xs text-ink">
                    Could not load the article: {articleError}
                  </p>
                )}
                {article?.thumbnail && <img src={article.thumbnail} alt="" className="mt-3 w-full rounded-md object-cover" />}
                {article && (
                  <>
                    {article.description && <p className="mt-2 text-xs font-medium text-ink-soft">{article.description}</p>}
                    <p className="mt-2 text-sm leading-relaxed text-ink">{article.extract}</p>
                    {article.url && (
                      <a
                        href={article.url}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-ink underline underline-offset-2"
                      >
                        Read on Wikipedia <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </>
                )}
                {!selected.wikipedia && !loadingArticle && (
                  <p className="mt-3 text-sm text-ink-soft">
                    No Wikipedia article is linked in the OpenStreetMap record for this place, so we show no history rather than
                    inventing one.
                  </p>
                )}
                <Button variant="outline" className="mt-4 w-full gap-2" onClick={() => onAddToMission(selected)}>
                  <Plus className="h-4 w-4" /> Add to mission
                </Button>
              </>
            )}
          </section>

          <ConditionsCard />
        </div>
      </div>
    </div>
  )
}
