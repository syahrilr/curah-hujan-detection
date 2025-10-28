/**
 * Open-Meteo Historical Data Integration
 * Fetches rainfall history for pump locations
 */

import type { PumpLocation } from './kml-parser'

export interface HistoricalDataPoint {
  timestamp: string
  precipitation: number
  rain: number
  windSpeed: number
  windDirection: number
}

export interface HistoricalData {
  location: PumpLocation
  startDate: string
  endDate: string
  data: HistoricalDataPoint[]
  statistics: {
    totalPrecipitation: number
    maxPrecipitation: number
    avgPrecipitation: number
    rainyDays: number
    maxWindSpeed: number
    avgWindSpeed: number
  }
}

/**
 * Fetch historical rainfall data from Open-Meteo Archive API
 */
export async function fetchHistoricalRainfall(
  location: PumpLocation,
  startDate: string,
  endDate: string
): Promise<HistoricalData> {
  const url = new URL('https://archive-api.open-meteo.com/v1/archive')

  url.searchParams.set('latitude', location.lat.toString())
  url.searchParams.set('longitude', location.lng.toString())
  url.searchParams.set('start_date', startDate)
  url.searchParams.set('end_date', endDate)
  url.searchParams.set('hourly', 'precipitation,rain,wind_speed_10m,wind_direction_10m')
  url.searchParams.set('timezone', 'Asia/Jakarta')

  const response = await fetch(url.toString())

  if (!response.ok) {
    throw new Error(`Open-Meteo Archive API error: ${response.status}`)
  }

  const apiData = await response.json()

  // Parse hourly data
  const dataPoints: HistoricalDataPoint[] = []
  const hours = apiData.hourly.time.length

  for (let i = 0; i < hours; i++) {
    dataPoints.push({
      timestamp: apiData.hourly.time[i],
      precipitation: apiData.hourly.precipitation[i] || 0,
      rain: apiData.hourly.rain[i] || 0,
      windSpeed: apiData.hourly.wind_speed_10m[i] || 0,
      windDirection: apiData.hourly.wind_direction_10m[i] || 0,
    })
  }

  // Calculate statistics
  const precipValues = dataPoints.map(d => d.precipitation)
  const windSpeedValues = dataPoints.map(d => d.windSpeed)

  const totalPrecipitation = precipValues.reduce((sum, val) => sum + val, 0)
  const maxPrecipitation = Math.max(...precipValues)
  const avgPrecipitation = totalPrecipitation / hours
  const rainyDays = new Set(
    dataPoints
      .filter(d => d.precipitation > 0.1)
      .map(d => d.timestamp.split('T')[0])
  ).size
  const maxWindSpeed = Math.max(...windSpeedValues)
  const avgWindSpeed = windSpeedValues.reduce((sum, val) => sum + val, 0) / hours

  return {
    location,
    startDate,
    endDate,
    data: dataPoints,
    statistics: {
      totalPrecipitation: parseFloat(totalPrecipitation.toFixed(2)),
      maxPrecipitation: parseFloat(maxPrecipitation.toFixed(2)),
      avgPrecipitation: parseFloat(avgPrecipitation.toFixed(3)),
      rainyDays,
      maxWindSpeed: parseFloat(maxWindSpeed.toFixed(2)),
      avgWindSpeed: parseFloat(avgWindSpeed.toFixed(2)),
    },
  }
}

/**
 * Fetch historical data for multiple locations
 */
export async function fetchHistoricalRainfallBatch(
  locations: PumpLocation[],
  startDate: string,
  endDate: string,
  onProgress?: (current: number, total: number) => void
): Promise<HistoricalData[]> {
  const results: HistoricalData[] = []

  for (let i = 0; i < locations.length; i++) {
    try {
      const data = await fetchHistoricalRainfall(locations[i], startDate, endDate)
      results.push(data)

      if (onProgress) {
        onProgress(i + 1, locations.length)
      }

      // Add delay to avoid rate limiting
      if (i < locations.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 200))
      }
    } catch (error) {
      console.error(`Failed to fetch data for ${locations[i].name}:`, error)
    }
  }

  return results
}

