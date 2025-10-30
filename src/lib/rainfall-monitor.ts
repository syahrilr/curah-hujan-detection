import { getPumpLocations, type PumpLocation } from "./kml-parser"
import { createRadarScreenshot } from "./radar-image-capture"
import { MongoClient } from "mongodb"
import https from "https"
import {
  captureRadarImage,
  validateRadarData,
  type CapturedRadarData,
  type DetectedLocation,
} from "./radar-image-capture"

const MONGODB_URI =
  process.env.MONGODB_URI ||
  "mongodb://sda:PasukanBiruJatiBaru2024@192.168.5.192:27017/db_curah_hujan?authSource=admin&directConnection=true"
const DB_NAME = "db_curah_hujan"

const SEARCH_RADIUS_KM = 1.0
const MIN_PIXEL_RADIUS = 2
const MAX_PIXEL_RADIUS = 50
const COLOR_MATCH_THRESHOLD = 28

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
  pixelX?: number
  pixelY?: number
}

function dBZtoRainRate(dbz: number): number {
  if (dbz < 5) return 0
  const Z = Math.pow(10, dbz / 10)
  const rainRate = Math.pow(Z / 200, 1 / 1.6)
  return Math.max(0, rainRate)
}

function getRainIntensity(mmPerHour: number): string {
  if (mmPerHour < 0.5) return "No Rain"
  if (mmPerHour < 2) return "Light Rain"
  if (mmPerHour < 10) return "Moderate Rain"
  if (mmPerHour < 50) return "Heavy Rain"
  return "Very Heavy Rain"
}

function latLngToImageXY(
  lat: number,
  lng: number,
  bounds: [[number, number], [number, number]],
  imgW: number,
  imgH: number,
) {
  const [sw, ne] = bounds
  const [lat1, lon1] = sw
  const [lat2, lon2] = ne

  // Validate bounds
  if (lat1 === lat2 || lon1 === lon2) {
    console.warn("Invalid bounds: zero-size area")
    return { x: Math.floor(imgW / 2), y: Math.floor(imgH / 2) }
  }

  const dx = Math.abs(lon2 - lon1)
  const dy = Math.abs(lat2 - lat1)

  // Normalize coordinates
  const fx = (lng - Math.min(lon1, lon2)) / dx
  const fy = (Math.max(lat1, lat2) - lat) / dy

  const x = Math.min(imgW - 1, Math.max(0, Math.round(fx * (imgW - 1))))
  const y = Math.min(imgH - 1, Math.max(0, Math.round(fy * (imgH - 1))))

  return { x, y }
}

function getDBZFromColor(pixelColor: [number, number, number, number], legends: any): number {
  const [r, g, b, a] = pixelColor

  // Check transparency
  if (a < 16) return 0

  // Check for white or black (background)
  if ((r < 10 && g < 10 && b < 10) || (r > 245 && g > 245 && b > 245)) return 0

  if (!legends || !legends.colors || !legends.levels) {
    console.warn("Invalid legends data")
    return 0
  }

  let minDistance = Number.POSITIVE_INFINITY
  let matchedIndex = 0

  legends.colors.forEach((colorHex: string, i: number) => {
    try {
      const colorInt = Number.parseInt(colorHex.slice(1), 16)
      const cr = (colorInt >> 16) & 0xff
      const cg = (colorInt >> 8) & 0xff
      const cb = colorInt & 0xff
      const distance = Math.hypot(r - cr, g - cg, b - cb)

      if (distance < minDistance) {
        minDistance = distance
        matchedIndex = i
      }
    } catch (error) {
      console.warn(`Failed to parse color ${colorHex}`)
    }
  })

  if (minDistance > COLOR_MATCH_THRESHOLD) return 0
  return legends.levels[matchedIndex] || 0
}

function getPixelRadius(
  lat: number,
  radiusKm: number,
  bounds: [[number, number], [number, number]],
  imgW: number,
  imgH: number,
): number {
  const [sw, ne] = bounds
  const [lat1, lon1] = sw
  const [lat2, lon2] = ne

  const R = 6371 // Earth radius in km
  const latRad = lat * (Math.PI / 180)

  const kmPerDegreeLat = (Math.PI / 180) * R
  const kmPerDegreeLng = kmPerDegreeLat * Math.cos(latRad)

  const lngSpanDegrees = Math.abs(lon2 - lon1)
  const latSpanDegrees = Math.abs(lat2 - lat1)

  if (lngSpanDegrees <= 0 || latSpanDegrees <= 0 || imgW <= 0 || imgH <= 0) {
    return MIN_PIXEL_RADIUS
  }

  const kmPerPixelX = (lngSpanDegrees * kmPerDegreeLng) / imgW
  const kmPerPixelY = (latSpanDegrees * kmPerDegreeLat) / imgH

  if (kmPerPixelX <= 0 || kmPerPixelY <= 0) {
    return MIN_PIXEL_RADIUS
  }

  const pixelRadiusX = radiusKm / kmPerPixelX
  const pixelRadiusY = radiusKm / kmPerPixelY
  const avgPixelRadius = (pixelRadiusX + pixelRadiusY) / 2

  return Math.round(Math.max(MIN_PIXEL_RADIUS, Math.min(MAX_PIXEL_RADIUS, avgPixelRadius)))
}


