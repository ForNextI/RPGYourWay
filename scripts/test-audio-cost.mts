import assert from 'node:assert/strict'
import {
  measureWavDuration,
  transcriptionProviderCostMicrousd,
  ttsProviderCostMicrousdFromWav,
  ttsReserveMicrousd,
} from '../lib/usage/audio-cost.ts'
import { roundUsageMicrousdToCent } from '../lib/usage/money.ts'

assert.equal(transcriptionProviderCostMicrousd({ input_tokens: 14, output_tokens: 45 }), 243)
assert.equal(transcriptionProviderCostMicrousd({ input_tokens: 1000, output_tokens: 500 }), 3750)
assert.equal(transcriptionProviderCostMicrousd(undefined), 0)

// Minimal PCM WAV: mono, 16-bit, 16 kHz, exactly two seconds of silence.
const sampleRate = 16_000
const channels = 1
const bitsPerSample = 16
const bytesPerSample = bitsPerSample / 8
const dataBytes = sampleRate * channels * bytesPerSample * 2
const wav = new Uint8Array(44 + dataBytes)
const view = new DataView(wav.buffer)
const writeAscii = (offset: number, text: string) => [...text].forEach((char, index) => { wav[offset + index] = char.charCodeAt(0) })
writeAscii(0, 'RIFF')
view.setUint32(4, 36 + dataBytes, true)
writeAscii(8, 'WAVE')
writeAscii(12, 'fmt ')
view.setUint32(16, 16, true)
view.setUint16(20, 1, true)
view.setUint16(22, channels, true)
view.setUint32(24, sampleRate, true)
view.setUint32(28, sampleRate * channels * bytesPerSample, true)
view.setUint16(32, channels * bytesPerSample, true)
view.setUint16(34, bitsPerSample, true)
writeAscii(36, 'data')
view.setUint32(40, dataBytes, true)

const measured = measureWavDuration(wav)
assert.equal(measured.durationSeconds, 2)
assert.equal(measured.byteRate, 32_000)
assert.equal(measured.dataBytes, 64_000)
const tts = ttsProviderCostMicrousdFromWav(wav)
assert.equal(tts.providerCostMicrousd, 500)
assert.equal(ttsReserveMicrousd(), 250_000)

// One whole-turn customer rounding, never component-by-component rounding.
const ttt = 4_485
const gameplay = 684_112
const ttsCost = 72_500
assert.equal(roundUsageMicrousdToCent(ttt + gameplay + ttsCost), 760_000)
assert.notEqual(
  roundUsageMicrousdToCent(ttt) + roundUsageMicrousdToCent(gameplay) + roundUsageMicrousdToCent(ttsCost),
  roundUsageMicrousdToCent(ttt + gameplay + ttsCost),
)

assert.throws(() => measureWavDuration(new Uint8Array(44)), /invalid WAV/i)
console.log('RPG Your Way audio-cost sanity checks passed: TTT usage, WAV duration, TTS estimate, reserve, and aggregate-before-rounding.')
