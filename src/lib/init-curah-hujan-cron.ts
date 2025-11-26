import { startRainfallCronJob

 } from "./curah-hujan-cron-service";
export function initializeRainfallCronJob() {
  const enableAutoStart = process.env.RAINFALL_CRON_AUTO_START !== "false";

  if (!enableAutoStart) {
    console.log("   [INIT-RAINFALL] Auto-start disabled in .env");
    return;
  }

  // Default tiap 5 menit
  const schedule = process.env.RAINFALL_CRON_SCHEDULE || "*/5 * * * *";

  console.log("   [INIT-RAINFALL] Initializing...");
  startRainfallCronJob(schedule);
}
