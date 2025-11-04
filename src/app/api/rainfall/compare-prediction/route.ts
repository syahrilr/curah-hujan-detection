import { NextRequest, NextResponse } from "next/server"
import { MongoClient, ServerApiVersion, Db } from "mongodb"

const MONGODB_URI = process.env.MONGODB_URI
const DB_NAME = "db_curah_hujan"
const COLLECTION_RAINFALL = "rainfall_records"

declare global {
  var _mongoClientPromise: Promise<MongoClient> | undefined
}

let client: MongoClient | null = null
let clientPromise: Promise<MongoClient> | null = null

function getClient(): Promise<MongoClient> {
  if (!MONGODB_URI) {
    throw new Error("MONGODB_URI tidak diatur")
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
    }
  }
  return clientPromise!
}

async function getDb(): Promise<Db> {
  const mongoClient = await getClient()
  return mongoClient.db(DB_NAME)
}

/**
 * POST /api/rainfall/compare-prediction
 * Membandingkan data prediksi dengan data real terdekat
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { predictionTime, locations, toleranceMinutes = 5 } = body

    if (!predictionTime || !locations || !Array.isArray(locations)) {
      return NextResponse.json(
        {
          success: false,
          error: "Parameter tidak lengkap",
          details: "Memerlukan predictionTime (ISO string) dan locations (array)",
        },
        { status: 400 }
      )
    }

    const db = await getDb()
    const collection = db.collection(COLLECTION_RAINFALL)

    // Parse waktu prediksi
    const targetTime = new Date(predictionTime)

    // Buat range waktu untuk mencari (± toleranceMinutes)
    const startTime = new Date(targetTime)
    startTime.setMinutes(startTime.getMinutes() - toleranceMinutes)

    const endTime = new Date(targetTime)
    endTime.setMinutes(endTime.getMinutes() + toleranceMinutes)

    console.log(`🔍 Mencari data real untuk waktu: ${targetTime.toISOString()}`)
    console.log(`📅 Range: ${startTime.toISOString()} - ${endTime.toISOString()}`)

    // Query untuk setiap lokasi
    const comparisons = await Promise.all(
      locations.map(async (location: any) => {
        const { name, predicted_rain_rate, confidence } = location

        // Cari dokumen dengan waktu terdekat
        const pipeline = [
          {
            $match: {
              createdAt: { $gte: startTime, $lte: endTime },
              "markers.name": name,
            },
          },
          {
            $addFields: {
              timeDiff: {
                $abs: {
                  $subtract: ["$createdAt", targetTime],
                },
              },
            },
          },
          {
            $sort: { timeDiff: 1 },
          },
          {
            $limit: 1,
          },
          {
            $unwind: "$markers",
          },
          {
            $match: {
              "markers.name": name,
            },
          },
          {
            $project: {
              _id: 0,
              actualTime: "$createdAt",
              radarTime: "$metadata.radarTime",
              actualRainRate: "$markers.rainRate",
              actualDbz: "$markers.dbz",
              actualIntensity: "$markers.intensity",
              timeDiffMinutes: {
                $divide: ["$timeDiff", 60000], // Convert ms to minutes
              },
            },
          },
        ]

        const result = await collection.aggregate(pipeline).toArray()

        if (result.length === 0) {
          return {
            location: name,
            status: "no_data",
            predicted: {
              time: predictionTime,
              rainRate: predicted_rain_rate,
              confidence,
            },
            actual: null,
            comparison: null,
          }
        }

        const actual = result[0]
        const error = Math.abs(predicted_rain_rate - actual.actualRainRate)
        const errorPercentage = actual.actualRainRate > 0
          ? (error / actual.actualRainRate) * 100
          : predicted_rain_rate > 0 ? 100 : 0

        return {
          location: name,
          status: "matched",
          predicted: {
            time: predictionTime,
            rainRate: predicted_rain_rate,
            confidence,
          },
          actual: {
            time: actual.actualTime,
            radarTime: actual.radarTime,
            rainRate: actual.actualRainRate,
            dbz: actual.actualDbz,
            intensity: actual.actualIntensity,
            timeDiffMinutes: actual.timeDiffMinutes,
          },
          comparison: {
            error: parseFloat(error.toFixed(2)),
            errorPercentage: parseFloat(errorPercentage.toFixed(2)),
            isAccurate: errorPercentage < 20, // Akurat jika error < 20%
            predictionQuality:
              errorPercentage < 10 ? "excellent" :
              errorPercentage < 20 ? "good" :
              errorPercentage < 40 ? "fair" : "poor",
          },
        }
      })
    )

    // Hitung statistik keseluruhan
    const matchedComparisons = comparisons.filter(c => c.status === "matched")
    const statistics = {
      totalLocations: locations.length,
      matchedLocations: matchedComparisons.length,
      unmatchedLocations: comparisons.length - matchedComparisons.length,
      averageError: matchedComparisons.length > 0
        ? matchedComparisons.reduce((sum, c) => sum + c.comparison!.error, 0) / matchedComparisons.length
        : 0,
      averageErrorPercentage: matchedComparisons.length > 0
        ? matchedComparisons.reduce((sum, c) => sum + c.comparison!.errorPercentage, 0) / matchedComparisons.length
        : 0,
      accurateCount: matchedComparisons.filter(c => c.comparison!.isAccurate).length,
      qualityDistribution: {
        excellent: matchedComparisons.filter(c => c.comparison!.predictionQuality === "excellent").length,
        good: matchedComparisons.filter(c => c.comparison!.predictionQuality === "good").length,
        fair: matchedComparisons.filter(c => c.comparison!.predictionQuality === "fair").length,
        poor: matchedComparisons.filter(c => c.comparison!.predictionQuality === "poor").length,
      },
    }

    console.log(`✅ Perbandingan selesai: ${matchedComparisons.length}/${locations.length} lokasi`)

    return NextResponse.json({
      success: true,
      predictionTime,
      toleranceMinutes,
      comparisons,
      statistics,
    })

  } catch (error: any) {
    console.error("❌ Error comparing prediction:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Gagal membandingkan prediksi",
        details: error.message,
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/rainfall/compare-prediction
 * Mendapatkan history perbandingan
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const location = searchParams.get("location")
    const limit = parseInt(searchParams.get("limit") || "10")

    const db = await getDb()
    const collection = db.collection("prediction_comparisons")

    const query = location ? { location } : {}
    const results = await collection
      .find(query)
      .sort({ comparedAt: -1 })
      .limit(limit)
      .toArray()

    return NextResponse.json({
      success: true,
      count: results.length,
      data: results,
    })

  } catch (error: any) {
    console.error("❌ Error fetching comparison history:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Gagal mengambil history perbandingan",
        details: error.message,
      },
      { status: 500 }
    )
  }
}
