// SPDX-License-Identifier: Apache-2.0
import { useState } from 'react'
import { Check, MapPin } from 'lucide-react'
import { TopNav, type View } from './components/TopNav'
import { HeroSearch } from './components/HeroSearch'
import { ExploreView } from './components/ExploreView'
import { MapView } from './components/MapView'
import { CultureView } from './components/CultureView'
import { SafetyView } from './components/SafetyView'
import { CompareView } from './components/CompareView'
import { MissionView } from './components/MissionView'
import { TrustView } from './components/TrustView'
import { CityProvider, useCity } from './context/CityContext'
import { type Category, type Place } from './lib/geo'
import { type Mission } from './lib/recommend'

function Shell() {
  const { setMission, pinPlace, pinned } = useCity()
  const [view, setView] = useState<View>('explore')
  const [toast, setToast] = useState<string | null>(null)

  const [prefill, setPrefill] = useState<{ interests: Category[]; key: number }>({ interests: ['heritage', 'restaurant'], key: 0 })
  const flash = (msg: string) => {
    setToast(msg)
    window.setTimeout(() => setToast(null), 2600)
  }

  const handleCreateMission = (mission: Mission) => {
    setMission(mission)
    setView('mission')
    flash(`City Mission generated for ${mission.city}.`)
  }

  const handleAddToMission = (place: Place) => {
    pinPlace(place)
    flash(`Added “${place.name}” to your mission.`)
  }

  const handlePlanMissionWith = (interests: Category[]) => {
    setPrefill((p) => ({ interests, key: p.key + 1 }))
    setView('explore')
    window.scrollTo({ top: 0, behavior: 'smooth' })
    flash('Mission form pre-filled with your culture interests.')
  }

  return (
    <div className="min-h-screen bg-paper">
      <TopNav view={view} setView={setView} />

      <main>
        {view === 'explore' && (
          <>
            <HeroSearch key={prefill.key} onCreate={handleCreateMission} initialInterests={prefill.interests} />
            <ExploreView onAddToMission={handleAddToMission} onOpenMission={() => setView('mission')} />
          </>
        )}
        {view === 'map' && <MapView onAddToMission={handleAddToMission} />}
        {view === 'culture' && <CultureView onAddToMission={handleAddToMission} onPlanMission={handlePlanMissionWith} />}
        {view === 'safety' && <SafetyView />}
        {view === 'compare' && <CompareView onGoExplore={() => setView('explore')} />}
        {view === 'mission' && <MissionView onPlanAnother={() => setView('explore')} />}
        {view === 'trust' && <TrustView />}
      </main>

      <footer className="mt-12 border-t border-line bg-ink text-paper">
        <div className="mx-auto grid max-w-[1600px] gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[2fr_1fr_1fr]">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand">
                <MapPin className="h-5 w-5 text-ink" />
              </span>
              <span className="font-display text-lg font-semibold">NAGARNAVI</span>
            </div>
            <p className="mt-3 max-w-md text-sm text-paper/70">
              City intelligence and exploration. Built on open data — decisions explained, missing data admitted, and never a
              fabricated “safety score”.
            </p>
          </div>
          <div>
            <h3 className="text-[11px] uppercase tracking-wide text-paper/60">Data sources</h3>
            <ul className="mt-3 space-y-1.5 text-sm text-paper/80">
              <li>OpenStreetMap (Nominatim)</li>
              <li>Wikipedia / Wikimedia</li>
              <li>Open-Meteo</li>
              <li>Community reports</li>
            </ul>
          </div>
          <div>
            <h3 className="text-[11px] uppercase tracking-wide text-paper/60">Notice</h3>
            <p className="mt-3 text-sm text-paper/80">
              Decision support only — not an emergency service or a guarantee of safety. Attributions: © OpenStreetMap
              contributors · Wikipedia CC BY-SA · Open-Meteo.
            </p>
          </div>
        </div>
      </footer>

      {toast && (
        <div role="status" className="fixed bottom-5 left-1/2 z-[2000] -translate-x-1/2">
          <div className="flex items-center gap-2 rounded-full border border-line bg-surface px-4 py-2.5 text-sm text-ink shadow-xl">
            <Check className="h-4 w-4 text-ink" />
            {toast}
            {pinned.length > 0 && <span className="text-ink-soft">· mission has {pinned.length}</span>}
          </div>
        </div>
      )}
    </div>
  )
}

export default function App() {
  return (
    <CityProvider>
      <Shell />
    </CityProvider>
  )
}