/**
 * Aggregate daily data from hourly data
 */
export function aggregateDailyData(hourlyData: HistoricalDataPoint[]): Array<{
  date: string
  totalPrecipitation: number
  maxPrecipitation: number
  avgWindSpeed: number
  maxWindSpeed: number
}> {
  const dailyMap = new Map<string, HistoricalDataPoint[]>()

  // Group by date
  for (const point of hourlyData) {
    const date = point.timestamp.split('T')[0]
    if (!dailyMap.has(date)) {
      dailyMap.set(date, [])
    }
    dailyMap.get(date)!.push(point)
  }

  // Aggregate
  const dailyData = Array.from(dailyMap.entries()).map(([date, points]) => {
    const precipValues = points.map(p => p.precipitation)
    const windValues = points.map(p => p.windSpeed)

    return {
      date,
      totalPrecipitation: parseFloat(precipValues.reduce((sum, val) => sum + val, 0).toFixed(2)),
      maxPrecipitation: parseFloat(Math.max(...precipValues).toFixed(2)),
      avgWindSpeed: parseFloat((windValues.reduce((sum, val) => sum + val, 0) / points.length).toFixed(2)),
      maxWindSpeed: parseFloat(Math.max(...windValues).toFixed(2)),
    }
  })

  return dailyData.sort((a, b) => a.date.localeCompare(b.date))
}

/**
 * Compare historical data across multiple locations
 */
export function compareLocations(historicalDataList: HistoricalData[]): {
  location: string
  totalRainfall: number
  rainyDays: number
  maxIntensity: number
}[] {
  return historicalDataList
    .map(data => ({
      location: data.location.name,
      totalRainfall: data.statistics.totalPrecipitation,
      rainyDays: data.statistics.rainyDays,
      maxIntensity: data.statistics.maxPrecipitation,
    }))
    .sort((a, b) => b.totalRainfall - a.totalRainfall)
}

/**
 * Get date range presets
 */
export function getDatePresets(): Record<string, { start: string; end: string; label: string }> {
  const today = new Date()
  const formatDate = (date: Date) => date.toISOString().split('T')[0]

  const presets: Record<string, { start: string; end: string; label: string }> = {
    last7days: {
      start: formatDate(new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)),
      end: formatDate(today),
      label: 'Last 7 Days',
    },
    last30days: {
      start: formatDate(new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000)),
      end: formatDate(today),
      label: 'Last 30 Days',
    },
    last90days: {
      start: formatDate(new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000)),
      end: formatDate(today),
      label: 'Last 90 Days',
    },
    thisMonth: {
      start: formatDate(new Date(today.getFullYear(), today.getMonth(), 1)),
      end: formatDate(today),
      label: 'This Month',
    },
    lastMonth: {
      start: formatDate(new Date(today.getFullYear(), today.getMonth() - 1, 1)),
      end: formatDate(new Date(today.getFullYear(), today.getMonth(), 0)),
      label: 'Last Month',
    },
    thisYear: {
      start: formatDate(new Date(today.getFullYear(), 0, 1)),
      end: formatDate(today),
      label: 'This Year (2025)',
    },
    year2024: {
      start: '2024-01-01',
      end: '2024-12-31',
      label: 'Year 2024',
    },
  }

  return presets
}

/**
 * Format data for chart display
 */
export function formatForChart(dailyData: Array<{
  date: string
  totalPrecipitation: number
  maxPrecipitation: number
}>) {
  return {
    labels: dailyData.map(d => {
      const date = new Date(d.date)
      return date.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })
    }),
    datasets: [
      {
        label: 'Total Precipitation (mm)',
        data: dailyData.map(d => d.totalPrecipitation),
        borderColor: 'rgb(59, 130, 246)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
      },
      {
        label: 'Max Intensity (mm/h)',
        data: dailyData.map(d => d.maxPrecipitation),
        borderColor: 'rgb(239, 68, 68)',
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
      },
    ],
  }
}

export default {
  fetchHistoricalRainfall,
  fetchHistoricalRainfallBatch,
  aggregateDailyData,
  compareLocations,
  getDatePresets,
  formatForChart,
}
