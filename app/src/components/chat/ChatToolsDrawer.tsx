type ToolConfig = {
  id: string
  name: string
  description: string
  questions: string[]
  output: {
    title: string
    summary: string
    receipts: Array<{ highlight: string; confidence: 'Confirmed' | 'Inferred' }>
    suggested: Array<{ title: string; due: string; context: string }>
  }
}

type ChatToolsDrawerProps = {
  tools: ToolConfig[]
  activeTool: ToolConfig | null
  toolStep: number
  toolAnswers: string[]
  onSelectTool: (tool: ToolConfig) => void
  onNext: () => void
  onAnswer: (value: string) => void
  onClose: () => void
  onBack: () => void
}

export type { ToolConfig }

export default function ChatToolsDrawer({
  tools,
  activeTool,
  toolStep,
  toolAnswers,
  onSelectTool,
  onNext,
  onAnswer,
  onClose,
  onBack,
}: ChatToolsDrawerProps) {
  return (
    <div className="drawer-backdrop" role="dialog" aria-label="Tools">
      <div className="tools-drawer">
        <div className="tools-drawer-handle" />
        {!activeTool ? (
          <>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <div className="tools-drawer-pill">
                <span style={{ width: 6, height: 6, borderRadius: 999, background: 'var(--chat-accent)' }} />
                Chat Mode
              </div>
            </div>
            <div className="tools-list">
              {tools.length === 0 ? (
                <div className="tool-empty">No tools available.</div>
              ) : tools.map((tool) => (
                <button key={tool.id} className="tool-item" onClick={() => onSelectTool(tool)}>
                  <div className="tool-icon">
                    <span className="material-symbols-outlined">
                      {tool.id === 'bio'
                        ? 'person'
                        : tool.id === 'decision'
                          ? 'call_split'
                          : tool.id === 'weekly'
                            ? 'insights'
                            : 'spa'}
                    </span>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '1rem', fontWeight: 600 }}>{tool.name}</div>
                    <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)' }}>{tool.description}</div>
                  </div>
                  <span className="material-symbols-outlined" style={{ color: 'rgba(255,255,255,0.2)' }}>
                    chevron_right
                  </span>
                </button>
              ))}
            </div>
            <button className="tools-cancel" onClick={onClose}>
              Cancel
            </button>
          </>
        ) : (
          <div style={{ display: 'grid', gap: 12 }}>
            <div style={{ fontSize: '1.1rem', fontWeight: 600 }}>{activeTool.name}</div>
            <div style={{ fontSize: '0.95rem', color: 'rgba(255,255,255,0.7)' }}>{activeTool.questions[toolStep]}</div>
            <input
              className="drawer-input"
              placeholder="Your answer"
              value={toolAnswers[toolStep] ?? ''}
              onChange={(event) => onAnswer(event.target.value)}
            />
            <div className="drawer-actions">
              <button className="tools-cancel" onClick={onBack}>
                Back
              </button>
              <button className="drawer-primary" onClick={onNext}>
                {toolStep === activeTool.questions.length - 1 ? 'Finish' : 'Next'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
