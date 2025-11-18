import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getPumpLocations, PumpLocation } from "@/lib/kml-parser";
import {
  fetchRainfallHistory,
  HistoricalData,
} from "@/lib/open-meteo-archive";
import { MongoClient, ServerApiVersion } from "mongodb";
import { format, parseISO, differenceInHours } from "date-fns";

const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = "db_curah_hujan";
const MONGODB_ENABLED = !!MONGODB_URI;


const CACHE_FRESHNESS_HOURS = 24;

let client: MongoClient | null = null;
if (MONGODB_ENABLED) {
  client = new MongoClient(MONGODB_URI, {
    serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true,
    },
    connectTimeoutMS: 10000,
    serverSelectionTimeoutMS: 10000,
  });
}


function sanitizeCollectionName(locationName: string): string {
  return locationName
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}


async function getDataFromMongoDB(
  locationName: string,
  latitude: number,
  longitude: number,
  startDate: string,
  endDate: string
) {
  if (!MONGODB_ENABLED || !client) {
    return null;
  }

  try {
    await client.connect();
    const db = client.db(DB_NAME);
    const collectionName = sanitizeCollectionName(locationName);
    const collection = db.collection(collectionName);

    // Query berdasarkan 'date' (per hari)
    const documents = await collection
      .find({
        date: {
          $gte: startDate,
          $lte: endDate,
        },
      })
      .sort({ date: 1 })
      .toArray();

    if (documents.length === 0) {
      return null;
    }

    // Check if data is fresh
    const latestUpdate = documents.reduce((latest, doc) => {
      const docUpdate = doc.updatedAt ? new Date(doc.updatedAt) : new Date(0);
      return docUpdate > latest ? docUpdate : latest;
    }, new Date(0));

    const hoursSinceUpdate = differenceInHours(new Date(), latestUpdate);
    const isFresh = hoursSinceUpdate < CACHE_FRESHNESS_HOURS;

    // Convert MongoDB documents to HistoricalData format
    const hourlyData: {
      time: string[];
      precipitation: number[];
      rain: number[];
      wind_speed_10m: number[];
    } = {
      time: [],
      precipitation: [],
      rain: [],
      wind_speed_10m: [],
    };


    documents.forEach((doc) => {
      const date = doc.date;
      const hourlyObject = doc.hourly;

      if (!hourlyObject) return;

      const sortedHours = Object.keys(hourlyObject).sort();

      sortedHours.forEach((hourKey) => {
        const hourData = hourlyObject[hourKey];

        hourlyData.time.push(hourData.time);
        hourlyData.precipitation.push(hourData.precipitation);
        hourlyData.rain.push(hourData.rain);
        hourlyData.wind_speed_10m.push(hourData.wind_speed_10m);
      });
    });

    return {
      data: {
        timezone: documents[0].timezone,
        hourly: hourlyData,
      },
      isFresh,
      lastUpdate: latestUpdate,
      source: "mongodb",
    };
  } catch (error) {
    console.error("Error fetching from MongoDB:", error);
    return null;
  } finally {
    try {
      await client.close();
    } catch (e) {

    }
  }
}


function getSafeSum(
  rainArray: (number | null)[],
  currentIndex: number,
  windowSize: number
): number {
  let sum = 0;
  for (let i = 0; i < windowSize; i++) {
    const indexToSum = currentIndex - i;
    if (indexToSum >= 0) {

      const value = rainArray[indexToSum] ?? 0;
      sum += value;
    } else {

      break;
    }
  }

  return Math.round(sum * 100) / 100;
}


async function saveToMongoDB(
  locationName: string,
  latitude: number,
  longitude: number,
  startDate: string,
  endDate: string,
  historyData: HistoricalData
) {
  if (!MONGODB_ENABLED || !client) {
    return false;
  }

  try {
    await client.connect();
    const db = client.db(DB_NAME);
    const collectionName = sanitizeCollectionName(locationName);
    const collection = db.collection(collectionName);


    const dataByDate = new Map<string, any>();


    const rainArray = historyData.hourly.rain;

    historyData.hourly.time.forEach((time: string, index: number) => {
      const date = time.split("T")[0]; // "2025-11-01"
      const hourKey = time.split("T")[1].substring(0, 2); // "00", "01", "23"

      if (!dataByDate.has(date)) {
        dataByDate.set(date, {
          date: date,
          hourly: {},
          timezone: historyData.timezone,
        });
      }


      const rain_rate = rainArray[index] ?? 0; // Laju rain (mm/jam)

      const rain_sum_3h = getSafeSum(rainArray, index, 3);
      const rain_sum_6h = getSafeSum(rainArray, index, 6);
      const rain_sum_12h = getSafeSum(rainArray, index, 12);
      const rain_sum_15h = getSafeSum(rainArray, index, 15);
      const rain_sum_24h = getSafeSum(rainArray, index, 24);


      dataByDate.get(date).hourly[hourKey] = {

        time: time,
        precipitation: historyData.hourly.precipitation[index] ?? 0,
        rain: historyData.hourly.rain[index] ?? 0,
        wind_speed_10m: historyData.hourly.wind_speed_10m[index] ?? 0,


        laju_rain: rain_rate,
        rain_sum_3h: rain_sum_3h,
        rain_sum_6h: rain_sum_6h,
        rain_sum_12h: rain_sum_12h,
        rain_sum_15h: rain_sum_15h,
        rain_sum_24h: rain_sum_24h,
      };
    });


    const dailyDocuments = Array.from(dataByDate.values()).map((doc) => ({
      ...doc,
      updatedAt: new Date(),
    }));

    if (dailyDocuments.length > 0) {
      const bulkOps = dailyDocuments.map((doc) => ({
        updateOne: {
          filter: { date: doc.date },
          update: {
            $set: {
              ...doc,
              updatedAt: new Date(),
            },
            $setOnInsert: {
              createdAt: new Date(),
            },
          },
          upsert: true,
        },
      }));

      await collection.bulkWrite(bulkOps);

      // --- ERROR FIX START ---
      // Create indexes with try-catch to handle conflicts
      try {
        await collection.createIndex({ date: 1 }, { unique: true });
      } catch (error: any) {
        // Ignore code 86 (IndexKeySpecsConflict) which happens if index exists with different options
        if (error.code !== 86) {
          console.warn(`Warning: Could not create unique index on 'date' for ${collectionName}:`, error.message);
        }
      }

      try {
        await collection.createIndex({ updatedAt: -1 });
      } catch (error) {
        console.warn(`Warning: Could not create index on 'updatedAt' for ${collectionName}:`, error);
      }
      // --- ERROR FIX END ---

      return true;
    }

    return false;
  } catch (error) {
    console.error("Error saving to MongoDB:", error);
    return false;
  } finally {
    try {
      await client.close();
    } catch (e) {
      // Ignore
    }
  }
}


