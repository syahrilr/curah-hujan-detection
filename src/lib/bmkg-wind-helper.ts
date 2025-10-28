/**
 * BMKG Wind Data Integration
 * Fetches wind direction and speed from BMKG API
 */

export interface WindData {
  location: {
    name: string
    lat: number
    lng: number
    kode: string
  }
  wind: {
    direction_deg: number      // 0-360 degrees
    direction_cardinal: string // N, NE, E, SE, S, SW, W, NW
    speed: number             // m/s or km/h
    timestamp: string
  }
  weather: {
    temp: number
    humidity: number
    weather_code: number
    weather_desc: string
  }
}

/**
 * Jakarta area administrative codes (Kecamatan level)
 * Based on Keputusan Mendagri No 100.1.1-6117 Tahun 2022
 */
const JAKARTA_KECAMATAN_CODES = {
  // Jakarta Pusat
  'Menteng': '31.71.01',
  'Gambir': '31.71.02',
  'Kemayoran': '31.71.03',
  'Tanah Abang': '31.71.04',
  'Cempaka Putih': '31.71.05',

  // Jakarta Barat
  'Grogol Petamburan': '31.73.01',
  'Taman Sari': '31.73.02',
  'Tambora': '31.73.03',
  'Kebon Jeruk': '31.73.04',

  // Jakarta Selatan
  'Cilandak': '31.74.01',
  'Kebayoran Baru': '31.74.02',
  'Kebayoran Lama': '31.74.03',
  'Pasar Minggu': '31.74.04',

  // Jakarta Timur
  'Matraman': '31.75.01',
  'Pulo Gadung': '31.75.02',
  'Cakung': '31.75.03',
  'Cipayung': '31.75.04',

  // Jakarta Utara
  'Koja': '31.72.01',
  'Penjaringan': '31.72.02',
  'Tanjung Priok': '31.72.03',
}

/**
 * Fetch weather data from BMKG API (using GitHub data)
 * Note: BMKG provides data per kelurahan (village level)
 */
export async function fetchBMKGWindData(
  kode_wilayah: string
): Promise<WindData | null> {
  try {
    // BMKG GitHub API endpoint
    const url = `https://api.bmkg.go.id/publik/prakiraan-cuaca?adm4=${kode_wilayah}`

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Rainfall-Monitoring-System/1.0'
      }
    })

    if (!response.ok) {
      throw new Error(`BMKG API error: ${response.status}`)
    }

    const data = await response.json()

    // Extract location info
    const lokasi = data.lokasi

    // Get current/latest weather data (first item in first day)
    const currentWeather = data.data[0].cuaca[0][0] // First day, first time slot

    return {
      location: {
        name: `${lokasi.kecamatan}, ${lokasi.kota}`,
        lat: parseFloat(lokasi.lat),
        lng: parseFloat(lokasi.lon),
        kode: lokasi.kotkab
      },
      wind: {
        direction_deg: currentWeather.wd_deg,
        direction_cardinal: currentWeather.wd,
        speed: currentWeather.ws, // in m/s
        timestamp: currentWeather.local_datetime
      },
      weather: {
        temp: currentWeather.t,
        humidity: currentWeather.hu,
        weather_code: currentWeather.weather,
        weather_desc: currentWeather.weather_desc
      }
    }

  } catch (error) {
    console.error('Failed to fetch BMKG wind data:', error)
    return null
  }
}

/**
 * Fetch wind data for multiple Jakarta locations
 */
export async function fetchJakartaWindData(): Promise<WindData[]> {
  const codes = Object.values(JAKARTA_KECAMATAN_CODES)

  // Sample a few key locations to avoid too many requests
  const sampleCodes = [
    '31.71.03.1001', // Kemayoran (Jakarta Pusat)
    '31.73.01.1001', // Grogol Petamburan (Jakarta Barat)
    '31.74.01.1001', // Cilandak (Jakarta Selatan)
    '31.75.02.1001', // Pulo Gadung (Jakarta Timur)
    '31.72.03.1001', // Tanjung Priok (Jakarta Utara)
  ]

  const results = await Promise.allSettled(
    sampleCodes.map(code => fetchBMKGWindData(code))
  )

  return results
    .filter((result): result is PromiseFulfilledResult<WindData> =>
      result.status === 'fulfilled' && result.value !== null
    )
    .map(result => result.value)
}

/**
 * Convert wind direction (degrees) to arrow rotation
 * Wind direction indicates WHERE the wind is coming FROM
 * Arrow points to WHERE the wind is going TO
 */
export function getWindArrowRotation(windDirectionDeg: number): number {
  // Wind direction: 0° = North (wind from North)
  // Arrow should point South (180°)
  // So we add 180° to get the arrow direction
  return (windDirectionDeg + 180) % 360
}

/**
 * Get wind speed category and color
 */
