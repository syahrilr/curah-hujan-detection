import { NextRequest, NextResponse } from "next/server"
import { MongoClient, ServerApiVersion, Db } from "mongodb"

const MONGODB_URI = process.env.MONGODB_URI
const DB_NAME = "db_curah_hujan"
const COLLECTION_RAINFALL = "rainfall_records"

// --- Peningkatan Manajemen Koneksi MongoDB ---
// (Tetap sama)
declare global {
  var _mongoClientPromise: Promise<MongoClient> | undefined
}
let client: MongoClient | null = null
let clientPromise: Promise<MongoClient> | null = null

function getClient(): Promise<MongoClient> {
  if (!MONGODB_URI) {
    throw new Error("Variabel lingkungan MONGODB_URI tidak diatur")
  }

  if (process.env.NODE_ENV === "development") {
    if (!global._mongoClientPromise) {
      client = new MongoClient(MONGODB_URI, {
        serverApi: {
          version: ServerApiVersion.v1,
          strict: true,
          deprecationErrors: true,
        },
      })
      global._mongoClientPromise = client.connect()
      console.log("Membuat koneksi MongoDB baru (development)...")
    }
    clientPromise = global._mongoClientPromise
  } else {
    if (!clientPromise) {
      client = new MongoClient(MONGODB_URI, {
        serverApi: {
          version: ServerApiVersion.v1,
          strict: true,
          deprecationErrors: true,
        },
      })
      clientPromise = client.connect()
      console.log("Membuat koneksi MongoDB baru (production)...")
    }
  }
  return clientPromise!
}

async function getDb(): Promise<Db> {
  try {
    const mongoClient = await getClient()
    return mongoClient.db(DB_NAME)
  } catch (error) {
    console.error("Gagal mendapatkan koneksi database:", error)
    throw new Error("Gagal terhubung ke database")
  }
}
// --- Akhir Peningkatan Manajemen Koneksi ---

/**
 * GET /api/rainfall-comparison
 * Fetch rainfall data for comparison between BMKG and Open-Meteo
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)

    const source = searchParams.get("source")
    const lat = parseFloat(searchParams.get("lat") || "0")
    const lng = parseFloat(searchParams.get("lng") || "0")
    const startDate = searchParams.get("startDate")
    const endDate = searchParams.get("endDate")

    if (!source || !startDate || !endDate) {
      return NextResponse.json(
        {
          success: false,
          error: "Parameter tidak lengkap",
          details: "source, startDate, dan endDate diperlukan",
        },
        { status: 400 },
      )
    }

    if (source === "bmkg") {
      // --- LOGIKA DIPANGGIL DI SINI ---
      const data = await fetchBMKGRainfallData(lat, lng, startDate, endDate)
      return NextResponse.json({
        success: true,
        source: "bmkg",
        data,
        count: data.length,
      })
    }

    if (source === "openmeteo") {
      return NextResponse.json({
        success: true,
        source: "openmeteo",
        message: "Gunakan /api/history?action=fetchData untuk data Open-Meteo",
      })
    }

    return NextResponse.json(
      {
        success: false,
        error: "Sumber tidak valid",
        details: "Sumber harus 'bmkg' atau 'openmeteo'",
      },
      { status: 400 },
    )
  } catch (error: any) {
    console.error("Error API Rainfall comparison (GET):", error)
    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
        details: error.message,
      },
      { status: 500 },
    )
  }
}

/**
 * --- FUNGSI DIPERBAIKI ---
 * Fetch BMKG rainfall data from MongoDB rainfall_records
 * Menggunakan query geospatial $near dan struktur data yang benar.
 */
