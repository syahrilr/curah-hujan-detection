import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getPumpLocations, PumpLocation } from "@/lib/kml-parser";
import {
  fetchRainfallHistory,
  HistoricalData,
} from "@/lib/open-meteo-archive";
import { MongoClient, ServerApiVersion } from "mongodb";

// Ambil URI dari env var - jika tidak ada, MongoDB akan di-skip
const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = "db_curah_hujan";
const COLLECTION_NAME = "rainfall_history";
const MONGODB_ENABLED = !!MONGODB_URI;

// Inisialisasi MDB Client hanya jika URI tersedia
let client: MongoClient | null = null;
if (MONGODB_ENABLED) {
  client = new MongoClient(MONGODB_URI, {
    serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true,
    },
    connectTimeoutMS: 5000, // Timeout 5 detik
    serverSelectionTimeoutMS: 5000, // Timeout selection 5 detik
  });
}

/**
 * Handler untuk method GET
 * Menangani ?action=getLocations dan ?action=fetchData
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const action = searchParams.get("action");

  try {
    // --- Aksi 1: Ambil Daftar Lokasi Pompa ---
    if (action === "getLocations") {
      const locations = await getPumpLocations();
      // Tambahkan ID unik untuk setiap lokasi agar bisa dipakai di <Select>
      const locationsWithId = locations.map((loc, index) => ({
        ...loc,
        id: `${loc.name.replace(/\s+/g, "-")}-${index}`,
      }));
      return NextResponse.json({ success: true, locations: locationsWithId });
    }

    // --- Aksi 2: Ambil Data History ---
    if (action === "fetchData") {
      const lat = searchParams.get("lat");
      const lng = searchParams.get("lng");
      const startDate = searchParams.get("startDate");
      const endDate = searchParams.get("endDate");
      const locationName = searchParams.get("locationName"); // Tambahan: nama lokasi

      if (!lat || !lng || !startDate || !endDate) {
        return NextResponse.json(
          {
            message:
              "Missing required query parameters: lat, lng, startDate, endDate",
          },
          { status: 400 }
        );
      }

      const latitude = parseFloat(lat as string);
      const longitude = parseFloat(lng as string);

      // 1. Ambil data dari Open-Meteo
      console.log(`Fetching data for ${latitude}, ${longitude} from ${startDate} to ${endDate}`);
      const historyData = await fetchRainfallHistory(
        latitude,
        longitude,
        startDate as string,
        endDate as string
      );

      console.log(`Received ${historyData.hourly.time.length} data points from Open-Meteo`);

      // 2. Simpan ke MongoDB (OPTIONAL - skip jika tidak tersedia)
      if (MONGODB_ENABLED && client) {
        try {
          console.log('Attempting to save to MongoDB...');
          await client.connect();
          const db = client.db(DB_NAME);
          const collection = db.collection(COLLECTION_NAME);

          const filter = {
            "location.latitude": latitude,
            "location.longitude": longitude,
            startDate: startDate as string,
            endDate: endDate as string,
          };

          const updateDoc = {
            $set: {
              location: {
                type: "Point",
                coordinates: [longitude, latitude],
                latitude: latitude,
                longitude: longitude,
                location: locationName
              },
              startDate: startDate as string,
              endDate: endDate as string,
              timezone: historyData.timezone,
              hourly_units: historyData.hourly_units,
              hourly: historyData.hourly,
              updatedAt: new Date(),
            },
            $setOnInsert: {
              createdAt: new Date(),
            },
          };

          await collection.updateOne(filter, updateDoc, { upsert: true });
          console.log("✓ Berhasil menyimpan/update history ke MongoDB");
        } catch (dbError) {
          console.warn("⚠ MongoDB tidak tersedia, data tidak disimpan:", (dbError as Error).message);
          // Jangan gagalkan request jika DB error, tetap kirim data ke client
        } finally {
          // Selalu tutup koneksi
          try {
            await client.close();
          } catch (closeError) {
            console.warn("Error closing MongoDB connection:", closeError);
          }
        }
      } else {
        console.log('ℹ MongoDB disabled - data tidak disimpan ke database');
      }

      // 3. Kembalikan data ke client (SELALU berhasil meski MongoDB error)
      return NextResponse.json({
        success: true,
        data: historyData,
        mongodbSaved: MONGODB_ENABLED // Info apakah data disimpan ke MongoDB
      });
    }

    return NextResponse.json({ message: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error(`Error in /api/history (action: ${action}):`, error);
    return NextResponse.json(
      { success: false, message: (error as Error).message || "Internal Server Error" },
      { status: 500 }
    );
  }
}
