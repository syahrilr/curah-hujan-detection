export interface HourlyForecast {
  time: string
  temperature_2m: number
  rain: number
  precipitation: number
  precipitation_probability: number
}

export interface ForecastDocument {
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

export function getCollectionName(pumpName: string): string {
  return 'prediction_' + pumpName
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
}

export async function getForecastCollection(pumpName: string) {
  const clientPromise = (await import('./mongodb')).default
  const client = await clientPromise
  const db = client.db('db-predict-ch')
  const collectionName = getCollectionName(pumpName)
  return db.collection<ForecastDocument>(collectionName)
}
