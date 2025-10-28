import { NextRequest, NextResponse } from 'next/server'

/**
 * GET /api/forecast
 * Fetch rainfall forecast from Open-Meteo API
 *
 * Query params:
 * - area: 'jakarta' (default) | 'custom'
 * - lat: latitude for custom area
 * - lng: longitude for custom area
 * - hours: forecast hours (default: 6, max: 24)
 * - grid: grid density for jakarta (default: 3 = 4x4 grid = 16 points)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)

    const area = searchParams.get('area') || 'jakarta'
    const hours = Math.min(parseInt(searchParams.get('hours') || '6'), 24)
    const gridDensity = parseInt(searchParams.get('grid') || '3') // 3 = 4x4 grid

    let gridPoints: Array<{ lat: number; lng: number; name: string }> = []

    if (area === 'jakarta') {
      // Jakarta area bounds
      const bounds = {
        north: -6.08,
        south: -6.35,
        west: 106.65,
        east: 106.98
      }

      // Generate grid points
      const latStep = (bounds.north - bounds.south) / gridDensity
      const lngStep = (bounds.east - bounds.west) / gridDensity

      for (let i = 0; i <= gridDensity; i++) {
        for (let j = 0; j <= gridDensity; j++) {
          const lat = bounds.south + (i * latStep)
          const lng = bounds.west + (j * lngStep)
          gridPoints.push({
            lat: parseFloat(lat.toFixed(6)),
            lng: parseFloat(lng.toFixed(6)),
            name: `Jakarta-${i}-${j}`
          })
        }
      }
    } else {
      // Custom single point
      const lat = parseFloat(searchParams.get('lat') || '-6.2')
      const lng = parseFloat(searchParams.get('lng') || '106.816')
      gridPoints = [{ lat, lng, name: 'Custom Point' }]
    }

    console.log(`🔍 Fetching forecast for ${gridPoints.length} points in ${area}`)

    // Fetch forecast for all grid points (parallel requests)
    const forecasts = await Promise.allSettled(
      gridPoints.map(point => fetchOpenMeteoForecast(point, hours))
    )

    // Process results
    const successfulForecasts = forecasts
      .map((result, index) => {
        if (result.status === 'fulfilled') {
          return result.value
        } else {
          console.error(`❌ Failed to fetch forecast for point ${index}:`, result.reason.message)
          return null
        }
      })
      .filter(f => f !== null)

    console.log(`✅ Successfully fetched ${successfulForecasts.length}/${gridPoints.length} forecasts`)

    // Calculate statistics
    const stats = calculateForecastStats(successfulForecasts, hours)

    return NextResponse.json({
      success: true,
      area: area,
      timestamp: new Date().toISOString(),
      summary: {
        totalPoints: gridPoints.length,
        successfulPoints: successfulForecasts.length,
        failedPoints: gridPoints.length - successfulForecasts.length,
        forecastHours: hours,
        ...stats
      },
      forecasts: successfulForecasts,
      gridInfo: {
        density: gridDensity,
        bounds: area === 'jakarta' ? {
          north: -6.08,
          south: -6.35,
          west: 106.65,
          east: 106.98
        } : null
      }
    })

  } catch (error: any) {
    console.error('❌ Forecast API failed:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch forecast data',
        details: error.message
      },
      { status: 500 }
    )
  }
}

/**
 * Fetch Open-Meteo forecast for a single point
 */
async function fetchOpenMeteoForecast(
  point: { lat: number; lng: number; name: string },
  hours: number
) {
  const url = new URL('https://api.open-meteo.com/v1/forecast')

  url.searchParams.set('latitude', point.lat.toString())
  url.searchParams.set('longitude', point.lng.toString())
  url.searchParams.set('hourly', 'precipitation,precipitation_probability,rain,weather_code')
  url.searchParams.set('timezone', 'Asia/Jakarta')
  url.searchParams.set('forecast_days', '1')

  const response = await fetch(url.toString(), {
    headers: {
      'User-Agent': 'Rainfall-Monitoring-System/1.0'
    },
    next: { revalidate: 1800 } // Cache for 30 minutes
  })

  if (!response.ok) {
    throw new Error(`Open-Meteo API error: ${response.status} ${response.statusText}`)
  }

  const data = await response.json()

  // Get current hour index
  const now = new Date()
  const currentHour = now.getHours()

  // Extract data for requested hours from current time
  const hourlyData = {
    times: data.hourly.time.slice(currentHour, currentHour + hours),
    precipitation: data.hourly.precipitation.slice(currentHour, currentHour + hours),
    probabilities: data.hourly.precipitation_probability.slice(currentHour, currentHour + hours),
    rain: data.hourly.rain.slice(currentHour, currentHour + hours),
    weatherCodes: data.hourly.weather_code.slice(currentHour, currentHour + hours)
  }

  // Calculate metrics
  const maxPrecipitation = Math.max(...hourlyData.precipitation)
  const avgPrecipitation = hourlyData.precipitation.reduce((a: number, b: number) => a + b, 0) / hourlyData.precipitation.length
  const avgProbability = hourlyData.probabilities.reduce((a: number, b: number) => a + b, 0) / hourlyData.probabilities.length
  const totalRain = hourlyData.precipitation.reduce((a: number, b: number) => a + b, 0)

  // Determine risk level
  const riskLevel = getRiskLevel(maxPrecipitation, avgProbability)

  return {
    location: {
      name: point.name,
      lat: point.lat,
      lng: point.lng
    },
    hourly: hourlyData,
    metrics: {
      maxPrecipitation: parseFloat(maxPrecipitation.toFixed(2)),
      avgPrecipitation: parseFloat(avgPrecipitation.toFixed(2)),
      avgProbability: parseFloat(avgProbability.toFixed(1)),
      totalRain: parseFloat(totalRain.toFixed(2)),
      riskLevel
    },
    units: {
      precipitation: 'mm/h',
      probability: '%',
      totalRain: 'mm'
    }
  }
}

