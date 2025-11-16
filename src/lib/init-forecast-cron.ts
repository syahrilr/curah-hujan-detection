import { startForecastCronJob } from "./forecast-cron-service";

let isInitialized = false;

/**
 * Initialize automatic forecast data collection
 * Called on server startup
 */
export function initializeForecastCronJob() {
  // Prevent multiple initialization
  if (isInitialized) {
    console.log("⚠️ Forecast cron job already initialized");
    return;
  }

  // Only run if explicitly enabled
  const enableAutoStart = process.env.FORECAST_CRON_AUTO_START === "true";

  if (!enableAutoStart) {
    console.log("\nℹ️ Forecast cron auto-start disabled");
    console.log("   Set FORECAST_CRON_AUTO_START=true in .env.local to enable");
    console.log("   Or use /api/forecast-control to start manually\n");
    return;
  }

  // Check if MongoDB is configured
  if (!process.env.MONGODB_URI) {
    console.error("\n❌ Cannot start forecast cron: MONGODB_URI not configured");
    console.error("   Please add MONGODB_URI to your .env.local file\n");
    return;
  }

  console.log("\n🤖 Auto-starting forecast data collection cron job...");

  // Get schedule from environment or use default (every 14 days)
  const schedule = process.env.FORECAST_CRON_SCHEDULE || "0 0 */14 * *";

  console.log(`   Schedule: ${schedule}`);
  console.log(`   Forecast period: 16 days ahead`);
  console.log(`   Collection interval: Every 14 days (2 days overlap)`);

  startForecastCronJob(schedule);

  isInitialized = true;

  console.log("✅ Forecast cron job initialized successfully");
  console.log("   You can control it via /api/forecast-control");
  console.log("   or directly call the functions in your code\n");
}

/**
 * Get initialization status
 */
export function isForecastCronInitialized() {
  return isInitialized;
}
