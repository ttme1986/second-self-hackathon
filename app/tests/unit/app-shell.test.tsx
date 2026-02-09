import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import AppShell from '../../src/components/AppShell'

describe('AppShell', () => {
  it('wraps children and applies variant class', () => {
    const { container } = render(
      <AppShell variant="hub">
        <div>CHILD</div>
      </AppShell>,
    )

    expect(screen.getByText('CHILD')).toBeInTheDocument()
    expect(container.querySelector('.app-shell--hub')).toBeTruthy()
  })
})
