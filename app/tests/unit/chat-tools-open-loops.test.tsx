import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { useEffect } from 'react'
import Chat from '../../src/pages/Chat'
import Reflect from '../../src/pages/Reflect'
import { OpenLoopsProvider, useOpenLoops } from '../../src/openloops/OpenLoopsProvider'

function renderChat() {
  return render(
    <OpenLoopsProvider>
      <MemoryRouter>
        <Chat />
      </MemoryRouter>
    </OpenLoopsProvider>,
  )
}

function ReflectWithSeed() {
  const { addLoop } = useOpenLoops()
  useEffect(() => {
    addLoop({
      title: 'Refine bio for demo deck',
      due: 'This Week',
      source: 'suggested',
      reminder: false,
    })
  }, [addLoop])
  return <Reflect />
}

describe('Tools drawer', () => {
  it('shows empty state when no tools are configured', async () => {
    renderChat()

    fireEvent.click(screen.getByLabelText('Open tools'))

    expect(screen.getByText('No tools available.')).toBeInTheDocument()
  })
})

describe('Open loops view', () => {
  it('shows suggested loops grouped by due window', async () => {
    render(
      <OpenLoopsProvider>
        <MemoryRouter initialEntries={['/reflect?tab=open-loops']}>
          <Routes>
            <Route path="/reflect" element={<ReflectWithSeed />} />
          </Routes>
        </MemoryRouter>
      </OpenLoopsProvider>,
    )

    expect(screen.getAllByText('This Week').length).toBeGreaterThan(0)
    expect(screen.getByText('Refine bio for demo deck')).toBeInTheDocument()
  })
})




