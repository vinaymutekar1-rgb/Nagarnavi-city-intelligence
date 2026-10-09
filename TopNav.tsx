import { useState } from 'react'
import { AlertCircle, Compass, Crosshair, Landmark, Layers, Loader2, Map as MapIcon, Menu, ShieldAlert, Scale, Database, Info } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { CitySearch } from './CitySearch'
import { useCity } from '../context/CityContext'
import { cn } from '@/lib/cn'

export type View = 'explore' | 'map' | 'culture' | 'safety' | 'compare' | 'mission' | 'trust'

const NAV: { id: View; label: string; icon: typeof Layers }[] = [
  { id: 'explore', label: 'Explore', icon: Compass },
  { id: 'map', label: 'Map', icon: MapIcon },
  { id: 'culture', label: 'Culture', icon: Landmark },
  { id: 'safety', label: 'Safety Signals', icon: ShieldAlert },
  { id: 'compare', label: 'Compare Places', icon: Scale },
  { id: 'trust', label: 'Data & Trust', icon: Database },
]

function LocateMeButton({ compact = false }: { compact?: boolean }) {
  const { locateMe, locateStatus, location, lastLocated } = useCity()
  const [open, setOpen] = useState(false)

  const label =
    locateStatus === 'requesting'
      ? 'Locating…'
      : locateStatus === 'granted'
        ? 'Located'
        : locateStatus === 'denied'
          ? 'Location blocked'
          : 'Locate Me'

  return (
    <>
      <Button
        variant={locateStatus === 'granted' ? 'default' : 'outline'}
        size={compact ? 'sm' : 'default'}
        onClick={() => setOpen(true)}
        className={cn('gap-2', locateStatus === 'granted' && 'bg-ink text-paper hover:bg-ink/90')}
        aria-label="Set my current location"
      >
        {locateStatus === 'requesting' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Crosshair className="h-4 w-4" />}
        {label}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">Centre the map on you</DialogTitle>
            <DialogDescription>
              NAGARNAVI needs your browser location to centre the map and measure how far places are from you. It is used only in
              this session — nothing is stored on a server and no coordinates are shared. You can always search for a city or
              locality instead.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 text-sm">
            <div className="flex items-start gap-2 text-ink-soft">
              <Info className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                Your browser will show a permission prompt. Geolocation only works over HTTPS (this preview is secure) or on
                localhost.
              </span>
            </div>
            {lastLocated && locateStatus === 'granted' && (
              <div className="rounded-md border border-line bg-secondary/50 p-3 text-xs text-ink-soft">
                Currently centred near <strong className="text-ink">{location.name}</strong> (
                {lastLocated.latitude.toFixed(3)}, {lastLocated.longitude.toFixed(3)}).
              </div>
            )}
            {locateStatus === 'denied' && (
              <div className="flex items-start gap-2 rounded-md border border-coral/40 bg-coral/10 p-3 text-xs text-ink">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-coral" />
                <span>
                  Location permission was denied. Enable it in your browser's site settings, or search for a city or locality above.
                </span>
              </div>
            )}
            {locateStatus === 'unavailable' && (
              <div className="flex items-start gap-2 rounded-md border border-coral/40 bg-coral/10 p-3 text-xs text-ink">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-coral" />
                <span>Your device could not determine a location. Please search for a city instead.</span>
              </div>
            )}
            {locateStatus === 'error' && (
              <div className="flex items-start gap-2 rounded-md border border-coral/40 bg-coral/10 p-3 text-xs text-ink">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-coral" />
                <span>Something went wrong getting your location. You can retry or search for a city.</span>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Use search instead
            </Button>
            <Button
              className="bg-ink text-paper hover:bg-ink/90"
              onClick={() => {
                locateMe()
                setOpen(false)
              }}
            >
              Allow location access
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

interface Props {
  view: View
  setView: (v: View) => void
}

export function TopNav({ view, setView }: Props) {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <header className="sticky top-0 z-[900] border-b border-line bg-paper/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-[1600px] items-center gap-4 px-4 sm:px-6">
        <button
          onClick={() => setView('explore')}
          className="flex shrink-0 items-center gap-2.5 text-left"
          aria-label="NAGARNAVI home"
        >
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-ink">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="oklch(0.9 0.19 118)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 21s7-6.2 7-11a7 7 0 10-14 0c0 4.8 7 11 7 11z" />
              <circle cx="12" cy="10" r="2.4" />
            </svg>
          </span>
          <span className="leading-none">
            <span className="block font-display text-lg font-semibold tracking-tight text-ink">NAGARNAVI</span>
            <span className="block text-[10px] uppercase tracking-[0.18em] text-ink-soft">Discover · Navigate · Decide</span>
          </span>
        </button>

        <nav className="hidden items-center gap-1 xl:flex" aria-label="Sections">
          {NAV.map((item) => {
            const Icon = item.icon
            return (
              <button
                key={item.id}
                onClick={() => setView(item.id)}
                aria-current={view === item.id ? 'page' : undefined}
                className={cn(
                  'flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  view === item.id ? 'bg-ink text-paper' : 'text-ink-soft hover:bg-secondary hover:text-ink',
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </button>
            )
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <div className="hidden md:block">
            <CitySearch variant="nav" />
          </div>
          <div className="hidden sm:block">
            <LocateMeButton compact />
          </div>

          <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
            <SheetTrigger
              className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-line bg-surface text-ink transition-colors hover:bg-secondary xl:hidden"
              aria-label="Open navigation menu"
            >
              <Menu className="h-5 w-5" />
            </SheetTrigger>
            <SheetContent className="w-[86vw] max-w-sm bg-paper p-5">
              <SheetTitle className="font-display text-xl">Menu</SheetTitle>
              <div className="mt-4 space-y-4">
                <CitySearch variant="hero" placeholder="Search a city or area…" />
                <div className="sm:hidden">
                  <LocateMeButton />
                </div>
                <nav className="flex flex-col gap-1" aria-label="Sections">
                  {NAV.map((item) => {
                    const Icon = item.icon
                    return (
                      <button
                        key={item.id}
                        onClick={() => {
                          setView(item.id)
                          setMenuOpen(false)
                        }}
                        className={cn(
                          'flex items-center gap-3 rounded-md px-3 py-3 text-left text-sm font-medium transition-colors',
                          view === item.id ? 'bg-ink text-paper' : 'text-ink hover:bg-secondary',
                        )}
                      >
                        <Icon className="h-4 w-4" />
                        {item.label}
                      </button>
                    )
                  })}
                </nav>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  )
}
