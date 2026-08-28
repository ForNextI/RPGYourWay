'use client'

import { Check, Headphones, Mic, SlidersHorizontal, Sparkles, Volume2, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useAccessibleDialog } from '@/components/accessibility/use-accessible-dialog'
import type { VoiceGuidedPlaySettings } from '@/lib/aigm/campaign-storage'

interface VoiceGuidedPlayDialogProps {
  open: boolean
  settings: VoiceGuidedPlaySettings
  onClose: () => void
  onSave: (settings: VoiceGuidedPlaySettings) => void
  onListen: (text: string) => void
}

const VOICE_GUIDED_INSTRUCTIONS = `Voice-guided play is a spoken, step-by-step way to use the Play page. Keep keyboard focus on the Voice Turn button. Press Space or Enter to begin speaking. Press Space or Enter again to stop and send your turn. Your Game Master will answer and read the reply aloud. During a spoken reply, press the button to interrupt and begin your next turn. Press Escape to cancel a recording or stop a spoken reply. Guidance level one assumes you know the rules and your characters. Guidance level ten gives detailed scene information, offers practical choices, explains relevant abilities, and can handle rolls according to your dice preference. You can change these settings at any time.`

function guidanceDescription(level: number) {
  if (level <= 2) return 'Essential spoken information only. The AIGM assumes you know the rules, your characters, and their options.'
  if (level <= 4) return 'Essential information with brief reminders when something important may be easy to miss.'
  if (level <= 6) return 'Clear situational guidance and a few practical options when they are useful.'
  if (level <= 8) return 'Detailed descriptions, relevant abilities, likely consequences, and structured choices.'
  return 'Full verbal guidance with detailed choices, rules explanations when useful, and explicit next steps.'
}

