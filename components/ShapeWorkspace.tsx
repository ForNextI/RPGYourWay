'use client'

import { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react'
import {
  SHAPE_MAX_INPUT_CHARACTERS,
  assessShapeTranscript,
  extractWardensCampaignTranscript,
} from '@/lib/shape/transcript'

type DescriptionLevel = 'plain' | 'light' | 'rich' | 'purple'
type JobStatus = 'processing' | 'error' | 'completed'

type ShapeJob = {
  id: string
  title: string
  description_level: DescriptionLevel
  transcript_characters: number
  status: JobStatus
  phase: string
  analysis_total: number
  writing_total: number
  next_analysis_chunk_index: number
  next_chunk_index: number
  prompt_version: string | null
  error_message: string | null
  input_tokens: number
  output_tokens: number
  result_text?: string | null
  created_at: string
  updated_at: string
}

const descriptions: Array<{ value: DescriptionLevel; label: string; detail: string }> = [
  { value: 'plain', label: 'Plain and simple', detail: 'Clean, direct prose with very little added decoration.' },
  { value: 'light', label: 'Slightly descriptive', detail: 'A little more atmosphere, detail, and flow.' },
  { value: 'rich', label: 'Very descriptive', detail: 'Fuller scenes, stronger imagery, and more textured prose.' },
  { value: 'purple', label: 'Excessively flowery and purple', detail: 'Lavish, ornate, and deliberately over the top.' },
]

function safeFilename(title: string) {
  const base = title.trim().replace(/[<>:"/\\|?*\u0000-\u001f]/g, '').replace(/\s+/g, ' ').slice(0, 80) || 'RPG-Your-Way-Shape'
  return `${base}.txt`
}

function progressLabel(job: ShapeJob) {
  if (job.status === 'completed') return 'Story complete'
  if (job.phase === 'analysis') return `Preparing continuity ${Math.min(job.next_analysis_chunk_index + 1, job.analysis_total)} of ${job.analysis_total}`
  if (job.phase === 'writing') return `Writing section ${Math.min(job.next_chunk_index + 1, job.writing_total)} of ${job.writing_total}`
  return 'Preparing Shape job'
}

export function ShapeWorkspace({ accessAllowed, accessConfigured }: { accessAllowed: boolean; accessConfigured: boolean }) {
  const [title, setTitle] = useState('')
  const [transcript, setTranscript] = useState('')
  const [descriptionLevel, setDescriptionLevel] = useState<DescriptionLevel>('light')
  const [job, setJob] = useState<ShapeJob | null>(null)
  const [running, setRunning] = useState(false)
  const [loadingResume, setLoadingResume] = useState(true)
  const [error, setError] = useState('')
  const [fileName, setFileName] = useState('')
  const cancelled = useRef(false)

  const assessment = useMemo(() => assessShapeTranscript(transcript.length), [transcript.length])

  useEffect(() => {
    cancelled.current = false
    if (!accessAllowed) {
      setLoadingResume(false)
      return () => { cancelled.current = true }
    }

    fetch('/api/shape/jobs?active=1', { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) return null
        return response.json() as Promise<{ job?: ShapeJob | null }>
      })
      .then((payload) => {
        if (!cancelled.current && payload?.job) setJob(payload.job)
      })
      .catch(() => {})
      .finally(() => { if (!cancelled.current) setLoadingResume(false) })

    return () => { cancelled.current = true }
  }, [accessAllowed])

  async function readFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    setError('')
    setFileName(file.name)
    try {
      const raw = await file.text()
      const extracted = file.name.toLowerCase().endsWith('.json') ? extractWardensCampaignTranscript(raw) : null
      if (extracted) {
        setTranscript(extracted.transcript)
        if (!title.trim() && extracted.title) setTitle(extracted.title)
      } else {
        setTranscript(raw)
      }
    } catch {
      setError('I could not read that file. Try a plain-text transcript or paste it below.')
    }
  }

  async function createJob() {
    setError('')
    const clean = transcript.trim()
    if (clean.length < 250) {
      setError('Give Shape at least 250 characters of gameplay transcript to work with.')
      return
    }
    if (!assessment.ready) {
      setError(`This submission is too large for one Shape request. Divide it into at least ${assessment.minimumParts} natural story sections.`)
      return
    }

    setRunning(true)
    try {
      const response = await fetch('/api/shape/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim(), transcript: clean, description_level: descriptionLevel }),
      })
      const payload = await response.json() as { job?: ShapeJob; error?: string }
      if (!response.ok || !payload.job) throw new Error(payload.error || 'Shape could not create the job.')
      setJob(payload.job)
      await runJob(payload.job.id)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Shape could not create the job.')
      setRunning(false)
    }
  }

  async function runJob(jobId: string) {
    setRunning(true)
    setError('')
    try {
      for (let step = 0; step < 64; step += 1) {
        const response = await fetch('/api/shape/transform', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ job_id: jobId }),
        })
        const payload = await response.json() as { job?: ShapeJob; error?: string }
        if (payload.job) setJob(payload.job)
        if (!response.ok) throw new Error(payload.error || 'Shape could not finish this processing step.')
        if (!payload.job) throw new Error('Shape returned an incomplete job update.')
        if (payload.job.status === 'completed') {
          setRunning(false)
          return
        }
      }
      throw new Error('Shape reached its safety limit before the job was finished. Resume the job to continue.')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Shape could not finish this processing step.')
      setRunning(false)
    }
  }

  function startAnother() {
    setJob(null)
    setTranscript('')
    setTitle('')
    setFileName('')
    setError('')
  }

  function downloadResult() {
    if (!job?.result_text) return
    const blob = new Blob([job.result_text], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = safeFilename(job.title)
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 1_000)
  }

  if (!accessAllowed) {
    return (
      <section className="shape-gate" aria-labelledby="shape-private-title">
        <p className="kicker">Private Shape test</p>
        <h2 id="shape-private-title">Shape is wired, but public processing stays closed until billing is in front of it.</h2>
        <p>{accessConfigured
          ? 'This signed-in account is not on the private Shape test list.'
          : 'Add RPGYW_SHAPE_BETA_EMAILS in Vercel before testing production conversions. The production route fails closed when that list is empty.'}</p>
      </section>
    )
  }

  if (loadingResume) return <p className="shape-loading" role="status">Checking for an unfinished Shape job…</p>

  if (job) {
    const totalTokens = (job.input_tokens || 0) + (job.output_tokens || 0)
    return (
      <section className="shape-workbench" aria-labelledby="shape-job-title">
        <div className="shape-job-heading">
          <div>
            <p className="kicker">{job.status === 'completed' ? 'Shape complete' : 'Durable Shape job'}</p>
            <h2 id="shape-job-title">{job.title}</h2>
            <p>{progressLabel(job)}</p>
          </div>
          <div className="shape-progress-pill">{job.transcript_characters.toLocaleString()} characters</div>
        </div>

        <div className="shape-progress-grid" aria-label="Shape processing progress">
          <div><strong>{job.next_analysis_chunk_index}/{job.analysis_total}</strong><span>continuity sections</span></div>
          <div><strong>{job.next_chunk_index}/{job.writing_total}</strong><span>writing sections</span></div>
          <div><strong>{totalTokens.toLocaleString()}</strong><span>recorded AI tokens</span></div>
        </div>

        {job.error_message && job.status === 'error' ? <p className="shape-error" role="alert">{job.error_message}</p> : null}
        {error ? <p className="shape-error" role="alert">{error}</p> : null}

        {job.status !== 'completed' ? (
          <div className="shape-actions">
            <button className="button button-primary" type="button" disabled={running} onClick={() => runJob(job.id)}>
              {running ? 'Shape is working…' : job.status === 'error' ? 'Resume this Shape job' : 'Continue Shape job'}
            </button>
            <p>Progress is saved to your account after each completed processing step.</p>
          </div>
        ) : (
          <>
            <div className="shape-actions">
              <button className="button button-primary" type="button" onClick={downloadResult}>Download story as text</button>
              <button className="button button-secondary" type="button" onClick={startAnother}>Shape another transcript</button>
            </div>
            <article className="shape-result" aria-label="Finished Shape prose">
              {job.result_text?.split(/\n\s*\n/).filter(Boolean).map((paragraph, index) => <p key={`${index}-${paragraph.slice(0, 24)}`}>{paragraph}</p>)}
            </article>
          </>
        )}
      </section>
    )
  }

  return (
    <section className="shape-workbench" aria-labelledby="shape-workbench-title">
      <div className="shape-job-heading">
        <div>
          <p className="kicker">Shape workbench</p>
          <h2 id="shape-workbench-title">Give Shape the campaign you actually played.</h2>
          <p>Paste a transcript or upload a text file. WardensPC campaign JSON exports are recognized automatically.</p>
        </div>
      </div>

      <div className="shape-form-grid">
        <label className="shape-field">
          <span>Story title</span>
          <input value={title} maxLength={120} onChange={(event) => setTitle(event.target.value)} placeholder="Untitled adventure" />
        </label>

        <label className="shape-file-field">
          <span>Upload transcript</span>
          <input type="file" accept=".txt,.md,.json,text/plain,application/json" onChange={readFile} />
          <small>{fileName || 'TXT, Markdown, or a WardensPC campaign JSON export'}</small>
        </label>
      </div>

      <label className="shape-field shape-transcript-field">
        <span>Gameplay transcript</span>
        <textarea value={transcript} onChange={(event) => setTranscript(event.target.value)} placeholder="Paste the campaign transcript here…" />
      </label>

      <div className="shape-count-row">
        <span>{transcript.length.toLocaleString()} / {SHAPE_MAX_INPUT_CHARACTERS.toLocaleString()} characters</span>
        {assessment.ready ? <span>One Shape request</span> : <span>Divide into at least {assessment.minimumParts} sections</span>}
      </div>

      <fieldset className="shape-description">
        <legend>How much description should Shape add?</legend>
        <div className="shape-description-grid">
          {descriptions.map((choice) => (
            <label key={choice.value} className={descriptionLevel === choice.value ? 'shape-description-card selected' : 'shape-description-card'}>
              <input type="radio" name="description-level" value={choice.value} checked={descriptionLevel === choice.value} onChange={() => setDescriptionLevel(choice.value)} />
              <strong>{choice.label}</strong>
              <span>{choice.detail}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {error ? <p className="shape-error" role="alert">{error}</p> : null}

      <div className="shape-actions">
        <button className="button button-primary" type="button" onClick={createJob} disabled={running || transcript.trim().length < 250 || !assessment.ready}>
          {running ? 'Creating Shape job…' : 'Start Shape'}
        </button>
        <p>Billing is deliberately not connected yet. Production conversion access remains private until the maximum-cost quote and Stripe gate are installed.</p>
      </div>
    </section>
  )
}
