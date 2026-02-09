/**
 * Audio Worklet Processor for low-latency audio capture
 * Runs on a dedicated audio thread for optimal performance
 * 
 * Features:
 * - 32ms frame size (512 samples @ 16kHz) for low latency
 * - Built-in local VAD using RMS energy threshold
 * - Extended hangover logic to prevent rapid toggling
 */
class AudioCaptureProcessor extends AudioWorkletProcessor {
    constructor() {
        super()
        // 512 samples @ 16kHz = 32ms - optimal for real-time conversation
        this.bufferSize = 512
        this.buffer = new Float32Array(this.bufferSize)
        this.bufferIndex = 0

        // Local VAD state - tuned to prevent rapid toggling
        this.speechThreshold = 0.02     // RMS threshold (slightly higher to reduce false triggers)
        this.hangoverFrames = 25        // ~800ms at 32ms/frame - long hangover prevents rapid toggling
        this.hangoverCount = 0
        this.isSpeaking = false
        this.wasSpeaking = false

        // Debounce: require multiple consecutive frames above threshold to trigger
        this.consecutiveActiveFrames = 0
        this.activationThreshold = 2    // Need 2 consecutive active frames (~64ms) to trigger
    }

    process(inputs, outputs, parameters) {
        const input = inputs[0]
        if (!input || !input[0]) return true

        const channelData = input[0]

        for (let i = 0; i < channelData.length; i++) {
            this.buffer[this.bufferIndex++] = channelData[i]

            if (this.bufferIndex >= this.bufferSize) {
                // Convert Float32 to Int16 PCM
                const pcm16 = new Int16Array(this.bufferSize)
                for (let j = 0; j < this.bufferSize; j++) {
                    const s = Math.max(-1, Math.min(1, this.buffer[j]))
                    pcm16[j] = s < 0 ? s * 0x8000 : s * 0x7fff
                }

                // Calculate RMS for audio level and VAD
                let sum = 0
                for (let j = 0; j < this.bufferSize; j++) {
                    sum += this.buffer[j] * this.buffer[j]
                }
                const rms = Math.sqrt(sum / this.bufferSize)

                // Local VAD logic with debounce and extended hangover
                this.wasSpeaking = this.isSpeaking

                if (rms > this.speechThreshold) {
                    this.consecutiveActiveFrames++
                    this.hangoverCount = this.hangoverFrames

                    // Only trigger speech start after consecutive active frames (debounce)
                    if (this.consecutiveActiveFrames >= this.activationThreshold) {
                        this.isSpeaking = true
                    }
                } else {
                    this.consecutiveActiveFrames = 0

                    if (this.hangoverCount > 0) {
                        this.hangoverCount--
                        // Stay in speaking state during hangover
                    } else {
                        this.isSpeaking = false
                    }
                }

                // Detect speech start/end transitions
                const speechStart = this.isSpeaking && !this.wasSpeaking
                const speechEnd = !this.isSpeaking && this.wasSpeaking

                // Send to main thread
                this.port.postMessage({
                    pcm16: pcm16.buffer,
                    rms: rms,
                    isSpeaking: this.isSpeaking,
                    speechStart: speechStart,
                    speechEnd: speechEnd
                }, [pcm16.buffer])

                this.bufferIndex = 0
                this.buffer = new Float32Array(this.bufferSize)
            }
        }

        return true
    }
}

registerProcessor('audio-capture-processor', AudioCaptureProcessor)
