import { useState } from 'react'
import { AlertTriangle, Check, ChevronDown, ClipboardCopy, Download, FileText } from 'lucide-react'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Button } from '@/components/ui/button'
import { type DecisionReceipt as Receipt } from '../lib/recommend'
import { cn } from '@/lib/cn'

const KIND_STYLE: Record<string, string> = {
  fact: 'border-line bg-surface text-ink',
  estimate: 'border-brand/60 bg-brand/15 text-ink',
  community: 'border-coral/40 bg-coral/10 text-ink',
  unknown: 'border-dashed border-line bg-paper text-ink-soft',
}

export function DecisionReceipt({ receipt }: { receipt: Receipt }) {
  const [copied, setCopied] = useState(false)
  const [downloaded, setDownloaded] = useState(false)
  const [open, setOpen] = useState(true)

  const toText = () => {
    const l = receipt
    const lines: string[] = []
    lines.push('NAGARNAVI — CITY DECISION RECEIPT')
    lines.push('='.repeat(40))
    lines.push(`City        : ${l.mission.city}`)
    lines.push(`Starting at : ${l.mission.startLabel}`)
    lines.push(`Budget      : ₹${l.mission.budget.toLocaleString('en-IN')}`)
    lines.push(`Time        : ${l.mission.duration} · ${l.mission.transport}`)
    lines.push(`Interests   : ${l.mission.interests.join(', ')}`)
    lines.push(`Priorities  : ${l.mission.priorities.join(', ') || 'none'}`)
    lines.push(`Generated   : ${new Date(l.generatedAt).toLocaleString()}`)
    lines.push('')
    lines.push(l.summary)
    lines.push('')
    l.stops.forEach((s) => {
      lines.push(`#${s.order} ${s.name} (${s.category})`)
      s.why.forEach((w) => lines.push(`   why : ${w}`))
      s.matchedPreferences.forEach((m) => lines.push(`   pref: ${m}`))
      s.evidence.forEach((e) => lines.push(`   [${e.kind}] ${e.label}: ${e.value}`))
      if (s.verify.length) lines.push(`   verify: ${s.verify.join('; ')}`)
      lines.push('')
    })
    lines.push('DATA SOURCES')
    l.dataSources.forEach((d) => lines.push(`   ${d.name} — ${d.used} stops — ${d.note}`))
    lines.push('')
    lines.push('STILL UNKNOWN')
    l.unknowns.forEach((u) => lines.push(`   - ${u}`))
    lines.push('')
    lines.push('This receipt is decision support, not a safety guarantee.')
    return lines.join('\n')
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(toText())
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  const download = () => {
    const blob = new Blob([toText()], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `nagarnavi-decision-receipt-${receipt.mission.city.toLowerCase().replace(/\s+/g, '-')}.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    setDownloaded(true)
    setTimeout(() => setDownloaded(false), 2500)
  }

  return (
    <section className="border border-line bg-surface" aria-label="City decision receipt">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-ink px-5 py-4 text-paper">
        <div className="flex items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-md bg-brand text-ink">
            <FileText className="h-5 w-5" />
          </span>
          <div>
            <h2 className="font-display text-xl font-semibold">City Decision Receipt</h2>
            <p className="text-xs text-paper/70">
              Generated {new Date(receipt.generatedAt).toLocaleString()} · derived from live data, not a language model
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="gap-1.5 border-paper/30 bg-transparent text-paper hover:bg-paper/10" onClick={copy}>
            {copied ? <Check className="h-4 w-4" /> : <ClipboardCopy className="h-4 w-4" />} {copied ? 'Copied' : 'Copy'}
          </Button>
          <Button size="sm" variant="outline" className="gap-1.5 border-paper/30 bg-transparent text-paper hover:bg-paper/10" onClick={download}>
            {downloaded ? <Check className="h-4 w-4" /> : <Download className="h-4 w-4" />} {downloaded ? 'Saved' : 'Download'}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 border-paper/30 bg-transparent text-paper hover:bg-paper/10"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
          >
            <ChevronDown className={cn('h-4 w-4 transition-transform', open && 'rotate-180')} />
            {open ? 'Collapse' : 'Expand'}
          </Button>
        </div>
      </div>

      {open && (
        <div className="space-y-6 p-5">
          <p className="text-sm leading-relaxed text-ink-soft">{receipt.summary}</p>

          <div className="rounded-md border border-line bg-paper p-4">
            <h3 className="text-[11px] uppercase tracking-wide text-ink-soft">Your mission inputs</h3>
            <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
              <div>
                <div className="text-[11px] text-ink-soft">City</div>
                <div className="font-medium text-ink">{receipt.mission.city}</div>
              </div>
              <div>
                <div className="text-[11px] text-ink-soft">Start</div>
                <div className="font-medium text-ink">{receipt.mission.startLabel}</div>
              </div>
              <div>
                <div className="text-[11px] text-ink-soft">Budget</div>
                <div className="font-medium text-ink">₹{receipt.mission.budget.toLocaleString('en-IN')}</div>
              </div>
              <div>
                <div className="text-[11px] text-ink-soft">Time · transport</div>
                <div className="font-medium text-ink">
                  {receipt.mission.duration} · {receipt.mission.transport}
                </div>
              </div>
            </div>
          </div>

          <div>
            <h3 className="font-display text-lg font-semibold text-ink">Why each stop was chosen</h3>
            <Accordion className="mt-3 space-y-2">
              {receipt.stops.map((s) => (
                <AccordionItem key={s.order} value={`stop-${s.order}`} className="rounded-md border border-line bg-surface px-4">
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex items-center gap-3 text-left">
                      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-ink text-xs font-semibold text-paper">
                        {s.order}
                      </span>
                      <span>
                        <span className="block font-medium text-ink">{s.name}</span>
                        <span className="block text-xs text-ink-soft">{s.category} · {s.sources.join(', ')}</span>
                      </span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="space-y-4 pb-4">
                    <div>
                      <h4 className="text-[11px] uppercase tracking-wide text-ink-soft">Why this place</h4>
                      <ul className="mt-1.5 space-y-1 text-sm text-ink">
                        {s.why.map((w) => (
                          <li key={w} className="flex items-start gap-2">
                            <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink" /> {w}
                          </li>
                        ))}
                      </ul>
                    </div>

                    {s.matchedPreferences.length > 0 && (
                      <div>
                        <h4 className="text-[11px] uppercase tracking-wide text-ink-soft">Preferences satisfied</h4>
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          {s.matchedPreferences.map((m) => (
                            <span key={m} className="rounded-full bg-brand/25 px-2 py-0.5 text-xs text-ink">
                              {m}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    <div>
                      <h4 className="text-[11px] uppercase tracking-wide text-ink-soft">Evidence & basis</h4>
                      <div className="mt-1.5 divide-y divide-line border border-line">
                        {s.evidence.map((e) => (
                          <div key={e.label} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                            <span className="text-ink-soft">{e.label}</span>
                            <span className={cn('rounded border px-2 py-0.5 text-xs', KIND_STYLE[e.kind])}>{e.value}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {s.verify.length > 0 && (
                      <div className="rounded-md border border-coral/40 bg-coral/10 p-3">
                        <h4 className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-ink">
                          <AlertTriangle className="h-3.5 w-3.5" /> Verify before you go
                        </h4>
                        <ul className="mt-1.5 list-inside list-disc space-y-0.5 text-xs text-ink">
                          {s.verify.map((v) => (
                            <li key={v}>{v}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-md border border-line bg-paper p-4">
              <h3 className="text-[11px] uppercase tracking-wide text-ink-soft">Sources used</h3>
              <ul className="mt-2 space-y-2 text-sm">
                {receipt.dataSources.map((d) => (
                  <li key={d.name}>
                    <div className="font-medium text-ink">
                      {d.name} · {d.used} stop{d.used === 1 ? '' : 's'}
                    </div>
                    <div className="text-xs text-ink-soft">{d.note}</div>
                  </li>
                ))}
                {receipt.weather && (
                  <li>
                    <div className="font-medium text-ink">{receipt.weather.source} · weather</div>
                    <div className="text-xs text-ink-soft">
                      {receipt.weather.condition}, {Math.round(receipt.weather.temperature)}°C · retrieved{' '}
                      {new Date(receipt.weather.retrievedAt).toLocaleTimeString()}
                    </div>
                  </li>
                )}
              </ul>
            </div>

            <div className="rounded-md border border-dashed border-line bg-paper p-4">
              <h3 className="text-[11px] uppercase tracking-wide text-ink-soft">What we could not verify</h3>
              <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-ink-soft">
                {receipt.unknowns.map((u) => (
                  <li key={u}>{u}</li>
                ))}
              </ul>
            </div>
          </div>

          <p className="rounded-md bg-secondary/60 p-3 text-xs leading-relaxed text-ink-soft">
            This receipt explains recommendations made from the data actually available. Match scores are a transparent product
            heuristic, not an official or safety rating. A place with no community reports is not described as safe — absence of
            reports is not evidence of safety.
          </p>
        </div>
      )}
    </section>
  )
}
