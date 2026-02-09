import { Link } from 'react-router-dom'
import AppShell from '../components/AppShell'
import { GridIcon, LogOutIcon } from '../components/Icons'
import { useProfile, type ActionPermission, type ActionType } from '../profile/ProfileProvider'
import { useAuth } from '../auth/AuthProvider'

const permissionLabels: Record<ActionPermission, string> = {
  suggest: 'Suggest Only',
  draft: 'Draft & Review',
  execute: 'Execute Now',
}

const actionTypeLabels: Record<ActionType, string> = {
  reminder: 'Reminders',
  email: 'Emails',
  calendar: 'Calendar Events',
  goal: 'Goal Actions',
  reading: 'Reading Items',
  general: 'General Tasks',
}

export default function Settings() {
  const { profile, toggleGeoCapture, requestDeleteAllData, updateProfile } = useProfile()
  const { signOutUser } = useAuth()

  const handleToggleGeo = async () => {
    await toggleGeoCapture(!(profile?.geoCapture ?? true))
  }

  const handleDeleteAll = async () => {
    const confirmed = window.confirm('Delete all data? This cannot be undone.')
    if (!confirmed) return

    try {
      await requestDeleteAllData()
      alert('Delete request submitted.')
    } catch (error) {
      alert('Delete flow is not yet connected. Please try again later.')
    }
  }

  const handleDefaultPermissionChange = async (permission: ActionPermission) => {
    await updateProfile({ defaultActionPermission: permission })
  }

  const handleActionTypePermissionChange = async (actionType: ActionType, permission: ActionPermission | 'default') => {
    const currentPermissions = profile?.actionPermissions ?? {}
    const newPermissions = { ...currentPermissions }

    if (permission === 'default') {
      delete newPermissions[actionType]
    } else {
      newPermissions[actionType] = permission
    }

    await updateProfile({ actionPermissions: newPermissions })
  }

  return (
    <AppShell variant="settings">
      <header className="reflect-header">
        <Link to="/" className="icon-button" aria-label="Back to Hub">
          <GridIcon />
        </Link>
        <h1>Settings</h1>
        <button className="icon-button" aria-label="Sign out" onClick={signOutUser}>
          <LogOutIcon />
        </button>
      </header>

      <main className="reflect-main">
        <section className="reflect-section">
        <div className="section-title">Profile</div>
        <div className="card card--light">
          <div className="field">
            <span className="card-title">Name</span>
            <div className="card-subtitle">{profile?.displayName ?? 'Loading...'}</div>
          </div>
        </div>
      </section>

      <section className="reflect-section">
        <div className="section-title">Privacy</div>
        <div className="card card--light">
          <div className="toggle-row">
            <div>
              <div className="card-title">Always capture location</div>
              <div className="card-subtitle">Enabled by default</div>
            </div>
            <button className="toggle" onClick={handleToggleGeo}>
              {(profile?.geoCapture ?? true) ? 'On' : 'Off'}
            </button>
          </div>
        </div>
      </section>

      <section className="reflect-section">
        <div className="section-title">Autonomous Actions</div>
        <div className="card card--light">
          <div className="field" style={{ marginBottom: 16 }}>
            <span className="card-title">Default Permission Level</span>
            <div className="card-subtitle" style={{ marginBottom: 8 }}>
              How should the AI handle suggested actions?
            </div>
            <select
              value={profile?.defaultActionPermission ?? 'suggest'}
              onChange={(e) => handleDefaultPermissionChange(e.target.value as ActionPermission)}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: 8,
                border: '1px solid rgba(0,0,0,0.15)',
                font: 'inherit',
                background: '#fff',
              }}
            >
              {(Object.keys(permissionLabels) as ActionPermission[]).map((permission) => (
                <option key={permission} value={permission}>
                  {permissionLabels[permission]}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <span className="card-title">Per-Type Overrides</span>
            <div className="card-subtitle" style={{ marginBottom: 12 }}>
              Customize permission level for specific action types
            </div>
            <div style={{ display: 'grid', gap: 12 }}>
              {(Object.keys(actionTypeLabels) as ActionType[]).map((actionType) => {
                const currentValue = profile?.actionPermissions?.[actionType] ?? 'default'
                return (
                  <div
                    key={actionType}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 0',
                      borderBottom: '1px solid rgba(0,0,0,0.06)',
                    }}
                  >
                    <span style={{ fontSize: '0.95rem' }}>{actionTypeLabels[actionType]}</span>
                    <select
                      value={currentValue}
                      onChange={(e) =>
                        handleActionTypePermissionChange(
                          actionType,
                          e.target.value as ActionPermission | 'default'
                        )
                      }
                      style={{
                        padding: '6px 10px',
                        borderRadius: 6,
                        border: '1px solid rgba(0,0,0,0.12)',
                        font: 'inherit',
                        fontSize: '0.85rem',
                        background: currentValue === 'default' ? '#f8f9fa' : '#fff',
                        color: currentValue === 'default' ? '#6b7280' : 'inherit',
                      }}
                    >
                      <option value="default">Use Default</option>
                      {(Object.keys(permissionLabels) as ActionPermission[]).map((permission) => (
                        <option key={permission} value={permission}>
                          {permissionLabels[permission]}
                        </option>
                      ))}
                    </select>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
        <div className="card card--light" style={{ marginTop: 12 }}>
          <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#f59e0b' }}>
              info
            </span>
            Permission Levels Explained
          </div>
          <div style={{ fontSize: '0.85rem', color: 'var(--reflect-muted)', marginTop: 8 }}>
            <div style={{ marginBottom: 8 }}>
              <strong>Suggest Only:</strong> Actions are saved to Follow ups for manual completion.
            </div>
            <div style={{ marginBottom: 8 }}>
              <strong>Draft & Review:</strong> AI creates a draft for you to review and approve before execution.
            </div>
            <div>
              <strong>Execute Now:</strong> AI immediately completes the action (where possible).
            </div>
          </div>
        </div>
      </section>

      <section className="reflect-section">
        <div className="section-title">Data</div>
        <div className="card card--light">
          <div className="card-title">Delete all data</div>
          <div className="card-subtitle">This action is irreversible.</div>
          <button className="button button--danger" onClick={handleDeleteAll}>
            Delete
          </button>
        </div>
      </section>
      </main>
    </AppShell>
  )
}