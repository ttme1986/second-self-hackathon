import { useAuth } from '../auth/AuthProvider'

export default function Login() {
  const { signInWithGoogle, signInWithDemo } = useAuth()

  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="login-branding">
          <h1>Meet your</h1>
          <img src="/second-self-icon.svg" alt="Second-Self" className="login-logo" />
          <div className="section-title">Second-Self</div>
        </div>
        <p>Capture voice moments and grow a living memory archive.</p>
        <button className="button button--primary" onClick={signInWithGoogle}>
          Sign in with Google
        </button>
        <button className="button button--secondary" onClick={signInWithDemo}>
          Sign in for Demo
        </button>
      </div>
    </div>
  )
}