import { startHistoryCronJob } from "./history-cron-service";

let isInitialized = false;

/**
 * Initialize automatic history data collection
 * Called on server startup
 */
export function initializeHistoryCronJob() {
  // Prevent multiple initialization
  if (isInitialized) {
    console.log("⚠️ History cron job already initialized");
    return;
  }

  // Only run if explicitly enabled
  const enableAutoStart = process.env.HISTORY_CRON_AUTO_START === "true";

  if (!enableAutoStart) {
    console.log("\nℹ️ History cron auto-start disabled");
    console.log("   Set HISTORY_CRON_AUTO_START=true in .env.local to enable");
    console.log("   Or use /api/history-control to start manually\n");
    return;
  }

  // Check if MongoDB is configured
  if (!process.env.MONGODB_URI) {
    console.error("\n❌ Cannot start history cron: MONGODB_URI not configured");
    console.error("   Please add MONGODB_URI to your .env.local file\n");
    return;
  }

  console.log("\n🤖 Auto-starting rainfall history collection cron job...");

  // Get settings from environment variables
  const schedule = process.env.HISTORY_CRON_SCHEDULE || "0 0 * * *"; // Default: daily at midnight
  const daysBack = parseInt(process.env.HISTORY_CRON_DAYS_BACK || "7"); // Default: 7 days

  console.log(`   Schedule: ${schedule}`);
  console.log(`   Days back: ${daysBack}`);

  startHistoryCronJob(schedule, daysBack);

  isInitialized = true;

  console.log("✅ History cron job initialized successfully");
  console.log("   You can control it via /api/history-control");
  console.log("   or directly call the functions in your code\n");
}

/**
 * Get initialization status
 */
export function isHistoryCronInitialized() {
  return isInitialized;
}
