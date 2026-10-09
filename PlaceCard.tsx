import { Check, ExternalLink, MapPin, Plus } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/cn'
import { CATEGORIES, formatDistance, type Place } from '../lib/geo'

const CATEGORY_LABEL: Record<string, string> = Object.fromEntries(CATEGORIES.map((c) => [c.id, c.label]))
const CATEGORY_COLOR: Record<string, string> = Object.fromEntries(CATEGORIES.map((c) => [c.id, c.color]))

export function CategoryChip({ category, className }: { category: string; className?: string }) {
  return (
    <span
      className={cn('inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium', className)}
      style={{ backgroundColor: `${CATEGORY_COLOR[category] || '#334155'}14`, color: CATEGORY_COLOR[category] || '#334155' }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: CATEGORY_COLOR[category] || '#334155' }} />
      {CATEGORY_LABEL[category] || category}
    </span>
  )
}

export function SourceTag({ place }: { place: Place }) {
  const label = place.isDemo ? 'Demo dataset' : place.source
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide',
        place.isDemo ? 'border-ink-soft/30 bg-secondary text-ink-soft' : 'border-line bg-surface text-ink-soft',
      )}
    >
      {label}
    </span>
  )
}

interface Props {
  place: Place
  distanceKm?: number
  selected?: boolean
  inComparison?: boolean
  onOpen?: (p: Place) => void
  onToggleCompare?: (p: Place) => void
  onViewOnMap?: (p: Place) => void
  onAddToMission?: (p: Place) => void
}

export function PlaceCard({ place, distanceKm, selected, inComparison, onOpen, onToggleCompare, onViewOnMap, onAddToMission }: Props) {
  return (
    <article
      className={cn(
        'group cursor-pointer border-b border-line bg-surface p-4 transition-colors hover:bg-secondary/40',
        selected && 'bg-secondary/70',
      )}
      onClick={() => onOpen?.(place)}
    >
      <div className="flex gap-3">
        {place.imageUrl ? (
          <img
            src={place.imageUrl}
            alt=""
            loading="lazy"
            className="h-16 w-16 shrink-0 rounded-md object-cover"
            onError={(e) => {
              ;(e.currentTarget as HTMLImageElement).style.display = 'none'
            }}
          />
        ) : (
          <div
            className="grid h-16 w-16 shrink-0 place-items-center rounded-md"
            style={{ backgroundColor: `${CATEGORY_COLOR[place.category] || '#334155'}14` }}
            aria-hidden
          >
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: CATEGORY_COLOR[place.category] || '#334155' }} />
          </div>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-display text-[15px] font-semibold leading-snug text-ink">{place.name}</h3>
            {place.isDemo && <Badge variant="outline" className="shrink-0 border-ink-soft/40 text-[10px] text-ink-soft">DEMO</Badge>}
          </div>

          <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
            <CategoryChip category={place.category} />
            {distanceKm !== undefined && Number.isFinite(distanceKm) && (
              <span className="inline-flex items-center gap-1 text-[11px] text-ink-soft">
                <MapPin className="h-3 w-3" />
                {formatDistance(distanceKm)} from start
              </span>
            )}
            {place.openingHours && <span className="text-[11px] text-ink-soft">{place.openingHours}</span>}
          </div>

          {place.address && <p className="mt-1.5 line-clamp-1 text-xs text-ink-soft">{place.address}</p>}

          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <SourceTag place={place} />
            {place.fee === 'no' && (
              <span className="rounded border border-line bg-surface px-1.5 py-0.5 text-[10px] text-ink-soft">Free entry</span>
            )}
            {place.wheelchair === 'yes' && (
              <span className="rounded border border-line bg-surface px-1.5 py-0.5 text-[10px] text-ink-soft">Step-free</span>
            )}
            {place.cuisine && (
              <span className="rounded border border-line bg-surface px-1.5 py-0.5 text-[10px] text-ink-soft">
                {String(place.cuisine).split(';')[0]}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {onViewOnMap && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onViewOnMap(place)
            }}
            className="inline-flex items-center gap-1.5 rounded-md border border-line bg-surface px-2.5 py-1.5 text-xs font-medium text-ink transition-colors hover:border-ink hover:bg-secondary"
          >
            <MapPin className="h-3.5 w-3.5" />
            View on map
          </button>
        )}
        {onAddToMission && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onAddToMission(place)
            }}
            className="inline-flex items-center gap-1.5 rounded-md border border-line bg-surface px-2.5 py-1.5 text-xs font-medium text-ink transition-colors hover:border-ink hover:bg-secondary"
          >
            <Plus className="h-3.5 w-3.5" />
            Add to mission
          </button>
        )}
        <label
          className="ml-auto inline-flex cursor-pointer items-center gap-1.5 text-xs text-ink-soft"
          onClick={(e) => e.stopPropagation()}
        >
          <input
            type="checkbox"
            checked={Boolean(inComparison)}
            onChange={() => onToggleCompare?.(place)}
            className="h-3.5 w-3.5 accent-[oklch(0.9_0.19_118)]"
            aria-label={`Add ${place.name} to comparison`}
          />
          {inComparison ? <Check className="h-3.5 w-3.5 text-ink" /> : null}
          Compare
        </label>
        {place.sourceUrl && (
          <a
            href={place.sourceUrl}
            target="_blank"
            rel="noreferrer noopener"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1 text-xs text-ink-soft hover:text-ink"
          >
            <ExternalLink className="h-3 w-3" />
            Source
          </a>
        )}
      </div>
    </article>
  )
}
