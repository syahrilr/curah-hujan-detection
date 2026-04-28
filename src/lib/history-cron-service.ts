import * as cron from "node-cron";
import { getPumpLocations } from "./kml-parser";
import { fetchRainfallHistory } from "./open-meteo-archive";
import { MongoClient, ServerApiVersion } from "mongodb";
import { format, subDays } from "date-fns";

const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = "db_curah_hujan";
const MONGODB_ENABLED = !!MONGODB_URI;

let cronJob: cron.ScheduledTask | null = null;
let isRunning = false;
let lastRunStats: any = null;
let errorCount = 0;
let successCount = 0;

// Note: MongoDB connections are now managed per-batch in fetchAndSaveAllLocationsHistory

/**
 * Fungsi untuk menyimpan data ke MongoDB dengan collection terpisah per lokasi
 */
/**
 * Fungsi untuk menyimpan data ke MongoDB dengan collection terpisah per lokasi
 * FIXED VERSION - Mengatasi conflict createdAt
 */
async function saveToMongoDB(
  db: import("mongodb").Db | null,
  locationName: string,
  latitude: number,
  longitude: number,
  startDate: string,
  endDate: string,
  historyData: any
) {
  if (!db) {
    console.log("   ⚠️ MongoDB disabled - data tidak disimpan");
    return { saved: false, documentsCount: 0 };
  }

  try {
    // Buat nama collection dari nama lokasi (sanitize)
    const collectionName = locationName
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_|_$/g, "");

    const collection = db.collection(collectionName);

    // Simpan data per hari (pecah data hourly menjadi daily documents)
    const dataByDate = new Map<string, any>();

    // Group data berdasarkan tanggal
    historyData.hourly.time.forEach((time: string, index: number) => {
      const date = time.split("T")[0]; // Ambil bagian tanggal (YYYY-MM-DD)

      if (!dataByDate.has(date)) {
        dataByDate.set(date, {
          date: date,
          location: {
            name: locationName,
            latitude: latitude,
            longitude: longitude,
            type: "Point",
            coordinates: [longitude, latitude],
          },
          hourly_data: [],
        });
      }

      dataByDate.get(date).hourly_data.push({
        time: time,
        precipitation: historyData.hourly.precipitation[index],
        rain: historyData.hourly.rain[index],
        wind_speed_10m: historyData.hourly.wind_speed_10m[index],
      });
    });

    // Convert Map ke Array
    const dailyDocuments = [];
    const now = new Date();

    for (const [date, data] of dataByDate) {
      dailyDocuments.push({
        date: data.date,
        location: data.location,
        hourly_data: data.hourly_data,
        timezone: historyData.timezone,
        hourly_units: historyData.hourly_units,
        updatedAt: now,
      });
    }

    // Bulk upsert - update jika sudah ada, insert jika belum
    if (dailyDocuments.length > 0) {
      const bulkOps = dailyDocuments.map((doc) => ({
        updateOne: {
          filter: {
            date: doc.date,
            "location.latitude": latitude,
            "location.longitude": longitude,
          },
          update: {
            $set: {
              // Hanya set field yang boleh di-update
              "location.name": doc.location.name,
              hourly_data: doc.hourly_data,
              timezone: doc.timezone,
              hourly_units: doc.hourly_units,
              updatedAt: doc.updatedAt,
            },
            $setOnInsert: {
              // Field yang hanya di-set saat insert pertama kali
              date: doc.date,
              "location.latitude": doc.location.latitude,
              "location.longitude": doc.location.longitude,
              "location.type": doc.location.type,
              "location.coordinates": doc.location.coordinates,
              createdAt: now,
            },
          },
          upsert: true,
        },
      }));

      const result = await collection.bulkWrite(bulkOps);

      // Buat index untuk optimasi query (hanya sekali)
      try {
        await collection.createIndex({ date: 1 }, { background: true });
        await collection.createIndex(
          { "location.coordinates": "2dsphere" },
          { background: true }
        );
        await collection.createIndex({ updatedAt: -1 }, { background: true });
      } catch (indexError) {
        // Index mungkin sudah ada, abaikan error
        console.log("   ℹ️ Indexes already exist or error creating:", (indexError as Error).message);
      }

      console.log(
        `   ✓ MongoDB: ${result.upsertedCount} inserted, ${result.modifiedCount} updated`
      );

      return {
        saved: true,
        documentsCount: result.upsertedCount + result.modifiedCount,
        collection: collectionName,
        inserted: result.upsertedCount,
        updated: result.modifiedCount,
      };
    }

    return { saved: false, documentsCount: 0 };
  } catch (dbError) {
    console.error("   ❌ MongoDB error:", (dbError as Error).message);
    return {
      saved: false,
      documentsCount: 0,
      error: (dbError as Error).message,
    };
  }
}


/**
 * Fungsi utama untuk mengambil dan menyimpan data history semua lokasi
 */
