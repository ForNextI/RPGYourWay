'use client'

import { Check, LoaderCircle, Mic, Settings2, Square, Volume2, VolumeX, X } from 'lucide-react'
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { takeSpeechChunks } from '@/lib/aigm/voice-streaming'

const NARRATION_ENABLED_KEY = 'wardenspc:aigm:narration-enabled'
const NARRATION_VOICE_KEY = 'wardenspc:aigm:narration-voice'
const ONBOARDING_NARRATION_ENABLED_KEY = 'wardenspc:aigm:onboarding-narration-enabled'
const MAX_RECORDING_MS = 2 * 60 * 1000
const MAX_PREFETCHED_SPEECH_JOBS = 2
const MAX_SPEECH_RETRIES = 2
const SPEECH_RMS_THRESHOLD = 0.012
const MIN_VOICED_AUDIO_MS = 140
const MIN_SPEECH_PEAK_RMS = 0.018

type NarrationVoice = 'fable' | 'marin' | 'ballad'
type AigmVoiceProfile = 'gameplay' | 'onboarding'

export interface AigmVoiceControlsHandle {
  prepareNarration: () => void
  beginNarration: () => void
  appendNarrationDelta: (delta: string) => void
  finishNarration: (fullText: string) => void
  stopNarration: () => void
  replay: (text: string) => void
}

interface AigmVoiceControlsProps {
  disabled?: boolean
  profile?: AigmVoiceProfile
  guidedMode?: boolean
  assistantResponding?: boolean
  assistantName?: string
  currentMessage: string
  onTranscriptUpdate: (text: string) => void
  onTranscriptComplete?: (text: string) => void
  onBusyChange?: (busy: boolean) => void
  onError: (message: string) => void
}

interface SpeechJob {
  generation: number
  text: string
  promise: Promise<ArrayBuffer> | null
}

function supportedRecordingType() {
  if (typeof MediaRecorder === 'undefined') return ''
  return [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/mp4',
  ].find((type) => MediaRecorder.isTypeSupported(type)) || ''
}

function extensionFor(type: string) {
  if (type.includes('ogg')) return 'ogg'
  if (type.includes('mp4')) return 'm4a'
  return 'webm'
}

async function parseTranscriptionStream(response: Response, onDelta: (delta: string) => void) {
  if (!response.body) throw new Error('The transcription service returned no readable stream.')
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let completeText = ''

  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''

    for (const line of lines) {
      if (!line.trim()) continue
      const event = JSON.parse(line) as { type?: string; delta?: string; text?: string; error?: string }
      if (event.type === 'delta' && event.delta) {
        completeText += event.delta
        onDelta(event.delta)
      } else if (event.type === 'done' && typeof event.text === 'string') {
        completeText = event.text
      } else if (event.type === 'error') {
        throw new Error(event.error || 'The transcription failed.')
      }
    }
  }

  return completeText.trim()
}

