import { initializeHistoryCronJob } from "./init-history-cron";

let isStartupComplete = false;

export function initializeServerStartup() {
  if (isStartupComplete) {
    return;
  }

  console.log("\n" + "=".repeat(60));
  console.log("🚀 SERVER STARTUP INITIALIZATION");
  console.log("=".repeat(60));

  // Initialize rainfall monitoring cron (real-time alerts)
  console.log("\n📡 1. Rainfall Monitoring Cron Job:");
  console.log("─".repeat(60));
//   initializeCronJob();

  // Initialize history data collection cron (daily backup)
  console.log("\n💾 2. History Data Collection Cron Job:");
  console.log("─".repeat(60));
  initializeHistoryCronJob();

  console.log("=".repeat(60));
  console.log("✅ SERVER STARTUP COMPLETE");
  console.log("=".repeat(60) + "\n");

  isStartupComplete = true;
}

/**
 * Get startup status
 */
export function isStartupInitialized() {
  return isStartupComplete;
}