export function VoiceGuidedPlayDialog({ open, settings, onClose, onSave, onListen }: VoiceGuidedPlayDialogProps) {
  const [draft, setDraft] = useState(settings)
  const headingRef = useRef<HTMLHeadingElement | null>(null)
  const dialogRef = useAccessibleDialog<HTMLElement>({ open, onClose, initialFocusRef: headingRef })

  useEffect(() => {
    if (open) setDraft(settings)
  }, [open, settings])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section ref={dialogRef} tabIndex={-1} className="max-h-[92dvh] w-full max-w-3xl overflow-y-auto rounded-3xl border border-primary/45 bg-card p-5 shadow-2xl outline-none sm:p-8" role="dialog" aria-modal="true" aria-labelledby="voice-guided-play-heading" aria-describedby="voice-guided-play-description">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Headphones className="size-6" aria-hidden="true" /></span>
            <div>
              <p className="font-mono text-[0.68rem] font-bold uppercase tracking-[0.2em] text-primary">For blind players and those assisting them</p>
              <h2 ref={headingRef} tabIndex={-1} id="voice-guided-play-heading" className="mt-2 font-display text-3xl font-bold outline-none">Voice-guided play</h2>
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl p-2 text-muted-foreground transition hover:bg-secondary hover:text-foreground" aria-label="Close voice-guided play settings"><X className="size-5" aria-hidden="true" /></button>
        </div>

        <div id="voice-guided-play-description" className="mt-5 space-y-3 text-sm leading-7 text-muted-foreground sm:text-base">
          <p>Voice-guided play is designed for blind players, screen-reader users, and anyone who prefers a spoken, step-by-step interface. It changes how the AIGM communicates, not who controls the game.</p>
          <p>Keep focus on one Voice Turn button. Press <strong className="text-foreground">Space or Enter</strong> to speak, press it again to stop and send, then hear the reply. Press <strong className="text-foreground">Escape</strong> to cancel a recording or stop a spoken reply.</p>
        </div>

        <button type="button" data-aigm-manual-listen="true" onClick={() => onListen(`${VOICE_GUIDED_INSTRUCTIONS} Current guidance level: ${draft.guidance_level}. Current dice preference: ${draft.dice_preference === 'player_rolls' ? 'you roll and tell the AIGM the result' : draft.dice_preference === 'aigm_rolls' ? 'the AIGM rolls automatically' : 'the AIGM asks each time'}.`)} className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl border border-primary/40 bg-primary/10 px-4 text-sm font-bold text-primary"><Volume2 className="size-4" aria-hidden="true" />Listen to these instructions</button>

        <button type="button" onClick={() => setDraft((current) => ({ ...current, enabled: !current.enabled }))} aria-pressed={draft.enabled} className="mt-6 flex w-full items-center justify-between gap-4 rounded-2xl border border-border bg-background px-4 py-4 text-left">
          <span><span className="block font-display text-xl font-bold">Enable voice-guided play</span><span className="mt-1 block text-sm leading-relaxed text-muted-foreground">The AIGM will read replies aloud and communicate important visual information in words.</span></span>
          <span className={`flex size-7 shrink-0 items-center justify-center rounded-lg border ${draft.enabled ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-transparent'}`}><Check className="size-4" aria-hidden="true" /></span>
        </button>

        <fieldset className="mt-6 rounded-2xl border border-border bg-background p-4 sm:p-5">
          <legend className="px-2 font-display text-xl font-bold">Guidance level</legend>
          <label htmlFor="voice-guidance-level" className="mt-2 block text-sm leading-relaxed text-muted-foreground">On a scale of one to ten, how much guidance would you like from the AIGM?</label>
          <div className="mt-4 grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3">
            <span className="font-mono text-sm font-bold text-muted-foreground">1</span>
            <input id="voice-guidance-level" type="range" min={1} max={10} step={1} value={draft.guidance_level} aria-describedby="voice-guidance-description" aria-valuetext={`Level ${draft.guidance_level}. ${guidanceDescription(draft.guidance_level)}`} onChange={(event) => setDraft((current) => ({ ...current, guidance_level: Number(event.target.value) }))} className="w-full accent-[var(--primary)]" />
            <span className="font-mono text-sm font-bold text-muted-foreground">10</span>
          </div>
          <output id="voice-guidance-description" htmlFor="voice-guidance-level" className="mt-4 block rounded-xl border border-primary/30 bg-primary/10 px-4 py-3 text-sm leading-relaxed">
            <strong className="text-primary">Level {draft.guidance_level}.</strong>{' '}
            {guidanceDescription(draft.guidance_level)}
          </output>
        </fieldset>

        <fieldset className="mt-6 rounded-2xl border border-border bg-background p-4 sm:p-5">
          <legend className="px-2 font-display text-xl font-bold">Player-character dice</legend>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Dice are part of player agency. Choose a default, then override it any time by speaking.</p>
          <div className="mt-4 grid gap-3">
            {[
              ['player_rolls', 'Ask me to roll', 'You roll physical, tactile, voice-activated, or digital dice and tell the AIGM the number. You can still say “Roll this one for me.”'],
              ['aigm_rolls', 'Roll for me automatically', 'The AIGM handles player-character rolls unless you provide your own result.'],
              ['ask_each_time', 'Ask each time', 'Whenever a player-character roll is needed, the AIGM asks whether you want to roll or have it roll.'],
            ].map(([value, title, description]) => (
              <label key={value} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 ${draft.dice_preference === value ? 'border-primary bg-primary/10' : 'border-border'}`}>
                <input type="radio" name="voice-dice-preference" value={value} checked={draft.dice_preference === value} onChange={() => setDraft((current) => ({ ...current, dice_preference: value as VoiceGuidedPlaySettings['dice_preference'] }))} className="mt-1 size-4 accent-[var(--primary)]" />
                <span><span className="block font-bold text-foreground">{title}</span><span className="mt-1 block text-sm leading-relaxed text-muted-foreground">{description}</span></span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} className="min-h-11 rounded-xl border border-border px-5 font-bold text-muted-foreground">Cancel</button>
          <button type="button" onClick={() => onSave(draft)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 font-bold text-primary-foreground"><SlidersHorizontal className="size-4" aria-hidden="true" />Save voice-guided play</button>
        </div>
      </section>
    </div>
  )
}

interface StoryDirectionDialogProps {
  open: boolean
  beginningAdventure: boolean
  onClose: () => void
  onBegin: () => void
  onListen: (text: string) => void
}

const STORY_DIRECTION_TEXT = `You’re in charge of where this story goes. This adventure can follow your direction, or you can let the AIGM guide the story completely. You can take control whenever you like and hand the reins back just as easily. Tell the AIGM to skip ahead, introduce a job, begin combat, slow down, spend more time with a character, add a companion, change the mood, or guide you toward the next adventure. You can also make the characters your own. The character editor can change core character facts such as ability scores, equipment, spells, features, and backstory, and the AIGM will use the edited record. You can tell the AIGM new campaign facts directly. A powerful story tool is the word retcon. If you say, Retcon: my character has always been an elf, not a human, the retcon becomes campaign canon. The old statement remains buried in the raw transcript, but ordinary play treats the character as having always been an elf. Adventures may begin in familiar ways, but those beginnings are only launch points. From there, the story is open-ended and responsive to your direction.`

export function StoryDirectionDialog({ open, beginningAdventure, onClose, onBegin, onListen }: StoryDirectionDialogProps) {
  const headingRef = useRef<HTMLHeadingElement | null>(null)
  const dialogRef = useAccessibleDialog<HTMLElement>({ open, onClose, initialFocusRef: headingRef })

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section ref={dialogRef} tabIndex={-1} className="max-h-[92dvh] w-full max-w-3xl overflow-y-auto rounded-3xl border border-accent/50 bg-card p-5 shadow-2xl outline-none sm:p-8" role="dialog" aria-modal="true" aria-labelledby="story-direction-heading">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-accent/15 text-accent"><Sparkles className="size-6" aria-hidden="true" /></span>
            <div>
              <p className="font-mono text-[0.68rem] font-bold uppercase tracking-[0.2em] text-accent">{beginningAdventure ? 'Before the first scene' : 'During your adventure'}</p>
              <h2 ref={headingRef} tabIndex={-1} id="story-direction-heading" className="mt-2 font-display text-3xl font-bold outline-none">You’re in charge of where this story goes.</h2>
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl p-2 text-muted-foreground transition hover:bg-secondary hover:text-foreground" aria-label="Close story direction help"><X className="size-5" aria-hidden="true" /></button>
        </div>

        <div className="mt-5 space-y-4 text-sm leading-7 text-muted-foreground sm:text-base">
          <p>This adventure can follow your direction, or you can let the AIGM guide the story completely. Take control whenever you like and hand the reins back just as easily.</p>
          <p>You can direct more than a character’s next action. Change the pace, redirect the story, introduce a goal, or tell the AIGM to lead.</p>
        </div>

        <div className="mt-5 grid gap-2 rounded-2xl border border-border bg-background p-4 text-sm sm:grid-cols-2">
          {[
            '“Let’s skip ahead to tomorrow morning.”',
            '“Introduce someone who has a job for us.”',
            '“I’m ready for some combat.”',
            '“Slow down. I want to keep talking with this character.”',
            '“Bring this scene to a close and move us to the next day.”',
            '“Take over and guide us toward the next adventure.”',
          ].map((example) => <p key={example} className="rounded-xl bg-secondary px-3 py-2.5 leading-relaxed">{example}</p>)}
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-primary/25 bg-primary/10 px-4 py-4 text-sm leading-7 text-muted-foreground">
            <p className="font-bold text-foreground">Make the characters your own</p>
            <p className="mt-2">The character editor can change more than a name or picture. Revise ability scores, equipment, spells, features, backstory, and other character facts, and the AIGM will use the edited record during play.</p>
            <p className="mt-2">RPG Your Way keeps the editor intentionally flexible. You decide how you want to play.</p>
          </div>
          <div className="rounded-2xl border border-accent/35 bg-accent/10 px-4 py-4 text-sm leading-7 text-muted-foreground">
            <p className="font-bold text-foreground">A powerful story tool: Retcon</p>
            <p className="mt-2">You can tell the AIGM new facts directly. If you need to replace something already established, say that you are making a <strong className="text-foreground">retcon</strong>.</p>
            <p className="mt-2 italic text-foreground">“Retcon: My character has always been an elf, not a human.”</p>
            <p className="mt-2">That becomes the campaign truth. The old statement remains in the raw transcript and may be discussed if you specifically ask about the correction, but ordinary play treats the retcon as though it had always been true.</p>
          </div>
        </div>

        <p className="mt-5 rounded-2xl border border-primary/25 bg-primary/10 px-4 py-4 text-sm leading-7 text-muted-foreground sm:text-base"><strong className="text-foreground">The opening may feel familiar.</strong> A quiet game may begin in a tavern; an action-heavy game may begin in immediate danger. Those beginnings are only launch points. From there, the story is open-ended and responsive to your direction.</p>

        <button type="button" data-aigm-manual-listen="true" onClick={() => onListen(STORY_DIRECTION_TEXT)} className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl border border-accent/45 bg-accent/10 px-4 text-sm font-bold text-accent"><Volume2 className="size-4" aria-hidden="true" />Listen to this explanation</button>

        <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          {!beginningAdventure && <button type="button" onClick={onClose} className="min-h-11 rounded-xl border border-border px-5 font-bold text-muted-foreground">Close</button>}
          <button type="button" onClick={beginningAdventure ? onBegin : onClose} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-accent px-5 font-bold text-accent-foreground"><Mic className="size-4" aria-hidden="true" />{beginningAdventure ? 'Begin the adventure' : 'Return to the adventure'}</button>
        </div>
      </section>
    </div>
  )
}
