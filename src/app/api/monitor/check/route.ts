import { NextRequest, NextResponse } from 'next/server'
import { checkRainfallAtPumps, saveRainfallAlerts } from '@/lib/rainfall-monitor'

/**
 * GET /api/monitor/check
 * Manually trigger rainfall check at all pump locations
 *
 * Query params:
 * - threshold: rainfall threshold in mm/h (default: 2.0)
 * - save: save to database (default: true)
 * - saveAll: save all records including 0 mm/h (default: true)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)

    // Parse parameters
    const threshold = parseFloat(searchParams.get('threshold') || '2.0')
    const shouldSave = searchParams.get('save') !== 'false'
    const saveAll = searchParams.get('saveAll') !== 'false' // Default TRUE

    console.log('🔍 Manual rainfall check triggered')
    console.log(`   Threshold: ${threshold} mm/h`)
    console.log(`   Save to DB: ${shouldSave}`)
    console.log(`   Save all records: ${saveAll}`)

    // Check rainfall at all pumps
    const startTime = Date.now()
    const results = await checkRainfallAtPumps(threshold)
    const duration = Date.now() - startTime

    // Calculate statistics
    const alertCount = results.filter(r => r.shouldAlert).length
    const noRainCount = results.filter(r => r.rainRate === 0).length
    const lightRainCount = results.filter(r => r.rainRate > 0 && !r.shouldAlert).length
    const totalCount = results.length

    // Save to database if requested
    let savedCount = 0
    if (shouldSave) {
      savedCount = await saveRainfallAlerts(results, saveAll)
    }

    // Prepare response
    const response = {
      success: true,
      message: `Checked ${totalCount} locations, found ${alertCount} alerts`,
      summary: {
        totalLocations: totalCount,
        alertsFound: alertCount,
        lightRainLocations: lightRainCount,
        noRainLocations: noRainCount,
        recordsSaved: savedCount,
        threshold: threshold,
        duration: `${duration}ms`,
        timestamp: new Date().toISOString(),
      },
      results: results.map(r => ({
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
        .filter(r => r.shouldAlert)
        .map(r => ({
          name: r.location.name,
          rainRate: r.rainRate,
          intensity: r.intensity,
        })),
    }

    return NextResponse.json(response)

  } catch (error: any) {
    console.error('❌ Monitor check failed:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to check rainfall',
        details: error.message,
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    return NextResponse.json({
      success: false,
      error: 'Custom locations not yet implemented',
      message: 'Please use GET method for now',
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
