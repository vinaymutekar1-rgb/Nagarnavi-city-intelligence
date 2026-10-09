import { useEffect, useRef, useState } from 'react'
import { Loader2, MapPin, Search, X } from 'lucide-react'
import { searchLocations, type SearchResult } from '../lib/geo'
import { useCity } from '../context/CityContext'
import { cn } from '@/lib/cn'

interface Props {
  variant?: 'nav' | 'hero'
  placeholder?: string
  autoFocusOnMount?: boolean
}

export function CitySearch({ variant = 'nav', placeholder = 'Search a city or area…', autoFocusOnMount }: Props) {
  const { setLocation, location } = useCity()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [active, setActive] = useState(0)
  const boxRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (autoFocusOnMount) inputRef.current?.focus()
  }, [autoFocusOnMount])

  // The selected location changed (e.g. via a quick-city button or geolocation):
  // clear any half-typed query so the box never shows a stale city.
  useEffect(() => {
    setQuery('')
    setResults([])
    setOpen(false)
  }, [location.name, location.latitude, location.longitude])

  useEffect(() => {
    const term = query.trim()
    if (term.length < 2) {
      setResults([])
      setError('')
      return
    }
    let cancelled = false
    setLoading(true)
    setOpen(true)
    const t = setTimeout(async () => {
      try {
        const res = await searchLocations(term, 6)
        if (cancelled) return
        setResults(res.results || [])
        setError('')
        setOpen(true)
        setActive(0)
      } catch (err) {
        if (cancelled) return
        setResults([])
        setError((err as Error).message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }, 380)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [query])

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const choose = (r: SearchResult) => {
    setLocation({
      name: r.name || r.displayName.split(',')[0],
      latitude: r.latitude,
      longitude: r.longitude,
      zoom: r.type === 'city' || r.type === 'administrative' ? 12 : 15,
      origin: 'search',
      detail: r.displayName,
    })
    setQuery('')
    setResults([])
    setOpen(false)
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open || results.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((a) => Math.min(a + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((a) => Math.max(a - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      choose(results[active])
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <div ref={boxRef} className={cn('relative', variant === 'hero' ? 'w-full' : 'w-full max-w-xs')}>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          aria-label="Search for a city or area"
          aria-expanded={open}
          role="combobox"
          aria-controls="city-search-results"
          className={cn(
            'w-full rounded-md border border-line bg-surface pl-9 pr-8 text-sm text-ink placeholder:text-ink-soft/70',
            'focus:border-ink focus:outline-none focus:ring-2 focus:ring-brand/60',
            variant === 'hero' ? 'h-12 text-base' : 'h-10',
          )}
        />
        {loading && <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-ink-soft" />}
        {!loading && query && (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => {
              setQuery('')
              setResults([])
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-soft hover:text-ink"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {open && (loading || results.length > 0 || error) && (
        <div
          id="city-search-results"
          role="listbox"
          className="absolute z-[1000] mt-2 w-full overflow-hidden rounded-lg border border-line bg-surface shadow-xl shadow-ink/10"
        >
          {loading && results.length === 0 && (
            <div className="flex items-center gap-2 px-3 py-3 text-sm text-ink-soft">
              <Loader2 className="h-4 w-4 animate-spin" /> Searching OpenStreetMap…
            </div>
          )}
          {error && (
            <div className="px-3 py-3 text-sm text-coral">
              Search unavailable: {error}
              <div className="mt-1 text-xs text-ink-soft">
                The geocoding provider may be rate-limiting. Try again in a moment, or use a quick city button.
              </div>
            </div>
          )}
          {!loading && !error && query.trim().length >= 2 && results.length === 0 && (
            <div className="px-3 py-3 text-sm text-ink-soft">No matching place found for “{query}”.</div>
          )}
          {results.map((r, i) => (
            <button
              key={r.id}
              role="option"
              aria-selected={i === active}
              onMouseEnter={() => setActive(i)}
              onClick={() => choose(r)}
              className={cn(
                'flex w-full items-start gap-3 px-3 py-2.5 text-left transition-colors',
                i === active ? 'bg-secondary' : 'bg-surface hover:bg-secondary/60',
              )}
            >
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-ink-soft" />
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-ink">{r.name}</span>
                <span className="block truncate text-xs text-ink-soft">{r.displayName}</span>
              </span>
            </button>
          ))}
          <div className="border-t border-line bg-secondary/40 px-3 py-1.5 text-[11px] text-ink-soft">
            Search by OpenStreetMap Nominatim
          </div>
        </div>
      )}
    </div>
  )
}
