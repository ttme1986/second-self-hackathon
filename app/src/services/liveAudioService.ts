import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai'

let apiKey = ''
const LIVE_MODEL =
  import.meta.env.VITE_GEMINI_LIVE_MODEL?.toString() ??
  'gemini-2.5-flash-native-audio-preview-12-2025'
// Text-only model for chat sessions (native audio model doesn't support text I/O via Live API)
const TEXT_MODEL =
  import.meta.env.VITE_GEMINI_TEXT_MODEL?.toString() ??
  'gemini-3-flash-preview'
const LIVE_VOICE = import.meta.env.VITE_GEMINI_LIVE_VOICE?.toString() ?? 'Kore'
const ENABLE_TRANSCRIPTION =
  (import.meta.env.VITE_GEMINI_LIVE_TRANSCRIPTIONS?.toString() ?? "true") ===
  "true";
const DEBUG_LIVE = (import.meta.env.VITE_GEMINI_LIVE_DEBUG?.toString() ?? 'false') === 'true'

const debugLog = (message: string, payload?: unknown) => {
  if (!DEBUG_LIVE) return
  if (payload === undefined) {
    console.log(message)
    return
  }
  console.log(message, payload)
}

const base64ToUint8Array = (base64: string) => {
  const binaryString = atob(base64)
  const bytes = new Uint8Array(binaryString.length)
  for (let i = 0; i < binaryString.length; i += 1) {
    bytes[i] = binaryString.charCodeAt(i)
  }
  return bytes
}

class LiveAudioService {
  private ai: GoogleGenAI | null = null
  private session: { sendRealtimeInput: (payload: Record<string, unknown>) => void; sendClientContent: (payload: Record<string, unknown>) => void; close?: () => void } | null = null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private chatSession: any = null  // Chat session for text-only mode (ai.chats.create)
  private inputContext: AudioContext | null = null
  private outputContext: AudioContext | null = null
  private inputSource: MediaStreamAudioSourceNode | null = null
  private workletNode: AudioWorkletNode | null = null
  private outputGain: GainNode | null = null
  private isConnected = false
  private textOnlyMode = false
  private pendingTextResponse = ''
  private needsUserGesture = false
  private currentStream: MediaStream | null = null

  // Transcription accumulation for finality detection
  private pendingOutputTranscription = ''
  private pendingInputTranscription = ''

  // Audio scheduling state with jitter buffer management
  private audioQueue: Float32Array[] = []
  private isPlaying = false
  private scheduledTime = 0
  private initialBufferTime = 0.1    // 100ms initial buffer
  private scheduleAheadTime = 0.3    // 300ms look-ahead for smoother playback
  private maxScheduleAhead = 5.0     // 5s hard cap for scheduledTime
  private scheduledSources: AudioBufferSourceNode[] = []
  private checkInterval: number | null = null

  // Local VAD state for UI feedback
  private isUserSpeakingLocal = false

  public onTranscriptUpdate:
    | ((transcript: string, isUser: boolean, isFinal: boolean) => void)
    | null = null
  public onAudioLevel: ((level: number) => void) | null = null
  public onStatus: ((status: string) => void) | null = null
  public onBargeIn: (() => void) | null = null
  public onVoiceActivity: ((isUserSpeaking: boolean) => void) | null = null

  private emitStatus(message: string) {
    debugLog(`[LiveAPI] ${message}`)
    this.onStatus?.(message)
  }

  /** Merge accumulated transcription text (handles both incremental and full-text modes) */
  private mergeText(accumulated: string, next: string): string {
    if (!accumulated) return next
    if (!next) return accumulated
    if (next.startsWith(accumulated)) return next
    if (accumulated.startsWith(next)) return accumulated
    return accumulated + ' ' + next
  }

  setApiKey(nextKey: string) {
    apiKey = nextKey
  }

  hasApiKey() {
    return Boolean(apiKey)
  }

  private ensureClient() {
    if (!apiKey) {
      throw new Error('Gemini API key missing')
    }
    if (!this.ai) {
      this.ai = new GoogleGenAI({ apiKey })
    }
  }

  get connected() {
    return this.isConnected
  }

  async connect(systemInstruction = '') {
    this.ensureClient()
    if (this.isConnected) {
      return
    }
    this.emitStatus('connecting')
    await this.doConnect(systemInstruction)
  }

