type Point = { lat: number; lng: number; rain: number }

async function fetchRain(lat: number, lng: number): Promise<number> {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,windspeed_10m_max,precipitation_hours,weathercode&temperature_unit=celsius&windspeed_unit=kmh&timezone=Asia/Jakarta`
  const r = await fetch(url, { cache: "no-store" })
  if (!r.ok) return 0
  const j = await r.json()
  const arr: number[] = j?.hourly?.rain || []
  return arr.length ? arr[arr.length - 1] : 0
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const swLat = Number(searchParams.get("swLat") ?? "0")
  const swLng = Number(searchParams.get("swLng") ?? "0")
  const neLat = Number(searchParams.get("neLat") ?? "0")
  const neLng = Number(searchParams.get("neLng") ?? "0")
  const stepLatParam = Number(searchParams.get("stepLat") ?? "0.1")
  const stepLonParam = Number(searchParams.get("stepLon") ?? "0.1")
  const gridParam = Number(searchParams.get("grid") ?? "0") // optional target grid side

  if (!Number.isFinite(swLat) || !Number.isFinite(swLng) || !Number.isFinite(neLat) || !Number.isFinite(neLng)) {
    return new Response("Invalid bounds", { status: 400 })
  }

  // normalize bounds
  const latMin = Math.min(swLat, neLat)
  const latMax = Math.max(swLat, neLat)
  const lngMin = Math.min(swLng, neLng)
  const lngMax = Math.max(swLng, neLng)

  // Compute sampling grid. Prefer caller step*, but cap the total samples to ≤ 36.
  const dLat = Math.max(1e-6, latMax - latMin)
  const dLng = Math.max(1e-6, lngMax - lngMin)

  let stepLat = Math.max(0.01, isFinite(stepLatParam) ? stepLatParam : 0.1)
  let stepLon = Math.max(0.01, isFinite(stepLonParam) ? stepLonParam : 0.1)

  if (gridParam > 1) {
    // If explicit grid side provided, override steps to hit ≈ grid^2 samples
    stepLat = dLat / Math.max(1, gridParam - 1)
    stepLon = dLng / Math.max(1, gridParam - 1)
  }

  // Build candidate points
  const candidates: Point[] = []
  for (let lat = latMin; lat <= latMax + 1e-9; lat += stepLat) {
    for (let lng = lngMin; lng <= lngMax + 1e-9; lng += stepLon) {
      candidates.push({ lat: Number(lat.toFixed(4)), lng: Number(lng.toFixed(4)), rain: 0 })
    }
  }

  // Hard cap total samples to keep the route fast
  const MAX_SAMPLES = 36
  const points = candidates.slice(0, MAX_SAMPLES)

  // Limited concurrency fetch (pool size 6)
  const CONCURRENCY = 6
  let i = 0
  async function worker() {
    while (i < points.length) {
      const idx = i++
      const p = points[idx]
      try {
        p.rain = await fetchRain(p.lat, p.lng)
      } catch {
        p.rain = 0
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, points.length) }, worker))

  return new Response(JSON.stringify({ points }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=60", // cache 60s
    },
  })
}