async function fetchAndSaveAllLocationsHistory(daysBack: number = 7) {
  console.log(`\n📊 Starting history fetch for all locations...`);
  console.log(`   Days back: ${daysBack}`);

  let mongoClient: MongoClient | null = null;
  let db: import("mongodb").Db | null = null;

  try {
    const locations = await getPumpLocations();
    console.log(`   Total locations: ${locations.length}`);

    const results = [];
    const endDate = format(new Date(), "yyyy-MM-dd");
    const startDate = format(subDays(new Date(), daysBack), "yyyy-MM-dd");

    console.log(`   Date range: ${startDate} to ${endDate}\n`);

    // ✅ Connect to MongoDB ONCE for all locations
    if (MONGODB_ENABLED && MONGODB_URI) {
      try {
        console.log(`   🔌 [DB] Connecting to MongoDB...`);
        mongoClient = new MongoClient(MONGODB_URI, {
          serverApi: {
            version: ServerApiVersion.v1,
            strict: false,
            deprecationErrors: true,
          },
          connectTimeoutMS: 10000,
          serverSelectionTimeoutMS: 10000,
        });
        await mongoClient.connect();
        db = mongoClient.db(DB_NAME);
        console.log(`   [DB] MongoDB connected to database: ${DB_NAME}\n`);
      } catch (dbError) {
        console.error("   ❌ [DB] MongoDB connection failed:", dbError);
        console.warn("   [DB] Will continue without saving to database");
        db = null;
      }
    } else {
      console.warn("   [DB] MONGODB_URI not found. Data will not be saved.");
    }

    for (let i = 0; i < locations.length; i++) {
      const location = locations[i];
      console.log(`[${i + 1}/${locations.length}] Processing: ${location.name}`);

      try {
        // Ambil data dari Open-Meteo
        console.log(`   🌐 Fetching from Open-Meteo...`);
        const historyData = await fetchRainfallHistory(
          location.lat,
          location.lng,
          startDate,
          endDate
        );

        const dataPoints = historyData.hourly.time.length;
        console.log(`   ✓ Received ${dataPoints} data points`);

        // Simpan ke MongoDB (menggunakan koneksi yang sudah ada)
        console.log(`   💾 Saving to MongoDB...`);
        const saveResult = await saveToMongoDB(
          db,
          location.name,
          location.lat,
          location.lng,
          startDate,
          endDate,
          historyData
        );

        if (saveResult.saved) {
          console.log(`   ✓ Saved ${saveResult.documentsCount} documents to collection: ${saveResult.collection}`);
        } else {
          console.log(`   ⚠️ Not saved to MongoDB`);
        }

        results.push({
          location: location.name,
          success: true,
          dataPoints: dataPoints,
          savedToDb: saveResult.saved,
          documentsCount: saveResult.documentsCount,
          collection: saveResult.collection,
        });

        console.log(`   ✅ Completed\n`);

        // Delay kecil untuk menghindari rate limiting
        if (i < locations.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }
      } catch (error) {
        console.error(`   ❌ Error: ${(error as Error).message}\n`);
        results.push({
          location: location.name,
          success: false,
          error: (error as Error).message,
        });
      }
    }

    return {
      success: true,
      totalLocations: locations.length,
      successCount: results.filter((r) => r.success).length,
      failedCount: results.filter((r) => !r.success).length,
      results: results,
    };
  } catch (error) {
    console.error("❌ Fatal error in fetchAndSaveAllLocationsHistory:", error);
    throw error;
  } finally {
    // ✅ Close connection ONCE at the end
    if (mongoClient) {
      try {
        await mongoClient.close();
        console.log("\n   🔌 [DB] MongoDB connection closed.");
      } catch (closeError) {
        console.warn("   ⚠️ [DB] Error closing MongoDB connection:", closeError);
      }
    }
  }
}

/**
 * Start automatic history data collection
 * @param schedule - Cron expression (default: every day at midnight "0 0 * * *")
 * @param daysBack - Number of days to fetch (default: 7)
 */
