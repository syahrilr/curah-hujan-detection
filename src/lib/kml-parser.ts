/**
 * KML Parser for pump locations
 * Parses KML file and extracts pump station coordinates
 */

import { readFileSync } from "fs"
import { join } from "path"

export interface PumpLocation {
  name: string
  lat: number
  lng: number
  description?: string
}

/**
 * Parse KML file and extract pump locations
 * Reads from public/data/Mapping Titik Lokasi Pompa.kml using file system
 */
export async function getPumpLocations(): Promise<PumpLocation[]> {
  try {
    const kmlPath = join(process.cwd(), "public", "data", "Mapping Titik Lokasi Pompa.kml")
    const kmlText = readFileSync(kmlPath, "utf-8")
    return parseKML(kmlText)
  } catch (error) {
    console.warn("KML file not found, using hardcoded pump locations:", error)
    return getHardcodedPumpLocations()
  }
}

/**
 * Parse KML XML string and extract placemarks using regex
 * Works in Node.js without requiring DOMParser
 */
function parseKML(kmlText: string): PumpLocation[] {
  try {
    const locations: PumpLocation[] = []

    // Match <Placemark>...</Placemark> blocks
    const placemarksRegex = /<Placemark[^>]*>([\s\S]*?)<\/Placemark>/g
    let placemark
    let index = 0

    while ((placemark = placemarksRegex.exec(kmlText)) !== null) {
      const placmarkContent = placemark[1]

      // Extract name
      const nameMatch = placmarkContent.match(/<name>(.*?)<\/name>/)
      const name = nameMatch ? nameMatch[1].trim() : `Pump ${index + 1}`

      // Extract description (optional)
      const descMatch = placmarkContent.match(/<description>(.*?)<\/description>/)
      const description = descMatch ? descMatch[1].trim() : ""

      // Extract coordinates (format: lng,lat,alt)
      const coordMatch = placmarkContent.match(/<coordinates>(.*?)<\/coordinates>/)
      if (!coordMatch) {
        console.warn(`Skipping placemark "${name}" - no coordinates found`)
        index++
        continue
      }

      const coordinatesText = coordMatch[1].trim()
      const [lngStr, latStr] = coordinatesText.split(",")
      const lng = Number.parseFloat(lngStr)
      const lat = Number.parseFloat(latStr)

      if (isNaN(lat) || isNaN(lng)) {
        console.warn(`Skipping placemark "${name}" - invalid coordinates: ${coordinatesText}`)
        index++
        continue
      }

      locations.push({
        name,
        lat,
        lng,
        description,
      })

      index++
    }

    console.log(`✅ Parsed ${locations.length} pump locations from KML`)
    return locations
  } catch (error) {
    console.error("Failed to parse KML:", error)
    return []
  }
}

/**
 * Get pump locations from hardcoded list (fallback)
 */
export function getHardcodedPumpLocations(): PumpLocation[] {
  return [
    {
      name: "Pulomas 2",
      lat: -6.168055599999999,
      lng: 106.8808333,
      description: "Pump station Pulomas",
    },
    {
      name: "Kampung Ambon",
      lat: -6.1788889,
      lng: 106.8988889,
      description: "Pump station Kampung Ambon",
    },
    {
      name: "Kelinci",
      lat: -6.161388899999999,
      lng: 106.8375,
      description: "Pump station Kelinci",
    },
    {
      name: "Jembatan Merah",
      lat: -6.1494444,
      lng: 106.8347222,
      description: "Pump station Jembatan Merah",
    },
    {
      name: "Hayam Wuruk",
      lat: -6.1594444,
      lng: 106.8194444,
      description: "Pump station Hayam Wuruk",
    },
    {
      name: "Batu Ceper",
      lat: -6.1633,
      lng: 106.82,
      description: "Pump station Batu Ceper",
    },
    {
      name: "Green Garden",
      lat: -6.158333300000001,
      lng: 106.7602778,
      description: "Pump station Green Garden",
    },
    {
      name: "Rumah Pompa Polder Kamal",
      lat: -6.0961734,
      lng: 106.7183362,
      description: "Pump station Polder Kamal",
    },
    {
      name: "RLS Brigif",
      lat: -6.3511111,
      lng: 106.7983333,
      description: "Pump station RLS Brigif",
    },
    {
      name: "Pintu Air Pakin Kali Krukut",
      lat: -6.1283326,
      lng: 106.805917,
      description: "Pump station Pintu Air Pakin",
    },
    {
      name: "Outlet RLS Pondok Ranggon",
      lat: -6.3380556,
      lng: 106.9177778,
      description: "Pump station Pondok Ranggon",
    },
    {
      name: "Teluk Gong",
      lat: -6.133645520597007,
      lng: 106.7778712339822,
      description: "Pump station Teluk Gong",
    },
  ]
}
