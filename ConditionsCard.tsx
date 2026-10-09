import { CloudRain, CloudSun, Droplets, Loader2, RefreshCw, Sun, Wind, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useCity } from '../context/CityContext'
import { formatAge } from '../lib/geo'

function WeatherIcon({ code, className }: { code: number; className?: string }) {
  if (code >= 51) return <CloudRain className={className} />
  if (code >= 2) return <CloudSun className={className} />
  return <Sun className={className} />
}

export function ConditionsCard() {
  const { weather, weatherError, loadingWeather, loadWeather, location } = useCity()

  return (
    <section className="border border-line bg-surface p-5" aria-label="City conditions">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-lg font-semibold text-ink">Conditions in {location.name}</h2>
        <Button variant="ghost" size="sm" className="gap-1.5" onClick={loadWeather} disabled={loadingWeather}>
          {loadingWeather ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} Refresh
        </Button>
      </div>

      {loadingWeather && !weather && (
        <div className="mt-4 flex items-center gap-2 text-sm text-ink-soft">
          <Loader2 className="h-4 w-4 animate-spin" /> Retrieving live weather…
        </div>
      )}

      {weatherError && !weather && (
        <div className="mt-4 rounded-md border border-coral/40 bg-coral/10 p-3 text-sm text-ink">
          <div className="flex items-center gap-2 font-medium">
            <AlertTriangle className="h-4 w-4 text-coral" /> Live weather could not be retrieved
          </div>
          <p className="mt-1 text-xs text-ink-soft">{weatherError}</p>
          <Button variant="outline" size="sm" className="mt-2 gap-1.5" onClick={loadWeather}>
            <RefreshCw className="h-3.5 w-3.5" /> Try again
          </Button>
        </div>
      )}

      {weather && (
        <>
          <div className="mt-4 flex items-center gap-4">
            <WeatherIcon code={weather.code} className="h-11 w-11 text-ink" />
            <div>
              <div className="font-display text-3xl font-semibold text-ink">{Math.round(weather.temperature)}°C</div>
              <div className="text-sm text-ink-soft">
                {weather.condition} · feels like {Math.round(weather.feelsLike)}°C
              </div>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-md border border-line bg-paper p-2">
              <Droplets className="mx-auto mb-1 h-4 w-4 text-ink-soft" />
              <div className="text-sm font-medium text-ink">{weather.humidity}%</div>
              <div className="text-[10px] uppercase tracking-wide text-ink-soft">Humidity</div>
            </div>
            <div className="rounded-md border border-line bg-paper p-2">
              <Wind className="mx-auto mb-1 h-4 w-4 text-ink-soft" />
              <div className="text-sm font-medium text-ink">{Math.round(weather.windSpeed)} km/h</div>
              <div className="text-[10px] uppercase tracking-wide text-ink-soft">Wind</div>
            </div>
            <div className="rounded-md border border-line bg-paper p-2">
              <CloudRain className="mx-auto mb-1 h-4 w-4 text-ink-soft" />
              <div className="text-sm font-medium text-ink">{weather.precipitation ?? 0} mm</div>
              <div className="text-[10px] uppercase tracking-wide text-ink-soft">Precip.</div>
            </div>
          </div>

          {weather.forecast?.length > 0 && (
            <div className="mt-4">
              <div className="text-[11px] uppercase tracking-wide text-ink-soft">Next days</div>
              <div className="mt-2 grid grid-cols-4 gap-2">
                {weather.forecast.map((f) => (
                  <div key={f.date} className="rounded-md border border-line bg-paper p-2 text-center">
                    <div className="text-[10px] text-ink-soft">
                      {new Date(f.date).toLocaleDateString(undefined, { weekday: 'short' })}
                    </div>
                    <WeatherIcon code={f.code} className="mx-auto my-1 h-4 w-4 text-ink" />
                    <div className="text-[11px] font-medium text-ink">
                      {Math.round(f.max)}° / {Math.round(f.min)}°
                    </div>
                    <div className="text-[10px] text-ink-soft">{f.rainChance ?? 0}% rain</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <p className="mt-3 text-[11px] text-ink-soft">
            Source: {weather.source} · retrieved {formatAge(weather.retrievedAt)} · timezone {weather.timezone}
          </p>

          <div className="mt-3 rounded-md bg-secondary/60 p-3 text-xs text-ink-soft">
            {weather.code >= 51
              ? 'Rain expected — favour indoor stops or carry protection; heritage sites may be slippery.'
              : weather.temperature >= 34
                ? 'Hot conditions — plan shade and water breaks, and prefer early or late outings.'
                : weather.temperature <= 12
                  ? 'Cool conditions — layer up for walking routes.'
                  : 'Comfortable for walking routes right now.'}
          </div>
        </>
      )}
    </section>
  )
}