  async connectTextOnly(systemInstruction = '') {
    this.ensureClient()
    if (this.isConnected) {
      debugLog('[LiveAPI] connectTextOnly: already connected')
      return
    }
    debugLog('[LiveAPI] connectTextOnly: starting connection...')
    this.emitStatus('connecting')

    // Text-only mode: the native audio model does not support text I/O via
    // the Live API (WebSocket). Use the standard chat API with a text-capable
    // model instead.
    this.textOnlyMode = true
    this.pendingTextResponse = ''

    this.chatSession = this.ai!.chats.create({
      model: TEXT_MODEL,
      config: { systemInstruction },
    })

    this.isConnected = true
    debugLog('[LiveAPI] connectTextOnly: chat session created, textOnlyMode=true')
    this.emitStatus('connected')
  }

  sendText(text: string) {
    if (this.textOnlyMode && this.chatSession) {
      // Text-only mode: use streaming chat API
      void this.sendTextViaChat(text)
      return
    }
    if (!this.session || !this.isConnected) {
      throw new Error('Not connected')
    }
    this.session.sendClientContent({
      turns: [{ role: 'user', parts: [{ text }] }],
      turnComplete: true,
    })
  }

  private async sendTextViaChat(text: string) {
    if (!this.chatSession) return
    try {
      const response = await this.chatSession.sendMessageStream({ message: text })
      let accumulated = ''
      for await (const chunk of response) {
        const chunkText = chunk.text ?? ''
        if (chunkText) {
          accumulated += chunkText
          this.onTranscriptUpdate?.(accumulated, false, false)
        }
      }
      if (accumulated) {
        this.onTranscriptUpdate?.(accumulated, false, true)
      }
    } catch (err) {
      console.error('[LiveAPI] sendTextViaChat error:', err)
    }
  }

