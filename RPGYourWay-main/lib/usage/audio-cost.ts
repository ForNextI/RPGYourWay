const TTS_ESTIMATED_MICROUSD_PER_SECOND = 250

function count(value: unknown) {
  const number = Number(value)
  return Number.isFinite(number) && number > 0 ? Math.floor(number) : 0
}

export type TranscriptionUsage = {
  inputTokens: number
  outputTokens: number
}

export function normalizeTranscriptionUsage(value: unknown): TranscriptionUsage {
  if (!value || typeof value !== 'object') return { inputTokens: 0, outputTokens: 0 }
  const payload = value as {
    usage?: unknown
    input_tokens?: unknown
    output_tokens?: unknown
  }
  const usage = payload.usage && typeof payload.usage === 'object'
    ? payload.usage as { input_tokens?: unknown; output_tokens?: unknown }
    : payload
  return {
    inputTokens: count(usage.input_tokens),
    outputTokens: count(usage.output_tokens),
  }
}

// gpt-4o-mini-transcribe: $1.25/M input + $5/M output.
// One token therefore costs 1.25 or 5 micro-US-dollars respectively.
export function transcriptionProviderCostMicrousd(value: unknown) {
  const usage = normalizeTranscriptionUsage(value)
  return Math.ceil((usage.inputTokens * 5 + usage.outputTokens * 20) / 4)
}

function ascii(bytes: Uint8Array, start: number, length: number) {
  return String.fromCharCode(...bytes.subarray(start, start + length))
}

export type WavMeasurement = {
  durationSeconds: number
  byteRate: number
  dataBytes: number
}

export function measureWavDuration(value: ArrayBuffer | Uint8Array): WavMeasurement {
  const bytes = value instanceof Uint8Array ? value : new Uint8Array(value)
  if (bytes.byteLength < 44 || ascii(bytes, 0, 4) !== 'RIFF' || ascii(bytes, 8, 4) !== 'WAVE') {
    throw new Error('Speech provider returned an invalid WAV file.')
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  let offset = 12
  let byteRate = 0
  let dataBytes = 0

  while (offset + 8 <= bytes.byteLength) {
    const chunkId = ascii(bytes, offset, 4)
    const chunkSize = view.getUint32(offset + 4, true)
    const dataStart = offset + 8
    const declaredEnd = dataStart + chunkSize

    if (chunkId === 'data' && (chunkSize === 0xffffffff || declaredEnd > bytes.byteLength)) {
      // OpenAI streams WAV responses with 0xFFFFFFFF length sentinels because the
      // final payload size is not known when the header is emitted. Treat the
      // remaining response bytes as PCM data rather than rejecting a valid stream.
      dataBytes += Math.max(0, bytes.byteLength - dataStart)
      break
    }

    if (declaredEnd > bytes.byteLength) break

    if (chunkId === 'fmt ' && chunkSize >= 16) {
      byteRate = view.getUint32(dataStart + 8, true)
    } else if (chunkId === 'data') {
      dataBytes += chunkSize
    }

    offset = declaredEnd + (chunkSize % 2)
  }

  if (!byteRate || !dataBytes) throw new Error('Speech provider returned a WAV file without measurable audio data.')
  return { durationSeconds: dataBytes / byteRate, byteRate, dataBytes }
}

// /audio/speech does not expose per-request usage. RPG Your Way therefore
// estimates TTS provider cost from server-measured WAV duration and reconciles
// that estimator against OpenAI's aggregate speech billing reports.
export function ttsProviderCostMicrousdFromWav(value: ArrayBuffer | Uint8Array) {
  const measurement = measureWavDuration(value)
  return {
    providerCostMicrousd: Math.max(1, Math.ceil(measurement.durationSeconds * TTS_ESTIMATED_MICROUSD_PER_SECOND)),
    ...measurement,
    estimatorMicrousdPerSecond: TTS_ESTIMATED_MICROUSD_PER_SECOND,
  }
}

export function ttsReserveMicrousd() {
  // A complete gameplay reply is clipped to 9,000 characters before narration.
  // Twenty-five cents gives a deliberately conservative whole-reply audio hold;
  // unused reservation is released when the turn settles.
  return 250_000
}
