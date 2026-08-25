'use client'

import { HelpCircle, Sparkles, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useAccessibleDialog } from '@/components/accessibility/use-accessible-dialog'

interface CharacterAssistanceDialogProps {
  open: boolean
  level: number
  onClose: () => void
  onSave: (level: number) => void
}

const LEVELS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const

export function CharacterAssistanceDialog({ open, level, onClose, onSave }: CharacterAssistanceDialogProps) {
  const [draft, setDraft] = useState(level)
  const headingRef = useRef<HTMLHeadingElement | null>(null)
  const dialogRef = useAccessibleDialog<HTMLElement>({ open, onClose, initialFocusRef: headingRef })

  useEffect(() => { if (open) setDraft(level) }, [open, level])
  if (!open) return null

  return (
    <div className="fixed inset-0 z-[105] flex items-center justify-center bg-black/70 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section ref={dialogRef} tabIndex={-1} className="w-full max-w-2xl rounded-3xl border border-primary/45 bg-card p-5 shadow-2xl outline-none sm:p-7" role="dialog" aria-modal="true" aria-labelledby="character-assistance-heading">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Sparkles className="size-6" aria-hidden="true" /></span>
            <div>
              <p className="font-mono text-[0.68rem] font-bold uppercase tracking-[0.2em] text-primary">AIGM character help</p>
              <h2 ref={headingRef} tabIndex={-1} id="character-assistance-heading" className="mt-1 font-display text-2xl font-bold outline-none sm:text-3xl">How much help do you want running your characters?</h2>
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl p-2 text-muted-foreground transition hover:bg-secondary hover:text-foreground" aria-label="Close character help settings"><X className="size-5" aria-hidden="true" /></button>
        </div>

        <p className="mt-4 text-sm leading-7 text-muted-foreground">This controls how proactively the AIGM points out abilities, reactions, spells, features, or other character options that might matter in the current situation.</p>
        <div className="mt-4 grid grid-cols-5 gap-2 sm:grid-cols-10">
          {LEVELS.map((value) => <button key={value} type="button" onClick={() => setDraft(value)} className={`min-h-10 rounded-xl border text-sm font-bold ${draft === value ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background hover:border-primary/55'}`}>{value}</button>)}
        </div>
        <div className="mt-2 flex justify-between gap-4 text-[0.72rem] font-semibold text-muted-foreground"><span>1 · Let me handle them</span><span className="text-right">10 · Actively help me</span></div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-border bg-background/65 p-3 text-xs leading-relaxed text-muted-foreground"><strong className="block text-foreground">1–3 · Hands off</strong>The AIGM usually lets you run your own abilities unless you ask.</div>
          <div className="rounded-2xl border border-border bg-background/65 p-3 text-xs leading-relaxed text-muted-foreground"><strong className="block text-foreground">4–7 · Helpful</strong>The AIGM points out useful opportunities when it notices them.</div>
          <div className="rounded-2xl border border-border bg-background/65 p-3 text-xs leading-relaxed text-muted-foreground"><strong className="block text-foreground">8–10 · Active</strong>The AIGM actively watches for applicable character options and reminders.</div>
        </div>

        <div className="mt-5 flex items-start gap-3 rounded-2xl border border-accent/35 bg-accent/10 p-4 text-sm leading-7 text-muted-foreground"><HelpCircle className="mt-1 size-5 shrink-0 text-accent" aria-hidden="true" /><p><strong className="text-foreground">This help is not foolproof.</strong> The AIGM may miss an opportunity or occasionally suggest something that does not apply. For example, it might notice that <strong className="text-foreground">Savage Attacker</strong> could apply to an attack and ask whether you want to use it. It works best when RPG Your Way has the feature’s rules through a supported SRD or you have included those rules in the character record.</p></div>

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} className="min-h-11 rounded-xl border border-border px-5 font-bold text-muted-foreground">Cancel</button>
          <button type="button" onClick={() => onSave(draft)} className="min-h-11 rounded-xl bg-primary px-5 font-bold text-primary-foreground">Use {draft} out of 10</button>
        </div>
      </section>
    </div>
  )
}
