/**
 * TTS Helper for Demo Recording
 *
 * Uses Gemini 2.5 Flash native audio model to generate user voice audio
 * with a different voice than the app's default "Kore" voice.
 */

import { GoogleGenAI, Modality } from '@google/genai'
import * as fs from 'fs'
import * as path from 'path'

// Use Zephyr voice for simulated user (app uses Kore)
const USER_VOICE = 'Zephyr'
const MODEL = 'gemini-2.5-flash-preview-native-audio-dialog'

export interface TTSOptions {
  text: string
  outputPath?: string
  voice?: string
}

export interface TTSResult {
  audioData: Buffer
  outputPath?: string
}

/**
 * Generate speech audio from text using Gemini TTS
 */
export async function generateUserSpeech(options: TTSOptions): Promise<TTSResult> {
  const apiKey = process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY

  if (!apiKey) {
    throw new Error('GEMINI_API_KEY or VITE_GEMINI_API_KEY environment variable is required')
  }

  const ai = new GoogleGenAI({ apiKey })

  const config = {
    responseModalities: [Modality.AUDIO],
    speechConfig: {
      voiceConfig: {
        prebuiltVoiceConfig: {
          voiceName: options.voice || USER_VOICE,
        },
      },
    },
  }

  const model = ai.models.generateContent({
    model: MODEL,
    config,
    contents: [
      {
        role: 'user',
        parts: [{ text: options.text }],
      },
    ],
  })

  const response = await model

  // Extract audio data from response
  const audioData = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data

  if (!audioData) {
    throw new Error('No audio data in response')
  }

  const buffer = Buffer.from(audioData, 'base64')

  // Save to file if outputPath provided
  if (options.outputPath) {
    const dir = path.dirname(options.outputPath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    fs.writeFileSync(options.outputPath, buffer)
  }

  return {
    audioData: buffer,
    outputPath: options.outputPath,
  }
}

/**
 * Demo utterances to generate for the demo recording
 */
export const DEMO_UTTERANCES = [
  {
    id: 'meeting-debrief',
    text: "Had a great meeting with Alex about the marketing project. The deadline moved to Friday. He asked me to send over the updated brand guidelines. Oh, and I'm feeling pretty good about how things are going — less stressed than last week.",
  },
  {
    id: 'goal-checkin',
    text: "On track with my Spanish learning goal. Been consistent with Duolingo this week.",
  },
  {
    id: 'morning-greeting',
    text: "Good morning! What's on my schedule today?",
  },
]

/**
 * Pre-generate all demo audio files
 */
export async function generateAllDemoAudio(outputDir: string): Promise<void> {
  console.log('Generating demo audio files...')

  for (const utterance of DEMO_UTTERANCES) {
    const outputPath = path.join(outputDir, `${utterance.id}.wav`)
    console.log(`Generating: ${utterance.id}`)

    try {
      await generateUserSpeech({
        text: utterance.text,
        outputPath,
      })
      console.log(`  Saved: ${outputPath}`)
    } catch (error) {
      console.error(`  Failed: ${error}`)
    }
  }

  console.log('Demo audio generation complete!')
}

// CLI entry point
if (require.main === module) {
  const outputDir = process.argv[2] || path.join(__dirname, '..', '..', 'demo-audio')
  generateAllDemoAudio(outputDir).catch(console.error)
}
