// app/api/monitor/control/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { startCronJob, stopCronJob, getCronJobStatus, restartCronJob } from '@/lib/cron-service'

/**
 * GET /api/monitor/control
 * Get cron job status
 */
export async function GET(request: NextRequest) {
  try {
    const status = getCronJobStatus()

    return NextResponse.json({
      success: true,
      status: {
        isRunning: status.isRunning,
        message: status.isRunning
          ? 'Cron job is running'
          : 'Cron job is stopped',
      },
    })

  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, interval, threshold } = body

    if (!action) {
      return NextResponse.json(
        { success: false, error: 'Missing required field: action' },
        { status: 400 }
      )
    }

    switch (action) {
      case 'start':
        startCronJob(
          interval || '*/10 * * * *',  // Default: every 10 minutes
          threshold || 2.0              // Default: 2.0 mm/h
        )
        return NextResponse.json({
          success: true,
          message: 'Cron job started',
          settings: {
            interval: interval || '*/10 * * * *',
            threshold: threshold || 2.0,
          },
        })

      case 'stop':
        stopCronJob()
        return NextResponse.json({
          success: true,
          message: 'Cron job stopped',
        })

      case 'restart':
        restartCronJob(
          interval || '*/10 * * * *',
          threshold || 2.0
        )
        return NextResponse.json({
          success: true,
          message: 'Cron job restarted',
          settings: {
            interval: interval || '*/10 * * * *',
            threshold: threshold || 2.0,
          },
        })

      default:
        return NextResponse.json(
          { success: false, error: 'Invalid action. Use: start, stop, or restart' },
          { status: 400 }
        )
    }

  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