  private async doConnect(systemInstruction: string) {
    const AudioContextClass = window.AudioContext || (window as unknown as Record<string, typeof AudioContext>).webkitAudioContext
    debugLog('[LiveAPI] init audio contexts')

    // Input context at 16kHz for Gemini API
    if (!this.inputContext || this.inputContext.state === 'closed') {
      this.inputContext = new AudioContextClass({ sampleRate: 16000 })
    }
    // Output context at 24kHz for Gemini audio output
    if (!this.outputContext || this.outputContext.state === 'closed') {
      this.outputContext = new AudioContextClass({ sampleRate: 24000 })
      this.outputGain = this.outputContext.createGain()
      this.outputGain.connect(this.outputContext.destination)
    }

    if (this.inputContext.state === 'suspended') await this.inputContext.resume()
    if (this.outputContext.state === 'suspended') await this.outputContext.resume()

    if (!this.currentStream || !this.currentStream.active) {
      debugLog('[LiveAPI] requesting mic stream')
      this.currentStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 16000,
          channelCount: 1,
        },
      })
      debugLog('[LiveAPI] mic stream acquired', this.currentStream.active)
    }

    const sessionPromise = this.ai!.live.connect({
      model: LIVE_MODEL,
      callbacks: {
        onopen: () => {
          this.emitStatus('socket-open')
        },
        onmessage: async (msg: LiveServerMessage) => {
          debugLog('[LiveAPI] message received')
          this.handleMessage(msg)
        },
        onclose: () => {
          this.isConnected = false
          this.emitStatus('closed')
        },
        onerror: (err) => {
          console.error('Live API runtime error', err)
          this.isConnected = false
          this.emitStatus('error')
          this.cleanupAudioNodes()
        },
      },
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: LIVE_VOICE } },
        },
        systemInstruction,
        inputAudioTranscription: ENABLE_TRANSCRIPTION ? {} : undefined,
        outputAudioTranscription: ENABLE_TRANSCRIPTION ? {} : undefined,
      },
    })

    this.session = await sessionPromise
    this.isConnected = true
    this.emitStatus('connected')
    await this.setupAudioProcessing()
    this.needsUserGesture =
      this.inputContext?.state !== 'running' || this.outputContext?.state !== 'running'
    if (this.needsUserGesture) {
      this.emitStatus('audio-locked')
      debugLog('[LiveAPI] audio locked', {
        input: this.inputContext?.state,
        output: this.outputContext?.state,
      })
    }
  }

  private handleMessage(msg: LiveServerMessage) {
    // Handle VAD signals
    if (msg.voiceActivity || msg.voiceActivityDetectionSignal) {
      debugLog('[LiveAPI] VAD', {
        voiceActivity: msg.voiceActivity,
        voiceActivityDetectionSignal: msg.voiceActivityDetectionSignal,
      })

      const vadSignal = (msg as unknown as Record<string, Record<string, unknown>>).voiceActivityDetectionSignal
      if (vadSignal) {
        const isUserSpeaking = vadSignal.voiceActivityStart !== undefined
        const userStopped = vadSignal.voiceActivityEnd !== undefined
        if (isUserSpeaking || userStopped) {
          this.onVoiceActivity?.(isUserSpeaking)
        }
        // Finalize input transcription when user stops speaking
        if (userStopped && this.pendingInputTranscription) {
          debugLog('[LiveAPI] finalizing user turn (VAD end)', { text: this.pendingInputTranscription })
          this.onTranscriptUpdate?.(this.pendingInputTranscription, true, true)
          this.pendingInputTranscription = ''
        }
      }
    }

    const serverContent = msg.serverContent

    // Server-confirmed interruption - finalize output transcription then flush
    if (serverContent?.interrupted) {
      if (this.pendingOutputTranscription) {
        debugLog('[LiveAPI] finalizing assistant turn (interrupted)', { text: this.pendingOutputTranscription })
        this.onTranscriptUpdate?.(this.pendingOutputTranscription, false, true)
        this.pendingOutputTranscription = ''
      }
      this.flushOutput()
      this.onBargeIn?.()
    }

    const parts = serverContent?.modelTurn?.parts ?? []

    // Text-only mode: accumulate text parts and emit full response
    if (this.textOnlyMode) {
      for (const part of parts) {
        if (part.text) {
          this.pendingTextResponse += part.text
          debugLog('[LiveAPI] text chunk', { text: part.text })
          this.onTranscriptUpdate?.(this.pendingTextResponse, false, false)
        }
      }
      if (serverContent?.turnComplete && this.pendingTextResponse) {
        debugLog('[LiveAPI] text turn complete', { text: this.pendingTextResponse })
        this.onTranscriptUpdate?.(this.pendingTextResponse, false, true)
        this.pendingTextResponse = ''
      }
      return
    }

    // Audio mode: process audio chunks (skip entirely when no output context)
    if (this.outputContext) {
      let audioQueued = false
      for (const part of parts) {
        if (part.inlineData?.data) {
          const mimeType = part.inlineData.mimeType ?? ''
          if (mimeType.startsWith('audio/')) {
            this.queueAudio(part.inlineData.data)
            audioQueued = true
            debugLog('[LiveAPI] audio chunk', mimeType)
          }
        }
      }

      if (audioQueued) {
        this.onAudioLevel?.(0.5)
      }
    }

    // Handle transcriptions (only actual spoken audio, not model text parts)
    const msgRecord = msg as unknown as Record<string, unknown>
    const outputTx =
      serverContent?.outputTranscription ??
      (msgRecord.outputTranscription as Record<string, unknown> | undefined) ??
      (msgRecord.output_transcription as Record<string, unknown> | undefined)
    const inputTx =
      serverContent?.inputTranscription ??
      (msgRecord.inputTranscription as Record<string, unknown> | undefined) ??
      (msgRecord.input_transcription as Record<string, unknown> | undefined)

    const outRec = outputTx as Record<string, unknown> | undefined
    const outputText =
      outRec?.text ?? outRec?.transcript ?? outRec?.content ?? outRec?.value
    if (outputText) {
      const text = outputText as string
      debugLog('[LiveAPI] outputTranscription received:', text.substring(0, 80))
      const explicitFinal = Boolean(outRec?.isFinal ?? outRec?.final ?? outRec?.finished)
      this.pendingOutputTranscription = this.mergeText(this.pendingOutputTranscription, text)
      if (explicitFinal) {
        debugLog('[LiveAPI] assistant message (explicit final)', { text })
        this.onTranscriptUpdate?.(text, false, true)
        this.pendingOutputTranscription = ''
      } else {
        debugLog('[LiveAPI] assistant message', { text })
        this.onTranscriptUpdate?.(text, false, false)
      }
    }

    const inRec = inputTx as Record<string, unknown> | undefined
    const inputText = inRec?.text ?? inRec?.transcript ?? inRec?.content ?? inRec?.value
    if (inputText) {
      const text = inputText as string
      const explicitFinal = Boolean(inRec?.isFinal ?? inRec?.final ?? inRec?.finished)
      this.pendingInputTranscription = this.mergeText(this.pendingInputTranscription, text)
      if (explicitFinal) {
        debugLog('[LiveAPI] user message (explicit final)', { text })
        this.onTranscriptUpdate?.(text, true, true)
        this.pendingInputTranscription = ''
      } else {
        debugLog('[LiveAPI] user message', { text })
        this.onTranscriptUpdate?.(text, true, false)
      }
    }

    // Finalize output transcription when model turn is complete
    if (serverContent?.turnComplete) {
      debugLog('[LiveAPI] turnComplete, pendingTranscription:', this.pendingOutputTranscription ? this.pendingOutputTranscription.substring(0, 80) : '(none)')
    }
    if (serverContent?.turnComplete && this.pendingOutputTranscription) {
      debugLog('[LiveAPI] finalizing assistant turn (turnComplete)', { text: this.pendingOutputTranscription })
      this.onTranscriptUpdate?.(this.pendingOutputTranscription, false, true)
      this.pendingOutputTranscription = ''
    }
  }

  private async setupAudioProcessing() {
    if (!this.inputContext || !this.currentStream) return

    // Cleanup existing nodes
    if (this.workletNode) {
      this.workletNode.disconnect()
      this.workletNode = null
    }
    if (this.inputSource) {
      this.inputSource.disconnect()
      this.inputSource = null
    }

    try {
      // Use AudioWorklet for low-latency processing
      await this.inputContext.audioWorklet.addModule('/audio-capture-processor.js')

      this.inputSource = this.inputContext.createMediaStreamSource(this.currentStream)
      this.workletNode = new AudioWorkletNode(this.inputContext, 'audio-capture-processor')

      this.workletNode.port.onmessage = (event) => {
        if (!this.isConnected || !this.session) return

        const { pcm16, rms, speechStart, speechEnd } = event.data

        // Emit audio level for visualization
        this.onAudioLevel?.(rms * 5)

        // Track local VAD state for UI feedback (no volume adjustment)
        if (speechStart && !this.isUserSpeakingLocal) {
          this.isUserSpeakingLocal = true
          debugLog('[LiveAPI] Local VAD: speech started')
        }
        if (speechEnd && this.isUserSpeakingLocal) {
          this.isUserSpeakingLocal = false
          debugLog('[LiveAPI] Local VAD: speech ended')
        }

        // Emit local VAD state for UI
        if (speechStart || speechEnd) {
          this.onVoiceActivity?.(this.isUserSpeakingLocal)
        }

        // Convert ArrayBuffer to base64
        const uint8 = new Uint8Array(pcm16)
        const base64 = btoa(String.fromCharCode(...uint8))

        try {
          this.session.sendRealtimeInput({
            audio: { data: base64, mimeType: 'audio/pcm;rate=16000' }
          })
          debugLog('[LiveAPI] sent audio chunk', base64.length)
        } catch (err) {
          console.warn('Error sending audio chunk:', err)
        }
      }

      this.inputSource.connect(this.workletNode)
      debugLog('[LiveAPI] AudioWorklet setup complete (32ms frames)')

    } catch (err) {
      console.warn('[LiveAPI] AudioWorklet failed, falling back to ScriptProcessor:', err)
      this.setupLegacyAudioProcessing()
    }
  }



  // Fallback for browsers without AudioWorklet support
  private setupLegacyAudioProcessing() {
    if (!this.inputContext || !this.currentStream) return

    this.inputSource = this.inputContext.createMediaStreamSource(this.currentStream)
    // Use smaller buffer (512) for legacy as well
    const processor = this.inputContext.createScriptProcessor(512, 1, 1)

    // Simple local VAD state for legacy
    let hangoverCount = 0
    const speechThreshold = 0.015
    const hangoverFrames = 5

    processor.onaudioprocess = (event) => {
      if (!this.isConnected) return
      const inputData = event.inputBuffer.getChannelData(0)

      // Calculate RMS
      let sum = 0
      for (let i = 0; i < inputData.length; i += 1) sum += inputData[i] * inputData[i]
      const rms = Math.sqrt(sum / inputData.length)
      this.onAudioLevel?.(rms * 5)

      // Local VAD (for UI feedback only, no volume adjustment)
      const wasSpeaking = this.isUserSpeakingLocal
      if (rms > speechThreshold) {
        this.isUserSpeakingLocal = true
        hangoverCount = hangoverFrames
      } else if (hangoverCount > 0) {
        hangoverCount--
      } else {
        this.isUserSpeakingLocal = false
      }

      if (this.isUserSpeakingLocal !== wasSpeaking) {
        this.onVoiceActivity?.(this.isUserSpeakingLocal)
      }

      // Convert to PCM16
      const pcm16 = new Int16Array(inputData.length)
      for (let i = 0; i < inputData.length; i++) {
        const s = Math.max(-1, Math.min(1, inputData[i]))
        pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff
      }
      const uint8 = new Uint8Array(pcm16.buffer)
      const base64 = btoa(String.fromCharCode(...uint8))

      if (!this.session || !this.isConnected) return
      try {
        this.session.sendRealtimeInput({
          audio: { data: base64, mimeType: 'audio/pcm;rate=16000' }
        })
      } catch (err) {
        console.warn('Error sending audio chunk:', err)
      }
    }

    this.inputSource.connect(processor)
    processor.connect(this.inputContext.destination)
  }



  private queueAudio(base64Data: string) {
    if (!this.outputContext || !this.outputGain) return

    const arrayBuffer = base64ToUint8Array(base64Data).buffer
    const dataInt16 = new Int16Array(arrayBuffer)

    // Convert Int16 to Float32
    const float32Array = new Float32Array(dataInt16.length)
    for (let i = 0; i < dataInt16.length; i++) {
      float32Array[i] = dataInt16[i] / 32768.0
    }

    // Add to queue - scheduling handles playback timing
    // Note: Removed aggressive jitter buffer dropping here as it was causing
    // audio loss during normal operation. The hard cap in scheduleNextBuffer
    // handles true overflow situations.
    this.audioQueue.push(float32Array)

    // Start playback if not already playing
    if (!this.isPlaying) {
      this.isPlaying = true
      this.scheduledTime = this.outputContext.currentTime + this.initialBufferTime
      this.scheduleNextBuffer()
    }
  }

  private createAudioBuffer(audioData: Float32Array): AudioBuffer {
    const audioBuffer = this.outputContext!.createBuffer(1, audioData.length, 24000)
    audioBuffer.getChannelData(0).set(audioData)
    return audioBuffer
  }

  private scheduleNextBuffer() {
    if (!this.outputContext || !this.outputGain) return

    // Hard cap check: reset scheduledTime if it drifted too far ahead
    const maxAhead = this.outputContext.currentTime + this.maxScheduleAhead
    if (this.scheduledTime > maxAhead) {
      debugLog('[LiveAPI] scheduledTime exceeded hard cap, flushing and resetting')
      // Stop all already-scheduled sources to prevent overlapping playback
      this.scheduledSources.forEach((source) => {
        try {
          source.stop()
        } catch {
          // ignore stop errors
        }
      })
      this.scheduledSources = []
      this.scheduledTime = this.outputContext.currentTime + this.initialBufferTime
    }

    // Schedule audio chunks ahead of time to prevent gaps
    while (
      this.audioQueue.length > 0 &&
      this.scheduledTime < this.outputContext.currentTime + this.scheduleAheadTime
    ) {
      const audioData = this.audioQueue.shift()!
      const audioBuffer = this.createAudioBuffer(audioData)
      const source = this.outputContext.createBufferSource()

      source.buffer = audioBuffer
      source.connect(this.outputGain)

      // Track for cleanup
      this.scheduledSources.push(source)
      source.onended = () => {
        const idx = this.scheduledSources.indexOf(source)
        if (idx > -1) this.scheduledSources.splice(idx, 1)
      }

      // Ensure we never schedule in the past
      const startTime = Math.max(this.scheduledTime, this.outputContext.currentTime)
      source.start(startTime)
      this.scheduledTime = startTime + audioBuffer.duration
    }

    // Continue checking for new audio
    if (this.audioQueue.length === 0) {
      if (!this.checkInterval) {
        this.checkInterval = window.setInterval(() => {
          if (this.audioQueue.length > 0) {
            this.scheduleNextBuffer()
          }
        }, 20) as unknown as number  // Check every 20ms for lower latency
      }
    } else {
      const nextCheckTime = (this.scheduledTime - this.outputContext.currentTime) * 1000
      setTimeout(() => this.scheduleNextBuffer(), Math.max(0, nextCheckTime - 20))
    }
  }

  private flushOutput() {
    if (!this.outputContext || !this.outputGain) return

    // Ramp gain to zero to avoid audio clicks/pops
    this.outputGain.gain.linearRampToValueAtTime(0, this.outputContext.currentTime + 0.03)

    // Clear scheduled interval
    if (this.checkInterval) {
      clearInterval(this.checkInterval)
      this.checkInterval = null
    }

    // Stop all scheduled sources after gain ramp
    setTimeout(() => {
      this.scheduledSources.forEach((source) => {
        try {
          source.stop()
        } catch {
          // ignore stop errors
        }
      })
      this.scheduledSources = []
      this.audioQueue = []
      this.isPlaying = false

      if (this.outputContext && this.outputGain) {
        this.scheduledTime = this.outputContext.currentTime
        // Restore gain for next playback
        this.outputGain.gain.setValueAtTime(1, this.outputContext.currentTime)
      }
    }, 40)
  }

  private cleanupAudioNodes() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval)
      this.checkInterval = null
    }
    if (this.workletNode) {
      this.workletNode.disconnect()
      this.workletNode = null
    }
    if (this.inputSource) {
      this.inputSource.disconnect()
      this.inputSource = null
    }
    if (this.currentStream) {
      this.currentStream.getTracks().forEach((track) => track.stop())
      this.currentStream = null
    }
    this.audioQueue = []
    this.scheduledSources = []
    this.isPlaying = false
    this.isUserSpeakingLocal = false
  }

  isAudioLocked() {
    return this.needsUserGesture
  }

  async resumeAudio() {
    if (!this.inputContext && !this.outputContext) return false
    try {
      if (this.inputContext?.state === 'suspended') await this.inputContext.resume()
      if (this.outputContext?.state === 'suspended') await this.outputContext.resume()
    } catch (error) {
      console.warn('Audio resume error', error)
    }
    this.needsUserGesture =
      this.inputContext?.state !== 'running' || this.outputContext?.state !== 'running'
    if (!this.needsUserGesture) {
      this.emitStatus('audio-unlocked')
    } else {
      this.emitStatus('audio-locked')
    }
    return !this.needsUserGesture
  }

  async disconnect() {
    // Finalize any pending transcriptions before disconnecting
    if (this.pendingInputTranscription) {
      this.onTranscriptUpdate?.(this.pendingInputTranscription, true, true)
      this.pendingInputTranscription = ''
    }
    if (this.pendingOutputTranscription) {
      this.onTranscriptUpdate?.(this.pendingOutputTranscription, false, true)
      this.pendingOutputTranscription = ''
    }

    this.isConnected = false
    this.textOnlyMode = false
    this.pendingTextResponse = ''
    this.chatSession = null
    this.emitStatus('disconnecting')
    this.cleanupAudioNodes()

    if (this.session) {
      try {
        this.session.sendRealtimeInput?.({ audioStreamEnd: true })
      } catch {
        // ignore stream end errors
      }
      try {
        this.session.close?.()
      } catch {
        // ignore close errors
      }
      this.session = null
    }

    if (this.inputContext && this.inputContext.state !== 'closed') {
      try {
        await this.inputContext.close()
      } catch (error) {
        console.warn('InputCtx close error', error)
      }
    }
    if (this.outputContext && this.outputContext.state !== 'closed') {
      this.flushOutput()
      try {
        await this.outputContext.close()
      } catch (error) {
        console.warn('OutputCtx close error', error)
      }
    }

    this.inputContext = null
    this.outputContext = null
  }
}

export const liveAudioService = new LiveAudioService()
