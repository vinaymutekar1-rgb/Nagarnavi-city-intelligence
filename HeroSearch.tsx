import { useState } from 'react'
import { ChevronDown, Loader2, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CitySearch } from './CitySearch'
import { useCity } from '../context/CityContext'
import { CATEGORIES, searchLocations, type Category, type Transport } from '../lib/geo'
import { type Mission, type Priority } from '../lib/recommend'
import { cn } from '@/lib/cn'

const POPULAR = ['Pune', 'Mumbai', 'Delhi', 'Bengaluru', 'Hyderabad', 'Jaipur']

const PRIORITIES: { id: Priority; label: string }[] = [
  { id: 'affordability', label: 'Affordability' },
  { id: 'culture', label: 'Cultural value' },
  { id: 'proximity', label: 'Proximity' },
  { id: 'accessibility', label: 'Accessibility' },
  { id: 'safety', label: 'Fewer reported concerns' },
  { id: 'cleanliness', label: 'Cleanliness info' },
]

const ACCESS_NEEDS = ['Step-free access', 'Mobility support', 'Audio guidance', 'Visual assistance']

const TRANSPORTS: { id: Transport; label: string }[] = [
  { id: 'walking', label: 'Walking' },
  { id: 'cycling', label: 'Cycling' },
  { id: 'driving', label: 'Driving' },
  { id: 'transit', label: 'Public transport' },
]

interface Props {
  onCreate: (mission: Mission) => void
  initialInterests?: Category[]
}

