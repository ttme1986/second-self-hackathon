import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import Reflect from '../../src/pages/Reflect'
import { OpenLoopsProvider } from '../../src/openloops/OpenLoopsProvider'

function renderReflect(path = '/reflect') {
  return render(
    <OpenLoopsProvider>
      <MemoryRouter initialEntries={[path]}>
        <Reflect />
      </MemoryRouter>
    </OpenLoopsProvider>,
  )
}

describe('Reflect surface', () => {
  it('shows empty claims state', async () => {
    const user = userEvent.setup()
    renderReflect()

    await user.click(screen.getByRole('link', { name: 'About Me' }))

    expect(screen.getByText('No claims available.')).toBeInTheDocument()
  })

  it('shows empty goals state', async () => {
    const user = userEvent.setup()
    renderReflect()

    // Goals is now a sub-tab under Commitments
    await user.click(screen.getByRole('link', { name: 'Commitments' }))
    await user.click(screen.getByRole('button', { name: 'Goals' }))
    expect(screen.getByText('No goals yet')).toBeInTheDocument()
  })
})




