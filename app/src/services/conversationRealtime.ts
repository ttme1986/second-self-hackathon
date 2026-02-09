type InferredClaim = {
  id?: string
  text: string
  category: string
  confidence: number
  evidence: string[]
  status: 'inferred' | 'confirmed' | 'rejected'
  conversationId: string
}

export type { InferredClaim }
