import * as cron from 'node-cron'
import { checkRainfallAtPumps, saveRainfallAlerts } from './rainfall-monitor'

let cronJob: cron.ScheduledTask | null = null
let isRunning = false

/**
 * Start automatic rainfall monitoring
 * @param interval - Cron expression (default: every 10 minutes)
 * @param threshold - Rainfall threshold in mm/h (default: 2.0)
 */
export function startCronJob(
  interval: string = '*/10 * * * *',
  threshold: number = 2.0
) {
  if (isRunning) {
    console.log('⚠️ Cron job already running')
    return
  }

  console.log('🚀 Starting rainfall monitoring cron job...')
  console.log(`   Interval: ${interval}`)
  console.log(`   Threshold: ${threshold} mm/h`)
  console.log(`   Save Mode: ALL RECORDS (including 0 mm/h)`)

  cronJob = cron.schedule(interval, async () => {
    console.log('\n⏰ Cron job triggered:', new Date().toLocaleString('id-ID'))

    try {
      // Check rainfall at all pump locations
      const results = await checkRainfallAtPumps(threshold)

      // Calculate statistics
      const alertCount = results.filter(r => r.shouldAlert).length
      const noRainCount = results.filter(r => r.rainRate === 0).length
      const lightRainCount = results.filter(r => r.rainRate > 0 && !r.shouldAlert).length

      console.log(`   📊 Summary:`)
      console.log(`      Total checked: ${results.length} locations`)
      console.log(`      🚨 Alerts (>${threshold} mm/h): ${alertCount}`)
      console.log(`      🌧️ Light rain (<${threshold} mm/h): ${lightRainCount}`)
      console.log(`      ☀️ No rain: ${noRainCount}`)

      // Save ALL results to database
      const savedCount = await saveRainfallAlerts(results, true)
      console.log(`   💾 Saved: ${savedCount} records`)

      console.log('✅ Cron job completed\n')

    } catch (error) {
      console.error('❌ Cron job failed:', error)
    }
  })

  isRunning = true
  console.log('✅ Cron job started successfully')
  console.log('   Next run will be executed according to schedule\n')
}

/**
 * Stop the cron job
 */
export function stopCronJob() {
  if (cronJob) {
    cronJob.stop()
    cronJob = null
    isRunning = false
    console.log('🛑 Cron job stopped')
  } else {
    console.log('⚠️ No cron job running')
  }
}

/**
 * Get cron job status
 */
export function getCronJobStatus() {
  return {
    isRunning,
    hasJob: cronJob !== null,
  }
}

/**
 * Restart cron job with new settings
 */
export function restartCronJob(interval: string, threshold: number) {
  stopCronJob()
  startCronJob(interval, threshold)
}
