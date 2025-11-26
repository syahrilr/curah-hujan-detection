import { initializeHistoryCronJob } from "./init-history-cron";
import { initializeForecastCronJob } from "./init-forecast-cron";
import { initializeTMACronJob } from "./init-tma-cron";
import { initializeRainfallCronJob } from "./init-curah-hujan-cron";

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

  // 3. Initialize TMA Cron (Realtime Water Level)
  console.log("\n🌊 3. TMA Monitoring Cron Job:");
  console.log("─".repeat(60));
  initializeTMACronJob();

  // 4. Initialize Rainfall Cron (Realtime Rainfall)
  console.log("\n🌧️ 4. Curah Hujan Monitoring Cron Job:");
  console.log("─".repeat(60));
  initializeRainfallCronJob();

  console.log("=".repeat(60));
  console.log("✅ SERVER STARTUP COMPLETE");
  console.log("=".repeat(60) + "\n");

  isStartupComplete = true;
}

export function isStartupInitialized() {
  return isStartupComplete;
}
