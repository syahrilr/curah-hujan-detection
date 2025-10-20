// app/api/monitor/schedule/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { checkRainfallAtPumps, saveRainfallAlerts } from '@/lib/rainfall-monitor'

/**
 * GET /api/monitor/schedule
 * Endpoint untuk cron job (dipanggil oleh external cron service)
 *
 * Contoh setup cron:
 * - Vercel Cron: https://vercel.com/docs/cron-jobs
 * - GitHub Actions: Scheduled workflow
 * - Cron-job.org: Free cron service
 *
 * Authorization dengan secret token untuk keamanan
 */
export async function GET(request: NextRequest) {
  try {
    // 1. Verify authorization token
    const authHeader = request.headers.get('authorization')
    const expectedToken = process.env.CRON_SECRET || 'your-secret-token-here'

    if (!authHeader || authHeader !== `Bearer ${expectedToken}`) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    console.log('⏰ Cron job triggered:', new Date().toISOString())

    // 2. Check rainfall (threshold: 2.0 mm/h = Light Rain)
    const results = await checkRainfallAtPumps(2.0)

    // 3. Save alerts to database
    const alertCount = results.filter(r => r.shouldAlert).length
    let savedCount = 0

    if (alertCount > 0) {
      savedCount = await saveRainfallAlerts(results)

    }

    // 5. Return summary
    return NextResponse.json({
      success: true,
      message: 'Cron job completed successfully',
      timestamp: new Date().toISOString(),
      summary: {
        totalLocations: results.length,
        alertsFound: alertCount,
        alertsSaved: savedCount,
      },
    })

  } catch (error: any) {
    console.error('❌ Cron job failed:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Cron job failed',
        details: error.message,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}

/**
 * POST /api/monitor/schedule
 * Start/stop automatic monitoring
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, interval } = body

    // TODO: Implement in-app scheduler
    // For now, use external cron service

    return NextResponse.json({
      success: false,
      error: 'In-app scheduler not yet implemented',
      message: 'Please use external cron service (Vercel Cron, GitHub Actions, etc.)',
      documentation: 'See setup instructions in README',
    }, { status: 501 })

  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to process request',
        details: error.message,
      },
      { status: 500 }
    )
  }
}
