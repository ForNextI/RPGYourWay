'use client'

import { ChangeEvent, DragEvent, useEffect, useMemo, useRef, useState } from 'react'
import {
  SHAPE_MAX_INPUT_CHARACTERS,
  assessShapeTranscript,
  extractWardensCampaignTranscript,
} from '@/lib/shape/transcript'

type DescriptionLevel = 'plain' | 'light' | 'rich' | 'purple'
type JobStatus = 'processing' | 'error' | 'completed'

type ShapeProject = {
  id: string
  title: string
  completed_parts: number
  created_at: string
  updated_at: string
}

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
  model: string | null
  project_id: string | null
  project_part_number: number
  error_message: string | null
  input_tokens: number
  cached_input_tokens: number
  cache_write_tokens: number
  output_tokens: number
  request_count: number
  maximum_deduction_microusd: number
  provider_cost_microusd: number
  billed_microusd: number
  result_text?: string | null
  partial_result_text?: string | null
  created_at: string
  updated_at: string
}

const descriptions: Array<{ value: DescriptionLevel; label: string; detail: string }> = [
  { value: 'plain', label: 'Plain and simple', detail: 'Clean, economical prose with only the description needed for clarity.' },
  { value: 'light', label: 'Slightly descriptive', detail: 'A little more atmosphere, sensory detail, and flow.' },
  { value: 'rich', label: 'Very descriptive', detail: 'Fuller scenes, stronger imagery, and more textured prose.' },
  { value: 'purple', label: 'Excessively flowery and purple', detail: 'Lavish, ornate, image-heavy prose on purpose.' },
]

