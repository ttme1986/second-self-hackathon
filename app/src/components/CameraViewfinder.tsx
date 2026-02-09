import { useRef, useEffect, useState, useCallback } from 'react'

type CameraViewfinderProps = {
  onCapture: (file: File) => void
  onClose: () => void
}

export default function CameraViewfinder({ onCapture, onClose }: CameraViewfinderProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [capturedImage, setCapturedImage] = useState<string | null>(null)
  const [isReady, setIsReady] = useState(false)

  // Start camera stream
  useEffect(() => {
    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'environment', // Prefer back camera
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        })
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          videoRef.current.onloadedmetadata = () => {
            setIsReady(true)
          }
        }
      } catch (err) {
        console.error('Failed to access camera:', err)
        setError('Unable to access camera. Please check permissions.')
      }
    }

    void startCamera()

    return () => {
      // Cleanup: stop all tracks
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop())
      }
    }
  }, [])

  const handleCapture = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return

    const video = videoRef.current
    const canvas = canvasRef.current
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.drawImage(video, 0, 0)
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9)
    setCapturedImage(dataUrl)
  }, [])

  const handleAccept = useCallback(() => {
    if (!capturedImage) return

    // Convert data URL to File
    fetch(capturedImage)
      .then((res) => res.blob())
      .then((blob) => {
        const file = new File([blob], `photo-${Date.now()}.jpg`, { type: 'image/jpeg' })
        onCapture(file)
        onClose()
      })
      .catch((err) => {
        console.error('Failed to create file:', err)
      })
  }, [capturedImage, onCapture, onClose])

  const handleRetake = useCallback(() => {
    setCapturedImage(null)
  }, [])

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: '#000',
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '16px',
          background: 'rgba(0,0,0,0.5)',
        }}
      >
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            color: '#fff',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            fontSize: '0.9rem',
          }}
        >
          <span className="material-symbols-outlined">close</span>
          Cancel
        </button>
        <span style={{ color: '#fff', fontSize: '0.9rem', fontWeight: 600 }}>
          {capturedImage ? 'Preview' : 'Camera'}
        </span>
        <div style={{ width: 80 }} /> {/* Spacer for centering */}
      </div>

      {/* Camera/Preview area */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        {error ? (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              textAlign: 'center',
              padding: 32,
            }}
          >
            <div>
              <span
                className="material-symbols-outlined"
                style={{ fontSize: 48, marginBottom: 16, display: 'block', opacity: 0.5 }}
              >
                videocam_off
              </span>
              <p>{error}</p>
              <button
                onClick={onClose}
                style={{
                  marginTop: 16,
                  padding: '12px 24px',
                  background: '#fff',
                  color: '#000',
                  border: 'none',
                  borderRadius: 8,
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                Go Back
              </button>
            </div>
          </div>
        ) : capturedImage ? (
          <img
            src={capturedImage}
            alt="Captured"
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'contain',
            }}
          />
        ) : (
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
              }}
            />
            {!isReady && (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: '#000',
                }}
              >
                <div className="loading-spinner" />
              </div>
            )}
          </>
        )}
        <canvas ref={canvasRef} style={{ display: 'none' }} />
      </div>

      {/* Controls */}
      <div
        style={{
          padding: '24px',
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: 32,
        }}
      >
        {capturedImage ? (
          <>
            <button
              onClick={handleRetake}
              style={{
                width: 56,
                height: 56,
                borderRadius: '50%',
                background: 'rgba(255,255,255,0.2)',
                border: 'none',
                color: '#fff',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 28 }}>
                refresh
              </span>
            </button>
            <button
              onClick={handleAccept}
              style={{
                width: 72,
                height: 72,
                borderRadius: '50%',
                background: '#22c55e',
                border: 'none',
                color: '#fff',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 36 }}>
                check
              </span>
            </button>
          </>
        ) : (
          <button
            onClick={handleCapture}
            disabled={!isReady}
            style={{
              width: 72,
              height: 72,
              borderRadius: '50%',
              background: '#fff',
              border: '4px solid rgba(255,255,255,0.3)',
              cursor: isReady ? 'pointer' : 'not-allowed',
              opacity: isReady ? 1 : 0.5,
            }}
            aria-label="Take photo"
          />
        )}
      </div>
    </div>
  )
}
