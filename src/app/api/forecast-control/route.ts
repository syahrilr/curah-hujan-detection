import * as cron from "node-cron";
import { getHardcodedPumpLocations } from "@/lib/kml-parser";
import { MongoClient, ServerApiVersion, Db } from "mongodb";
import { format, addDays } from "date-fns";

const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = "db-predict-ch";
const MONGODB_ENABLED = !!MONGODB_URI;

// Configuration
const API_DELAY_MS = 1500; // 1.5 seconds between API calls
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 5000;

// Global state
let cronJob: cron.ScheduledTask | null = null;
let isRunning = false;
let lastRunStats: any = null;
let errorCount = 0;
let successCount = 0;

// 🛑 FUNGSI INDEXING DIHAPUS SEMUA 🛑
// const indexedCollections = new Set<string>();
// async function ensureCollectionIndexes(...) { ... }
// async function initializeAllIndexes(...) { ... }

interface OpenMeteoResponse {
  latitude: number;
  longitude: number;
  timezone: string;
  elevation: number;
  hourly: {
    time: string[];
    temperature_2m: number[];
    rain: number[];
    precipitation: number[];
    precipitation_probability: number[];
  };
}

interface ForecastDocument {
  pumpName: string;
  pumpLat: number;
  pumpLng: number;
  latitude: number;
  longitude: number;
  timezone: string;
  elevation: number;
  hourly: {
    time: string[];
    temperature_2m: number[];
    rain: number[];
    precipitation: number[];
    precipitation_probability: number[];
  };
  fetchedAt: Date;
  forecastStartDate: Date;
  forecastEndDate: Date;
  forecastDays: number;
  dataPoints: number;
}

/**
 * Helper untuk membuat nama collection dari nama pompa
 */
function getCollectionName(pumpName: string): string {
  const collectionName =
    "prediction_" +
    pumpName
      .toLowerCase()
      .replace(/\s+/g, "_")
      .replace(/[^a-z0-9_]/g, "");
  return collectionName;
}

/**
 * Fetch forecast dari Open-Meteo API dengan retry mechanism
 */
