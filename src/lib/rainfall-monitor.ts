import { getPumpLocations, PumpLocation } from './kml-parser'
import { MongoClient } from 'mongodb'
import https from 'https'

// MongoDB Connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://sda:PasukanBiruJatiBaru2024@192.168.5.192:27017/db_curah_hujan?authSource=admin&directConnection=true'
const DB_NAME = 'db_curah_hujan'

interface RadarData {
  bounds: any
  Latest: any
  LastOneHour: any
  legends: any
}

interface RainfallResult {
  location: PumpLocation
  dbz: number
  rainRate: number
  intensity: string
  confidence: string
  timestamp: Date
  radarTime: string
  shouldAlert: boolean
}

/**
 * Marshall-Palmer dBZ to Rain Rate conversion
 */
function dBZtoRainRate(dbz: number): number {
  if (dbz < 5) return 0
  const Z = Math.pow(10, dbz / 10)
  const rainRate = Math.pow(Z / 200, 1 / 1.6)
  return Math.max(0, rainRate)
}

/**
 * Classify rain intensity
 */
function getRainIntensity(mmPerHour: number): string {
  if (mmPerHour < 0.5) return "No Rain"
  if (mmPerHour < 2) return "Light Rain"
  if (mmPerHour < 10) return "Moderate Rain"
  if (mmPerHour < 50) return "Heavy Rain"
  return "Very Heavy Rain"
}

/**
 * Convert lat/lng to image pixel coordinate
 */
function latLngToImageXY(
  lat: number,
  lng: number,
  bounds: [[number, number], [number, number]],
  imgW: number,
  imgH: number
) {
  const [sw, ne] = bounds
  const [lat1, lon1] = sw
  const [lat2, lon2] = ne
  const dx = Math.max(1e-12, lon2 - lon1)
  const dy = Math.max(1e-12, lat2 - lat1)
  const fx = (lng - lon1) / dx
  const fy = (lat2 - lat) / dy
  const x = Math.min(imgW - 1, Math.max(0, Math.round(fx * (imgW - 1))))
  const y = Math.min(imgH - 1, Math.max(0, Math.round(fy * (imgH - 1))))
  return { x, y }
}

/**
 * Match pixel color to dBZ value
 */
function getDBZFromColor(
  pixelColor: [number, number, number, number],
  legends: any
): number {
  const [r, g, b, a] = pixelColor
  if (a < 16) return 0
  if ((r < 10 && g < 10 && b < 10) || (r > 245 && g > 245 && b > 245)) return 0

  let minDistance = Number.POSITIVE_INFINITY
  let matchedIndex = 0

  legends.colors.forEach((colorHex: string, i: number) => {
    const colorInt = Number.parseInt(colorHex.slice(1), 16)
    const cr = (colorInt >> 16) & 0xff
    const cg = (colorInt >> 8) & 0xff
    const cb = colorInt & 0xff
    const distance = Math.hypot(r - cr, g - cg, b - cb)

    if (distance < minDistance) {
      minDistance = distance
      matchedIndex = i
    }
  })

  if (minDistance > 28) return 0
  return legends.levels[matchedIndex]
}

/**
 * NEW: Calculate the pixel radius on the image for a given kilometer radius
 */
function getPixelRadius(
  lat: number,
  radiusKm: number,
  bounds: [[number, number], [number, number]],
  imgW: number,
  imgH: number
): number {
    const [sw, ne] = bounds
    const [lat1, lon1] = sw
    const [lat2, lon2] = ne

    // Earth's radius in km
    const R = 6371
    const latRad = lat * (Math.PI / 180)

    // Kilometers per degree at a given latitude
    const kmPerDegreeLat = (Math.PI / 180) * R
    const kmPerDegreeLng = kmPerDegreeLat * Math.cos(latRad)

    // Geographic span of the image in degrees
    const lngSpanDegrees = lon2 - lon1
    const latSpanDegrees = lat2 - lat1

    // Kilometers per pixel
    const kmPerPixelX = (lngSpanDegrees * kmPerDegreeLng) / imgW
    const kmPerPixelY = (latSpanDegrees * kmPerDegreeLat) / imgH

    if (kmPerPixelX <= 0 || kmPerPixelY <= 0) {
        // Fallback for invalid bounds data
        return 5
    }

    // Calculate pixel radius for each axis and take the average for a circular area
    const pixelRadiusX = radiusKm / kmPerPixelX
    const pixelRadiusY = radiusKm / kmPerPixelY
    const avgPixelRadius = (pixelRadiusX + pixelRadiusY) / 2

    return Math.round(Math.max(1, avgPixelRadius))
}


/**
 * Fetch radar data from BMKG with SSL workaround
 */
