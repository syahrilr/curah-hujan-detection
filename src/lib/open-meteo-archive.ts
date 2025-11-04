export interface HistoricalHourly {
  time: string[];
  precipitation: (number | null)[];
  rain: (number | null)[];
  wind_speed_10m: (number | null)[];
  wind_direction_100m: (number | null)[];
}

export interface HistoricalData {
  latitude: number;
  longitude: number;
  generationtime_ms: number;
  utc_offset_seconds: number;
  timezone: string;
  timezone_abbreviation: string;
  elevation: number;
  hourly_units: {
    time: string;
    precipitation: string;
    rain: string;
    wind_speed_10m: string;
    wind_direction_100m: string;
  };
  hourly: HistoricalHourly;
}

/**
 * Mengambil data history curah hujan dari Open-Meteo Archive API.
 * @param lat Latitude lokasi
 * @param lng Longitude lokasi
 * @param startDate Tanggal mulai (YYYY-MM-DD)
 * @param endDate Tanggal selesai (YYYY-MM-DD)
 * @returns Promise<HistoricalData>
 */
export async function fetchRainfallHistory(
  lat: number,
  lng: number,
  startDate: string,
  endDate: string,
): Promise<HistoricalData> {
  const url = new URL("https://archive-api.open-meteo.com/v1/archive");
  url.searchParams.set("latitude", lat.toFixed(5));
  url.searchParams.set("longitude", lng.toFixed(5));
  url.searchParams.set("start_date", startDate);
  url.searchParams.set("end_date", endDate);
  url.searchParams.set(
    "hourly",
    "precipitation,rain,wind_speed_10m,wind_direction_100m",
  );
  url.searchParams.set("timezone", "auto");

  console.log(`Fetching Open-Meteo History: ${url.toString()}`);

  try {
    const response = await fetch(url.toString(), {
      next: { revalidate: 3600 }, // Cache 1 jam
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Open-Meteo API Error:", errorText);
      throw new Error(`Failed to fetch history data: ${response.status} ${errorText}`);
    }

    const data: HistoricalData = await response.json();
    return data;
  } catch (error) {
    console.error("Error in fetchRainfallHistory:", error);
    throw error;
  }
}
