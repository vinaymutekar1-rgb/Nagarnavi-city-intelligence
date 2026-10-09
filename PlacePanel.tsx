import { useEffect, useState } from 'react'
import { Accessibility, Clock, ExternalLink, Loader2, Navigation, Plus, Route, Star, Wallet, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { fetchWiki, formatDistance, type Place, type WikiArticle } from '../lib/geo'
import { CategoryChip, SourceTag } from './PlaceCard'
import { cn } from '@/lib/cn'

interface Props {
  place: Place | null
  distanceKm?: number
  inComparison?: boolean
  onClose: () => void
  onToggleCompare: (p: Place) => void
  onAddToMission: (p: Place) => void
  start?: { latitude: number; longitude: number } | null
}

function Row({ icon: Icon, label, value, muted }: { icon: typeof Clock; label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex items-start gap-2.5 py-2">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-ink-soft" />
      <div className="min-w-0">
        <div className="text-[11px] uppercase tracking-wide text-ink-soft">{label}</div>
        <div className={cn('text-sm', muted ? 'text-ink-soft' : 'text-ink')}>{value}</div>
      </div>
    </div>
  )
}

export function PlacePanel({ place, distanceKm, inComparison, onClose, onToggleCompare, onAddToMission, start }: Props) {
  const [article, setArticle] = useState<WikiArticle | null>(null)
  const [loadingArticle, setLoadingArticle] = useState(false)
  const [articleError, setArticleError] = useState('')

  useEffect(() => {
    setArticle(null)
    setArticleError('')
    if (!place?.wikipedia) return
    const title = decodeURIComponent(place.wikipedia.split('/wiki/')[1] || '')
    if (!title) return
    let cancelled = false
    setLoadingArticle(true)
    fetchWiki(title)
      .then((res) => {
        if (!cancelled) setArticle(res.article)
      })
      .catch((err: Error) => {
        if (!cancelled) setArticleError(err.message)
      })
      .finally(() => {
        if (!cancelled) setLoadingArticle(false)
      })
    return () => {
      cancelled = true
    }
  }, [place?.id, place?.wikipedia])

  if (!place) return null

  const directionsUrl =
    start && Number.isFinite(start.latitude)
      ? `https://www.openstreetmap.org/directions?engine=fossgis_osrm_foot&route=${start.latitude}%2C${start.longitude}%3B${place.latitude}%2C${place.longitude}`
      : null

  return (
    <aside className="flex h-full flex-col overflow-hidden border-l border-line bg-surface" aria-label="Place details">
      <div className="flex items-start justify-between gap-2 border-b border-line p-4">
        <div className="min-w-0">
          <CategoryChip category={place.category} />
          <h2 className="mt-2 font-display text-xl font-semibold leading-tight text-ink">{place.name}</h2>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close details">
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="nagar-scroll flex-1 overflow-y-auto p-4">
        {article?.thumbnail && (
          <img src={article.thumbnail} alt="" className="mb-3 max-h-44 w-full rounded-md object-cover" />
        )}

        <div className="divide-y divide-line">
          <Row
            icon={Route}
            label="Distance from start"
            value={distanceKm !== undefined && Number.isFinite(distanceKm) ? `${formatDistance(distanceKm)} (straight line)` : 'Set a start point to measure'}
            muted={distanceKm === undefined}
          />
          <Row icon={Clock} label="Opening hours" value={place.openingHours || 'Not published in source data'} muted={!place.openingHours} />
          <Row
            icon={Wallet}
            label="Entry cost"
            value={place.fee === 'no' ? 'Free entry (OSM fee tag)' : place.fee === 'yes' ? 'Paid entry — amount not published' : 'Not recorded'}
            muted={!place.fee}
          />
          <Row
            icon={Accessibility}
            label="Accessibility"
            value={
              place.wheelchair === 'yes'
                ? 'Wheelchair accessible (OSM)'
                : place.wheelchair === 'limited'
                  ? 'Partially accessible (OSM)'
                  : 'Not recorded in OpenStreetMap'
            }
            muted={!place.wheelchair}
          />
          <Row icon={Star} label="Rating" value="No ratings source connected — not invented" muted />
          <Row icon={Navigation} label="Coordinates" value={`${place.latitude.toFixed(5)}, ${place.longitude.toFixed(5)}`} />
          {place.address && <Row icon={Navigation} label="Address" value={place.address} />}
        </div>

        {loadingArticle && (
          <div className="mt-4 flex items-center gap-2 text-sm text-ink-soft">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading sourced article…
          </div>
        )}
        {articleError && <div className="mt-4 rounded-md border border-coral/40 bg-coral/10 p-3 text-xs text-ink">Wikipedia: {articleError}</div>}
        {article && (
          <div className="mt-5 rounded-md border border-line bg-paper p-3.5">
            <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-ink-soft">
              <ExternalLink className="h-3.5 w-3.5" /> Culture & context · Wikipedia
            </div>
            {article.description && <p className="mt-1.5 text-xs font-medium text-ink-soft">{article.description}</p>}
            <p className="mt-2 text-sm leading-relaxed text-ink">{article.extract}</p>
            {article.url && (
              <a href={article.url} target="_blank" rel="noreferrer noopener" className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-ink underline underline-offset-2">
                Read the full article <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
        )}

        <div className="mt-4 flex items-center gap-2">
          <SourceTag place={place} />
          {place.sourceUrl && (
            <a href={place.sourceUrl} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 text-xs text-ink-soft hover:text-ink">
              Open in OpenStreetMap <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>

        <p className="mt-3 text-[11px] leading-relaxed text-ink-soft">
          Privacy note: coordinates come from the public source above. We do not store your precise location.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2 border-t border-line p-4">
        <Button variant="outline" className="gap-2" onClick={() => onAddToMission(place)}>
          <Plus className="h-4 w-4" /> Add to mission
        </Button>
        <Button
          variant={inComparison ? 'default' : 'outline'}
          className={cn('gap-2', inComparison && 'bg-ink text-paper hover:bg-ink/90')}
          onClick={() => onToggleCompare(place)}
        >
          {inComparison ? 'In comparison' : 'Compare'}
        </Button>
        {directionsUrl ? (
          <a
            href={directionsUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="col-span-2 inline-flex items-center justify-center gap-2 rounded-md border border-line bg-surface px-3 py-2 text-sm font-medium text-ink transition-colors hover:bg-secondary"
          >
            <Navigation className="h-4 w-4" /> Open walking directions (OpenStreetMap)
          </a>
        ) : (
          <div className="col-span-2 rounded-md border border-dashed border-line p-2 text-center text-[11px] text-ink-soft">
            Set a starting point to get directions
          </div>
        )}
      </div>
    </aside>
  )
}
