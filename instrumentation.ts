// Runs once when the Next.js server starts.
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return

  // Dev hot-reload can call register() again; keep a single refresh loop.
  const state = globalThis as typeof globalThis & { __dashboardServiceTimer?: ReturnType<typeof setInterval> }
  if (state.__dashboardServiceTimer) return

  const { warmDashboardServices, DASHBOARD_CACHE_TTL_MS } = await import('./server/dashboard-services')
  const warm = () => warmDashboardServices().catch(error => console.warn('[dashboard-services] warm-up failed:', error))

  void warm()
  state.__dashboardServiceTimer = setInterval(warm, DASHBOARD_CACHE_TTL_MS)
  state.__dashboardServiceTimer.unref?.()
}
