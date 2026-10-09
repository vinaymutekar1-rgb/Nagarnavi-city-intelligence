import { useMemo, useRef, useState } from 'react'
import { Camera, Check, Info, MapPin, Mic, ShieldCheck, Square, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { CityMap } from './CityMap'
import { useCity } from '../context/CityContext'
import { REPORT_LABELS, type CommunityReport, type ReportCategory } from '../lib/recommend'
import { formatAge } from '../lib/geo'
import { cn } from '@/lib/cn'

const STATUS_STYLE: Record<string, string> = {
  unverified: 'border-line bg-paper text-ink-soft',
  corroborated: 'border-ink/30 bg-secondary text-ink',
  verified: 'border-brand/60 bg-brand/20 text-ink',
}

const STATUS_LABEL: Record<string, string> = {
  unverified: 'Unverified (community)',
  corroborated: 'Community corroborated',
  verified: 'Verified by a reviewer',
}

export function SafetyView() {
  const { location, reports, addReport, corroborate, lastLocated } = useCity()

  const [activeCats, setActiveCats] = useState<ReportCategory[]>(Object.keys(REPORT_LABELS) as ReportCategory[])
  const [includeDemo, setIncludeDemo] = useState(true)
  const [statusFilter, setStatusFilter] = useState<'all' | 'unverified' | 'corroborated' | 'verified'>('all')

  const [category, setCategory] = useState<ReportCategory>('unsafe-area')
  const [description, setDescription] = useState('')
  const [reportLocation, setReportLocation] = useState<{ latitude: number; longitude: number } | null>(null)
  const [address, setAddress] = useState('')
  const [when, setWhen] = useState(() => new Date().toISOString().slice(0, 16))
  const [imageName, setImageName] = useState<string | null>(null)
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [formError, setFormError] = useState('')

  const [micConsentOpen, setMicConsentOpen] = useState(false)
  const [recording, setRecording] = useState(false)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const [micError, setMicError] = useState('')

  const filtered = useMemo(
    () =>
      reports
        .filter((r) => activeCats.includes(r.category))
        .filter((r) => includeDemo || !r.isDemo)
        .filter((r) => statusFilter === 'all' || r.status === statusFilter)
        .sort((a, b) => new Date(b.reportTime).getTime() - new Date(a.reportTime).getTime()),
    [reports, activeCats, includeDemo, statusFilter],
  )

  const counts = useMemo(
    () => ({
      total: reports.length,
      user: reports.filter((r) => !r.isDemo).length,
      verified: reports.filter((r) => r.status === 'verified').length,
      corroborated: reports.filter((r) => r.status === 'corroborated').length,
    }),
    [reports],
  )

  const toggleCat = (c: ReportCategory) =>
    setActiveCats((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]))

  const onPickImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (imageUrl) URL.revokeObjectURL(imageUrl)
    setImageName(file.name)
    setImageUrl(URL.createObjectURL(file))
  }

  const startRecording = async () => {
    setMicError('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const rec = new MediaRecorder(stream)
      chunksRef.current = []
      rec.ondataavailable = (ev) => ev.data.size > 0 && chunksRef.current.push(ev.data)
      rec.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        if (audioUrl) URL.revokeObjectURL(audioUrl)
        setAudioUrl(URL.createObjectURL(blob))
        stream.getTracks().forEach((t) => t.stop())
      }
      rec.start()
      recorderRef.current = rec
      setRecording(true)
    } catch (err) {
      setMicError(`Microphone unavailable: ${(err as Error).message}`)
    }
  }

  const stopRecording = () => {
    recorderRef.current?.stop()
    setRecording(false)
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setFormError('')
    if (description.trim().length < 10) {
      setFormError('Please describe the concern in at least 10 characters.')
      return
    }
    const loc = reportLocation || (lastLocated ?? null) || { latitude: location.latitude, longitude: location.longitude }
    addReport({
      city: location.name,
      category,
      description: description.trim(),
      latitude: loc.latitude,
      longitude: loc.longitude,
      address: address.trim() || null,
      reportTime: new Date(when).toISOString(),
      hasImage: Boolean(imageUrl),
      hasAudio: Boolean(audioUrl),
    })
    setSubmitted(true)
    setDescription('')
    setAddress('')
    setImageName(null)
    if (imageUrl) URL.revokeObjectURL(imageUrl)
    setImageUrl(null)
    if (audioUrl) URL.revokeObjectURL(audioUrl)
    setAudioUrl(null)
    setReportLocation(null)
  }

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-8 sm:px-6">
      <header className="border-b border-line pb-6">
        <span className="text-[11px] uppercase tracking-[0.16em] text-ink-soft">Safety signals</span>
        <h1 className="mt-1 font-display text-3xl font-semibold text-ink sm:text-4xl">Community reports in {location.name}</h1>
        <p className="mt-2 max-w-3xl text-ink-soft">
          Experiences reported by people, clearly separated from verified data. A place with no reports is <strong className="text-ink">not</strong>{' '}
          described as safe — absence of reports is not evidence of safety.
        </p>
      </header>

      <div className="mt-5 flex items-start gap-2 rounded-md border border-line bg-secondary/50 p-3 text-xs text-ink-soft">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          NAGARNAVI provides decision support only. It is not an emergency service and not a safety assessment. In an emergency,
          contact local emergency services. Reports shown as <strong>DEMO</strong> are sample data shipped with the app.
        </span>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-4">
        {[
          { label: 'Reports in view', value: filtered.length },
          { label: 'Submitted here', value: counts.user },
          { label: 'Corroborated', value: counts.corroborated },
          { label: 'Reviewer-verified', value: counts.verified },
        ].map((s) => (
          <div key={s.label} className="border border-line bg-surface p-4">
            <div className="text-[11px] uppercase tracking-wide text-ink-soft">{s.label}</div>
            <div className="mt-1 font-display text-2xl font-semibold text-ink">{s.value}</div>
          </div>
        ))}
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_1.1fr]">
        {/* Report list */}
        <div>
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(REPORT_LABELS) as ReportCategory[]).map((c) => (
              <button
                key={c}
                onClick={() => toggleCat(c)}
                aria-pressed={activeCats.includes(c)}
                className={cn(
                  'rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                  activeCats.includes(c) ? 'border-ink bg-ink text-paper' : 'border-line bg-surface text-ink-soft hover:border-ink',
                )}
              >
                {REPORT_LABELS[c]}
              </button>
            ))}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-3">
            <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs text-ink-soft">
              <input type="checkbox" checked={includeDemo} onChange={(e) => setIncludeDemo(e.target.checked)} className="h-3.5 w-3.5 accent-[oklch(0.9_0.19_118)]" />
              Include demo data
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
              aria-label="Filter by verification state"
              className="h-8 rounded-md border border-line bg-paper px-2 text-xs text-ink focus:border-ink focus:outline-none"
            >
              <option value="all">All states</option>
              <option value="unverified">Unverified</option>
              <option value="corroborated">Corroborated</option>
              <option value="verified">Verified</option>
            </select>
          </div>

          <ul className="mt-4 space-y-3">
            {filtered.length === 0 && (
              <li className="border border-dashed border-line p-6 text-center text-sm text-ink-soft">
                No reports match these filters.
              </li>
            )}
            {filtered.map((r: CommunityReport) => (
              <li key={r.id} className="border border-line bg-surface p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium text-ink">{REPORT_LABELS[r.category]}</span>
                  <div className="flex items-center gap-2">
                    {r.isDemo && <span className="rounded border border-ink-soft/40 bg-secondary px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-ink-soft">DEMO</span>}
                    <span className={cn('rounded border px-2 py-0.5 text-[11px]', STATUS_STYLE[r.status])}>{STATUS_LABEL[r.status]}</span>
                  </div>
                </div>
                <p className="mt-2 text-sm text-ink">{r.description}</p>
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-soft">
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="h-3 w-3" /> {r.address || `${r.latitude.toFixed(3)}, ${r.longitude.toFixed(3)}`}
                  </span>
                  <span>Reported {formatAge(r.reportTime)}</span>
                  <span>{r.corroborations} corroboration{r.corroborations === 1 ? '' : 's'}</span>
                  {r.hasImage && <span className="inline-flex items-center gap-1"><Camera className="h-3 w-3" /> photo attached (this device)</span>}
                  {r.hasAudio && <span className="inline-flex items-center gap-1"><Mic className="h-3 w-3" /> voice note (this session)</span>}
                </div>
                {!r.isDemo && (
                  <Button variant="outline" size="sm" className="mt-3 gap-1.5" onClick={() => corroborate(r.id)}>
                    <ShieldCheck className="h-3.5 w-3.5" /> I've seen this too
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </div>

        {/* Map + form */}
        <div className="space-y-6">
          <div className="overflow-hidden border border-line bg-surface">
            <CityMap
              center={{ latitude: location.latitude, longitude: location.longitude }}
              zoom={location.zoom}
              places={[]}
              selectedId={null}
              onSelect={() => {}}
              reports={filtered}
              showReports
              userLocation={reportLocation || lastLocated || null}
              onMapClick={(lat, lng) => setReportLocation({ latitude: lat, longitude: lng })}
              className="h-[320px] w-full"
            />
            <div className="flex items-center justify-between gap-2 border-t border-line px-3 py-2 text-xs text-ink-soft">
              <span>
                {reportLocation
                  ? `Report pin: ${reportLocation.latitude.toFixed(4)}, ${reportLocation.longitude.toFixed(4)}`
                  : 'Click the map to place your report, or use your current location.'}
              </span>
              {reportLocation && (
                <button onClick={() => setReportLocation(null)} className="inline-flex items-center gap-1 underline">
                  <X className="h-3 w-3" /> clear
                </button>
              )}
            </div>
          </div>

          <form onSubmit={submit} className="border border-line bg-surface p-5">
            <h2 className="font-display text-xl font-semibold text-ink">Submit a report</h2>
            <p className="mt-1 text-xs text-ink-soft">
              Stored locally in this browser for the demo. It is not shared with other users or sent to a server.
            </p>

            {submitted && (
              <div className="mt-3 flex items-center gap-2 rounded-md border border-brand/60 bg-brand/15 p-3 text-sm text-ink">
                <Check className="h-4 w-4" /> Report saved locally. Thank you — it now appears in the list and on the map.
              </div>
            )}

            <div className="mt-4 space-y-4">
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={category} onValueChange={(v) => setCategory(v as ReportCategory)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(REPORT_LABELS) as ReportCategory[]).map((c) => (
                      <SelectItem key={c} value={c}>
                        {REPORT_LABELS[c]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="desc">What did you observe?</Label>
                <Textarea
                  id="desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe what you saw, and when — facts only, please."
                  className="min-h-[88px]"
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="where">Location label (optional)</Label>
                  <Input id="where" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="e.g. near the bus stop" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="when">When</Label>
                  <Input id="when" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => setReportLocation(lastLocated || { latitude: location.latitude, longitude: location.longitude })}
                >
                  <MapPin className="h-3.5 w-3.5" /> Use current location
                </Button>
              </div>

              {/* media */}
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-md border border-line bg-paper p-3">
                  <div className="flex items-center gap-2 text-xs font-medium text-ink">
                    <Camera className="h-4 w-4" /> Photo (optional)
                  </div>
                  <input
                    id="photo"
                    type="file"
                    accept="image/*"
                    onChange={onPickImage}
                    className="mt-2 block w-full text-xs text-ink-soft file:mr-2 file:rounded file:border file:border-line file:bg-surface file:px-2 file:py-1 file:text-xs"
                  />
                  {imageUrl && (
                    <div className="mt-2">
                      <img src={imageUrl} alt="Attached report" className="max-h-32 w-full rounded object-cover" />
                      <button
                        type="button"
                        onClick={() => {
                          URL.revokeObjectURL(imageUrl)
                          setImageUrl(null)
                          setImageName(null)
                        }}
                        className="mt-1 inline-flex items-center gap-1 text-xs text-coral"
                      >
                        <Trash2 className="h-3 w-3" /> remove {imageName}
                      </button>
                    </div>
                  )}
                </div>

                <div className="rounded-md border border-line bg-paper p-3">
                  <div className="flex items-center gap-2 text-xs font-medium text-ink">
                    <Mic className="h-4 w-4" /> Voice note (optional)
                  </div>
                  {!audioUrl && !recording && (
                    <Button type="button" variant="outline" size="sm" className="mt-2 gap-1.5" onClick={() => setMicConsentOpen(true)}>
                      <Mic className="h-3.5 w-3.5" /> Record voice note
                    </Button>
                  )}
                  {recording && (
                    <Button type="button" variant="outline" size="sm" className="mt-2 gap-1.5 border-coral text-coral" onClick={stopRecording}>
                      <Square className="h-3.5 w-3.5" /> Stop recording
                    </Button>
                  )}
                  {audioUrl && (
                    <div className="mt-2">
                      <audio controls src={audioUrl} className="w-full" />
                      <button
                        type="button"
                        onClick={() => {
                          URL.revokeObjectURL(audioUrl)
                          setAudioUrl(null)
                        }}
                        className="mt-1 inline-flex items-center gap-1 text-xs text-coral"
                      >
                        <Trash2 className="h-3 w-3" /> delete recording
                      </button>
                    </div>
                  )}
                  <p className="mt-2 text-[10px] text-ink-soft">Audio stays in this browser session and is never uploaded.</p>
                </div>
              </div>

              {micError && <p className="text-xs text-coral">{micError}</p>}
              {formError && <p className="text-sm text-coral">{formError}</p>}

              <Button type="submit" className="w-full bg-ink text-paper hover:bg-ink/90">
                Submit report
              </Button>
            </div>
          </form>
        </div>
      </div>

      <Dialog open={micConsentOpen} onOpenChange={setMicConsentOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">Record a voice note?</DialogTitle>
            <DialogDescription>
              Your browser will ask for microphone permission. The recording is kept only in this browser session, is never
              uploaded, and is discarded when you delete it or close the tab. Only record a note if you consent to this.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => setMicConsentOpen(false)}>
              Cancel
            </Button>
            <Button
              className="bg-ink text-paper hover:bg-ink/90"
              onClick={() => {
                setMicConsentOpen(false)
                void startRecording()
              }}
            >
              I consent — start recording
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
