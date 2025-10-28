/**
 * Radar Image Capture and Storage Utilities
 * FIXED VERSION - Improved timestamp validation
 */

import https from "https"

export interface CapturedRadarData {
  imageBase64: string
  imageUrl: string
  timestamp: string
  radarStation: string
  bounds: {
    sw: [number, number]
    ne: [number, number]
  }
  detectedLocations: DetectedLocation[]
}

export interface DetectedLocation {
  lat: number
  lng: number
  name: string
  dbz: number
  rainRate: number
  intensity: string
  confidence: string
  pixelX: number
  pixelY: number
}

/**
 * Fetch radar image from BMKG and convert to base64
 */
export async function captureRadarImage(
  imageUrl: string,
  radarStation = "JAK",
): Promise<{ base64: string; size: number; timestamp: string }> {
  return new Promise((resolve, reject) => {
    const httpsAgent = new https.Agent({
      rejectUnauthorized: false,
    })

    const url = new URL(imageUrl)

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
            reject(new Error(`Failed to fetch image: ${response.statusCode}`))
            return
          }

          try {
            const buffer = Buffer.concat(chunks)
            const base64 = buffer.toString("base64")
            const mimeType = response.headers["content-type"] || "image/png"
            const dataUrl = `data:${mimeType};base64,${base64}`

            resolve({
              base64: dataUrl,
              size: buffer.length,
              timestamp: new Date().toISOString(),
            })
          } catch (error) {
            reject(new Error("Failed to encode image"))
          }
        })
      },
    )

    request.on("error", (error) => {
      reject(error)
    })

    request.end()
  })
}

/**
 * Create a screenshot/annotation of detected locations on radar image
 * Returns canvas as base64 PNG
 */