export function startHistoryCronJob(
  schedule: string = "0 0 * * *",
  daysBack: number = 7
) {
  if (isRunning) {
    console.log("⚠️ History cron job already running");
    return;
  }

  if (!MONGODB_ENABLED) {
    console.error("❌ Cannot start cron job: MONGODB_URI not configured");
    return;
  }

  console.log("\n🚀 Starting rainfall history cron job...");
  console.log(`   Schedule: ${schedule}`);
  console.log(`   Days back: ${daysBack}`);
  console.log(`   Database: ${DB_NAME}`);
  console.log(`   Next run: ${getNextRunTime(schedule)}\n`);

  cronJob = cron.schedule(schedule, async () => {
    const startTime = Date.now();
    console.log("\n⏰ Cron job triggered:", new Date().toLocaleString("id-ID"));
    console.log("━".repeat(60));

    try {
      const result = await fetchAndSaveAllLocationsHistory(daysBack);

      const duration = Date.now() - startTime;
      console.log("\n" + "━".repeat(60));
      console.log("📊 Summary:");
      console.log(`   Total locations: ${result.totalLocations}`);
      console.log(`   ✅ Success: ${result.successCount}`);
      console.log(`   ❌ Failed: ${result.failedCount}`);
      console.log(`   ⏱️ Duration: ${(duration / 1000).toFixed(2)}s`);
      console.log("━".repeat(60));

      // Update stats
      successCount++;
      lastRunStats = {
        success: true,
        timestamp: new Date().toISOString(),
        duration: duration,
        totalLocations: result.totalLocations,
        successCount: result.successCount,
        failedCount: result.failedCount,
        results: result.results,
      };

      console.log("✅ Cron job completed successfully\n");
    } catch (error) {
      errorCount++;
      const duration = Date.now() - startTime;

      console.error("\n" + "━".repeat(60));
      console.error("❌ Cron job failed:", error);

      if (error instanceof Error) {
        console.error("   Name:", error.name);
        console.error("   Message:", error.message);
        if (error.stack) {
          console.error("   Stack trace (top 5 lines):");
          error.stack
            .split("\n")
            .slice(0, 5)
            .forEach((line) => {
              console.error("      ", line.trim());
            });
        }
      }

      console.error(`   ⏱️ Failed after: ${(duration / 1000).toFixed(2)}s`);
      console.error(`   📊 Error count: ${errorCount}/${successCount + errorCount} total runs`);
      console.error("━".repeat(60) + "\n");

      // Update stats
      lastRunStats = {
        success: false,
        timestamp: new Date().toISOString(),
        duration: duration,
        error:
          error instanceof Error
            ? {
                name: error.name,
                message: error.message,
              }
            : String(error),
      };
    }
  });

  isRunning = true;
  successCount = 0;
  errorCount = 0;

  console.log("✅ History cron job started successfully");
  console.log("   Use stopHistoryCronJob() to stop\n");
}

/**
 * Stop the history cron job
 */
export function stopHistoryCronJob() {
  if (cronJob) {
    cronJob.stop();
    cronJob = null;
    isRunning = false;
    console.log("🛑 History cron job stopped");
    console.log(`   Final stats: ${successCount} successes, ${errorCount} errors`);
  } else {
    console.log("⚠️ No history cron job running");
  }
}

/**
 * Get history cron job status
 */
export function getHistoryCronJobStatus() {
  return {
    isRunning,
    hasJob: cronJob !== null,
    lastRun: lastRunStats,
    mongodbEnabled: MONGODB_ENABLED,
    database: DB_NAME,
    statistics: {
      successCount,
      errorCount,
      totalRuns: successCount + errorCount,
      successRate:
        successCount + errorCount > 0
          ? ((successCount / (successCount + errorCount)) * 100).toFixed(2) + "%"
          : "N/A",
    },
  };
}

/**
 * Restart cron job with new settings
 */
export function restartHistoryCronJob(schedule: string, daysBack: number) {
  console.log("🔄 Restarting history cron job with new settings...");
  console.log(`   New schedule: ${schedule}`);
  console.log(`   New days back: ${daysBack}`);

  stopHistoryCronJob();

  // Small delay to ensure clean restart
  setTimeout(() => {
    startHistoryCronJob(schedule, daysBack);
  }, 1000);
}

/**
 * Get last run statistics
 */
export function getLastRunStats() {
  return lastRunStats;
}

/**
 * Reset error counter
 */
export function resetErrorCount() {
  errorCount = 0;
  successCount = 0;
  console.log("🔄 Statistics reset");
}

/**
 * Manual trigger - run fetch immediately
 */
export async function triggerManualFetch(daysBack: number = 7) {
  console.log("\n🔧 Manual trigger started...");
  const startTime = Date.now();

  try {
    const result = await fetchAndSaveAllLocationsHistory(daysBack);
    const duration = Date.now() - startTime;

    console.log("\n📊 Manual fetch completed:");
    console.log(`   Success: ${result.successCount}/${result.totalLocations}`);
    console.log(`   Duration: ${(duration / 1000).toFixed(2)}s\n`);

    return result;
  } catch (error) {
    console.error("❌ Manual fetch failed:", error);
    throw error;
  }
}

/**
 * Helper function to get next run time
 */
function getNextRunTime(schedule: string): string {
  try {
    const schedulePattern = cron.validate(schedule);
    if (!schedulePattern) {
      return "Invalid schedule";
    }

    // Simple estimation untuk schedule umum
    if (schedule === "0 0 * * *") {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);
      return tomorrow.toLocaleString("id-ID");
    }

    return "According to schedule: " + schedule;
  } catch {
    return "Unable to calculate";
  }
}
