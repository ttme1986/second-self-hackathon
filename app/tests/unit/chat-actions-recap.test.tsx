import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import Chat from '../../src/pages/Chat'
import { OpenLoopsProvider } from '../../src/openloops/OpenLoopsProvider'

function renderChat() {
  return render(
    <OpenLoopsProvider>
      <MemoryRouter>
        <Chat />
      </MemoryRouter>
    </OpenLoopsProvider>,
  )
}

describe('Chat action bar', () => {
  it('shows no suggestions initially', () => {
    renderChat()
    expect(screen.getByText('No suggested actions yet')).toBeInTheDocument()
  })

  it('does not create suggested actions from mic toggle alone', async () => {
    const user = userEvent.setup()
    renderChat()

    const mic = screen.getByLabelText('Microphone')

    await user.click(mic)
    await user.click(mic)
    await user.click(mic)
    await user.click(mic)

    expect(screen.getByText('No suggested actions yet')).toBeInTheDocument()
  })
})

describe('Chat recap', () => {
  it('opens recap on hang-up', async () => {
    const user = userEvent.setup()
    renderChat()

    await user.click(screen.getByLabelText('End session'))
    expect(screen.getByText('Session Recap')).toBeInTheDocument()
  })

  it('shows empty suggested actions section when none exist', async () => {
    const user = userEvent.setup()
    renderChat()

    await user.click(screen.getByLabelText('End session'))

    expect(screen.getByText('All set.')).toBeInTheDocument()
  })
})