export async function createRadarScreenshot(
  radarImageBase64: string,
  detectedLocations: DetectedLocation[],
  imageWidth: number,
  imageHeight: number,
): Promise<string> {
  try {
    // Dynamic import canvas (only available in Node.js)
    let createCanvas: any, loadImage: any, registerFont: any
    try {
      const canvasModule = await import("canvas")
      createCanvas = canvasModule.createCanvas
      loadImage = canvasModule.loadImage
      registerFont = canvasModule.registerFont
    } catch (err) {
      console.warn("Canvas module not available for screenshot creation")
      return radarImageBase64 // Return original if canvas not available
    }

    // Create canvas
    const canvas = createCanvas(imageWidth, imageHeight)
    const ctx = canvas.getContext("2d")

    // Draw base radar image
    const img = await loadImage(radarImageBase64)
    ctx.drawImage(img, 0, 0, imageWidth, imageHeight)

    // Add semi-transparent overlay for better marker visibility
    ctx.fillStyle = "rgba(0, 0, 0, 0.05)"
    ctx.fillRect(0, 0, imageWidth, imageHeight)

    // Sort locations by rain rate (highest first) for better visibility
    const sortedLocations = [...detectedLocations].sort((a, b) => b.rainRate - a.rainRate)

    // Draw detected locations
    sortedLocations.forEach((location, index) => {
      const x = location.pixelX
      const y = location.pixelY
      const rainRate = location.rainRate

      // Get color based on rain intensity
      const markerColor = getMarkerColor(rainRate)
      const isHighRisk = rainRate >= 10 // Heavy rain threshold

      // Draw outer glow for high-risk locations
      if (isHighRisk) {
        ctx.shadowColor = markerColor
        ctx.shadowBlur = 20
        ctx.shadowOffsetX = 0
        ctx.shadowOffsetY = 0
      }

      // Draw marker circle
      const radius = isHighRisk ? 14 : 10
      ctx.fillStyle = markerColor
      ctx.beginPath()
      ctx.arc(x, y, radius, 0, Math.PI * 2)
      ctx.fill()

      // Reset shadow
      ctx.shadowBlur = 0

      // Draw white border
      ctx.strokeStyle = "#ffffff"
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.arc(x, y, radius, 0, Math.PI * 2)
      ctx.stroke()

      // Draw number inside circle
      ctx.fillStyle = "#ffffff"
      ctx.font = `bold ${isHighRisk ? 14 : 12}px Arial`
      ctx.textAlign = "center"
      ctx.textBaseline = "middle"
      ctx.fillText((index + 1).toString(), x, y)

      // Draw label box with location name and rain rate
      const labelX = x + radius + 8
      const labelY = y - 10

      // Measure text
      ctx.font = "bold 13px Arial"
      const nameWidth = ctx.measureText(location.name).width
      ctx.font = "12px Arial"
      const rateText = `${rainRate.toFixed(1)} mm/h`
      const rateWidth = ctx.measureText(rateText).width
      const maxWidth = Math.max(nameWidth, rateWidth)

      // Draw label background with shadow
      ctx.shadowColor = "rgba(0, 0, 0, 0.5)"
      ctx.shadowBlur = 6
      ctx.shadowOffsetX = 2
      ctx.shadowOffsetY = 2

      const padding = 6
      const labelHeight = 36
      ctx.fillStyle = "rgba(255, 255, 255, 0.95)"
      ctx.fillRect(labelX, labelY, maxWidth + padding * 2, labelHeight)

      ctx.shadowBlur = 0
      ctx.shadowOffsetX = 0
      ctx.shadowOffsetY = 0

      // Draw label border
      ctx.strokeStyle = markerColor
      ctx.lineWidth = 2
      ctx.strokeRect(labelX, labelY, maxWidth + padding * 2, labelHeight)

      // Draw location name
      ctx.fillStyle = "#1e293b"
      ctx.font = "bold 13px Arial"
      ctx.textAlign = "left"
      ctx.textBaseline = "top"
      ctx.fillText(location.name, labelX + padding, labelY + padding)

      // Draw rain rate
      ctx.fillStyle = markerColor
      ctx.font = "bold 12px Arial"
      ctx.fillText(rateText, labelX + padding, labelY + padding + 16)

      // Draw intensity badge if high risk
      if (isHighRisk) {
        const badgeX = labelX + maxWidth + padding * 2 + 4
        const badgeY = labelY
        ctx.fillStyle = "#ef4444"
        ctx.fillRect(badgeX, badgeY, 28, 36)
        ctx.fillStyle = "#ffffff"
        ctx.font = "bold 10px Arial"
        ctx.textAlign = "center"
        ctx.save()
        ctx.translate(badgeX + 14, badgeY + 18)
        ctx.rotate(-Math.PI / 2)
        ctx.fillText("ALERT", 0, 0)
        ctx.restore()
      }
    })

    // Add legend/summary box
    if (detectedLocations.length > 0) {
      const legendX = 20
      const legendY = imageHeight - 150
      const legendWidth = 250
      const legendHeight = 130

      // Draw legend background with shadow
      ctx.shadowColor = "rgba(0, 0, 0, 0.5)"
      ctx.shadowBlur = 10
      ctx.shadowOffsetX = 3
      ctx.shadowOffsetY = 3

      ctx.fillStyle = "rgba(255, 255, 255, 0.95)"
      ctx.fillRect(legendX, legendY, legendWidth, legendHeight)

      ctx.shadowBlur = 0
      ctx.shadowOffsetX = 0
      ctx.shadowOffsetY = 0

      // Legend border
      ctx.strokeStyle = "#3b82f6"
      ctx.lineWidth = 3
      ctx.strokeRect(legendX, legendY, legendWidth, legendHeight)

      // Legend title
      ctx.fillStyle = "#1e293b"
      ctx.font = "bold 16px Arial"
      ctx.textAlign = "left"
      ctx.fillText("📍 Detected Locations", legendX + 10, legendY + 22)

      // Statistics
      const stats = [
        { label: "Total Detected", value: detectedLocations.length, color: "#3b82f6" },
        { label: "High Risk (≥10 mm/h)", value: detectedLocations.filter(l => l.rainRate >= 10).length, color: "#ef4444" },
        { label: "Medium Risk (2-10)", value: detectedLocations.filter(l => l.rainRate >= 2 && l.rainRate < 10).length, color: "#f59e0b" },
        { label: "Low Risk (<2 mm/h)", value: detectedLocations.filter(l => l.rainRate < 2).length, color: "#10b981" },
      ]

      stats.forEach((stat, i) => {
        const statY = legendY + 45 + i * 20

        // Draw color indicator
        ctx.fillStyle = stat.color
        ctx.fillRect(legendX + 10, statY - 8, 12, 12)
        ctx.strokeStyle = "#ffffff"
        ctx.lineWidth = 1
        ctx.strokeRect(legendX + 10, statY - 8, 12, 12)

        // Draw label
        ctx.fillStyle = "#475569"
        ctx.font = "12px Arial"
        ctx.fillText(stat.label, legendX + 28, statY)

        // Draw value
        ctx.fillStyle = stat.color
        ctx.font = "bold 13px Arial"
        ctx.textAlign = "right"
        ctx.fillText(stat.value.toString(), legendX + legendWidth - 15, statY)
        ctx.textAlign = "left"
      })
    }

    // Add timestamp watermark
    const timestamp = new Date().toLocaleString("id-ID", {
      dateStyle: "short",
      timeStyle: "short",
    })

    ctx.fillStyle = "rgba(0, 0, 0, 0.7)"
    ctx.fillRect(imageWidth - 180, 10, 170, 30)
    ctx.fillStyle = "#ffffff"
    ctx.font = "bold 12px Arial"
    ctx.textAlign = "right"
    ctx.fillText(`Generated: ${timestamp}`, imageWidth - 15, 28)

    // Add "BMKG Radar" label
    ctx.fillStyle = "rgba(0, 0, 0, 0.7)"
    ctx.fillRect(10, 10, 120, 30)
    ctx.fillStyle = "#60a5fa"
    ctx.font = "bold 14px Arial"
    ctx.textAlign = "left"
    ctx.fillText("🛰️ BMKG Radar", 15, 28)

    // Convert canvas to base64 PNG
    const buffer = canvas.toBuffer("image/png")
    const base64 = buffer.toString("base64")
    return `data:image/png;base64,${base64}`
  } catch (error) {
    console.warn("Failed to create screenshot:", error)
    console.warn("Error details:", error instanceof Error ? error.message : String(error))
    return radarImageBase64 // Return original on error
  }
}

