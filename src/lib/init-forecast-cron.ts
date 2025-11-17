import { startForecastCronJob } from "./forecast-cron-service";

let isInitialized = false;

/**
 * Initialize automatic forecast data collection
 * Called on server startup
 */
export function initializeForecastCronJob() {
  // Prevent multiple initialization
  if (isInitialized) {
    console.log("⚠️ [INIT-Forecast] Forecast cron job already initialized. Skipping.");
    return;
  }

  console.log("\n🤖 [INIT-Forecast] Initializing Forecast Cron Job...");

  // Only run if explicitly enabled
  const enableAutoStart = process.env.FORECAST_CRON_AUTO_START === "true";

  if (!enableAutoStart) {
    console.log("   [INIT-Forecast] ℹ️ Auto-start disabled.");
    console.log("   [INIT-Forecast]    Set FORECAST_CRON_AUTO_START=true in .env.local to enable");
    console.log("   [INIT-Forecast]    Or use /api/forecast-control to start manually\n");
    isInitialized = true; // Tandai sebagai "initialized" meskipun tidak auto-start
    return;
  }

  console.log("   [INIT-Forecast] Auto-start is ENABLED.");

  // Check if MongoDB is configured
  if (!process.env.MONGODB_URI) {
    console.error("\n❌ [INIT-Forecast] Cannot start forecast cron: MONGODB_URI not configured");
    console.error("   [INIT-Forecast] Please add MONGODB_URI to your .env.local file\n");
    return; // Jangan set isInitialized ke true jika error
  }

  console.log("   [INIT-Forecast] MONGODB_URI found.");

  // Get schedule from environment or use default (every 10 days)
  const schedule = process.env.FORECAST_CRON_SCHEDULE || "0 0 */10 * *"; // Ganti default

  console.log(`   [INIT-Forecast] Schedule set to: ${schedule}`);
  console.log(`   [INIT-Forecast] Forecast period: 16 days ahead`);
  console.log(`   [INIT-Forecast] Collection interval: Every 10 days (6 days overlap)`); // Ganti teks log

  console.log("   [INIT-Forecast] Calling startForecastCronJob()...");
  startForecastCronJob(schedule);

  isInitialized = true;

  console.log("✅ [INIT-Forecast] Forecast cron job initialized and started successfully");
  console.log("   [INIT-Forecast] You can control it via /api/forecast-control\n");
}

/**
 * Get initialization status
 */
export function isForecastCronInitialized() {
  return isInitialized;
}