export function getWindSpeedCategory(speedMS: number): {
  category: string
  color: string
  description: string
} {
  // Beaufort scale adapted
  if (speedMS < 0.5) return {
    category: 'Calm',
    color: '#94a3b8',
    description: 'Calm'
  }
  if (speedMS < 3.3) return {
    category: 'Light',
    color: '#60a5fa',
    description: 'Light breeze'
  }
  if (speedMS < 7.9) return {
    category: 'Moderate',
    color: '#3b82f6',
    description: 'Moderate breeze'
  }
  if (speedMS < 13.8) return {
    category: 'Strong',
    color: '#f59e0b',
    description: 'Strong breeze'
  }
  return {
    category: 'Very Strong',
    color: '#ef4444',
    description: 'Very strong'
  }
}

/**
 * Convert m/s to km/h
 */
export function msToKmh(ms: number): number {
  return ms * 3.6
}

/**
 * Create wind arrow SVG icon
 */
export function createWindArrowIcon(
  rotation: number,
  color: string,
  size: number = 32
): string {
  return `
    <svg width="${size}" height="${size}" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
      <g transform="rotate(${rotation} 16 16)">
        <!-- Arrow body -->
        <line x1="16" y1="4" x2="16" y2="28" stroke="${color}" stroke-width="3" stroke-linecap="round"/>
        <!-- Arrow head -->
        <polygon points="16,4 12,10 20,10" fill="${color}"/>
        <!-- Arrow tail -->
        <circle cx="16" cy="28" r="2" fill="${color}"/>
      </g>
    </svg>
  `
}

/**
 * Create wind barb (meteorological standard)
 * More accurate for aviation/meteorology
 */
export function createWindBarb(
  speedKnots: number,
  rotation: number,
  size: number = 40
): string {
  // Simplified wind barb
  // Full barb = 10 knots, half barb = 5 knots
  const fullBarbs = Math.floor(speedKnots / 10)
  const halfBarb = (speedKnots % 10) >= 5 ? 1 : 0

  let barbsHTML = ''
  let yPos = 8

  // Add full barbs
  for (let i = 0; i < Math.min(fullBarbs, 5); i++) {
    barbsHTML += `<line x1="20" y1="${yPos}" x2="28" y2="${yPos - 4}" stroke="currentColor" stroke-width="2"/>`
    yPos += 4
  }

  // Add half barb
  if (halfBarb) {
    barbsHTML += `<line x1="20" y1="${yPos}" x2="24" y2="${yPos - 2}" stroke="currentColor" stroke-width="2"/>`
  }

  return `
    <svg width="${size}" height="${size}" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
      <g transform="rotate(${rotation} 20 20)">
        <!-- Staff -->
        <line x1="20" y1="8" x2="20" y2="32" stroke="currentColor" stroke-width="2"/>
        <!-- Barbs -->
        ${barbsHTML}
        <!-- Base circle -->
        <circle cx="20" cy="32" r="3" fill="currentColor"/>
      </g>
    </svg>
  `
}

/**
 * Format wind data for display
 */
export function formatWindInfo(windData: WindData): string {
  const speedKmh = msToKmh(windData.wind.speed)
  const category = getWindSpeedCategory(windData.wind.speed)

  return `
    <div style="min-width: 220px; font-family: system-ui;">
      <h3 style="margin: 0 0 10px 0; color: #1e40af; font-size: 14px; font-weight: bold;">
        💨 Wind Data
      </h3>

      <div style="background: #f8fafc; padding: 10px; border-radius: 6px; margin-bottom: 10px;">
        <div style="font-size: 12px; line-height: 1.8;">
          <strong>Location:</strong> ${windData.location.name}<br/>
          <strong>Direction:</strong> ${windData.wind.direction_cardinal} (${windData.wind.direction_deg}°)<br/>
          <strong>Speed:</strong> ${windData.wind.speed.toFixed(1)} m/s (${speedKmh.toFixed(1)} km/h)<br/>
          <strong>Category:</strong> <span style="color: ${category.color}; font-weight: 600;">${category.category}</span>
        </div>
      </div>

      <div style="background: #dbeafe; padding: 8px; border-radius: 6px; font-size: 11px;">
        <strong>Weather:</strong> ${windData.weather.weather_desc}<br/>
        <strong>Temperature:</strong> ${windData.weather.temp}°C<br/>
        <strong>Humidity:</strong> ${windData.weather.humidity}%
      </div>

      <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #e5e7eb; font-size: 10px; color: #6b7280; text-align: center;">
        ${windData.wind.timestamp}
      </div>
    </div>
  `
}

/**
 * Export all utilities
 */
export default {
  fetchBMKGWindData,
  fetchJakartaWindData,
  getWindArrowRotation,
  getWindSpeedCategory,
  createWindArrowIcon,
  createWindBarb,
  formatWindInfo,
  msToKmh,
  JAKARTA_KECAMATAN_CODES
}
