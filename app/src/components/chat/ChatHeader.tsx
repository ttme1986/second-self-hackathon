import EmotionIndicator from '../EmotionIndicator'
import type { EmotionalState } from '../../api/backend'

type ChatHeaderProps = {
  formattedDate: string
  formattedTime: string
  formattedElapsed: string
  isRecording: boolean
  currentEmotion: EmotionalState | null
}

export default function ChatHeader({
  formattedDate,
  formattedTime,
  formattedElapsed,
  isRecording,
  currentEmotion,
}: ChatHeaderProps) {
  return (
    <header className="chat-header">
      <div className="chat-header-center">
        <div className="chat-header-date">{formattedDate}</div>
        <div className="chat-header-time">{formattedTime}</div>
        <div className={isRecording ? 'chat-header-timer is-active' : 'chat-header-timer'}>
          {formattedElapsed}
        </div>
        {currentEmotion && isRecording && (
          <div style={{ marginTop: 4 }}>
            <EmotionIndicator emotion={currentEmotion} size="small" />
          </div>
        )}
      </div>
      <button className="chat-header-button" aria-label="Tune settings">
        <span className="material-symbols-outlined">tune</span>
      </button>
    </header>
  )
}
