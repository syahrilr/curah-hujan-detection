import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(
  request: Request,
  context: { params: Promise<{ pumpName: string }> }
) {
  try {
    const { pumpName } = await context.params
    const decodedPumpName = decodeURIComponent(pumpName)

    const { getForecastCollection } = await import('@/lib/forecast')
    const collection = await getForecastCollection(decodedPumpName)

    const latestForecast = await collection
      .find()
      .sort({ fetchedAt: -1 })
      .limit(1)
      .toArray()

    if (latestForecast.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'No forecast data found for this pump'
        },
        {
          status: 404,
          headers: {
            'Content-Type': 'application/json',
          }
        }
      )
    }

    return NextResponse.json(
      {
        success: true,
        data: latestForecast[0]
      },
      {
        headers: {
          'Content-Type': 'application/json',
        }
      }
    )

  } catch (error) {
    console.error('Error fetching forecast:', error)
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
