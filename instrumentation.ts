// Runs once when the Next.js server starts.
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return

  // Dev hot-reload can call register() again; keep a single refresh loop.
  const state = globalThis as typeof globalThis & { __registryCacheTimer?: ReturnType<typeof setInterval> }
  if (state.__registryCacheTimer) return

  const { warmRegistryCache, REGISTRY_CACHE_TTL_MS } = await import('./server/registry-cache')
  const warm = () => warmRegistryCache().catch(error => console.warn('[registry-cache] warm-up failed:', error))

  void warm()
  state.__registryCacheTimer = setInterval(warm, REGISTRY_CACHE_TTL_MS)
  state.__registryCacheTimer.unref?.()
}
