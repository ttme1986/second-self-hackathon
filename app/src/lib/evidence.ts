const normalizeEvidence = (value?: string) => (value ?? '').replace(/\s+/g, ' ').trim()

export const createEvidenceSnippet = (value?: string, max = 140) => {
  const normalized = normalizeEvidence(value)
  if (!normalized) return ''
  if (normalized.length <= max) return normalized
  return `${normalized.slice(0, max).trim()}...`
}
