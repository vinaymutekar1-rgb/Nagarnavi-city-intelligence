import { useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle2, Clock, Database, Info, Loader2, RefreshCw, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useCity } from '../context/CityContext'
import { fetchStatus, formatAge, type ProviderStatus } from '../lib/geo'
import { cn } from '@/lib/cn'

export function TrustView() {
  const { places, demoPlaces, sources, placesUpdatedAt, reports, location, degraded, warming } = useCity()
  const [providers, setProviders] = useState<ProviderStatus[]>([])
  const [checkedAt, setCheckedAt] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const check = () => {
    setLoading(true)
    setError('')
    fetchStatus()
      .then((res) => {
        setProviders(res.providers)
        setCheckedAt(res.checkedAt)
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    check()
  }, [])

  const liveCount = places.length
  const demoCount = demoPlaces.length
  const userReports = reports.filter((r) => !r.isDemo).length
  const demoReports = reports.filter((r) => r.isDemo).length

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-8 sm:px-6">
      <header className="border-b border-line pb-6">
        <span className="text-[11px] uppercase tracking-[0.16em] text-ink-soft">Transparency</span>
        <h1 className="mt-1 font-display text-3xl font-semibold text-ink sm:text-4xl">Data & trust centre</h1>
        <p className="mt-2 max-w-3xl text-ink-soft">
          What we use, when we retrieved it, what is missing, and how recommendations are actually calculated. No fabricated
          live data — if a provider is down we say so.
        </p>
        <Button variant="outline" className="mt-4 gap-2" onClick={check} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Re-check providers
        </Button>
      </header>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Live places in view', value: liveCount, hint: location.name },
          { label: 'Demo places', value: demoCount, hint: 'Clearly labelled DEMO' },
          { label: 'Reports from you', value: userReports, hint: 'Stored in this browser' },
          { label: 'Demo reports', value: demoReports, hint: 'Sample data' },
        ].map((s) => (
          <div key={s.label} className="border border-line bg-surface p-4">
            <div className="text-[11px] uppercase tracking-wide text-ink-soft">{s.label}</div>
            <div className="mt-1 font-display text-2xl font-semibold text-ink">{s.value}</div>
            <div className="text-xs text-ink-soft">{s.hint}</div>
          </div>
        ))}
      </div>

      <section className="mt-8">
        <h2 className="font-display text-2xl font-semibold text-ink">Provider status</h2>
        {error && <p className="mt-2 text-sm text-coral">Could not reach the status endpoint: {error}</p>}
        <ul className="mt-4 divide-y divide-line border border-line bg-surface">
          {providers.map((p) => (
            <li key={p.name} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div>
                <div className="flex items-center gap-2 font-medium text-ink">
                  {p.ok ? <CheckCircle2 className="h-4 w-4 text-ink" /> : <XCircle className="h-4 w-4 text-coral" />}
                  {p.name}
                </div>
                <div className="text-xs text-ink-soft">{p.note}</div>
              </div>
              <div className="text-right text-xs">
                <div className={cn('font-medium', p.ok ? 'text-ink' : 'text-coral')}>
                  {p.ok ? `Reachable · HTTP ${p.status}` : p.error ? 'Unreachable' : `HTTP ${p.status}`}
                </div>
                {p.latencyMs !== undefined && <div className="text-ink-soft">{p.latencyMs} ms</div>}
              </div>
            </li>
          ))}
          {providers.length === 0 && !loading && <li className="px-4 py-3 text-sm text-ink-soft">No provider data.</li>}
        </ul>
        {checkedAt && <p className="mt-2 text-xs text-ink-soft">Checked {formatAge(checkedAt)}.</p>}
      </section>

      <section className="mt-8 grid gap-4 lg:grid-cols-3">
        <div className="border border-line bg-surface p-5">
          <h3 className="flex items-center gap-2 font-display text-lg font-semibold text-ink">
            <Database className="h-4 w-4" /> Sources in this view
          </h3>
          <ul className="mt-3 space-y-1.5 text-sm text-ink-soft">
            {(sources.length ? sources : ['No live sources returned yet']).map((s) => (
              <li key={s}>· {s}</li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-ink-soft">
            Live places last refreshed:{' '}
            <strong className="text-ink">{placesUpdatedAt ? new Date(placesUpdatedAt).toLocaleString() : 'not yet'}</strong>
            {warming ? ' (still loading…)' : ''}
          </p>
          {degraded.length > 0 && (
            <p className="mt-2 rounded border border-coral/40 bg-coral/10 p-2 text-xs text-ink">
              Degraded categories this session: {degraded.join(', ')}
            </p>
          )}
        </div>

        <div className="border border-line bg-surface p-5">
          <h3 className="flex items-center gap-2 font-display text-lg font-semibold text-ink">
            <Clock className="h-4 w-4" /> Freshness by record
          </h3>
          <ul className="mt-3 space-y-2 text-sm">
            <li className="flex justify-between">
              <span className="text-ink-soft">OpenStreetMap places</span>
              <span className="text-ink">{liveCount ? `${liveCount} records` : '—'}</span>
            </li>
            <li className="flex justify-between">
              <span className="text-ink-soft">Demo records</span>
              <span className="text-ink">{demoCount}</span>
            </li>
            <li className="flex justify-between">
              <span className="text-ink-soft">Reports (user / demo)</span>
              <span className="text-ink">
                {userReports} / {demoReports}
              </span>
            </li>
          </ul>
          <p className="mt-3 text-xs text-ink-soft">
            OpenStreetMap records are retrieved live and cached for 30 minutes. Demo records are static and labelled.
          </p>
        </div>

        <div className="border border-line bg-surface p-5">
          <h3 className="flex items-center gap-2 font-display text-lg font-semibold text-ink">
            <Info className="h-4 w-4" /> How recommendations work
          </h3>
          <ol className="mt-3 list-inside list-decimal space-y-1.5 text-sm text-ink-soft">
            <li>Your interests narrow the categories we look at.</li>
            <li>Distance is measured straight-line from your start point.</li>
            <li>Each place is scored on interest match, proximity, culture, cost flag, accessibility and data completeness.</li>
            <li>Your chosen priorities change the weights applied.</li>
            <li>Community reports nearby are surfaced as information — never as proof of safety.</li>
            <li>Missing data is excluded from the score, never counted as zero.</li>
          </ol>
        </div>
      </section>

      <section className="mt-8 border border-dashed border-line bg-surface p-5">
        <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-ink">
          <AlertTriangle className="h-4 w-4 text-coral" /> Limitations you should know
        </h2>
        <ul className="mt-3 grid gap-2 text-sm text-ink-soft sm:grid-cols-2">
          <li>· Distances and travel times are straight-line estimates, not routed distances.</li>
          <li>· No live traffic, no road closures, no accident statistics are connected.</li>
          <li>· No ratings or review counts are available from the connected sources.</li>
          <li>· Opening hours and prices are only shown when the source publishes them.</li>
          <li>· Community reports are user-generated and may be inaccurate or out of date.</li>
          <li>· Confidence figures are a transparent product heuristic, not an official score.</li>
        </ul>
      </section>
    </div>
  )
}
