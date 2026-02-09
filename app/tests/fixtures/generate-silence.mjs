/**
 * Generate a silent WAV file for use with Chromium's --use-file-for-fake-audio-capture flag.
 * 16kHz mono PCM16, 5 seconds of silence.
 */
import { writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outputPath = resolve(__dirname, 'silence.wav')

const sampleRate = 16000
const numChannels = 1
const bitsPerSample = 16
const durationSec = 5

const numSamples = sampleRate * durationSec
const dataSize = numSamples * numChannels * (bitsPerSample / 8)
const headerSize = 44
const fileSize = headerSize + dataSize

const buffer = Buffer.alloc(fileSize)

// RIFF header
buffer.write('RIFF', 0)
buffer.writeUInt32LE(fileSize - 8, 4)
buffer.write('WAVE', 8)

// fmt chunk
buffer.write('fmt ', 12)
buffer.writeUInt32LE(16, 16) // chunk size
buffer.writeUInt16LE(1, 20) // PCM format
buffer.writeUInt16LE(numChannels, 22)
buffer.writeUInt32LE(sampleRate, 24)
buffer.writeUInt32LE(sampleRate * numChannels * (bitsPerSample / 8), 28) // byte rate
buffer.writeUInt16LE(numChannels * (bitsPerSample / 8), 32) // block align
buffer.writeUInt16LE(bitsPerSample, 34)

// data chunk
buffer.write('data', 36)
buffer.writeUInt32LE(dataSize, 40)
// Samples are all zeros (silence) — Buffer.alloc initializes to 0

writeFileSync(outputPath, buffer)
console.log(`Generated ${outputPath} (${durationSec}s, ${sampleRate}Hz, ${numChannels}ch, ${bitsPerSample}bit)`)
