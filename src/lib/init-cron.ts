import { startCronJob } from './cron-service'

let isInitialized = false


export function initializeCronJob() {
  // Prevent multiple initialization
  if (isInitialized) {
    return
  }

  // Only run in development or if explicitly enabled
  const enableAutoStart = process.env.CRON_AUTO_START === 'true'

  if (process.env.NODE_ENV === 'development' || enableAutoStart) {
    console.log('\n🤖 Auto-starting rainfall monitoring cron job...')

    // Get settings from environment variables
    const interval = process.env.CRON_INTERVAL || '*/10 * * * *'
    const threshold = parseFloat(process.env.CRON_THRESHOLD || '2.0')

    startCronJob(interval, threshold)

    isInitialized = true

    console.log('✅ Cron job initialized successfully')
    console.log('   You can control it via /api/monitor/control\n')
  } else {
    console.log('ℹ️ Cron auto-start disabled')
    console.log('   Set CRON_AUTO_START=true in .env.local to enable')
  }
}
