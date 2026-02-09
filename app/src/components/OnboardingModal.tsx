import { useState } from 'react'
import { useProfile } from '../profile/ProfileProvider'

export default function OnboardingModal() {
  const { completeOnboarding, toggleGeoCapture } = useProfile()
  const [loading, setLoading] = useState(false)

  const handleContinue = async () => {
    setLoading(true)
    await toggleGeoCapture(true)

    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        () => {},
        () => {},
      )
    }

    await completeOnboarding()
    setLoading(false)
  }

  return (
    <div className="modal-backdrop">
      <div className="modal">
        <div className="section-title">Welcome</div>
        <h2>Enable location capture?</h2>
        <p>
          Second-Self uses location to enrich moments. We will request permission now. You can
          change this later in Settings.
        </p>
        <button className="button button--primary" onClick={handleContinue} disabled={loading}>
          {loading ? 'Setting up...' : 'Continue'}
        </button>
      </div>
    </div>
  )
}
