import { Link, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import AppShell from '../components/AppShell'
import { useProfile } from '../profile/ProfileProvider'
import { useOpenLoops } from '../openloops/OpenLoopsProvider'
import TodaysFocus from '../components/TodaysFocus'
import {
  listReviewQueue,
} from '../api/backend'
import { type FocusItem } from '../services/focusGenerator'
import { getEmotionTrends, type EmotionTrendResult } from '../services/emotionTracker'

export default function Hub() {
  const navigate = useNavigate()
  const { profile } = useProfile()
  const { loops } = useOpenLoops()
  const name = profile?.displayName ?? 'there'
  const dueTodayCount = loops.filter((loop) => loop.due === 'Today' && !loop.done).length
  const [reviewQueueCount, setReviewQueueCount] = useState(0)
  const [emotionTrends, setEmotionTrends] = useState<EmotionTrendResult | null>(null)

  // Generate time-based greeting with emotional awareness
  const getGreeting = () => {
    const hour = new Date().getHours()
    let timeGreeting = 'Good morning'
    if (hour >= 12 && hour < 17) {
      timeGreeting = 'Good afternoon'
    } else if (hour >= 17) {
      timeGreeting = 'Good evening'
    }

    // Add emotional context if available
    if (emotionTrends && emotionTrends.points.length >= 3) {
      const mood = emotionTrends.overallMood
      if (mood === 'stress' || mood === 'sadness') {
        return `${timeGreeting}, ${name}. I'm here for you.`
      }
      if (mood === 'joy' || mood === 'calm') {
        return `${timeGreeting}, ${name}!`
      }
    }

    return `${timeGreeting}, ${name}.`
  }

  const getSubtitle = () => {
    if (emotionTrends && emotionTrends.points.length >= 3) {
      const mood = emotionTrends.overallMood
      if (mood === 'stress') {
        return "Let's take things one step at a time today."
      }
      if (mood === 'sadness') {
        return "Remember, it's okay to take breaks when you need them."
      }
      if (mood === 'joy') {
        return "You've been feeling great. Keep that momentum going!"
      }
      if (mood === 'calm') {
        return 'Your digital memory is ready for updates.'
      }
    }
    return 'Your digital memory is ready for updates.'
  }

  // Format date dynamically
  const formattedDate = new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  })

  // Load data on mount
  useEffect(() => {
    const loadData = async () => {
      const [reviewRes, trendsRes] = await Promise.allSettled([
        listReviewQueue(),
        getEmotionTrends(),
      ])
      if (reviewRes.status === 'fulfilled') {
        const pending = reviewRes.value.data?.items?.filter((i) => i.status === 'pending') ?? []
        setReviewQueueCount(pending.length)
      }
      if (trendsRes.status === 'fulfilled') setEmotionTrends(trendsRes.value)
    }

    void loadData()
  }, [])

  const handleFocusItemClick = (item: FocusItem) => {
    if (item.type === 'goal' || item.type === 'milestone') {
      navigate(`/reflect?tab=follow-ups&subtab=goals&goalId=${item.linkedId}`)
    } else if (item.type === 'action') {
      navigate('/reflect?tab=follow-ups')
    }
  }


  return (
    <AppShell variant="hub">
      <div className="hub-top-spacer" />
      <main className="hub-main">
        <header className="hub-header">
          <span className="hub-date">{formattedDate}</span>
          <Link to="/settings" className="hub-settings-button" aria-label="Open settings">
            <span className="material-symbols-outlined">settings</span>
          </Link>
        </header>

        <section className="hub-greeting">
          <h1 className="hub-greeting-title">
            {getGreeting()}
          </h1>
          <p className="hub-greeting-subtitle">{getSubtitle()}</p>
        </section>

        <section className="hub-cards">
          <Link to="/chat" className="hub-card hub-card--dark">
            <div className="hub-card-icon">
              <span className="material-symbols-outlined">record_voice_over</span>
            </div>
            <div>
              <div className="hub-card-title">Chat</div>
              <div className="hub-card-subtitle">
                Narrate your thoughts, cultivate your personal story.
              </div>
            </div>
          </Link>
          <Link to="/reflect" className="hub-card hub-card--light">
            <div className="hub-card-icon">
              <span className="material-symbols-outlined">data_thresholding</span>
            </div>
            <div>
              <div className="hub-card-title">Reflect</div>
              <div className="hub-card-subtitle">
                Witness your knowledge evolve and identify growth patterns.
              </div>
            </div>
          </Link>
        </section>

        {/* Today's Focus Section */}
        <section style={{ marginBottom: 24, width: '100%', maxWidth: '100%' }}>
          <TodaysFocus displayName={name} onItemClick={handleFocusItemClick} />
        </section>

        <section className="hub-attention">
          <div className="hub-attention-title">Attention required</div>
          <div className="hub-attention-grid">
            <Link to="/reflect?tab=follow-ups" className="hub-pill" aria-label="Due Today">
              <div className="hub-pill-icon">
                <span className="material-symbols-outlined">pending_actions</span>
                <span className="hub-badge hub-badge--warm">{dueTodayCount}</span>
              </div>
              <span>Due Today</span>
            </Link>
            <Link to="/reflect?tab=review" className="hub-pill" aria-label="Review Queue">
              <div className="hub-pill-icon">
                <span className="material-symbols-outlined">history_edu</span>
                <span className="hub-badge">{reviewQueueCount}</span>
              </div>
              <span>Review Queue</span>
            </Link>
          </div>
        </section>

      </main>
    </AppShell>
  )
}
