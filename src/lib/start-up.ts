import { initializeHistoryCronJob } from "./init-history-cron";
import { initializeForecastCronJob } from "./init-forecast-cron";

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
  // initializeCronJob(); // Your existing monitor cron

  // Initialize history data collection cron (daily backup)
  console.log("\n💾 2. History Data Collection Cron Job:");
  console.log("─".repeat(60));
  initializeHistoryCronJob();

  // Initialize forecast data collection cron (every 14 days)
  console.log("\n🌦️ 3. Forecast Data Collection Cron Job:");
  console.log("─".repeat(60));
  initializeForecastCronJob();

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