export const AigmVoiceControls = forwardRef<AigmVoiceControlsHandle, AigmVoiceControlsProps>(function AigmVoiceControls({
  disabled = false,
  profile = 'gameplay',
  guidedMode = false,
  assistantResponding = false,
  assistantName,
  currentMessage,
  onTranscriptUpdate,
  onTranscriptComplete,
  onBusyChange,
  onError,
}, ref) {
  const onboardingProfile = profile === 'onboarding'
  const spokenAssistantName = onboardingProfile ? 'Ithamir' : assistantName?.trim() || 'Game Master'
  const settingsId = onboardingProfile ? 'ithamir-voice-settings' : 'aigm-voice-settings'
  const narrationEnabledKey = onboardingProfile ? ONBOARDING_NARRATION_ENABLED_KEY : NARRATION_ENABLED_KEY
  const spokenNoun = onboardingProfile ? 'message' : 'turn'
  const [narrationEnabled, setNarrationEnabled] = useState(true)
  const [voice, setVoice] = useState<NarrationVoice>(onboardingProfile ? 'ballad' : 'fable')
  const [showSettings, setShowSettings] = useState(false)
  const [openingMicrophone, setOpeningMicrophone] = useState(false)
  const [recording, setRecording] = useState(false)
  const [transcribing, setTranscribing] = useState(false)
  const [speaking, setSpeaking] = useState(false)

  const recorderRef = useRef<MediaRecorder | null>(null)
  const recordingStreamRef = useRef<MediaStream | null>(null)
  const recordingChunksRef = useRef<Blob[]>([])
  const recordingTimerRef = useRef<number | null>(null)
  const recordingAudioContextRef = useRef<AudioContext | null>(null)
  const recordingAnalyserFrameRef = useRef<number | null>(null)
  const recordingMonitorAvailableRef = useRef(false)
  const recordingVoicedMsRef = useRef(0)
  const recordingPeakRmsRef = useRef(0)
  const transcriptPrefixRef = useRef('')
  const currentMessageRef = useRef(currentMessage)
  const transcriptTextRef = useRef('')
  const speechBufferRef = useRef('')
  const streamedTextRef = useRef('')
  const speechHasBegunRef = useRef(false)
  const speechQueueRef = useRef<SpeechJob[]>([])
  const speechGenerationRef = useRef(0)
  const narrationInterruptedRef = useRef(false)
  const speechPumpRunningRef = useRef(false)
  const speechAbortControllersRef = useRef(new Set<AbortController>())
  const audioContextRef = useRef<AudioContext | null>(null)
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null)
  const cancelRecordingRef = useRef(false)
  const microphonePhaseRef = useRef<'idle' | 'opening' | 'recording' | 'stopping' | 'transcribing'>('idle')
  const microphoneGenerationRef = useRef(0)
  const transcriptionAbortRef = useRef<AbortController | null>(null)
  const guidedButtonRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    currentMessageRef.current = currentMessage
  }, [currentMessage])

  useEffect(() => {
    if (!guidedMode || onboardingProfile) return
    const frame = window.requestAnimationFrame(() => guidedButtonRef.current?.focus())
    return () => window.cancelAnimationFrame(frame)
  }, [guidedMode, onboardingProfile])

  useEffect(() => {
    const storedNarrationPreference = window.localStorage.getItem(narrationEnabledKey)
    setNarrationEnabled(storedNarrationPreference === null ? true : storedNarrationPreference === 'true')
    if (onboardingProfile) {
      setVoice('ballad')
    } else {
      const storedVoice = window.localStorage.getItem(NARRATION_VOICE_KEY)
      setVoice(storedVoice === 'marin' ? 'marin' : 'fable')
    }

    return () => {
      if (recordingTimerRef.current) window.clearTimeout(recordingTimerRef.current)
      if (recordingAnalyserFrameRef.current) window.cancelAnimationFrame(recordingAnalyserFrameRef.current)
      recordingAnalyserFrameRef.current = null
      void recordingAudioContextRef.current?.close()
      recordingAudioContextRef.current = null
      microphoneGenerationRef.current += 1
      microphonePhaseRef.current = 'idle'
      transcriptionAbortRef.current?.abort()
      transcriptionAbortRef.current = null
      recordingStreamRef.current?.getTracks().forEach((track) => track.stop())
      for (const controller of speechAbortControllersRef.current) controller.abort()
      audioSourceRef.current?.stop()
      void audioContextRef.current?.close()
    }
  }, [narrationEnabledKey, onboardingProfile])

  function ensureAudioContext() {
    if (!audioContextRef.current) audioContextRef.current = new AudioContext()
    if (audioContextRef.current.state === 'suspended') void audioContextRef.current.resume()
    return audioContextRef.current
  }

  function stopNarration() {
    narrationInterruptedRef.current = true
    speechGenerationRef.current += 1
    speechBufferRef.current = ''
    streamedTextRef.current = ''
    speechHasBegunRef.current = false
    speechQueueRef.current = []
    for (const controller of speechAbortControllersRef.current) controller.abort()
    speechAbortControllersRef.current.clear()
    try {
      audioSourceRef.current?.stop()
    } catch {
      // The source may already have ended.
    }
    audioSourceRef.current = null
    setSpeaking(false)
  }

  async function playAudio(arrayBuffer: ArrayBuffer, generation: number) {
    if (generation !== speechGenerationRef.current) return
    const context = ensureAudioContext()
    const audioBuffer = await context.decodeAudioData(arrayBuffer.slice(0))
    if (generation !== speechGenerationRef.current) return

    await new Promise<void>((resolve, reject) => {
      const source = context.createBufferSource()
      source.buffer = audioBuffer
      source.connect(context.destination)
      source.onended = () => {
        if (audioSourceRef.current === source) audioSourceRef.current = null
        resolve()
      }
      audioSourceRef.current = source
      try {
        source.start()
      } catch (error) {
        reject(error)
      }
    })
  }

  async function waitBeforeSpeechRetry(attempt: number, generation: number) {
    await new Promise<void>((resolve) => window.setTimeout(resolve, 350 * attempt))
    if (generation !== speechGenerationRef.current) throw new DOMException('Narration stopped.', 'AbortError')
  }

  async function requestSpeech(text: string, generation: number, attempt = 0): Promise<ArrayBuffer> {
    if (generation !== speechGenerationRef.current) throw new DOMException('Narration stopped.', 'AbortError')
    const controller = new AbortController()
    speechAbortControllersRef.current.add(controller)
    try {
      const response = await fetch('/api/aigm/speech', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, voice, profile }),
        signal: controller.signal,
      })
      if (!response.ok) {
        const payload = await response.json().catch(() => ({})) as { error?: string }
        const retryable = response.status === 429 || response.status >= 500
        if (retryable && attempt < MAX_SPEECH_RETRIES) {
          await waitBeforeSpeechRetry(attempt + 1, generation)
          return requestSpeech(text, generation, attempt + 1)
        }
        throw new Error(payload.error || 'The narration service could not speak this passage.')
      }
      return response.arrayBuffer()
    } finally {
      speechAbortControllersRef.current.delete(controller)
    }
  }

  function primeSpeechQueue() {
    let started = speechQueueRef.current.filter((job) => job.promise).length
    for (const job of speechQueueRef.current) {
      if (started >= MAX_PREFETCHED_SPEECH_JOBS) break
      if (job.promise || job.generation !== speechGenerationRef.current) continue
      job.promise = requestSpeech(job.text, job.generation)
      void job.promise.catch(() => undefined)
      started += 1
    }
  }

  async function pumpSpeechQueue() {
    if (speechPumpRunningRef.current) return
    const pumpGeneration = speechGenerationRef.current
    speechPumpRunningRef.current = true
    setSpeaking(true)
    let failed = false
    try {
      while (speechQueueRef.current.length > 0) {
        if (pumpGeneration !== speechGenerationRef.current) break
        primeSpeechQueue()
        const job = speechQueueRef.current.shift()
        if (!job || job.generation !== pumpGeneration) continue
        const promise = job.promise ?? requestSpeech(job.text, job.generation)
        primeSpeechQueue()
        const audio = await promise
        if (job.generation !== speechGenerationRef.current) continue
        await playAudio(audio, job.generation)
      }
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) {
        failed = true
        speechQueueRef.current = []
        for (const controller of speechAbortControllersRef.current) controller.abort()
        speechAbortControllersRef.current.clear()
        onError(`${error instanceof Error ? error.message : 'The narration could not be played.'} Narration stopped rather than skipping part of the reply. Use Listen to try the complete reply again.`)
      }
    } finally {
      speechPumpRunningRef.current = false
      const currentGenerationHasWork = speechQueueRef.current.some((job) => job.generation === speechGenerationRef.current)
      if (!failed && currentGenerationHasWork) {
        void pumpSpeechQueue()
      } else if (pumpGeneration === speechGenerationRef.current) {
        setSpeaking(false)
        if (guidedMode) requestAnimationFrame(() => guidedButtonRef.current?.focus())
      }
    }
  }

  function speechSafeText(text: string) {
    return text
      .replace(/\[([^\]]+)\]\(https?:\/\/[^)]+\)/gi, '$1')
      .replace(/<https?:\/\/[^>]+>/gi, '')
      .replace(/(?:https?:\/\/|www\.)\S+/gi, '')
      .replace(/\s+/g, ' ')
      .trim()
  }

  function enqueueSpeech(text: string) {
    const clean = speechSafeText(text)
    if (!clean) return
    speechHasBegunRef.current = true
    speechQueueRef.current.push({
      generation: speechGenerationRef.current,
      text: clean,
      promise: null,
    })
    primeSpeechQueue()
    void pumpSpeechQueue()
  }

  function drainSpeechBuffer(final: boolean) {
    const result = takeSpeechChunks(speechBufferRef.current, final, {
      minimum: speechHasBegunRef.current ? 280 : 80,
      maximum: speechHasBegunRef.current ? 720 : 430,
    })
    speechBufferRef.current = result.rest
    for (const chunk of result.chunks) enqueueSpeech(chunk)
  }

  function prepareNarration() {
    ensureAudioContext()
  }

  function beginNarration() {
    setShowSettings(false)
    stopNarration()
    narrationInterruptedRef.current = false
    if (!guidedMode && !narrationEnabled) return
    ensureAudioContext()
    streamedTextRef.current = ''
  }

  function appendNarrationDelta(delta: string) {
    if (narrationInterruptedRef.current || (!guidedMode && !narrationEnabled) || !delta) return
    streamedTextRef.current += delta
    speechBufferRef.current += delta
    drainSpeechBuffer(false)
  }

  function finishNarration(fullText: string) {
    if (narrationInterruptedRef.current || (!guidedMode && !narrationEnabled)) return
    const streamedText = streamedTextRef.current
    if (!streamedText.trim()) {
      speechBufferRef.current = fullText
    } else if (fullText.startsWith(streamedText)) {
      speechBufferRef.current += fullText.slice(streamedText.length)
    }
    drainSpeechBuffer(true)
  }

  function replay(text: string) {
    stopNarration()
    narrationInterruptedRef.current = false
    ensureAudioContext()
    speechBufferRef.current = text
    drainSpeechBuffer(true)
  }

  useImperativeHandle(ref, () => ({
    prepareNarration,
    beginNarration,
    appendNarrationDelta,
    finishNarration,
    stopNarration,
    replay,
  }))

  function finishRecording() {
    if (microphonePhaseRef.current !== 'recording') return
    const recorder = recorderRef.current
    if (!recorder || recorder.state === 'inactive') {
      microphonePhaseRef.current = 'idle'
      setRecording(false)
      onBusyChange?.(false)
      return
    }
    microphonePhaseRef.current = 'stopping'
    recorder.stop()
  }

  function cancelRecording() {
    cancelRecordingRef.current = true
    finishRecording()
  }

  useEffect(() => {
    if (!recording && !speaking) return

    function keyboardTargetUsesSpace(target: EventTarget | null) {
      if (!(target instanceof Element)) return false
      return Boolean(target.closest('input, textarea, select, button, a[href], [contenteditable="true"], [role="button"], [role="slider"], [role="checkbox"], [role="radio"], [role="switch"], [role="textbox"]'))
    }

    function handleVoiceKeyboard(event: globalThis.KeyboardEvent) {
      const manualListenControl = event.target instanceof Element
        ? event.target.closest('[data-aigm-manual-listen="true"]')
        : null
      if (!guidedMode && speaking && (event.code === 'Space' || event.key === ' ') && !event.shiftKey && !event.ctrlKey && !event.altKey && !event.metaKey && !event.isComposing && (Boolean(manualListenControl) || !keyboardTargetUsesSpace(event.target))) {
        event.preventDefault()
        stopNarration()
        return
      }
      if (event.key === 'Escape' && guidedMode) {
        event.preventDefault()
        if (recording) cancelRecording()
        else if (speaking) stopNarration()
        return
      }
      if (!recording || guidedMode) return
      if (event.key !== 'Enter' || event.shiftKey || event.ctrlKey || event.altKey || event.metaKey || event.isComposing) return
      event.preventDefault()
      finishRecording()
    }

    window.addEventListener('keydown', handleVoiceKeyboard)
    return () => window.removeEventListener('keydown', handleVoiceKeyboard)
  }, [guidedMode, recording, speaking])

  function stopRecordingMonitor() {
    if (recordingAnalyserFrameRef.current) window.cancelAnimationFrame(recordingAnalyserFrameRef.current)
    recordingAnalyserFrameRef.current = null
    const context = recordingAudioContextRef.current
    recordingAudioContextRef.current = null
    if (context) void context.close().catch(() => undefined)
  }

  function startRecordingMonitor(stream: MediaStream) {
    stopRecordingMonitor()
    recordingMonitorAvailableRef.current = false
    recordingVoicedMsRef.current = 0
    recordingPeakRmsRef.current = 0

    try {
      const context = new AudioContext()
      const source = context.createMediaStreamSource(stream)
      const analyser = context.createAnalyser()
      analyser.fftSize = 1024
      source.connect(analyser)
      recordingAudioContextRef.current = context
      recordingMonitorAvailableRef.current = true
      const samples = new Float32Array(analyser.fftSize)
      let previousSampleAt = performance.now()

      const sample = (now: number) => {
        analyser.getFloatTimeDomainData(samples)
        let sumSquares = 0
        for (const value of samples) sumSquares += value * value
        const rms = Math.sqrt(sumSquares / samples.length)
        recordingPeakRmsRef.current = Math.max(recordingPeakRmsRef.current, rms)
        const elapsed = Math.min(50, Math.max(0, now - previousSampleAt))
        if (rms >= SPEECH_RMS_THRESHOLD) recordingVoicedMsRef.current += elapsed
        previousSampleAt = now
        recordingAnalyserFrameRef.current = window.requestAnimationFrame(sample)
      }
      recordingAnalyserFrameRef.current = window.requestAnimationFrame(sample)
      if (context.state === 'suspended') void context.resume().catch(() => undefined)
    } catch {
      recordingMonitorAvailableRef.current = false
      stopRecordingMonitor()
    }
  }

  function recordingContainsSpeech() {
    if (!recordingMonitorAvailableRef.current) return true
    return recordingVoicedMsRef.current >= MIN_VOICED_AUDIO_MS && recordingPeakRmsRef.current >= MIN_SPEECH_PEAK_RMS
  }

  async function transcribeRecording(blob: Blob, mimeType: string, generation: number) {
    if (!blob.size) {
      if (generation === microphoneGenerationRef.current) {
        microphonePhaseRef.current = 'idle'
        onError('Nothing recorded.')
        onBusyChange?.(false)
      }
      return
    }
    if (generation !== microphoneGenerationRef.current) return
    microphonePhaseRef.current = 'transcribing'
    setTranscribing(true)
    transcriptTextRef.current = ''
    transcriptPrefixRef.current = currentMessageRef.current.trimEnd()

    let abortController: AbortController | null = null
    try {
      const data = new FormData()
      data.append('audio', new File([blob], `rpgyw-${spokenNoun}.${extensionFor(mimeType)}`, { type: mimeType || 'audio/webm' }))
      data.append('context', profile)
      abortController = new AbortController()
      transcriptionAbortRef.current?.abort()
      transcriptionAbortRef.current = abortController
      const response = await fetch('/api/aigm/transcribe', { method: 'POST', body: data, signal: abortController.signal })
      if (!response.ok) {
        const payload = await response.json().catch(() => ({})) as { error?: string }
        throw new Error(payload.error || 'The microphone recording could not be transcribed.')
      }

      const finalText = await parseTranscriptionStream(response, (delta) => {
        if (generation !== microphoneGenerationRef.current) return
        transcriptTextRef.current += delta
        const separator = transcriptPrefixRef.current && transcriptTextRef.current ? ' ' : ''
        onTranscriptUpdate(`${transcriptPrefixRef.current}${separator}${transcriptTextRef.current}`)
      })
      if (generation !== microphoneGenerationRef.current) return
      const separator = transcriptPrefixRef.current && finalText ? ' ' : ''
      const completeText = `${transcriptPrefixRef.current}${separator}${finalText}`.trim()
      onTranscriptUpdate(completeText)
      if (guidedMode && completeText) onTranscriptComplete?.(completeText)
    } catch (error) {
      if (generation === microphoneGenerationRef.current && !(error instanceof DOMException && error.name === 'AbortError')) {
        onError(error instanceof Error ? error.message : 'The microphone recording could not be transcribed.')
      }
    } finally {
      if (transcriptionAbortRef.current === abortController) transcriptionAbortRef.current = null
      if (generation === microphoneGenerationRef.current) {
        microphonePhaseRef.current = 'idle'
        setTranscribing(false)
        onBusyChange?.(false)
        if (guidedMode) requestAnimationFrame(() => guidedButtonRef.current?.focus())
      }
    }
  }

  async function startRecording() {
    if (disabled || microphonePhaseRef.current !== 'idle' || openingMicrophone || recording || transcribing) return
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      onError('This browser does not provide the microphone recording tools RPG Your Way needs.')
      return
    }

    const generation = microphoneGenerationRef.current + 1
    microphoneGenerationRef.current = generation
    microphonePhaseRef.current = 'opening'
    let stream: MediaStream | null = null
    setShowSettings(false)
    stopNarration()
    setOpeningMicrophone(true)
    onBusyChange?.(true)

    try {
      const activeStream = await navigator.mediaDevices.getUserMedia({ audio: true })
      stream = activeStream
      if (generation !== microphoneGenerationRef.current || microphonePhaseRef.current !== 'opening') {
        activeStream.getTracks().forEach((track) => track.stop())
        return
      }
      const mimeType = supportedRecordingType()
      const recorder = mimeType ? new MediaRecorder(activeStream, { mimeType, audioBitsPerSecond: 64_000 }) : new MediaRecorder(activeStream)
      recordingStreamRef.current = activeStream
      recorderRef.current = recorder
      recordingChunksRef.current = []
      startRecordingMonitor(activeStream)

      recorder.ondataavailable = (event) => {
        if (event.data.size) recordingChunksRef.current.push(event.data)
      }
      recorder.onerror = () => {
        onError('The browser lost the microphone recording.')
        if (recorder.state !== 'inactive') recorder.stop()
      }
      cancelRecordingRef.current = false
      recorder.onstop = () => {
        const currentGeneration = generation === microphoneGenerationRef.current
        if (recordingTimerRef.current) window.clearTimeout(recordingTimerRef.current)
        recordingTimerRef.current = null
        activeStream.getTracks().forEach((track) => track.stop())
        if (recordingStreamRef.current === activeStream) recordingStreamRef.current = null
        if (recorderRef.current === recorder) recorderRef.current = null
        if (currentGeneration) setRecording(false)
        const actualType = recorder.mimeType || mimeType || 'audio/webm'
        const blob = new Blob(recordingChunksRef.current, { type: actualType })
        recordingChunksRef.current = []
        const containsSpeech = recordingContainsSpeech()
        stopRecordingMonitor()
        if (!currentGeneration) return
        if (cancelRecordingRef.current) {
          cancelRecordingRef.current = false
          microphonePhaseRef.current = 'idle'
          onBusyChange?.(false)
          if (guidedMode) requestAnimationFrame(() => guidedButtonRef.current?.focus())
          return
        }
        if (!containsSpeech) {
          microphonePhaseRef.current = 'idle'
          onError('Nothing recorded.')
          onBusyChange?.(false)
          if (guidedMode) requestAnimationFrame(() => guidedButtonRef.current?.focus())
          return
        }
        void transcribeRecording(blob, actualType, generation)
      }

      recorder.start(250)
      microphonePhaseRef.current = 'recording'
      setOpeningMicrophone(false)
      setRecording(true)
      recordingTimerRef.current = window.setTimeout(finishRecording, MAX_RECORDING_MS)
    } catch (error) {
      stream?.getTracks().forEach((track) => track.stop())
      stopRecordingMonitor()
      recordingStreamRef.current = null
      recorderRef.current = null
      if (generation !== microphoneGenerationRef.current) return
      microphonePhaseRef.current = 'idle'
      setOpeningMicrophone(false)
      setRecording(false)
      onBusyChange?.(false)
      onError(error instanceof DOMException && error.name === 'NotAllowedError'
        ? 'Microphone permission was not granted.'
        : 'RPG Your Way could not open this microphone.')
    }
  }

  function toggleNarrationEnabled() {
    const next = !narrationEnabled
    setNarrationEnabled(next)
    window.localStorage.setItem(narrationEnabledKey, String(next))
    if (next) ensureAudioContext()
    else stopNarration()
  }

  function chooseVoice(nextVoice: NarrationVoice) {
    if (onboardingProfile || nextVoice === 'ballad') return
    setVoice(nextVoice)
    window.localStorage.setItem(NARRATION_VOICE_KEY, nextVoice)
  }

  const guidedUnavailable = (disabled && !speaking) || openingMicrophone || transcribing || (assistantResponding && !speaking)
  const guidedLabel = recording
    ? 'Stop and send'
    : openingMicrophone
      ? 'Opening microphone'
      : transcribing
        ? 'Transcribing and sending'
        : speaking
          ? 'Interrupt and speak'
          : assistantResponding
            ? 'Game Master responding'
            : 'Start speaking'
  const guidedStatus = recording
    ? 'Listening. Press Space or Enter to stop and send. Press Escape to cancel.'
    : openingMicrophone
      ? 'Opening your microphone.'
      : transcribing
        ? 'Transcribing your turn and preparing to send it.'
        : speaking
          ? 'The Game Master is speaking. Press Space or Enter to interrupt and speak. Press Escape to stop the reply.'
          : assistantResponding
            ? 'The Game Master is responding.'
            : 'Ready. Press Space or Enter to begin speaking.'

  async function handleGuidedButton() {
    if (microphonePhaseRef.current === 'recording') {
      finishRecording()
      return
    }
    if (microphonePhaseRef.current !== 'idle') return
    if (speaking) stopNarration()
    await startRecording()
  }

  function handleMicrophoneButton() {
    if (microphonePhaseRef.current === 'recording') {
      finishRecording()
      return
    }
    if (microphonePhaseRef.current === 'idle') void startRecording()
  }

  if (guidedMode && !onboardingProfile) {
    return (
      <div className="relative flex min-w-[10.5rem] shrink-0 flex-col items-stretch gap-1.5">
        <button
          ref={guidedButtonRef}
          type="button"
          onClick={() => void handleGuidedButton()}
          disabled={guidedUnavailable}
          aria-label={`Voice Turn: ${guidedLabel}`}
          aria-describedby="voice-turn-status"
          className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border px-4 text-sm font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-55 ${recording ? 'border-red-400 bg-red-500/15 text-red-600 dark:text-red-300' : speaking ? 'border-accent/60 bg-accent/15 text-accent' : 'border-primary/50 bg-primary/10 text-primary hover:bg-primary/15'}`}
        >
          {openingMicrophone || transcribing || (assistantResponding && !speaking) ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : recording || speaking ? <Square className="size-3.5 fill-current" aria-hidden="true" /> : <Mic className="size-4" aria-hidden="true" />}
          <span>{guidedLabel}</span>
        </button>
        <span id="voice-turn-status" className="sr-only" role="status" aria-live="polite">{guidedStatus}</span>
      </div>
    )
  }

  return (
    <div className="relative flex shrink-0 items-center gap-2">
      <button
        type="button"
        onClick={handleMicrophoneButton}
        disabled={disabled || openingMicrophone || transcribing}
        aria-label={recording ? 'Stop recording' : openingMicrophone ? 'Opening microphone' : transcribing ? `Transcribing spoken ${spokenNoun}` : `Speak your ${spokenNoun}`}
        title={recording ? 'Stop recording' : `Speak your ${spokenNoun}`}
        className={`flex size-11 items-center justify-center rounded-xl border transition disabled:cursor-not-allowed disabled:opacity-45 ${recording ? 'border-red-400 bg-red-500/15 text-red-600 dark:text-red-300' : 'border-border bg-background text-muted-foreground hover:border-primary/45 hover:text-foreground'}`}
      >
        {openingMicrophone || transcribing ? <LoaderCircle className="size-5 animate-spin" aria-hidden="true" /> : recording ? <Square className="size-4 fill-current" aria-hidden="true" /> : <Mic className="size-5" aria-hidden="true" />}
      </button>

      <button
        type="button"
        onClick={() => speaking ? stopNarration() : setShowSettings((current) => !current)}
        aria-label={speaking ? `Stop ${spokenAssistantName} narration` : `${spokenAssistantName} voice settings`}
        aria-expanded={speaking ? undefined : showSettings}
        aria-controls={speaking ? undefined : settingsId}
        title={speaking ? 'Stop speaking' : 'Narration settings'}
        className={`flex size-11 items-center justify-center rounded-xl border transition ${speaking ? 'border-primary/60 bg-primary/15 text-primary' : narrationEnabled ? 'border-primary/45 bg-primary/10 text-primary' : 'border-border bg-background text-muted-foreground hover:border-primary/45 hover:text-foreground'}`}
      >
        {speaking ? <Square className="size-4 fill-current" aria-hidden="true" /> : narrationEnabled ? <Volume2 className="size-5" aria-hidden="true" /> : <VolumeX className="size-5" aria-hidden="true" />}
      </button>

      {showSettings && !speaking && (
        <div id={settingsId} className="absolute bottom-[calc(100%+0.65rem)] right-0 z-50 w-80 rounded-2xl border border-primary/35 bg-card p-4 text-sm shadow-2xl" role="dialog" aria-label={`${spokenAssistantName} voice settings`}>
          <button type="button" onClick={() => setShowSettings(false)} className="absolute right-2 top-2 rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground" aria-label="Close narration settings"><X className="size-4" aria-hidden="true" /></button>
          <div className="flex items-center gap-2 pr-8">
            <Settings2 className="size-5 text-primary" aria-hidden="true" />
            <p className="font-display text-lg font-bold">Voice</p>
          </div>
          <button type="button" onClick={toggleNarrationEnabled} aria-pressed={narrationEnabled} className="mt-4 flex w-full items-center justify-between gap-3 rounded-xl border border-border bg-background px-3 py-3 text-left font-semibold">
            <span>Read {spokenAssistantName} replies aloud</span>
            <span className={`flex size-6 items-center justify-center rounded-md border ${narrationEnabled ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-transparent'}`}><Check className="size-4" aria-hidden="true" /></span>
          </button>
          {onboardingProfile ? (
            <div className="mt-4 rounded-xl border border-border bg-background px-3 py-3">
              <span className="block text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">Ithamir’s voice</span>
              <span className="mt-1 block font-bold">Warm and composed</span>
            </div>
          ) : (
            <fieldset className="mt-4" disabled={!narrationEnabled}>
              <legend className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">Game Master voice</legend>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <button type="button" onClick={() => chooseVoice('fable')} aria-pressed={voice === 'fable'} className={`rounded-xl border px-3 py-3 text-left disabled:opacity-45 ${voice === 'fable' ? 'border-primary bg-primary/10' : 'border-border bg-background'}`}>
                  <span className="block font-bold">Male voice</span><span className="text-xs text-muted-foreground">Default</span>
                </button>
                <button type="button" onClick={() => chooseVoice('marin')} aria-pressed={voice === 'marin'} className={`rounded-xl border px-3 py-3 text-left disabled:opacity-45 ${voice === 'marin' ? 'border-primary bg-primary/10' : 'border-border bg-background'}`}>
                  <span className="block font-bold">Female voice</span>
                </button>
              </div>
            </fieldset>
          )}
          <p className="mt-3 text-xs leading-relaxed text-muted-foreground">Microphone recordings are sent to the AI service for transcription. Voices are AI-generated. {onboardingProfile ? 'Ithamir uses his own onboarding voice.' : 'The selected voice reads your Game Master’s replies.'}</p>
        </div>
      )}

      {(openingMicrophone || recording || transcribing) && (
        <span className="absolute bottom-[calc(100%+0.55rem)] left-0 z-40 whitespace-nowrap rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground shadow-xl" role="status">
          {openingMicrophone ? 'Opening your microphone…' : recording ? 'Listening… press Enter or click the red stop control when you finish.' : `Transcribing your ${spokenNoun}…`}
        </span>
      )}
    </div>
  )
})
