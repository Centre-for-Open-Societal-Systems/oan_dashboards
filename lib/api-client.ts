const apiBase = (process.env.NEXT_PUBLIC_API_BASE || '').replace(/\/$/, '')
const farmerApiBase = (process.env.NEXT_PUBLIC_FARMER_API_BASE || 'http://localhost:8005').replace(/\/$/, '')

function buildUrl(path: string) {
  if (path.startsWith('http')) return path
  const normalizedPath = path.startsWith('/') ? path : `/${path}`

  // If the path is for a farmer registry chart that we ported to the python API!
  const pythonEndpoints = ['farmersByRegion', 'farmersByGender', 'farmersByType']
  const chartId = normalizedPath.split('/').pop();
  
  if (chartId && pythonEndpoints.includes(chartId)) {
     return `${farmerApiBase}/api/v1/charts/${chartId}`
  }

  return `${apiBase}${normalizedPath}`
}

export function apiUrl(path: string) {
  return buildUrl(path)
}

export async function apiFetch(input: string, init?: RequestInit) {
  const url = buildUrl(input)
  return fetch(url, init)
}