async function fetchBMKGRainfallData(
  lat: number,
  lng: number,
  startDate: string,
  endDate: string,
): Promise<Array<{ timestamp: string; rainfall: number }>> {
  try {
    // Dapatkan DB yang sudah terhubung
    const db = await getDb()
    const collection = db.collection(COLLECTION_RAINFALL)

    const start = new Date(startDate)
    const end = new Date(endDate)
    end.setHours(23, 59, 59, 999) // Akhir hari

    // CATATAN: Pastikan Anda memiliki 2dsphere index di 'location' pada MongoDB
    // Jalankan ini di mongo shell: db.rainfall_records.createIndex({ "location": "2dsphere" })

    const records = await collection
      .find({
        createdAt: {
          $gte: start,
          $lte: end,
        },
        // Query Geospatial untuk menemukan dokumen di dekat lat/lng yang diberikan
        location: {
          $near: {
            $geometry: {
              type: "Point",
              coordinates: [lng, lat], // Format GeoJSON: [longitude, latitude]
            },
            $maxDistance: 5000, // Jarak maksimum 5km (5000 meter)
          },
        },
      })
      .sort({ createdAt: 1 }) // Urutkan berdasarkan waktu
      .toArray()

    console.log(`Ditemukan ${records.length} record BMKG dalam rentang tanggal dan jarak 5km`)

    // Ekstraksi data curah hujan
    const rainfallData: Array<{ timestamp: string; rainfall: number }> = []

    for (const record of records) {
      // Ambil data dari 'metadata.rainRate' sesuai contoh Anda
      if (record.metadata && typeof record.metadata.rainRate === "number") {

        // Prioritaskan radarTime jika ada, jika tidak gunakan createdAt
        let timestamp = record.createdAt.toISOString()

        if (record.metadata.radarTime && typeof record.metadata.radarTime === 'string') {
          // Coba parsing radarTime "2025-10-19 22:03 WIB"
          try {
            const parts = record.metadata.radarTime.split(' ')
            if (parts.length >= 2) {
              // Asumsi WIB adalah +07:00
              const isoTime = parts[0] + 'T' + parts[1] + '+07:00'
              const date = new Date(isoTime)
              if (!isNaN(date.getTime())) {
                timestamp = date.toISOString()
              }
            }
          } catch (e) {
            // Biarkan timestamp menggunakan createdAt jika parsing gagal
            console.warn(`Gagal mem-parsing radarTime: ${record.metadata.radarTime}, menggunakan createdAt`)
          }
        }

        rainfallData.push({
          timestamp: timestamp,
          rainfall: record.metadata.rainRate || 0,
        })
      }
    }

    console.log(`Mengekstrak ${rainfallData.length} titik data curah hujan dari BMKG`)

    return rainfallData
  } catch (error) {
    console.error("Gagal mengambil data BMKG:", error)
    throw error // Biarkan handler GET menangkap error
  }
}

/**
 * Calculate distance between two coordinates using Haversine formula
 * (Fungsi ini tidak lagi digunakan oleh fetchBMKGRainfallData, tapi mungkin berguna untuk hal lain)
 */
function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371 // Radius bumi dalam km
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2)

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

/**
 * POST /api/rainfall-comparison
 * Save comparison results for future analysis
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const {
      locationName,
      latitude,
      longitude,
      startDate,
      endDate,
      bmkgData,
      openMeteoData,
      statistics,
    } = body

    if (!locationName || !latitude || !longitude || !startDate || !endDate) {
      return NextResponse.json(
        {
          success: false,
          error: "Parameter wajib tidak ada",
        },
        { status: 400 },
      )
    }

    // Dapatkan DB yang sudah terhubung
    const db = await getDb()
    const collection = db.collection("rainfall_comparisons")

    const document = {
      location: {
        name: locationName,
        type: "Point",
        coordinates: [longitude, latitude],
        latitude,
        longitude,
      },
      period: {
        startDate: new Date(startDate),
        endDate: new Date(endDate),
      },
      // Data ini sekarang akan berisi data per jam yang sudah diagregasi
      bmkgData: bmkgData || [],
      openMeteoData: openMeteoData || [],
      statistics: statistics || {},
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    const result = await collection.insertOne(document)

    console.log(`Menyimpan hasil perbandingan: ${result.insertedId}`)

    return NextResponse.json({
      success: true,
      message: "Perbandingan berhasil disimpan",
      id: result.insertedId.toString(),
    })
  } catch (error: any) {
    console.error("Gagal menyimpan perbandingan:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Gagal menyimpan perbandingan",
        details: error.message,
      },
      { status: 500 },
    )
  }
}
