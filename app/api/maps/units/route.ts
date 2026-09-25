import { NextResponse } from 'next/server'
import fs from 'fs/promises'
import path from 'path'
import { brotliDecompressSync } from 'zlib'

// Every woreda in the map boundaries with its parent zone and region P-codes.
// Used as the denominator for geographic coverage, so coverage always agrees
// with what the map can draw. Only feature properties are returned (~40 KB),
// never geometry.

interface WoredaUnit {
  woreda: string
  zone: string
  region: string
}

let units: WoredaUnit[] | null = null

async function loadUnits(): Promise<WoredaUnit[]> {
  if (units) return units
  const buf = await fs.readFile(path.join(process.cwd(), 'public', 'maps', 'woredas.topojson.br'))
  const topo = JSON.parse(brotliDecompressSync(buf).toString('utf8'))
  const key = Object.keys(topo.objects ?? {})[0]
  if (!key) throw new Error('Invalid woreda topology')
  const geometries: Array<{ properties?: Record<string, string> }> = topo.objects[key].geometries ?? []
  units = geometries
    .map(g => ({
      woreda: g.properties?.admin3Pcod ?? '',
      zone: g.properties?.admin2Pcod ?? '',
      region: g.properties?.admin1Pcod ?? '',
    }))
    .filter(u => u.woreda)
  return units
}

export async function GET() {
  try {
    return NextResponse.json(await loadUnits(), {
      headers: { 'Cache-Control': 'public, max-age=86400' },
    })
  } catch (err) {
    console.error('[Maps API] failed to load woreda units', err)
    return NextResponse.json({ error: 'Failed to load map units' }, { status: 500 })
  }
}