async function fetchForecastForPump(
  lat: number,
  lng: number,
  retries = MAX_RETRIES
): Promise<OpenMeteoResponse> {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&hourly=temperature_2m,rain,precipitation,precipitation_probability&timezone=auto&forecast_days=16`;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(
        `      [API] Attempt ${attempt}/${retries}: Fetching from Open-Meteo...`
      );
      const response = await fetch(url, {
        cache: "no-store",
        signal: AbortSignal.timeout(15000), // 15 detik timeout
      });

      if (!response.ok) {
        throw new Error(
          `HTTP ${response.status}: ${response.statusText} for URL: ${url}`
        );
      }

      console.log(`      [API] Attempt ${attempt} successful.`);
      return await response.json();
    } catch (error) {
      const isLastAttempt = attempt === retries;
      console.warn(
        `      [API] Attempt ${attempt}/${retries} failed: ${
          (error as Error).message
        }`
      );

      if (isLastAttempt) {
        console.error(
          `   ❌ [API] Fetch failed after ${retries} attempts.`
        );
        throw error; // Lempar error setelah percobaan terakhir
      }

      console.warn(
        `      [API] Retrying in ${RETRY_DELAY_MS / 1000}s...`
      );
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    }
  }

  // This should be unreachable
  throw new Error("Unexpected error in fetchForecastForPump");
}

/**
 * 🛑 FUNGSI INDEXING DIHAPUS SEMUA 🛑
 */

/**
 * Menyimpan forecast ke MongoDB
 */
async function saveForecastToMongoDBOptimized(
  db: Db | null,
  pumpName: string,
  pumpLat: number,
  pumpLng: number,
  forecastData: OpenMeteoResponse
): Promise<{ saved: boolean; collection?: string; error?: string }> {
  if (!db) {
    console.warn("   [DB] MongoDB disabled - data tidak disimpan");
    return { saved: false };
  }

  const collectionName = getCollectionName(pumpName);

  try {
    const collection = db.collection<ForecastDocument>(collectionName);

    // Prepare document
    const document: ForecastDocument = {
      pumpName: pumpName,
      pumpLat: pumpLat,
      pumpLng: pumpLng,
      latitude: forecastData.latitude,
      longitude: forecastData.longitude,
      timezone: forecastData.timezone,
      elevation: forecastData.elevation,
      hourly: forecastData.hourly,
      fetchedAt: new Date(),
      forecastStartDate: new Date(forecastData.hourly.time[0]),
      forecastEndDate: new Date(
        forecastData.hourly.time[forecastData.hourly.time.length - 1]
      ),
      forecastDays: 16,
      dataPoints: forecastData.hourly.time.length,
    };

    // ✅ Only insert - NO index creation here
    console.log(`      [DB] Saving document to collection: ${collectionName}`);
    const result = await collection.insertOne(document);
    console.log(
      `      [DB] Document inserted successfully. ID: ${result.insertedId}`
    );

    return {
      saved: true,
      collection: collectionName,
    };
  } catch (dbError) {
    console.error(
      `   ❌ [DB] Error saving to ${collectionName}:`,
      (dbError as Error).message
    );
    return {
      saved: false,
      error: (dbError as Error).message,
    };
  }
}

/**
 * 🛑 FUNGSI CLEANUP DIHAPUS (Sesuai permintaan) 🛑
 */
// async function cleanupOldForecastsOptimized( ... ) { ... }


/**
 * ✅ FUNGSI UTAMA
 * Fungsi ini sekarang TIDAK lagi memanggil initializeAllIndexes
 */
async function fetchAndSaveAllForecastsData() {
  console.log(`\n🌦️ [MAIN] Starting forecast fetch for all pump stations...`);
  console.log(
    `   [MAIN] Forecast period: 16 days (${format(
      new Date(),
      "yyyy-MM-dd"
    )} to ${format(addDays(new Date(), 16), "yyyy-MM-dd")})`
  );

  let client: MongoClient | null = null;
  let db: Db | null = null;

  try {
    const locations = await getHardcodedPumpLocations();
    console.log(`   [MAIN] Total pump stations: ${locations.length}`);
    console.log(`   [MAIN] Database: ${DB_NAME}\n`);

    // ✅ Connect to MongoDB ONCE
    if (MONGODB_ENABLED && MONGODB_URI) {
      try {
        console.log(`   🔌 [DB] Connecting to MongoDB...`);
        client = new MongoClient(MONGODB_URI, {
          serverApi: {
            version: ServerApiVersion.v1,
            strict: true,
            deprecationErrors: true,
          },
          connectTimeoutMS: 10000,
          serverSelectionTimeoutMS: 10000,
        });

        await client.connect();
        await client.db("admin").command({ ping: 1 });

        db = client.db(DB_NAME);
        console.info(`   [DB] MongoDB connected to database: ${DB_NAME}\n`);

        // 🛑 PANGGILAN UNTUK INDEXING DI AWAL SUDAH DIHAPUS 🛑

      } catch (dbError) {
        console.error("   ❌ [DB] MongoDB connection failed:", dbError);
        // Jangan lanjutkan jika DB gagal konek
        throw new Error(`MongoDB connection failed: ${(dbError as Error).message}`);
      }
    } else {
      console.warn(
        "   [DB] MONGODB_URI not found. Running in-memory (no data will be saved)."
      );
    }

    const results = [];
    console.log(`\n--- [START] Processing ${locations.length} stations ---`);

    // Process each location
    for (let i = 0; i < locations.length; i++) {
      const location = locations[i];
      console.log(
        `\n--- [${i + 1}/${
          locations.length
        }] Processing: ${location.name} (Lat: ${location.lat}, Lng: ${
          location.lng
        }) ---`
      );

      try {
        // Fetch from Open-Meteo API
        const forecastData = await fetchForecastForPump(
          location.lat,
          location.lng
        );

        const dataPoints = forecastData.hourly.time.length;
        console.log(`      [API] Received ${dataPoints} hourly data points`);

        // Save to MongoDB (fast - no index creation)
        const saveResult = await saveForecastToMongoDBOptimized(
          db,
          location.name,
          location.lat,
          location.lng,
          forecastData
        );

        // 🛑 PANGGILAN UNTUK BACKGROUND INDEXING SUDAH DIHAPUS 🛑

        //
        // 🐞 BUG FIX: Ini adalah data push yang benar untuk blok TRY
        //
        results.push({
          location: location.name,
          success: true,
          dataPoints: dataPoints,
          savedToDb: saveResult.saved,
          collection: saveResult.collection,
          forecastStart: forecastData.hourly.time[0],
          forecastEnd:
            forecastData.hourly.time[forecastData.hourly.time.length - 1],
        });

        console.log(`   [MAIN] Successfully processed ${location.name}`);

        // Rate limiting: delay between requests
        if (i < locations.length - 1) {
          console.log(`      [SYSTEM] Waiting ${API_DELAY_MS}ms...`);
          await new Promise((resolve) => setTimeout(resolve, API_DELAY_MS));
        }

      } catch (error) {
        // Ini adalah blok CATCH
        console.error(
          `   ❌ [MAIN] Failed to process ${location.name}: ${
            (error as Error).message
          }`
        );
        results.push({
          location: location.name,
          success: false,
          error: (error as Error).message,
        });

        // Jika terjadi error, beri jeda juga sebelum mencoba stasiun berikutnya.
        if (i < locations.length - 1) {
          console.warn(`      [SYSTEM] Error occurred. Waiting ${API_DELAY_MS}ms before next station...`);
          await new Promise((resolve) => setTimeout(resolve, API_DELAY_MS));
        }
      }
    }

    console.log(`\n--- [END] Finished processing all stations ---`);

    // 🛑 PANGGILAN CLEANUP DIHAPUS (Sesuai permintaan) 🛑
    // const cleanupResult = await cleanupOldForecastsOptimized(db);

    return {
      success: true,
      totalLocations: locations.length,
      successCount: results.filter((r) => r.success).length,
      failedCount: results.filter((r) => !r.success).length,
      results: results,
      // 🛑 cleanupResult dihapus dari return
      // cleanup: cleanupResult,
    };
  } catch (error) {
    console.error("❌ [MAIN] Fatal error in fetchAndSaveAllForecastsData:", error);
    throw error;
  } finally {
    // ✅ Close connection ONCE at the end
    if (client) {
      try {
        await client.close();
        console.log("\n   🔌 [DB] MongoDB connection closed.");
      } catch (closeError) {
        console.warn("   ⚠️ [DB] Error closing MongoDB connection:", closeError);
      }
    }
  }
}

/**
 * Start automatic forecast data collection
 * Default schedule: Every 14 days at midnight
 */
export function startForecastCronJob(schedule: string = "0 0 */14 * *") {
  if (isRunning) {
    console.warn("⚠️ [CRON] Forecast cron job already running");
    return;
  }

  if (!MONGODB_ENABLED) {
    console.error("❌ [CRON] Cannot start cron job: MONGODB_URI not configured");
    return;
  }

  if (!cron.validate(schedule)) {
    console.error(`❌ [CRON] Invalid cron schedule: ${schedule}`);
    return;
  }

  console.log("\n🚀 [CRON] Starting forecast data collection cron job...");
  console.log(`   [CRON] Schedule: ${schedule}`);
  console.log(`   [CRON] Forecast period: 16 days`);
  console.log(`   [CRON] Database: ${DB_NAME}`);
  console.log(`   [CRON] API delay: ${API_DELAY_MS}ms between requests`);
  console.log(`   [CRON] Max retries: ${MAX_RETRIES}\n`);

  cronJob = cron.schedule(schedule, async () => {
    const startTime = Date.now();
    console.log(
      `\n⏰ [CRON] Job triggered at: ${new Date().toLocaleString("id-ID")}`
    );
    console.log("═".repeat(60));
    console.log(`   [CRON] Calling fetchAndSaveAllForecastsData...`);

    try {
      const result = await fetchAndSaveAllForecastsData();

      const duration = Date.now() - startTime;
      console.log("\n" + "═".repeat(60));
      console.log("📊 [CRON] Summary:");
      console.log(`   [CRON] Total locations: ${result.totalLocations}`);
      console.log(`   [CRON] ✅ Success: ${result.successCount}`);
      console.log(`   [CRON] ❌ Failed: ${result.failedCount}`);
      // 🛑 Log Cleanup dihapus
      // console.log(
      //   `   [CRON] 🧹 Cleaned up: ${result.cleanup.deletedCount} old records`
      // );
      console.log(`   [CRON] ⏱️ Duration: ${(duration / 1000).toFixed(2)}s`);
      console.log("═".repeat(60));

      successCount++;
      lastRunStats = {
        success: true,
        timestamp: new Date().toISOString(),
        duration: duration,
        totalLocations: result.totalLocations,
        successCount: result.successCount,
        failedCount: result.failedCount,
        // 🛑 Properti Cleanup dihapus
        // cleanupDeleted: result.cleanup.deletedCount,
        results: result.results,
      };

      console.log("✅ [CRON] Job completed successfully\n");
    } catch (error) {
      errorCount++;
      const duration = Date.now() - startTime;

      console.error("\n" + "═".repeat(60));
      console.error("❌ [CRON] Job failed:", error);

      if (error instanceof Error) {
        console.error("   [CRON] Name:", error.name);
        console.error("   [CRON] Message:", error.message);
        if (error.stack) {
          console.error("   [CRON] Stack trace (top 5 lines):");
          error.stack
            .split("\n")
            .slice(0, 5)
            .forEach((line) => {
              console.error("      ", line.trim());
            });
        }
      }

      console.error(`   [CRON] ⏱️ Failed after: ${(duration / 1000).toFixed(2)}s`);
      console.error(
        `   [CRON] 📊 Error count: ${errorCount}/${
          successCount + errorCount
        } total runs`
      );
      console.error("═".repeat(60) + "\n");

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

  console.log("✅ [CRON] Job started successfully");
  console.log("   [CRON] Use stopForecastCronJob() to stop\n");
}

/**
 * Stop the forecast cron job
 */
export function stopForecastCronJob() {
  if (cronJob) {
    cronJob.stop();
    cronJob = null;
    isRunning = false;
    console.log("🛑 [CRON] Forecast cron job stopped.");
    console.log(
      `   [CRON] Final stats: ${successCount} successes, ${errorCount} errors`
    );
  } else {
    console.warn("⚠️ [CRON] No forecast cron job running to stop.");
  }
}

/**
 * Get forecast cron job status
 */
export function getForecastCronJobStatus() {
  // console.log("   [CRON] Getting cron job status..."); // Terlalu verbose
  return {
    isRunning,
    hasJob: cronJob !== null,
    lastRun: lastRunStats,
    mongodbEnabled: MONGODB_ENABLED,
    database: DB_NAME,
    schedule: "Every 14 days at midnight",
    forecastDays: 16,
    apiDelayMs: API_DELAY_MS,
    maxRetries: MAX_RETRIES,
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
export function restartForecastCronJob(schedule: string) {
  console.log("🔄 [CRON] Restarting forecast cron job with new settings...");
  console.log(`   [CRON] New schedule: ${schedule}`);

  stopForecastCronJob();

  setTimeout(() => {
    console.log("   [CRON] Calling startForecastCronJob() after restart delay...");
    startForecastCronJob(schedule);
  }, 1000); // Tunda 1 detik untuk memastikan stop selesai
}

/**
 * Get last run statistics
 */
export function getLastForecastRunStats() {
  return lastRunStats;
}

/**
 * Reset error counter
 */
export function resetForecastErrorCount() {
  errorCount = 0;
  successCount = 0;
  console.log("🔄 [CRON] Forecast statistics reset");
}

/**
 * Manual trigger - run fetch immediately
 */
export async function triggerManualForecastFetch() {
  console.log("\n🔧 [MANUAL] Manual forecast fetch triggered...");
  const startTime = Date.now();

  try {
    const result = await fetchAndSaveAllForecastsData();
    const duration = Date.now() - startTime;

    console.log("\n📊 [MANUAL] Manual forecast fetch completed:");
    console.log(`   [MANUAL] Success: ${result.successCount}/${result.totalLocations}`);
    console.log(`   [MANUAL] Duration: ${(duration / 1000).toFixed(2)}s\n`);

    // 🛑 Objek 'cleanup' tidak lagi ada di 'result'
    return result;
  } catch (error) {
    console.error("❌ [MANUAL] Manual forecast fetch failed:", error);
    throw error; // Lempar error agar API route bisa menangkapnya
  }
}
