import { NextRequest, NextResponse } from 'next/server'
import { fetchJakartaWindData, fetchBMKGWindData } from '@/lib/bmkg-wind-helper'

/**
 * GET /api/wind
 * Fetch wind data from BMKG for Jakarta area
 *
 * Query params:
 * - area: 'jakarta' (default) | 'custom'
 * - kode: kode wilayah (for custom area)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)

    const area = searchParams.get('area') || 'jakarta'
    const kode = searchParams.get('kode')

    console.log(`💨 Fetching wind data for: ${area}`)

    if (area === 'custom' && kode) {
      // Fetch single location
      const windData = await fetchBMKGWindData(kode)

      if (!windData) {
        return NextResponse.json(
          {
            success: false,
            error: 'Failed to fetch wind data for specified location',
            kode
          },
          { status: 404 }
        )
      }

      return NextResponse.json({
        success: true,
        area: 'custom',
        timestamp: new Date().toISOString(),
        data: [windData],
        summary: {
          totalLocations: 1,
          avgWindSpeed: windData.wind.speed,
          maxWindSpeed: windData.wind.speed
        }
      })

    } else {
      // Fetch Jakarta area (multiple locations)
      const windDataArray = await fetchJakartaWindData()

      if (windDataArray.length === 0) {
        return NextResponse.json(
          {
            success: false,
            error: 'No wind data available',
            hint: 'BMKG API might be unavailable'
          },
          { status: 503 }
        )
      }

      // Calculate statistics
      const avgWindSpeed = windDataArray.reduce((sum, d) => sum + d.wind.speed, 0) / windDataArray.length
      const maxWindSpeed = Math.max(...windDataArray.map(d => d.wind.speed))
      const minWindSpeed = Math.min(...windDataArray.map(d => d.wind.speed))

      return NextResponse.json({
        success: true,
        area: 'jakarta',
        timestamp: new Date().toISOString(),
        data: windDataArray,
        summary: {
          totalLocations: windDataArray.length,
          avgWindSpeed: parseFloat(avgWindSpeed.toFixed(2)),
          maxWindSpeed: parseFloat(maxWindSpeed.toFixed(2)),
          minWindSpeed: parseFloat(minWindSpeed.toFixed(2))
        }
      })
    }

  } catch (error: any) {
    console.error('❌ Wind API failed:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch wind data',
        details: error.message
      },
      { status: 500 }
    )
  }
}

/**
 * Example responses:
 *
 * GET /api/wind
 * {
 *   "success": true,
 *   "area": "jakarta",
 *   "timestamp": "2025-10-22T10:00:00Z",
 *   "data": [
 *     {
 *       "location": {
 *         "name": "Kemayoran, Jakarta Pusat",
 *         "lat": -6.168,
 *         "lng": 106.881,
 *         "kode": "3171"
 *       },
 *       "wind": {
 *         "direction_deg": 270,
 *         "direction_cardinal": "W",
 *         "speed": 5.5,
 *         "timestamp": "2025-10-22 17:00:00"
 *       },
 *       "weather": {
 *         "temp": 28,
 *         "humidity": 75,
 *         "weather_code": 3,
 *         "weather_desc": "Berawan"
 *       }
 *     }
 *   ],
 *   "summary": {
 *     "totalLocations": 5,
 *     "avgWindSpeed": 4.2,
 *     "maxWindSpeed": 7.3,
 *     "minWindSpeed": 2.1
 *   }
 * }
 */
