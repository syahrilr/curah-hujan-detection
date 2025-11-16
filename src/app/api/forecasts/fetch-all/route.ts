import { NextResponse } from 'next/server'
import { getHardcodedPumpLocations } from '@/lib/kml-parser'

export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 5 minutes

interface OpenMeteoResponse {
  latitude: number
  longitude: number
  timezone: string
  elevation: number
  hourly: {
    time: string[]
    temperature_2m: number[]
    rain: number[]
    precipitation: number[]
    precipitation_probability: number[]
  }
}

interface ForecastDocument {
  pumpName: string
  pumpLat: number
  pumpLng: number
  latitude: number
  longitude: number
  timezone: string
  elevation: number
  hourly: {
    time: string[]
    temperature_2m: number[]
    rain: number[]
    precipitation: number[]
    precipitation_probability: number[]
  }
  fetchedAt: Date
  forecastStartDate: Date
  forecastEndDate: Date
}

async function fetchForecastForPump(lat: number, lng: number): Promise<OpenMeteoResponse> {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&hourly=temperature_2m,rain,precipitation,precipitation_probability&timezone=auto&forecast_days=16`

  const response = await fetch(url, {
    cache: 'no-store',
    next: { revalidate: 0 }
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch forecast: ${response.statusText}`)
  }

  return response.json()
}

export async function POST() {
  try {
    const { getForecastCollection } = await import('@/lib/forecast')
    const pumpLocations = getHardcodedPumpLocations()
    const results = []
    let successCount = 0
    let errorCount = 0

    console.log(`Starting fetch for ${pumpLocations.length} pump stations...`)

    for (const pump of pumpLocations) {
      try {
        console.log(`Fetching forecast for: ${pump.name}`)

        // Fetch from Open-Meteo
        const forecastData = await fetchForecastForPump(pump.lat, pump.lng)

        // Prepare document
        const document: ForecastDocument = {
          pumpName: pump.name,
          pumpLat: pump.lat,
          pumpLng: pump.lng,
          latitude: forecastData.latitude,
          longitude: forecastData.longitude,
          timezone: forecastData.timezone,
          elevation: forecastData.elevation,
          hourly: forecastData.hourly,
          fetchedAt: new Date(),
          forecastStartDate: new Date(forecastData.hourly.time[0]),
          forecastEndDate: new Date(forecastData.hourly.time[forecastData.hourly.time.length - 1])
        }

        // Save to MongoDB
        const collection = await getForecastCollection(pump.name)
        await collection.insertOne(document)

        successCount++
        results.push({
          pump: pump.name,
          status: 'success',
          recordsCount: forecastData.hourly.time.length
        })

        console.log(`✓ Success: ${pump.name}`)

        // Delay to respect API rate limits
        await new Promise(resolve => setTimeout(resolve, 1000))

      } catch (error) {
        errorCount++
        console.error(`✗ Error: ${pump.name}`, error)
        results.push({
          pump: pump.name,
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    console.log(`Completed: ${successCount} success, ${errorCount} errors`)

    return NextResponse.json({
      success: true,
      message: 'Forecast collection completed',
      summary: {
        total: pumpLocations.length,
        success: successCount,
        errors: errorCount
      },
      results,
      timestamp: new Date().toISOString()
    }, {
      headers: {
        'Content-Type': 'application/json',
      }
    })

  } catch (error) {
    console.error('Error in fetch-all API:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        }
      }
    )
  }
}
