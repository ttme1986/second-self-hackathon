export async function trackEvent(name: string, params?: Record<string, unknown>) {
  if (import.meta.env.DEV) {
    console.debug('[analytics]', name, params)
  }
}
