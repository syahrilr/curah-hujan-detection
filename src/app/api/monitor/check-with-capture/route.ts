import { type NextRequest, NextResponse } from "next/server"
import { checkRainfallAtPumpsWithCapture, saveRainfallWithImage } from "@/lib/rainfall-monitor"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)

    const threshold = Number.parseFloat(searchParams.get("threshold") || "2.0")
    const shouldSave = searchParams.get("save") !== "false"
    const saveAll = searchParams.get("saveAll") !== "false"

    console.log("📍 Enhanced rainfall check triggered")
    console.log(`   Threshold: ${threshold} mm/h`)
    console.log(`   Save to DB: ${shouldSave}`)
    console.log(`   Save all records: ${saveAll}`)

    const startTime = Date.now()
    // 'checkRainfallAtPumpsWithCapture' sekarang akan mengembalikan 'detectedLocations' berisi 48 lokasi
    const { results, capturedData } = await checkRainfallAtPumpsWithCapture(threshold)
    const duration = Date.now() - startTime

    const alertCount = results.filter((r) => r.shouldAlert).length
    const noRainCount = results.filter((r) => r.rainRate === 0).length
    const lightRainCount = results.filter((r) => r.rainRate > 0 && !r.shouldAlert).length
    const totalCount = results.length

    let savedCount = 0
    let recordId = null
    let screenshotGenerated = false

    if (shouldSave && capturedData) {
      const saveResult = await saveRainfallWithImage(results, capturedData, saveAll, threshold)
      savedCount = saveResult.savedCount
      recordId = saveResult.recordId
      if ('screenshotGenerated' in saveResult) {
        screenshotGenerated = Boolean((saveResult as any).screenshotGenerated)
      } else {
        screenshotGenerated = false
      }
    }

    // ✅ Fetch the saved screenshot from database if available
    let screenshot = null
    if (recordId && screenshotGenerated) {
      try {
        const { MongoClient } = await import('mongodb')
        const MONGODB_URI = process.env.MONGODB_URI ||
          'mongodb://sda:PasukanBiruJatiBaru2024@192.168.5.192:27017/db_curah_hujan?authSource=admin&directConnection=true'

        const client = await MongoClient.connect(MONGODB_URI, {
          serverSelectionTimeoutMS: 5000,
        })

        const db = client.db('db_curah_hujan')
        const { ObjectId } = await import('mongodb')
        const record = await db.collection('rainfall_records').findOne(
          { _id: new ObjectId(recordId) },
          { projection: { screenshot: 1 } }
        )

        if (record?.screenshot) {
          screenshot = record.screenshot
        }

        await client.close()
      } catch (error) {
        console.warn('Failed to fetch screenshot:', error)
      }
    }

    const response = {
      success: true,
      message: `Checked ${totalCount} locations, found ${alertCount} alerts`,
      summary: {
        totalLocations: totalCount,
        alertsFound: alertCount,
        lightRainLocations: lightRainCount,
        noRainLocations: noRainCount,
        detectedLocations: capturedData?.detectedLocations.length || 0,
        recordsSaved: savedCount,
        recordId: recordId,
        screenshotGenerated: screenshotGenerated,
        threshold: threshold,
        duration: `${duration}ms`,
        timestamp: new Date().toISOString(),
      },
      results: results.map((r) => ({
        name: r.location.name,
        coordinates: {
          lat: r.location.lat,
          lng: r.location.lng,
        },
        rainfall: {
          dbz: r.dbz,
          rainRate: r.rainRate,
          intensity: r.intensity,
          confidence: r.confidence,
        },
        alert: r.shouldAlert,
        radarTime: r.radarTime,
      })),
      alerts: results
        .filter((r) => r.shouldAlert)
        .map((r) => ({
          name: r.location.name,
          rainRate: r.rainRate,
          intensity: r.intensity,
        })),
      capturedData: capturedData
        ? {
            timestamp: capturedData.timestamp,
            radarStation: capturedData.radarStation,
            radarImage: capturedData.imageBase64,
            radarImageUrl: capturedData.imageUrl,
            screenshot: screenshot,
            detectedLocations: capturedData.detectedLocations,
            imageSize: capturedData.imageBase64.length,
            bounds: capturedData.bounds,
          }
        : null,
    }

    return NextResponse.json(response)
  } catch (error: any) {
    console.error("❌ Enhanced monitor check failed:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Failed to check rainfall with capture",
        details: error.message,
      },
      { status: 500 },
    )
  }
}