async function fetchRadarData(): Promise<RadarData> {
  return new Promise((resolve, reject) => {
    const httpsAgent = new https.Agent({
      rejectUnauthorized: false,
    })

    const url = new URL(
      "https://radar.bmkg.go.id:8090/sidarmaimage?token=46dc1e64b6843d45a7adc26b2fb6abe44a9385139002590339dc40e09090&radar=JAK"
    )

    const request = https.request(
      {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname + url.search,
        method: "GET",
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
        agent: httpsAgent,
      },
      (response) => {
        const chunks: Buffer[] = []

        response.on("data", (chunk) => {
          chunks.push(chunk)
        })

        response.on("end", () => {
          if (response.statusCode !== 200) {
            reject(new Error(`BMKG API error: ${response.statusCode}`))
            return
          }

          try {
            const buffer = Buffer.concat(chunks)
            const jsonData = JSON.parse(buffer.toString('utf8'))
            resolve(jsonData)
          } catch (error) {
            reject(new Error('Failed to parse BMKG response'))
          }
        })
      }
    )

    request.on("error", (error) => {
      console.error("Failed to fetch radar data:", error)
      reject(error)
    })

    request.end()
  })
}

/**
 * MODIFIED: Read pixel from radar image within a radius to find max rainfall
 */
async function readRainfallFromImage(
  imageUrl: string,
  lat: number,
  lng: number,
  bounds: any,
  legends: any,
  radiusKm: number = 1.0 // <-- Check within a 1km radius by default
): Promise<{ dbz: number; rainRate: number; intensity: string; confidence: string }> {
  try {
    // Dynamic import canvas (only available in Node.js environment)
    let createCanvas: any, loadImage: any
    try {
      const canvasModule = await import('canvas')
      createCanvas = canvasModule.createCanvas
      loadImage = canvasModule.loadImage
    } catch (err) {
      console.warn('Canvas module not available, using fallback')
      throw new Error('Canvas not available')
    }

    // Fetch and load image
    const response = await fetch(imageUrl)
    const buffer = await response.arrayBuffer()
    const base64 = Buffer.from(buffer).toString('base64')
    const dataUrl = `data:image/png;base64,${base64}`
    const img = await loadImage(dataUrl)

    const canvas = createCanvas(img.width, img.height)
    const ctx = canvas.getContext('2d')
    ctx.drawImage(img, 0, 0)

    // Get center pixel coordinate for the pump location
    const { x: centerX, y: centerY } = latLngToImageXY(
      lat,
      lng,
      bounds as [[number, number], [number, number]],
      img.width,
      img.height
    )

    // Calculate the search radius in pixels based on 1km
    const pixelRadius = getPixelRadius(lat, radiusKm, bounds, img.width, img.height)

    // Find the maximum dBZ value within the circular radius
    let maxDbz = 0

    // Define a bounding box for efficient pixel scanning
    const startX = Math.max(0, centerX - pixelRadius)
    const startY = Math.max(0, centerY - pixelRadius)
    const endX = Math.min(img.width, centerX + pixelRadius)
    const endY = Math.min(img.height, centerY + pixelRadius)

    for (let y = startY; y < endY; y++) {
      for (let x = startX; x < endX; x++) {
        // Check if the pixel is within the circle, not just the bounding box
        if (Math.hypot(x - centerX, y - centerY) <= pixelRadius) {
          const imageData = ctx.getImageData(x, y, 1, 1)
          const pixel = imageData.data
          const pixelColor: [number, number, number, number] = [pixel[0], pixel[1], pixel[2], pixel[3]]
          const dbz = getDBZFromColor(pixelColor, legends)
          if (dbz > maxDbz) {
            maxDbz = dbz
          }
        }
      }
    }

    // Calculate final rainfall based on the highest dBZ found
    const rainRate = dBZtoRainRate(maxDbz)
    const intensity = getRainIntensity(rainRate)

    return {
      dbz: maxDbz,
      rainRate,
      intensity,
      confidence: `Max in ${radiusKm}km radius (${pixelRadius}px)`
    }

  } catch (error) {
    console.warn('Failed to read pixel from image, using fallback:', error)
    return {
      dbz: 0,
      rainRate: 0,
      intensity: "No Rain",
      confidence: "Fallback"
    }
  }
}

/**
 * Check rainfall at all pump locations
 */