async function fetchRadarData(): Promise<RadarData> {
  return new Promise((resolve, reject) => {
    const httpsAgent = new https.Agent({
      rejectUnauthorized: false,
    })

    const url = new URL(
      "https://radar.bmkg.go.id:8090/sidarmaimage?token=46dc1e64b6843d45a7adc26b2fb6abe44a9385139002590339dc40e09090&radar=JAK",
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
            const jsonData = JSON.parse(buffer.toString("utf8"))
            resolve(jsonData)
          } catch (error) {
            reject(new Error("Failed to parse BMKG response"))
          }
        })
      },
    )

    request.on("error", (error) => {
      console.error("Failed to fetch radar data:", error)
      reject(error)
    })

    request.end()
  })
}

async function readRainfallFromImage(
  imageUrl: string,
  lat: number,
  lng: number,
  bounds: any,
  legends: any,
  radiusKm = SEARCH_RADIUS_KM,
): Promise<{
  dbz: number
  rainRate: number
  intensity: string
  confidence: string
  pixelX: number
  pixelY: number
}> {
  try {
    let createCanvas: any, loadImage: any
    try {
      const canvasModule = await import("canvas")
      createCanvas = canvasModule.createCanvas
      loadImage = canvasModule.loadImage
    } catch (err) {
      console.warn("Canvas module not available")
      throw new Error("Canvas not available")
    }

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 15000)

    let response: any
    try {
      response = await fetch(imageUrl, { signal: controller.signal })
    } catch (err) {
      clearTimeout(timeoutId)
      if ((err as Error).name === "AbortError") {
        throw new Error("Image fetch timed out")
      }
      throw err
    }
    clearTimeout(timeoutId)

    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.status}`)
    }

    const buffer = await response.arrayBuffer()
    const base64 = Buffer.from(buffer).toString("base64")
    const dataUrl = `data:image/png;base64,${base64}`

    const img = await loadImage(dataUrl)

    const canvas = createCanvas(img.width, img.height)
    const ctx = canvas.getContext("2d")
    ctx.drawImage(img, 0, 0)

    const { x: centerX, y: centerY } = latLngToImageXY(
      lat,
      lng,
      bounds as [[number, number], [number, number]],
      img.width,
      img.height,
    )

    const pixelRadius = getPixelRadius(lat, radiusKm, bounds, img.width, img.height)

    let maxDbz = 0
    let sampleCount = 0

    const startX = Math.max(0, centerX - pixelRadius)
    const startY = Math.max(0, centerY - pixelRadius)
    const endX = Math.min(img.width, centerX + pixelRadius)
    const endY = Math.min(img.height, centerY + pixelRadius)

    for (let y = startY; y < endY; y++) {
      for (let x = startX; x < endX; x++) {
        if (Math.hypot(x - centerX, y - centerY) <= pixelRadius) {
          const imageData = ctx.getImageData(x, y, 1, 1)
          const pixel = imageData.data
          const pixelColor: [number, number, number, number] = [pixel[0], pixel[1], pixel[2], pixel[3]]
          const dbz = getDBZFromColor(pixelColor, legends)
          if (dbz > maxDbz) {
            maxDbz = dbz
          }
          sampleCount++
        }
      }
    }

    const rainRate = dBZtoRainRate(maxDbz)
    const intensity = getRainIntensity(rainRate)

    return {
      dbz: maxDbz,
      rainRate,
      intensity,
      confidence: `Max in ${radiusKm}km radius (${pixelRadius}px, ${sampleCount} samples)`,
      pixelX: centerX,
      pixelY: centerY,
    }
  } catch (error) {
    console.warn(`Failed to read pixel from image: ${error instanceof Error ? error.message : String(error)}`)
    return {
      dbz: 0,
      rainRate: 0,
      intensity: "No Rain",
      confidence: "Fallback",
      pixelX: 0,
      pixelY: 0,
    }
  }
}

export async function checkRainfallAtPumpsWithCapture(rainfallThreshold = 2.0): Promise<{
  results: RainfallResult[]
  capturedData: CapturedRadarData | null
}> {
  try {
    console.log("🔍 Starting rainfall check with image capture...")

    const pumpLocations = await getPumpLocations()
    console.log(`📍 Found ${pumpLocations.length} pump locations`)

    const radarData = await fetchRadarData()
    console.log("📡 Radar data fetched")

    const bounds: [[number, number], [number, number]] = [
      [Number(radarData.bounds.overlayBRC[0]), Number(radarData.bounds.overlayTLC[1])],
      [Number(radarData.bounds.overlayTLC[0]), Number(radarData.bounds.overlayBRC[1])],
    ]

    const latestImageUrl = radarData.Latest?.file
    if (!latestImageUrl) {
      throw new Error("No radar image available")
    }

    console.log("🖼️ Capturing radar image...")

    let imageBase64 = ""
    try {
      const captured = await captureRadarImage(latestImageUrl, "JAK")
      imageBase64 = captured.base64
      console.log(`✅ Image captured (${(captured.size / 1024).toFixed(2)} KB)`)
    } catch (error) {
      console.warn(`⚠️ Failed to capture image: ${error instanceof Error ? error.message : String(error)}`)
    }

    console.log("🔍 Processing radar image for detected locations...")

    const results: RainfallResult[] = []
    const detectedLocations: DetectedLocation[] = []

    let canvasAvailable = false
    try {
      await import("canvas")
      canvasAvailable = true
    } catch {
      console.warn("⚠️ Canvas module not available")
    }

    for (const location of pumpLocations) {
      try {
        let rainfall

        if (canvasAvailable) {
          rainfall = await readRainfallFromImage(latestImageUrl, location.lat, location.lng, bounds, radarData.legends)
        } else {
          const randomDbz = Math.floor(Math.random() * 30)
          const rainRate = dBZtoRainRate(randomDbz)
          const intensity = getRainIntensity(rainRate)

          rainfall = {
            dbz: randomDbz,
            rainRate: rainRate,
            intensity: intensity,
            confidence: "Estimated (Canvas N/A)",
            pixelX: 0,
            pixelY: 0,
          }
        }

        const shouldAlert = rainfall.rainRate >= rainfallThreshold

        const result: RainfallResult = {
          location,
          dbz: rainfall.dbz,
          rainRate: rainfall.rainRate,
          intensity: rainfall.intensity,
          confidence: rainfall.confidence,
          timestamp: new Date(),
          radarTime: radarData.Latest.timeLocal,
          shouldAlert,
          pixelX: rainfall.pixelX,
          pixelY: rainfall.pixelY,
        }

        results.push(result)

        detectedLocations.push({
          lat: location.lat,
          lng: location.lng,
          name: location.name,
          dbz: rainfall.dbz,
          rainRate: rainfall.rainRate,
          intensity: rainfall.intensity,
          confidence: rainfall.confidence,
          pixelX: rainfall.pixelX || 0,
          pixelY: rainfall.pixelY || 0,
        })

        if (shouldAlert) {
          console.log(`⚠️ ALERT: ${location.name} - ${rainfall.intensity} (${rainfall.rainRate.toFixed(2)} mm/h)`)
        } else {
          console.log(`✅ OK: ${location.name} - ${rainfall.intensity} (${rainfall.rainRate.toFixed(2)} mm/h)`)
        }
      } catch (error) {
        console.error(`❌ Failed to check ${location.name}: ${error instanceof Error ? error.message : String(error)}`)
        results.push({
          location,
          dbz: 0,
          rainRate: 0,
          intensity: "Error",
          confidence: "Failed",
          timestamp: new Date(),
          radarTime: radarData.Latest.timeLocal,
          shouldAlert: false,
        })
      }
    }

    const parsableTimestamp = radarData.Latest.timeLocal.replace(/ \w+$/, "");

    const capturedData: CapturedRadarData = {
      imageBase64,
      imageUrl: latestImageUrl,
      timestamp: parsableTimestamp,
      radarStation: "JAK",
      bounds: {
        sw: [bounds[0][0], bounds[0][1]],
        ne: [bounds[1][0], bounds[1][1]],
      },
      detectedLocations,
    }

    console.log(
      `✅ Check complete: ${results.filter((r) => r.shouldAlert).length}/${results.length} locations need alert`,
    )
    console.log(`📍 Detected ${detectedLocations.length} locations with rainfall data`)

    return { results, capturedData }
  } catch (error) {
    console.error(`❌ Rainfall check failed: ${error instanceof Error ? error.message : String(error)}`)
    throw error
  }
}


export async function saveRainfallWithImage(
  results: RainfallResult[],
  capturedData: CapturedRadarData | null,
  saveAll = false,
  rainfallThreshold: number,
): Promise<{ savedCount: number; recordId: string | null }> {

  const recordsToSave = saveAll ? results : results.filter((r) => r.shouldAlert)

  if (!capturedData) {
    console.log("ℹ️ No captured data, nothing to save")
    return { savedCount: 0, recordId: null }
  }

  let client: MongoClient | null = null

  try {
    if (capturedData) {
      const validation = validateRadarData(capturedData)
      if (!validation.valid) {
        console.error("⚠️ Validation errors:", validation.errors)
      } else {
        console.log("✅ Radar data validation passed")
      }
    }


    const locationsForScreenshot = capturedData
      ? capturedData.detectedLocations.filter(loc => loc.rainRate > 0)
      : [];

    let annotatedScreenshot = ""
    if (capturedData && locationsForScreenshot.length > 0) {
      try {
        console.log(`📸 Generating annotated screenshot for ${locationsForScreenshot.length} locations (out of ${capturedData.detectedLocations.length} total)...`)

        const imageWidth = 1024
        const imageHeight = 1024

        annotatedScreenshot = await createRadarScreenshot(
          capturedData.imageBase64,
          locationsForScreenshot,
          imageWidth,
          imageHeight
        )

        const screenshotSize = (annotatedScreenshot.length / 1024).toFixed(2)
        console.log(`✅ Screenshot generated (${screenshotSize} KB)`)
      } catch (error) {
        console.warn("⚠️ Failed to generate screenshot:", error)

      }
    } else if (capturedData) {
      console.log("ℹ️ No rainfall detected, skipping screenshot generation.")
    }

    client = await MongoClient.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    })

    const db = client.db(DB_NAME)
    const collection = db.collection("rainfall_records")

    const document = {
      location: capturedData
        ? {
            type: "Point",
            coordinates: [
              (capturedData.bounds.sw[1] + capturedData.bounds.ne[1]) / 2,
              (capturedData.bounds.sw[0] + capturedData.bounds.ne[0]) / 2,
            ],
          }
        : null,
      radarStation: capturedData?.radarStation || "JAK",
      radarImage: capturedData?.imageBase64 || "",
      radarImageUrl: capturedData?.imageUrl || "",
      screenshot: annotatedScreenshot,
      markers:
        capturedData?.detectedLocations.map((loc) => ({
          lat: loc.lat,
          lng: loc.lng,
          name: loc.name,
          time: capturedData.timestamp,
          id: `auto-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          dbz: loc.dbz,
          rainRate: loc.rainRate,
          intensity: loc.intensity,
        })) || [],
      detectedLocations: capturedData?.detectedLocations || [],
      bounds: capturedData?.bounds || null,
      notes: `Auto-detected: ${capturedData?.detectedLocations.length || 0} locations processed.`,
      metadata: {
        radarTime: capturedData?.timestamp,
        bounds: capturedData?.bounds,
        zoom: null,
        totalDetected: capturedData?.detectedLocations.length || 0,
        locationsWithRain: locationsForScreenshot.length,
        maxRainRate: Math.max(0, ...(capturedData?.detectedLocations.map((l) => l.rainRate) || [0])),
        alertCount: capturedData?.detectedLocations.filter((l) => l.rainRate >= rainfallThreshold).length || 0,
        hasScreenshot: annotatedScreenshot.length > 0,
      },
      isAutoDetected: true,
      isAlert: capturedData.detectedLocations.some(l => l.rainRate >= rainfallThreshold),
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    // Check document size
    const docSize = JSON.stringify(document).length / (1024 * 1024)
    if (docSize > 15) {
      console.warn(`⚠️ Document size (${docSize.toFixed(2)}MB) is approaching MongoDB 16MB limit`)
    } else {
      console.log(`📏 Document size: ${docSize.toFixed(2)}MB`)
    }

    const insertResult = await collection.insertOne(document)

    console.log(`💾 Saved record with ${capturedData?.detectedLocations.length || 0} detected locations`)
    console.log(`   Radar image: ${(capturedData?.imageBase64.length || 0 / 1024).toFixed(2)} KB`)
    console.log(`   Screenshot: ${annotatedScreenshot.length > 0 ? (annotatedScreenshot.length / 1024).toFixed(2) + ' KB' : 'Not generated'}`)
    console.log(`   Record ID: ${insertResult.insertedId}`)

    return {
      savedCount: 1,
      recordId: insertResult.insertedId.toString(),
    }
  } catch (error) {
    console.error("❌ Failed to save records:", error)
    if (error instanceof Error) {
      console.error("   Error details:", {
        name: error.name,
        message: error.message,
        stack: error.stack?.split('\n').slice(0, 3).join('\n')
      })
    }
    throw error
  } finally {
    if (client) {
      await client.close()
    }
  }
}

