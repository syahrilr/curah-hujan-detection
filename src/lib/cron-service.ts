import * as cron from "node-cron"
import { checkRainfallAtPumpsWithCapture, saveRainfallWithImage } from "./rainfall-monitor"

let cronJob: cron.ScheduledTask | null = null
let isRunning = false
let lastRunStats: any = null
let errorCount = 0
let successCount = 0

/**
 * Start automatic rainfall monitoring with radar image capture
 * @param interval - Cron expression (default: every 10 minutes)
 * @param threshold - Rainfall threshold in mm/h (default: 2.0)
 */
export function startCronJob(interval = "*/10 * * * *", threshold = 2.0) {
  if (isRunning) {
    console.log("⚠️ Cron job already running")
    return
  }

  console.log("🚀 Starting rainfall monitoring cron job with image capture...")
  console.log(`   Interval: ${interval}`)
  console.log(`   Threshold: ${threshold} mm/h`)
  console.log(`   Mode: ENHANCED (with radar image and detected locations)`)

  cronJob = cron.schedule(interval, async () => {
    const startTime = Date.now()
    console.log("\n⏰ Cron job triggered:", new Date().toLocaleString("id-ID"))

    try {
      const { results, capturedData } = await checkRainfallAtPumpsWithCapture(threshold)

      // Calculate statistics
      const alertCount = results.filter((r) => r.shouldAlert).length
      const noRainCount = results.filter((r) => r.rainRate === 0).length
      const lightRainCount = results.filter((r) => r.rainRate > 0 && !r.shouldAlert).length
      const detectedCount = capturedData?.detectedLocations.length || 0

      console.log(`   📊 Summary:`)
      console.log(`      Total checked: ${results.length} locations`)
      console.log(`      🚨 Alerts (>${threshold} mm/h): ${alertCount}`)
      console.log(`      🌧️ Light rain (<${threshold} mm/h): ${lightRainCount}`)
      console.log(`      ☀️ No rain: ${noRainCount}`)
      console.log(`      📍 Detected locations with rainfall: ${detectedCount}`)

      if (capturedData) {
        console.log(`   🖼️ Radar Image:`)
        console.log(`      Station: ${capturedData.radarStation}`)
        console.log(`      Size: ${(capturedData.imageBase64.length / 1024).toFixed(2)} KB`)
        console.log(`      URL: ${capturedData.imageUrl}`)
        console.log(`      Timestamp (original): ${capturedData.timestamp}`)

        // ✅ Validate timestamp format
        try {
          const date = new Date(capturedData.timestamp)
          if (!isNaN(date.getTime())) {
            console.log(`      ✅ Timestamp valid: ${date.toISOString()}`)
          } else {
            console.warn(`      ⚠️ Invalid timestamp: ${capturedData.timestamp}`)
          }
        } catch (e) {
          console.warn(`      ⚠️ Timestamp parse error:`, e)
        }
      }

      // Save ALL results with captured data to database
      const { savedCount, recordId } = await saveRainfallWithImage(results, capturedData, true)

      const duration = Date.now() - startTime

      console.log(`   💾 Saved: ${savedCount} record(s)`)
      if (recordId) {
        console.log(`      Record ID: ${recordId}`)
      }
      console.log(`   ⏱️ Duration: ${duration}ms`)

      // Update stats
      successCount++
      lastRunStats = {
        success: true,
        timestamp: new Date().toISOString(),
        duration: duration,
        locationsChecked: results.length,
        alertsFound: alertCount,
        detectedLocations: detectedCount,
        recordsSaved: savedCount,
        recordId: recordId,
      }

      console.log("✅ Cron job completed\n")
    } catch (error) {
      errorCount++
      const duration = Date.now() - startTime

      console.error("❌ Cron job failed:", error)

      // ✅ Enhanced error logging
      if (error instanceof Error) {
        console.error("   📋 Error Details:")
        console.error("      Name:", error.name)
        console.error("      Message:", error.message)
        if (error.stack) {
          console.error("      Stack trace (top 5 lines):")
          error.stack.split('\n').slice(0, 5).forEach(line => {
            console.error("        ", line.trim())
          })
        }
      }

      console.error(`   ⏱️ Failed after: ${duration}ms`)
      console.error(`   📊 Error count: ${errorCount}/${successCount + errorCount} total runs\n`)

      // Update stats
      lastRunStats = {
        success: false,
        timestamp: new Date().toISOString(),
        duration: duration,
        error: error instanceof Error ? {
          name: error.name,
          message: error.message
        } : String(error),
      }
    }
  })

  isRunning = true
  successCount = 0
  errorCount = 0

  console.log("✅ Cron job started successfully")
  console.log("   Next run will be executed according to schedule\n")
}

/**
 * Stop the cron job
 */
export function stopCronJob() {
  if (cronJob) {
    cronJob.stop()
    cronJob = null
    isRunning = false
    console.log("🛑 Cron job stopped")
    console.log(`   Final stats: ${successCount} successes, ${errorCount} errors`)
  } else {
    console.log("⚠️ No cron job running")
  }
}

/**
 * Get cron job status
 */
export function getCronJobStatus() {
  return {
    isRunning,
    hasJob: cronJob !== null,
    lastRun: lastRunStats,
    statistics: {
      successCount,
      errorCount,
      totalRuns: successCount + errorCount,
      successRate: successCount + errorCount > 0
        ? ((successCount / (successCount + errorCount)) * 100).toFixed(2) + '%'
        : 'N/A',
    },
  }
}

/**
 * Restart cron job with new settings
 */
export function restartCronJob(interval: string, threshold: number) {
  console.log("🔄 Restarting cron job with new settings...")
  console.log(`   New interval: ${interval}`)
  console.log(`   New threshold: ${threshold} mm/h`)

  stopCronJob()

  // Small delay to ensure clean restart
  setTimeout(() => {
    startCronJob(interval, threshold)
  }, 1000)
}

/**
 * Get last run statistics
 */
export function getLastRunStats() {
  return lastRunStats
}

/**
 * Reset error counter
 */
export function resetErrorCount() {
  errorCount = 0
  successCount = 0
  console.log("🔄 Statistics reset")
}