export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const action = searchParams.get("action");

  try {

    if (action === "getLocations") {
      const locations = await getPumpLocations();
      const locationsWithId = locations.map((loc, index) => ({
        ...loc,
        id: `${loc.name.replace(/\s+/g, "-")}-${index}`,
      }));
      return NextResponse.json({ success: true, locations: locationsWithId });
    }

    if (action === "fetchData") {
      const lat = searchParams.get("lat");
      const lng = searchParams.get("lng");
      const startDate = searchParams.get("startDate");
      const endDate = searchParams.get("endDate");
      const locationName = searchParams.get("locationName");
      const forceRefresh = searchParams.get("forceRefresh") === "true";

      if (!lat || !lng || !startDate || !endDate) {
        return NextResponse.json(
          { message: "Missing required parameters" },
          { status: 400 }
        );
      }

      const latitude = parseFloat(lat);
      const longitude = parseFloat(lng);


      if (!forceRefresh && MONGODB_ENABLED) {
        console.log("Checking MongoDB cache...");
        const cachedData = await getDataFromMongoDB(
          locationName || "unknown",
          latitude,
          longitude,
          startDate,
          endDate
        );

        if (cachedData && cachedData.isFresh) {
          console.log("✓ Using fresh data from MongoDB cache");
          return NextResponse.json({
            success: true,
            data: cachedData.data,
            fromCache: true,
            isFresh: true,
            lastUpdate: cachedData.lastUpdate,
            source: "mongodb",
          });
        } else if (cachedData && !cachedData.isFresh) {
          console.log(
            "⚠ MongoDB cache exists but is stale, fetching fresh data..."
          );
        } else {
          console.log("ℹ No cache found, fetching from Open-Meteo...");
        }
      }

      console.log(
        `Fetching from Open-Meteo: ${latitude}, ${longitude} (${startDate} to ${endDate})`
      );
      const historyData = await fetchRainfallHistory(
        latitude,
        longitude,
        startDate,
        endDate
      );

      console.log(`✓ Received ${historyData.hourly.time.length} data points`);


      const saved = await saveToMongoDB(
        locationName || "unknown",
        latitude,
        longitude,
        startDate,
        endDate,
        historyData
      );

      if (saved) {
        console.log("✓ Data saved to MongoDB (with derived features)");
      }


      return NextResponse.json({
        success: true,
        data: historyData,
        fromCache: false,
        isFresh: true,
        lastUpdate: new Date(),
        source: "open-meteo",
        mongodbSaved: saved,
      });
    }


    if (action === "getCacheInfo") {
      const locationName = searchParams.get("locationName");
      const startDate = searchParams.get("startDate");
      const endDate = searchParams.get("endDate");

      if (!locationName || !startDate || !endDate || !MONGODB_ENABLED) {
        return NextResponse.json({
          success: true,
          hasCacheInfo: false,
        });
      }

      try {
        await client!.connect();
        const db = client!.db(DB_NAME);
        const collectionName = sanitizeCollectionName(locationName);
        const collection = db.collection(collectionName);

        const query = {
          date: {
            $gte: startDate,
            $lte: endDate,
          },
        };

        const count = await collection.countDocuments(query);

        if (count > 0) {
          const latestDoc = await collection.findOne(
            query,
            { sort: { updatedAt: -1 } }
          );

          return NextResponse.json({
            success: true,
            hasCacheInfo: true,
            cacheInfo: {
              documentsCount: count,
              lastUpdate: latestDoc?.updatedAt,
              isFresh:
                differenceInHours(
                  new Date(),
                  new Date(latestDoc?.updatedAt)
                ) < CACHE_FRESHNESS_HOURS,
            },
          });
        }
      } catch (error) {
        console.error("Error getting cache info:", error);
      } finally {
        try {
          await client!.close();
        } catch (e) {
          // Ignore
        }
      }

      return NextResponse.json({
        success: true,
        hasCacheInfo: false,
      });
    }

    return NextResponse.json({ message: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error(`Error in /api/history (action: ${action}):`, error);
    return NextResponse.json(
      {
        success: false,
        message: (error as Error).message || "Internal Server Error",
      },
      { status: 500 }
    );
  }
}