/**
 * Get marker color based on rain rate
 */
function getMarkerColor(rainRate: number): string {
  if (rainRate < 0.5) return "#94a3b8" // Gray - No rain
  if (rainRate < 2) return "#10b981" // Green - Light rain
  if (rainRate < 10) return "#3b82f6" // Blue - Moderate rain
  if (rainRate < 50) return "#f59e0b" // Orange - Heavy rain
  return "#ef4444" // Red - Very heavy rain
}

/**
 * Validate captured radar data before saving
 * ✅ FIXED: Improved timestamp validation
 */
export function validateRadarData(data: CapturedRadarData): {
  valid: boolean
  errors: string[]
} {
  const errors: string[] = []

  // Validate image
  if (!data.imageBase64 || data.imageBase64.trim() === "") {
    errors.push("Radar image is empty")
  }

  if (!data.imageBase64.startsWith("data:image")) {
    errors.push("Invalid image format")
  }

  // Validate URL
  if (!data.imageUrl || data.imageUrl.trim() === "") {
    errors.push("Image URL is empty")
  }

  // ✅ FIXED: Improved timestamp validation - accept ISO format
  if (!data.timestamp) {
    errors.push("Timestamp is missing")
  } else {
    try {
      const date = new Date(data.timestamp)
      if (isNaN(date.getTime())) {
        errors.push(`Invalid timestamp format: ${data.timestamp}`)
      }
      // Additional check: timestamp should be recent (within 24 hours)
      const now = new Date()
      const diff = Math.abs(now.getTime() - date.getTime())
      const hoursDiff = diff / (1000 * 60 * 60)
      if (hoursDiff > 24) {
        errors.push(`Timestamp is too old (${hoursDiff.toFixed(1)} hours ago)`)
      }
    } catch (e) {
      errors.push(`Timestamp parse error: ${data.timestamp}`)
    }
  }

  // Validate bounds
  if (!data.bounds || !data.bounds.sw || !data.bounds.ne) {
    errors.push("Invalid bounds")
  } else {
    // Validate bound values
    const [swLat, swLng] = data.bounds.sw
    const [neLat, neLng] = data.bounds.ne

    if (isNaN(swLat) || isNaN(swLng) || isNaN(neLat) || isNaN(neLng)) {
      errors.push("Bounds contain invalid numbers")
    }

    if (swLat >= neLat || swLng >= neLng) {
      errors.push("Invalid bounds: SW must be less than NE")
    }
  }

  // Validate detected locations
  if (!Array.isArray(data.detectedLocations)) {
    errors.push("Detected locations must be an array")
  } else {
    data.detectedLocations.forEach((loc, index) => {
      if (isNaN(loc.lat) || isNaN(loc.lng)) {
        errors.push(`Location ${index}: Invalid coordinates`)
      }
      if (!loc.name || loc.name.trim() === "") {
        errors.push(`Location ${index}: Missing name`)
      }
      if (isNaN(loc.rainRate) || loc.rainRate < 0) {
        errors.push(`Location ${index}: Invalid rain rate`)
      }
      if (isNaN(loc.dbz)) {
        errors.push(`Location ${index}: Invalid dBZ value`)
      }
    })
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

/**
 * Check if document size is within MongoDB 16MB limit
 */
export function validateDocumentSize(capturedData: CapturedRadarData): {
  valid: boolean
  sizeInMB: number
  warning?: string
} {
  try {
    const jsonString = JSON.stringify(capturedData)
    const sizeInBytes = Buffer.byteLength(jsonString, 'utf8')
    const sizeInMB = sizeInBytes / (1024 * 1024)

    const valid = sizeInMB < 15 // Leave 1MB buffer
    const warning = sizeInMB > 10
      ? `Document size (${sizeInMB.toFixed(2)}MB) is approaching MongoDB 16MB limit`
      : undefined

    return { valid, sizeInMB, warning }
  } catch (error) {
    console.error('Failed to calculate document size:', error)
    return { valid: true, sizeInMB: 0 }
  }
}

/**
 * Format captured data for database storage
 */
export function formatForDatabase(capturedData: CapturedRadarData, additionalMetadata?: Record<string, any>) {
  return {
    radarStation: capturedData.radarStation,
    radarImage: capturedData.imageBase64,
    radarImageUrl: capturedData.imageUrl,
    timestamp: new Date(capturedData.timestamp), // Convert ISO string to Date
    radarTime: capturedData.timestamp, // Keep ISO string for reference
    bounds: {
      sw: {
        lat: capturedData.bounds.sw[0],
        lng: capturedData.bounds.sw[1],
      },
      ne: {
        lat: capturedData.bounds.ne[0],
        lng: capturedData.bounds.ne[1],
      },
    },
    detectedLocations: capturedData.detectedLocations.map((loc) => ({
      lat: loc.lat,
      lng: loc.lng,
      name: loc.name,
      dbz: loc.dbz,
      rainRate: loc.rainRate,
      intensity: loc.intensity,
      confidence: loc.confidence,
      pixelX: loc.pixelX,
      pixelY: loc.pixelY,
    })),
    metadata: {
      totalDetected: capturedData.detectedLocations.length,
      maxRainRate: Math.max(0, ...capturedData.detectedLocations.map((l) => l.rainRate)),
      alertCount: capturedData.detectedLocations.filter((l) => l.rainRate >= 2.0).length,
      ...additionalMetadata,
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}