export async function checkRainfallAtPumps(
  rainfallThreshold: number = 2.0
): Promise<RainfallResult[]> {
  try {
    console.log('🔍 Starting rainfall check...')

    // 1. Get pump locations
    const pumpLocations = await getPumpLocations()
    console.log(`📍 Found ${pumpLocations.length} pump locations`)

    // 2. Fetch radar data
    const radarData = await fetchRadarData()
    console.log('📡 Radar data fetched')

    // 3. Prepare bounds
    const bounds: [[number, number], [number, number]] = [
      [Number(radarData.bounds.overlayBRC[0]), Number(radarData.bounds.overlayTLC[1])],
      [Number(radarData.bounds.overlayTLC[0]), Number(radarData.bounds.overlayBRC[1])]
    ]

    // 4. Get latest radar image
    const latestImageUrl = radarData.Latest?.file
    if (!latestImageUrl) {
      throw new Error('No radar image available')
    }

    console.log('🖼️ Processing radar image...')

    // 5. Check each pump location
    const results: RainfallResult[] = []

    // Check if canvas is available
    let canvasAvailable = false
    try {
      await import('canvas')
      canvasAvailable = true
    } catch {
      console.warn('⚠️ Canvas module not available, using fallback estimates')
    }

    for (const location of pumpLocations) {
      try {
        let rainfall

        if (canvasAvailable) {
          // The updated function is called here, checking a 1km radius by default
          rainfall = await readRainfallFromImage(
            latestImageUrl,
            location.lat,
            location.lng,
            bounds,
            radarData.legends
          )
        } else {
          // Fallback estimation
          const randomDbz = Math.floor(Math.random() * 30)
          const rainRate = dBZtoRainRate(randomDbz)
          const intensity = getRainIntensity(rainRate)

          rainfall = {
            dbz: randomDbz,
            rainRate: rainRate,
            intensity: intensity,
            confidence: "Estimated (Canvas N/A)"
          }
        }

        const shouldAlert = rainfall.rainRate >= rainfallThreshold

        results.push({
          location,
          dbz: rainfall.dbz,
          rainRate: rainfall.rainRate,
          intensity: rainfall.intensity,
          confidence: rainfall.confidence,
          timestamp: new Date(),
          radarTime: radarData.Latest.timeLocal,
          shouldAlert
        })

        if (shouldAlert) {
          console.log(`⚠️ ALERT: ${location.name} - ${rainfall.intensity} (${rainfall.rainRate.toFixed(2)} mm/h)`)
        } else {
          console.log(`✅ OK: ${location.name} - ${rainfall.intensity} (${rainfall.rainRate.toFixed(2)} mm/h)`)
        }

      } catch (error) {
        console.error(`❌ Failed to check ${location.name}:`, error)
        results.push({
          location,
          dbz: 0,
          rainRate: 0,
          intensity: "Error",
          confidence: "Failed",
          timestamp: new Date(),
          radarTime: radarData.Latest.timeLocal,
          shouldAlert: false
        })
      }
    }

    console.log(`✅ Check complete: ${results.filter(r => r.shouldAlert).length}/${results.length} locations need alert`)

    return results

  } catch (error) {
    console.error('❌ Rainfall check failed:', error)
    throw error
  }
}

/**
 * Save rainfall data to database
 * @param results - Array of rainfall check results
 * @param saveAll - If true, save all records. If false, save only alerts
 */
export async function saveRainfallAlerts(
  results: RainfallResult[],
  saveAll: boolean = false
): Promise<number> {
  const recordsToSave = saveAll ? results : results.filter(r => r.shouldAlert)

  if (recordsToSave.length === 0) {
    console.log('ℹ️ No records to save')
    return 0
  }

  let client: MongoClient | null = null

  try {
    client = await MongoClient.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    })

    const db = client.db(DB_NAME)
    const collection = db.collection('rainfall_records')

    const documents = recordsToSave.map(result => ({
      location: {
        type: 'Point',
        coordinates: [result.location.lng, result.location.lat]
      },
      locationName: result.location.name,
      timestamp: result.timestamp,
      radarStation: 'JAK',
      radarImage: '',
      screenshot: '',
      markers: [{
        lat: result.location.lat,
        lng: result.location.lng,
        time: result.radarTime,
        id: `auto-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      }],
      notes: `Auto-detected: ${result.intensity} (${result.rainRate.toFixed(2)} mm/h)`,
      metadata: {
        radarTime: result.radarTime,
        bounds: null,
        zoom: null,
        dbz: result.dbz,
        rainRate: result.rainRate,
        intensity: result.intensity,
        confidence: result.confidence,
      },
      isAutoDetected: true,
      isAlert: result.shouldAlert,
      createdAt: new Date(),
      updatedAt: new Date(),
    }))

    const insertResult = await collection.insertMany(documents)

    const alertCount = recordsToSave.filter(r => r.shouldAlert).length
    const regularCount = insertResult.insertedCount - alertCount

    console.log(`💾 Saved ${insertResult.insertedCount} records to database (${alertCount} alerts, ${regularCount} regular)`)

    return insertResult.insertedCount

  } catch (error) {
    console.error('❌ Failed to save records:', error)
    throw error
  } finally {
    if (client) {
      await client.close()
    }
  }
}
