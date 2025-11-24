import { NextResponse } from 'next/server'
import { getHardcodedPumpLocations } from '@/lib/kml-parser'

export const dynamic = 'force-dynamic'

interface ForecastDocument {
  pumpName: string
  pumpLat: number
  pumpLng: number
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

export async function GET() {
  try {
    const clientPromise = (await import('@/lib/mongodb'))
    const { getForecastCollection } = await import('@/lib/forecast')
    const pumpLocations = getHardcodedPumpLocations()
    const forecasts: ForecastDocument[] = []

    for (const pump of pumpLocations) {
      try {
        const collection = await getForecastCollection(pump.name)
        const latest = await collection
          .find()
          .sort({ fetchedAt: -1 })
          .limit(1)
          .toArray()

        if (latest.length > 0) {
          forecasts.push(latest[0] as ForecastDocument)
        }
      } catch (error) {
        console.error(`Failed to fetch forecast for ${pump.name}:`, error)
        // Continue to next pump even if one fails
      }
    }

    return NextResponse.json({
      success: true,
      count: forecasts.length,
      data: forecasts
    }, {
      headers: {
        'Content-Type': 'application/json',
      }
    })
  } catch (error) {
    console.error('Error in all-latest API:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        data: []
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