/**
 * Calculate overall forecast statistics
 */
function calculateForecastStats(forecasts: any[], hours: number) {
  if (forecasts.length === 0) {
    return {
      highRiskAreas: 0,
      mediumRiskAreas: 0,
      lowRiskAreas: 0,
      noRiskAreas: 0,
      maxPrecipitation: 0,
      avgPrecipitation: 0,
      avgProbability: 0,
      totalRain: 0
    }
  }

  const highRisk = forecasts.filter(f => f.metrics.riskLevel === 'high').length
  const mediumRisk = forecasts.filter(f => f.metrics.riskLevel === 'medium').length
  const lowRisk = forecasts.filter(f => f.metrics.riskLevel === 'low').length
  const noRisk = forecasts.filter(f => f.metrics.riskLevel === 'none').length

  const maxPrecipitation = Math.max(...forecasts.map(f => f.metrics.maxPrecipitation))
  const avgPrecipitation = forecasts.reduce((sum, f) => sum + f.metrics.avgPrecipitation, 0) / forecasts.length
  const avgProbability = forecasts.reduce((sum, f) => sum + f.metrics.avgProbability, 0) / forecasts.length
  const totalRain = forecasts.reduce((sum, f) => sum + f.metrics.totalRain, 0) / forecasts.length

  return {
    highRiskAreas: highRisk,
    mediumRiskAreas: mediumRisk,
    lowRiskAreas: lowRisk,
    noRiskAreas: noRisk,
    maxPrecipitation: parseFloat(maxPrecipitation.toFixed(2)),
    avgPrecipitation: parseFloat(avgPrecipitation.toFixed(2)),
    avgProbability: parseFloat(avgProbability.toFixed(1)),
    totalRain: parseFloat(totalRain.toFixed(2))
  }
}

/**
 * Determine risk level based on precipitation and probability
 */
function getRiskLevel(maxPrecipitation: number, avgProbability: number): 'high' | 'medium' | 'low' | 'none' {
  // High risk: Heavy rain with high probability
  if (maxPrecipitation >= 7.6 && avgProbability >= 50) return 'high'

  // Medium risk: Moderate rain with medium probability
  if (maxPrecipitation >= 2.5 && avgProbability >= 40) return 'medium'

  // Low risk: Light rain or low probability
  if (maxPrecipitation > 0.5 || avgProbability > 30) return 'low'

  // No risk
  return 'none'
}

/**
 * POST /api/forecast
 * Save forecast data to MongoDB for historical comparison
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validate required fields
    if (!body.forecasts || !Array.isArray(body.forecasts)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid request body',
          details: 'forecasts array is required'
        },
        { status: 400 }
      )
    }

    // TODO: Implement MongoDB storage
    // This would save forecast data for later comparison with actual rainfall
    // Useful for:
    // 1. Forecast accuracy analysis
    // 2. Model validation
    // 3. Historical trends

    console.log('📝 Forecast save request received (not yet implemented)')
    console.log(`   Forecasts: ${body.forecasts.length}`)
    console.log(`   Timestamp: ${new Date().toISOString()}`)

    return NextResponse.json({
      success: true,
      message: 'Forecast saving not yet implemented',
      hint: 'Will be used for accuracy analysis and model validation',
      received: {
        forecastCount: body.forecasts.length,
        timestamp: new Date().toISOString()
      }
    })

  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to save forecast',
        details: error.message
      },
      { status: 500 }
    )
  }
}
