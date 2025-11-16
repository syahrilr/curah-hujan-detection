import * as cron from "node-cron";
import { getHardcodedPumpLocations } from "./kml-parser";
import { MongoClient, ServerApiVersion } from "mongodb";
import { format, addDays } from "date-fns";

const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = "db-predict-ch";
const MONGODB_ENABLED = !!MONGODB_URI;

let cronJob: cron.ScheduledTask | null = null;
let isRunning = false;
let lastRunStats: any = null;
let errorCount = 0;
let successCount = 0;

// MongoDB Client
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
  return (
    "prediction_" +
    pumpName
      .toLowerCase()
      .replace(/\s+/g, "_")
      .replace(/[^a-z0-9_]/g, "")
  );
}

/**
 * Fetch forecast dari Open-Meteo API
 */
async function fetchForecastForPump(
  lat: number,
  lng: number
): Promise<OpenMeteoResponse> {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&hourly=temperature_2m,rain,precipitation,precipitation_probability&timezone=auto&forecast_days=16`;

  const response = await fetch(url, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch forecast: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Simpan forecast ke MongoDB dengan collection terpisah per pompa
 */
async function saveForecastToMongoDB(
  pumpName: string,
  pumpLat: number,
  pumpLng: number,
  forecastData: OpenMeteoResponse
): Promise<{ saved: boolean; collection?: string; error?: string }> {
  if (!MONGODB_ENABLED || !client) {
    console.log("   ⚠️ MongoDB disabled - data tidak disimpan");
    return { saved: false };
  }

  try {
    await client.connect();
    const db = client.db(DB_NAME);

    const collectionName = getCollectionName(pumpName);
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

    // Insert document
    await collection.insertOne(document);

    // Create indexes untuk optimasi query
    await collection.createIndex({ fetchedAt: -1 });
    await collection.createIndex({ forecastStartDate: 1 });
    await collection.createIndex({ forecastEndDate: 1 });

    return {
      saved: true,
      collection: collectionName,
    };
  } catch (dbError) {
    console.error("   ❌ MongoDB error:", (dbError as Error).message);
    return {
      saved: false,
      error: (dbError as Error).message,
    };
  } finally {
    try {
      await client.close();
    } catch (closeError) {
      console.warn("   ⚠️ Error closing MongoDB connection:", closeError);
    }
  }
}

/**
 * Cleanup old forecast data (older than 30 days)
 */
async function cleanupOldForecasts(): Promise<{
  success: boolean;
  deletedCount: number;
  collections: string[];
}> {
  if (!MONGODB_ENABLED || !client) {
    return { success: false, deletedCount: 0, collections: [] };
  }

  try {
    await client.connect();
    const db = client.db(DB_NAME);
    const locations = await getHardcodedPumpLocations();

    let totalDeleted = 0;
    const affectedCollections: string[] = [];

    // Delete forecasts older than 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    for (const location of locations) {
      try {
        const collectionName = getCollectionName(location.name);
        const collection = db.collection(collectionName);

        const result = await collection.deleteMany({
          fetchedAt: { $lt: thirtyDaysAgo },
        });

        if (result.deletedCount > 0) {
          totalDeleted += result.deletedCount;
          affectedCollections.push(collectionName);
        }
      } catch (error) {
        console.error(
          `   ⚠️ Cleanup failed for ${location.name}:`,
          (error as Error).message
        );
      }
    }

    return {
      success: true,
      deletedCount: totalDeleted,
      collections: affectedCollections,
    };
  } catch (error) {
    console.error("   ❌ Cleanup error:", (error as Error).message);
    return { success: false, deletedCount: 0, collections: [] };
  } finally {
    try {
      await client.close();
    } catch (closeError) {
      console.warn("   ⚠️ Error closing MongoDB connection:", closeError);
    }
  }
}

/**
 * Fungsi utama untuk mengambil dan menyimpan forecast semua lokasi
 */
async function fetchAndSaveAllForecastsData() {
  console.log(`\n🌦️ Starting forecast fetch for all pump stations...`);
  console.log(
    `   Forecast period: 16 days (${format(new Date(), "yyyy-MM-dd")} to ${format(addDays(new Date(), 16), "yyyy-MM-dd")})`
  );

  try {
    const locations = await getHardcodedPumpLocations();
    console.log(`   Total pump stations: ${locations.length}`);
    console.log(`   Database: ${DB_NAME}\n`);

    const results = [];

    for (let i = 0; i < locations.length; i++) {
      const location = locations[i];
      console.log(`[${i + 1}/${locations.length}] Processing: ${location.name}`);

      try {
        // Fetch dari Open-Meteo API
        console.log(`   🌍 Fetching 16-day forecast from Open-Meteo...`);
        const forecastData = await fetchForecastForPump(
          location.lat,
          location.lng
        );

        const dataPoints = forecastData.hourly.time.length;
        console.log(`   ✓ Received ${dataPoints} hourly data points`);

        // Simpan ke MongoDB
        console.log(`   💾 Saving to MongoDB...`);
        const saveResult = await saveForecastToMongoDB(
          location.name,
          location.lat,
          location.lng,
          forecastData
        );

        if (saveResult.saved) {
          console.log(
            `   ✓ Saved to collection: ${saveResult.collection}`
          );
        } else {
          console.log(`   ⚠️ Not saved to MongoDB`);
        }

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

        console.log(`   ✅ Completed\n`);

        // Delay untuk respect API rate limits
        if (i < locations.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
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

    // Cleanup old data setelah fetch selesai
    console.log(`\n🧹 Cleaning up old forecast data (>30 days)...`);
    const cleanupResult = await cleanupOldForecasts();
    if (cleanupResult.success && cleanupResult.deletedCount > 0) {
      console.log(
        `   ✓ Deleted ${cleanupResult.deletedCount} old forecast records`
      );
      console.log(`   ✓ Affected collections: ${cleanupResult.collections.length}`);
    } else {
      console.log(`   ℹ️ No old data to clean up`);
    }

    return {
      success: true,
      totalLocations: locations.length,
      successCount: results.filter((r) => r.success).length,
      failedCount: results.filter((r) => !r.success).length,
      results: results,
      cleanup: cleanupResult,
    };
  } catch (error) {
    console.error("❌ Fatal error in fetchAndSaveAllForecastsData:", error);
    throw error;
  }
}

/**
 * Start automatic forecast data collection
 * Default schedule: Setiap 14 hari sekali
 * @param schedule - Cron expression (default: "0 0 *\/14 * *" = setiap 14 hari at midnight)
 */
export function startForecastCronJob(schedule: string = "0 0 */14 * *") {
  if (isRunning) {
    console.log("⚠️ Forecast cron job already running");
    return;
  }

  if (!MONGODB_ENABLED) {
    console.error("❌ Cannot start cron job: MONGODB_URI not configured");
    return;
  }

  console.log("\n🚀 Starting forecast data collection cron job...");
  console.log(`   Schedule: ${schedule}`);
  console.log(`   Forecast period: 16 days`);
  console.log(`   Database: ${DB_NAME}`);
  console.log(`   Next run: ${getNextRunTime(schedule)}\n`);

  cronJob = cron.schedule(schedule, async () => {
    const startTime = Date.now();
    console.log("\n⏰ Forecast cron job triggered:", new Date().toLocaleString("id-ID"));
    console.log("━".repeat(60));

    try {
      const result = await fetchAndSaveAllForecastsData();

      const duration = Date.now() - startTime;
      console.log("\n" + "━".repeat(60));
      console.log("📊 Summary:");
      console.log(`   Total locations: ${result.totalLocations}`);
      console.log(`   ✅ Success: ${result.successCount}`);
      console.log(`   ❌ Failed: ${result.failedCount}`);
      console.log(
        `   🧹 Cleaned up: ${result.cleanup.deletedCount} old records`
      );
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
        cleanupDeleted: result.cleanup.deletedCount,
        results: result.results,
      };

      console.log("✅ Forecast cron job completed successfully\n");
    } catch (error) {
      errorCount++;
      const duration = Date.now() - startTime;

      console.error("\n" + "━".repeat(60));
      console.error("❌ Forecast cron job failed:", error);

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
      console.error(
        `   📊 Error count: ${errorCount}/${successCount + errorCount} total runs`
      );
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

  console.log("✅ Forecast cron job started successfully");
  console.log("   Use stopForecastCronJob() to stop\n");
}

/**
 * Stop the forecast cron job
 */
export function stopForecastCronJob() {
  if (cronJob) {
    cronJob.stop();
    cronJob = null;
    isRunning = false;
    console.log("🛑 Forecast cron job stopped");
    console.log(
      `   Final stats: ${successCount} successes, ${errorCount} errors`
    );
  } else {
    console.log("⚠️ No forecast cron job running");
  }
}

/**
 * Get forecast cron job status
 */
export function getForecastCronJobStatus() {
  return {
    isRunning,
    hasJob: cronJob !== null,
    lastRun: lastRunStats,
    mongodbEnabled: MONGODB_ENABLED,
    database: DB_NAME,
    schedule: "Every 14 days at midnight",
    forecastDays: 16,
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
  console.log("🔄 Restarting forecast cron job with new settings...");
  console.log(`   New schedule: ${schedule}`);

  stopForecastCronJob();

  // Small delay to ensure clean restart
  setTimeout(() => {
    startForecastCronJob(schedule);
  }, 1000);
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
  console.log("🔄 Forecast statistics reset");
}

/**
 * Manual trigger - run fetch immediately
 */
export async function triggerManualForecastFetch() {
  console.log("\n🔧 Manual forecast fetch started...");
  const startTime = Date.now();

  try {
    const result = await fetchAndSaveAllForecastsData();
    const duration = Date.now() - startTime;

    console.log("\n📊 Manual forecast fetch completed:");
    console.log(`   Success: ${result.successCount}/${result.totalLocations}`);
    console.log(`   Duration: ${(duration / 1000).toFixed(2)}s\n`);

    return result;
  } catch (error) {
    console.error("❌ Manual forecast fetch failed:", error);
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

    // Untuk schedule 14 hari
    if (schedule === "0 0 */14 * *") {
      const fourteenDays = new Date();
      fourteenDays.setDate(fourteenDays.getDate() + 14);
      fourteenDays.setHours(0, 0, 0, 0);
      return fourteenDays.toLocaleString("id-ID");
    }

    return "According to schedule: " + schedule;
  } catch {
    return "Unable to calculate";
  }
}
