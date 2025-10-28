/**
 * API Route: /api/locations
 * Get list of pump locations
 */

import { NextResponse } from 'next/server'
import { getPumpLocations } from '@/lib/kml-parser'

export async function GET() {
  try {
    const locations = await getPumpLocations()

    return NextResponse.json({
      success: true,
      locations: locations.map(loc => ({
        name: loc.name,
        lat: loc.lat,
        lng: loc.lng,
        description: loc.description,
      })),
      count: locations.length,
    })
  } catch (error) {
    console.error('Failed to get locations:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
