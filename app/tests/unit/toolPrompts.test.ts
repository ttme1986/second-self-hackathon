import { buildToolPrompt } from '../../src/tools/toolPrompts'

describe('tool prompt builders', () => {
  it('should build a bio prompt with provided answers', () => {
    const prompt = buildToolPrompt({
      toolId: 'bio',
      answers: ['Product lead', 'Human-first AI'],
      displayName: 'Tim Wu',
    })

    expect(prompt).toContain('Tim Wu')
    expect(prompt).toContain('Product lead')
    expect(prompt).toContain('Human-first AI')
  })

  it('should default missing answers to Not provided', () => {
    const prompt = buildToolPrompt({
      toolId: 'weekly',
      answers: ['Last week'],
      displayName: 'Alex',
    })

    expect(prompt).toContain('Last week')
    expect(prompt).toContain('Not provided')
  })

  it('should fall back to a generic display name when missing', () => {
    const prompt = buildToolPrompt({
      toolId: 'growth',
      answers: ['Ship demo', 'Time'],
    })

    expect(prompt).toContain('the user')
    expect(prompt).toContain('Ship demo')
  })
})



