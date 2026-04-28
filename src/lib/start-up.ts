import { initializeHistoryCronJob } from "./init-history-cron";
import { initializeForecastCronJob } from "./init-forecast-cron";
import { initializeTMACronJob } from "./init-tma-cron";
import { initializeRainfallCronJob } from "./init-curah-hujan-cron";
import { initializePompaSyncCronJob } from "./init-pompa-sync-cron";

let isStartupComplete = false;

export function initializeServerStartup() {
  // Mencegah inisialisasi ganda (karena HMR Next.js di development)
  if (isStartupComplete) {
    return;
  }

  console.log("\n" + "=".repeat(60));
  console.log("🚀 SERVER STARTUP INITIALIZATION");
  console.log("=".repeat(60));

  // 1. Initialize History Cron (Daily Backup)
  console.log("\n💾 1. History Data Collection Cron Job:");
  console.log("─".repeat(60));
  if (typeof initializeHistoryCronJob === 'function') initializeHistoryCronJob();

  // 2. Initialize Forecast Cron (Weather Prediction)
  console.log("\n🌦️ 2. Forecast Data Collection Cron Job:");
  console.log("─".repeat(60));
  if (typeof initializeForecastCronJob === 'function') initializeForecastCronJob();

  // 3. Initialize TMA Cron (Water Level Monitoring)
  console.log("\n🌊 3. TMA (Water Level) Monitoring Cron Job:");
  console.log("─".repeat(60));
  if (typeof initializeTMACronJob === 'function') initializeTMACronJob();

  // 4. Initialize Rainfall/Curah Hujan Cron (DSDA Rainfall Monitoring)
  console.log("\n🌧️ 4. Curah Hujan (DSDA Rainfall) Monitoring Cron Job:");
  console.log("─".repeat(60));
  if (typeof initializeRainfallCronJob === 'function') initializeRainfallCronJob();

  // 5. Initialize Pompa Sync Cron (Nearest Neighbor Mapping)
  console.log("\n🏗️ 5. Pompa Data Sync (Nearest Neighbor) Cron Job:");
  console.log("─".repeat(60));
  initializePompaSyncCronJob()

  console.log("=".repeat(60));
  console.log("✅ SERVER STARTUP COMPLETE");
  console.log("=".repeat(60) + "\n");

  isStartupComplete = true;
}

export function isStartupInitialized() {
  return isStartupComplete;
}