function safeFilename(title: string, suffix = '.txt') {
  const base = title.trim().replace(/[<>:"/\\|?*\u0000-\u001f]/g, '').replace(/\s+/g, ' ').slice(0, 80) || 'RPG-Your-Way-Script'
  return `${base}${suffix}`
}

function formatMicrousd(value: number | null | undefined) {
  const amount = Number(value || 0) / 1_000_000
  return `$${amount.toFixed(2)}`
}

function progressLabel(job: ShapeJob) {
  if (job.status === 'completed') return 'Story complete'
  if (job.phase === 'analysis') return `Preparing continuity ${Math.min(job.next_analysis_chunk_index + 1, job.analysis_total)} of ${job.analysis_total}`
  if (job.phase === 'writing') return `Writing section ${Math.min(job.next_chunk_index + 1, job.writing_total)} of ${job.writing_total}`
  return 'Preparing Script job'
}

function realProgress(job: ShapeJob) {
  const analysisTotal = Math.max(0, Number(job.analysis_total || 0))
  const writingTotal = Math.max(0, Number(job.writing_total || 0))
  const total = Math.max(1, analysisTotal + writingTotal)
  const completed = job.status === 'completed'
    ? total
    : Math.min(analysisTotal, Math.max(0, Number(job.next_analysis_chunk_index || 0)))
      + Math.min(writingTotal, Math.max(0, Number(job.next_chunk_index || 0)))
  const percent = Math.min(100, Math.max(0, (completed / total) * 100))
  return { completed, total, percent }
}

export function ShapeWorkspace() {
  const [title, setTitle] = useState('')
  const [transcript, setTranscript] = useState('')
  const [descriptionLevel, setDescriptionLevel] = useState<DescriptionLevel>('light')
  const [job, setJob] = useState<ShapeJob | null>(null)
  const [projects, setProjects] = useState<ShapeProject[]>([])
  const [projectMode, setProjectMode] = useState(false)
  const [selectedProjectId, setSelectedProjectId] = useState('')
  const [projectTitle, setProjectTitle] = useState('')
  const [running, setRunning] = useState(false)
  const [loadingResume, setLoadingResume] = useState(true)
  const [error, setError] = useState('')
  const [fileName, setFileName] = useState('')
  const [dragging, setDragging] = useState(false)
  const [duplicateBlocked, setDuplicateBlocked] = useState(false)
  const [quoteMicrousd, setQuoteMicrousd] = useState<number | null>(null)
  const [quoting, setQuoting] = useState(false)
  const cancelled = useRef(false)

  const assessment = useMemo(() => assessShapeTranscript(transcript.trim().length), [transcript])
  const selectedProject = projects.find((project) => project.id === selectedProjectId) || null

  async function loadProjects() {
    try {
      const response = await fetch('/api/shape/projects', { cache: 'no-store' })
      if (!response.ok) return
      const payload = await response.json() as { projects?: ShapeProject[] }
      setProjects(payload.projects || [])
    } catch {}
  }

  useEffect(() => {
    cancelled.current = false
    loadProjects()
    fetch('/api/shape/jobs', { cache: 'no-store' })
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
  }, [])

  function acceptRawFile(file: File) {
    setError('')
    setQuoteMicrousd(null)
    setDuplicateBlocked(false)
    setFileName(file.name)
    file.text()
      .then((raw) => {
        const extracted = file.name.toLowerCase().endsWith('.json') ? extractWardensCampaignTranscript(raw) : null
        if (extracted) {
          setTranscript(extracted.transcript)
          if (!title.trim() && extracted.title) setTitle(extracted.title)
        } else {
          setTranscript(raw)
        }
      })
      .catch(() => setError('I could not read that file. Try a plain-text transcript or paste it below.'))
  }

  function readFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (file) acceptRawFile(file)
  }

  function dropFile(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setDragging(false)
    const file = event.dataTransfer.files?.[0]
    if (file) acceptRawFile(file)
  }

  async function requestQuote() {
    setError('')
    setDuplicateBlocked(false)
    const clean = transcript.trim()
    if (clean.length < 250 || !assessment.ready) return
    setQuoting(true)
    try {
      const response = await fetch('/api/shape/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript: clean, project_mode: projectMode }),
      })
      const payload = await response.json() as { maximum_microusd?: number; error?: string }
      if (!response.ok || !payload.maximum_microusd) throw new Error(payload.error || 'Script could not estimate this request.')
      setQuoteMicrousd(payload.maximum_microusd)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Script could not estimate this request.')
    } finally {
      setQuoting(false)
    }
  }

  async function createJob(confirmDuplicate = false) {
    setError('')
    setDuplicateBlocked(false)
    const clean = transcript.trim()
    if (clean.length < 250) {
      setError('Give Script at least 250 characters of gameplay transcript to work with.')
      return
    }
    if (!assessment.ready) {
      setError(`This submission is too large for one Script request. Divide it into at least ${assessment.minimumParts} natural story sections and use campaign-project mode so continuity carries forward.`)
      return
    }
    if (projectMode && !selectedProjectId && !(projectTitle.trim() || title.trim())) {
      setError('Give the new campaign project a name.')
      return
    }

    if (quoteMicrousd === null) {
      setError('See the maximum estimated deduction before beginning this Script request.')
      return
    }

    setRunning(true)
    try {
      const response = await fetch('/api/shape/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          transcript: clean,
          description_level: descriptionLevel,
          project_mode: projectMode,
          project_id: projectMode ? selectedProjectId : '',
          project_title: projectMode && !selectedProjectId ? (projectTitle.trim() || title.trim()) : '',
          confirm_duplicate: confirmDuplicate,
        }),
      })
      const payload = await response.json() as { job?: ShapeJob; error?: string; duplicate?: boolean }
      if (!response.ok || !payload.job) {
        if (payload.duplicate) setDuplicateBlocked(true)
        throw new Error(payload.error || 'Script could not create the job.')
      }
      setJob(payload.job)
      await loadProjects()
      await runJob(payload.job.id)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Script could not create the job.')
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
        if (!response.ok) {
          throw new Error(payload.error || 'Script could not finish this processing step.')
        }
        if (!payload.job) throw new Error('Script returned an incomplete job update.')
        if (payload.job.status === 'completed') {
          await loadProjects()
          setRunning(false)
          return
        }
      }
      throw new Error('Script reached its safety limit before the job was finished. Resume the job to continue.')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Script could not finish this processing step.')
      setRunning(false)
    }
  }


  async function discardJob() {
    if (!job || job.status === 'completed') return
    if (!window.confirm('Discard this saved Script job? Successful AI processing already completed will be charged, and the unused reservation will be released.')) return
    setError('')
    try {
      const response = await fetch(`/api/shape/jobs?id=${encodeURIComponent(job.id)}`, { method: 'DELETE' })
      const payload = await response.json() as { error?: string }
      if (!response.ok) throw new Error(payload.error || 'Script could not discard that saved job.')
      setJob(null)
      setTranscript('')
      setTitle('')
      setFileName('')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Script could not discard that saved job.')
    }
  }

  function startAnother() {
    const continuingProject = job?.project_id || ''
    setJob(null)
    setTranscript('')
    setTitle('')
    setFileName('')
    setError('')
    setDuplicateBlocked(false)
    setQuoteMicrousd(null)
    if (continuingProject) {
      setProjectMode(true)
      setSelectedProjectId(continuingProject)
    }
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

  function downloadPartialResult() {
    if (!job?.partial_result_text) return
    const notice = [
      'INCOMPLETE SCRIPT RESULT',
      'This file contains only prose successfully checkpointed before Script stopped.',
      'Resume the saved Script job to attempt the remaining material.',
      '',
      job.partial_result_text,
    ].join('\n')
    const blob = new Blob([notice], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = safeFilename(`${job.title}-INCOMPLETE`)
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 1_000)
  }

  async function copyResult() {
    if (!job?.result_text) return
    try {
      await navigator.clipboard.writeText(job.result_text)
    } catch {
      setError('Your browser would not allow Script to copy the finished story. The download button still works.')
    }
  }


  if (loadingResume) return <p className="shape-loading" role="status">Checking your Script workbench…</p>

  if (job) {
    const persistedError = job.status === 'error' ? (job.error_message || '') : ''
    const visibleError = error || persistedError
    const progress = realProgress(job)
    return (
      <section className="shape-workbench" aria-labelledby="shape-job-title">
        <div className="shape-job-heading">
          <div>
            <p className="kicker">{job.status === 'completed' ? 'Script complete' : 'Saved Script job'}</p>
            <h2 id="shape-job-title">{job.title}</h2>
            <p>{progressLabel(job)}{job.project_id ? ` · campaign-project part ${job.project_part_number}` : ''}</p>
          </div>
          <div className="shape-progress-pill">{job.transcript_characters.toLocaleString()} characters</div>
        </div>

        {job.status !== 'completed' ? (
          <div className="shape-live-progress" role="status" aria-live="polite">
            <div className="shape-live-progress-copy">
              <span className={running ? 'shape-live-working-dot active' : 'shape-live-working-dot'} aria-hidden="true" />
              <strong>{progressLabel(job)}</strong>
              <span>{progress.completed} of {progress.total} completed</span>
            </div>
            <div
              className="shape-live-progress-track"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={progress.total}
              aria-valuenow={progress.completed}
              aria-valuetext={`${progressLabel(job)}. ${progress.completed} of ${progress.total} completed.`}
            >
              <span style={{ width: `${progress.percent}%` }} />
            </div>
            <small>Progress advances only when a real Script step finishes.</small>
          </div>
        ) : null}

        <div className="shape-progress-grid shape-commercial-progress" aria-label="Script processing and usage progress">
          <div><strong>{job.analysis_total ? `${job.next_analysis_chunk_index}/${job.analysis_total}` : '—'}</strong><span>continuity sections</span></div>
          <div><strong>{job.next_chunk_index}/{job.writing_total}</strong><span>writing sections</span></div>
          <div><strong>{formatMicrousd(job.maximum_deduction_microusd)}</strong><span>approved maximum</span></div>
          {job.status === 'completed' ? <div><strong>{formatMicrousd(job.billed_microusd)}</strong><span>final deduction</span></div> : null}
        </div>

        {visibleError ? (
          <p className="shape-error" role="alert">
            {visibleError}
            {/balance|usage/i.test(visibleError) ? <> <a href="/account#add-usage">Add usage in Account.</a></> : null}
          </p>
        ) : null}
        {job.status !== 'completed' ? (
          <div className="shape-actions">
            <button className="button button-primary" type="button" disabled={running} onClick={() => runJob(job.id)}>
              {running ? 'Script is working…' : job.status === 'error' ? 'Resume this Script job' : 'Continue Script job'}
            </button>
            {job.partial_result_text ? <button className="button button-secondary" type="button" disabled={running} onClick={downloadPartialResult}>Download work so far</button> : null}
            <button className="button button-secondary" type="button" disabled={running} onClick={discardJob}>Discard saved job</button>
            <p>Transcript, continuity, prose, and progress are checkpointed to your account after completed steps.</p>
          </div>
        ) : (
          <>
            {job.project_id ? <p className="shape-project-success"><strong>Campaign project updated.</strong> The compact continuity ledger from this part is ready to carry into the next transcript section.</p> : null}
            <div className="shape-actions">
              <button className="button button-primary" type="button" onClick={downloadResult}>Download story as text</button>
              <button className="button button-secondary" type="button" onClick={copyResult}>Copy story</button>
              <button className="button button-secondary" type="button" onClick={startAnother}>{job.project_id ? 'Script the next project part' : 'Script another transcript'}</button>
            </div>
            <article className="shape-result" aria-label="Finished Script prose">
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
          <p className="kicker">Script workbench</p>
          <h2 id="shape-workbench-title">Give Script the campaign you actually played.</h2>
          <p>Paste a transcript or upload a file. WardensPC campaign JSON exports are recognized automatically.</p>
        </div>
        <span className="shape-beta-pill active">Available now</span>
      </div>

      <div className="shape-public-preview-note testing">
        <strong>Your balance pays for successful AI processing.</strong>
        <span>See and approve the maximum deduction before Script begins. The final deduction can be lower, never higher.</span>
      </div>

      <div className="shape-form-grid">
        <label className="shape-field">
          <span>Story title</span>
          <input value={title} maxLength={120} onChange={(event) => setTitle(event.target.value)} placeholder="Untitled adventure" />
        </label>

        <div
          className={dragging ? 'shape-file-field dragging' : 'shape-file-field'}
          onDragEnter={(event) => { event.preventDefault(); setDragging(true) }}
          onDragOver={(event) => event.preventDefault()}
          onDragLeave={() => setDragging(false)}
          onDrop={dropFile}
        >
          <label htmlFor="shape-transcript-file">Upload or drop transcript</label>
          <input id="shape-transcript-file" type="file" accept=".txt,.md,.log,.json,text/plain,application/json" onChange={readFile} />
          <small>{fileName || 'TXT, Markdown, LOG, or a WardensPC campaign JSON export'}</small>
        </div>
      </div>

      <label className="shape-field shape-transcript-field">
        <span>Gameplay transcript</span>
        <textarea value={transcript} onChange={(event) => { setTranscript(event.target.value); setDuplicateBlocked(false); setQuoteMicrousd(null) }} placeholder="Paste the campaign transcript here…" />
      </label>

      <div className="shape-count-row">
        <span>{transcript.trim().length.toLocaleString()} / {SHAPE_MAX_INPUT_CHARACTERS.toLocaleString()} characters</span>
        {assessment.ready ? <span>Ready for one Script request</span> : <span>Divide into at least {assessment.minimumParts} chronological parts</span>}
      </div>

      <fieldset className="shape-project-mode">
        <legend>Is this a one-off story or part of a larger campaign?</legend>
        <div className="shape-project-options">
          <label className={!projectMode ? 'selected' : ''}>
            <input type="radio" name="shape-project-mode" checked={!projectMode} onChange={() => { setProjectMode(false); setQuoteMicrousd(null) }} />
            <strong>One transcript</strong>
            <span>Script this submission on its own.</span>
          </label>
          <label className={projectMode ? 'selected' : ''}>
            <input type="radio" name="shape-project-mode" checked={projectMode} onChange={() => { setProjectMode(true); setQuoteMicrousd(null) }} />
            <strong>Ongoing campaign project</strong>
            <span>Carry a compact continuity ledger into later transcript parts.</span>
          </label>
        </div>

        {projectMode ? (
          <div className="shape-project-picker">
            {projects.length ? (
              <label className="shape-field">
                <span>Continue an existing project, or start a new one</span>
                <select value={selectedProjectId} onChange={(event) => { setSelectedProjectId(event.target.value); setQuoteMicrousd(null) }}>
                  <option value="">Start a new project</option>
                  {projects.map((project) => <option key={project.id} value={project.id}>{project.title} · {project.completed_parts} completed part{project.completed_parts === 1 ? '' : 's'}</option>)}
                </select>
              </label>
            ) : null}
            {!selectedProject ? (
              <label className="shape-field">
                <span>Campaign project name</span>
                <input value={projectTitle} maxLength={120} onChange={(event) => setProjectTitle(event.target.value)} placeholder={title.trim() || 'My Script Project'} />
              </label>
            ) : (
              <p className="shape-project-context"><strong>{selectedProject.title}</strong> has {selectedProject.completed_parts} completed part{selectedProject.completed_parts === 1 ? '' : 's'}. This submission will become part {selectedProject.completed_parts + 1}.</p>
            )}
          </div>
        ) : null}
      </fieldset>

      <fieldset className="shape-description">
        <legend>How much description should Script add?</legend>
        <div className="shape-description-grid">
          {descriptions.map((choice) => (
            <label key={choice.value} className={descriptionLevel === choice.value ? 'shape-description-card selected' : 'shape-description-card'}>
              <input type="radio" name="description-level" value={choice.value} checked={descriptionLevel === choice.value} onChange={() => { setDescriptionLevel(choice.value); setQuoteMicrousd(null) }} />
              <strong>{choice.label}</strong>
              <span>{choice.detail}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <details className="shape-source-help">
        <summary>What should I give Script?</summary>
        <div>
          <p>Use the raw gameplay transcript. Script is meant to tell the same adventure as prose, not redesign the campaign.</p>
          <p>For campaigns larger than one million characters, divide the transcript at natural story breaks such as a session, chapter, adventure, or major location. Process the parts in chronological order using an ongoing campaign project.</p>
          <p>Script automatically handles smaller internal chunks, continuity analysis, and prose seams. You do not need to prepare those yourself.</p>
        </div>
      </details>

      {error ? (
        <p className="shape-error" role="alert">
          {error}
          {/balance|usage/i.test(error) ? <> <a href="/account#add-usage">Add usage in Account.</a></> : null}
        </p>
      ) : null}

      {quoteMicrousd !== null ? (
        <div className="shape-quote" role="status">
          <span>Maximum estimated deduction</span>
          <strong>{formatMicrousd(quoteMicrousd)}</strong>
          <small>The final deduction may be lower. It will not exceed this amount.</small>
        </div>
      ) : null}

      <div className="shape-actions">
        {quoteMicrousd === null ? (
          <button className="button button-primary" type="button" onClick={requestQuote} disabled={running || quoting || transcript.trim().length < 250 || !assessment.ready}>
            {quoting ? 'Estimating…' : 'See maximum usage'}
          </button>
        ) : (
          <button className="button button-primary" type="button" onClick={() => createJob(false)} disabled={running}>
            {running ? 'Creating Script job…' : `Begin Script · max ${formatMicrousd(quoteMicrousd)}`}
          </button>
        )}
        {duplicateBlocked ? <button className="button button-secondary" type="button" disabled={running} onClick={() => createJob(true)}>I really need to Script this exact transcript again</button> : null}
        {quoteMicrousd !== null ? <button className="button button-secondary" type="button" disabled={running} onClick={() => setQuoteMicrousd(null)}>Recalculate</button> : null}
        <p>Only successful metered AI processing is deducted from your RPG Your Way balance.</p>
      </div>
    </section>
  )
}