export function HeroSearch({ onCreate, initialInterests }: Props) {
  const { location, setLocation, locateMe, locateStatus } = useCity()
  const [startLabel, setStartLabel] = useState('')
  const [interests, setInterests] = useState<Category[]>(initialInterests ?? ['heritage', 'restaurant'])
  const [budget, setBudget] = useState(2500)
  const [duration, setDuration] = useState('half-day')
  const [transport, setTransport] = useState<Transport>('walking')
  const [accessNeeds, setAccessNeeds] = useState<string[]>([])
  const [priorities, setPriorities] = useState<Priority[]>(['culture', 'proximity'])
  const [advanced, setAdvanced] = useState(false)
  const [date, setDate] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const toggle = <T,>(list: T[], value: T, setter: (v: T[]) => void, max?: number) => {
    if (list.includes(value)) setter(list.filter((v) => v !== value))
    else if (!max || list.length < max) setter([...list, value])
  }

  const quickCity = async (name: string) => {
    try {
      const res = await searchLocations(name, 1)
      if (res.results[0]) {
        const r = res.results[0]
        setLocation({ name: r.name, latitude: r.latitude, longitude: r.longitude, zoom: 12, origin: 'search', detail: r.displayName })
      }
    } catch {
      setError('Could not load that city right now.')
    }
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (interests.length === 0) {
      setError('Pick at least one interest so we can match places.')
      return
    }
    setBusy(true)
    let start = { latitude: location.latitude, longitude: location.longitude }
    let startName = `${location.name} centre`

    if (startLabel.trim().length > 2) {
      try {
        const res = await searchLocations(startLabel.trim(), 1)
        if (res.results[0]) {
          start = { latitude: res.results[0].latitude, longitude: res.results[0].longitude }
          startName = res.results[0].name || res.results[0].displayName.split(',')[0]
        } else {
          setError(`Couldn't find "${startLabel}". Using the city centre instead.`)
        }
      } catch {
        setError(`Couldn't look up "${startLabel}". Using the city centre instead.`)
      }
    }

    onCreate({
      city: location.name,
      startLabel: startName,
      start,
      interests,
      budget,
      duration,
      transport,
      accessibility: accessNeeds,
      priorities,
      date: date || undefined,
    })
    setBusy(false)
  }

  return (
    <section className="relative overflow-hidden bg-paper">
      <div className="mx-auto grid max-w-[1600px] gap-10 px-4 pb-12 pt-12 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:gap-16 lg:pt-16">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-[11px] font-medium uppercase tracking-[0.16em] text-ink-soft">
            <Sparkles className="h-3.5 w-3.5" /> City intelligence engine
          </span>
          <h1 className="mt-5 font-display text-[2.6rem] font-semibold leading-[1.05] tracking-tight text-ink sm:text-6xl">
            Your City.
            <br />
            <span className="relative inline-block">
              Better Explored.
              <span className="absolute -bottom-1 left-0 h-1.5 w-full rounded-full bg-brand" aria-hidden />
            </span>
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-ink-soft">
            Find places worth visiting, plan smarter routes, and understand your surroundings — using live OpenStreetMap data,
            sourced culture, real weather and community reports.
          </p>

          <dl className="mt-9 grid max-w-xl grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-3">
            {[
              { k: 'Open data', v: 'OpenStreetMap + Wikipedia' },
              { k: 'Live weather', v: 'Open-Meteo forecast' },
              { k: 'Transparent', v: 'Every score explained' },
            ].map((s) => (
              <div key={s.k}>
                <dt className="text-[11px] uppercase tracking-wide text-ink-soft">{s.k}</dt>
                <dd className="mt-1 text-sm font-medium text-ink">{s.v}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-8">
            <div className="text-[11px] uppercase tracking-wide text-ink-soft">Try a city</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {POPULAR.map((c) => (
                <button
                  key={c}
                  onClick={() => quickCity(c)}
                  className={cn(
                    'rounded-full border px-3 py-1.5 text-sm transition-colors',
                    location.name.toLowerCase().includes(c.toLowerCase())
                      ? 'border-ink bg-ink text-paper'
                      : 'border-line bg-surface text-ink hover:border-ink',
                  )}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
        </div>

        <form
          onSubmit={submit}
          className="rounded-xl border border-line bg-surface p-5 shadow-[0_30px_70px_-50px_rgba(13,27,42,0.5)] sm:p-7"
        >
          <h2 className="font-display text-2xl font-semibold text-ink">Plan a City Mission</h2>
          <p className="mt-1 text-sm text-ink-soft">
            Currently exploring <strong className="text-ink">{location.name}</strong>
            {location.detail ? ` · ${location.detail.split(',').slice(0, 2).join(',')}` : ''}
          </p>

          <div className="mt-5 space-y-5">
            <div className="space-y-2">
              <Label>City or locality</Label>
              <CitySearch variant="hero" placeholder={`Search a city (currently ${location.name})`} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="start">Starting point</Label>
              <div className="flex gap-2">
                <Input
                  id="start"
                  value={startLabel}
                  onChange={(e) => setStartLabel(e.target.value)}
                  placeholder={`Blank = ${location.name} centre`}
                />
                <Button type="button" variant="outline" onClick={locateMe} disabled={locateStatus === 'requesting'} className="shrink-0 gap-2">
                  {locateStatus === 'requesting' ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {locateStatus === 'granted' ? 'Located' : 'Locate me'}
                </Button>
              </div>
              {locateStatus === 'denied' && (
                <p className="text-xs text-coral">Location permission was denied — search for a city or type a starting point instead.</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Interests</Label>
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map((c) => (
                  <button
                    type="button"
                    key={c.id}
                    onClick={() => toggle(interests, c.id, setInterests)}
                    aria-pressed={interests.includes(c.id)}
                    className={cn(
                      'rounded-full border px-3 py-1.5 text-sm transition-colors',
                      interests.includes(c.id) ? 'border-ink bg-ink text-paper' : 'border-line bg-surface text-ink hover:border-ink',
                    )}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="budget">Budget (₹)</Label>
                <Input
                  id="budget"
                  type="number"
                  min={0}
                  step={250}
                  value={budget}
                  onChange={(e) => setBudget(Math.max(0, Number(e.target.value)))}
                />
              </div>
              <div className="space-y-2">
                <Label>Available time</Label>
                <Select value={duration} onValueChange={setDuration}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="2hours">2 hours</SelectItem>
                    <SelectItem value="half-day">Half day</SelectItem>
                    <SelectItem value="full-day">Full day</SelectItem>
                    <SelectItem value="weekend">Weekend</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Transport mode</Label>
                <Select value={transport} onValueChange={(v) => setTransport(v as Transport)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TRANSPORTS.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Priorities (max 3)</Label>
                <div className="flex flex-wrap gap-1.5">
                  {PRIORITIES.map((p) => (
                    <button
                      type="button"
                      key={p.id}
                      onClick={() => toggle(priorities, p.id, setPriorities, 3)}
                      aria-pressed={priorities.includes(p.id)}
                      className={cn(
                        'rounded-full border px-2.5 py-1 text-xs transition-colors',
                        priorities.includes(p.id)
                          ? 'border-ink bg-ink text-paper'
                          : 'border-line bg-surface text-ink-soft hover:border-ink',
                      )}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setAdvanced((a) => !a)}
              className="flex w-full items-center justify-between rounded-md border border-line px-3 py-2 text-sm text-ink-soft hover:bg-secondary"
              aria-expanded={advanced}
            >
              Accessibility & date
              <ChevronDown className={cn('h-4 w-4 transition-transform', advanced && 'rotate-180')} />
            </button>

            {advanced && (
              <div className="space-y-4 rounded-md border border-line bg-paper p-3">
                <div className="space-y-2">
                  <Label>Accessibility requirements</Label>
                  <div className="flex flex-wrap gap-2">
                    {ACCESS_NEEDS.map((a) => (
                      <button
                        type="button"
                        key={a}
                        onClick={() => toggle(accessNeeds, a, setAccessNeeds)}
                        aria-pressed={accessNeeds.includes(a)}
                        className={cn(
                          'rounded-full border px-2.5 py-1 text-xs transition-colors',
                          accessNeeds.includes(a) ? 'border-ink bg-ink text-paper' : 'border-line bg-surface text-ink hover:border-ink',
                        )}
                      >
                        {a}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="date">Travel date (optional)</Label>
                  <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                </div>
              </div>
            )}

            {error && <p className="text-sm text-coral">{error}</p>}

            <Button
              type="submit"
              disabled={busy}
              className="h-12 w-full bg-brand text-base font-semibold text-ink hover:bg-brand/85"
            >
              {busy ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : null}
              Generate My City Mission
            </Button>
            <p className="text-center text-xs text-ink-soft">
              Recommendations are computed locally from the preferences above — no AI guessing, every score is explained.
            </p>
          </div>
        </form>
      </div>
    </section>
  )
}
