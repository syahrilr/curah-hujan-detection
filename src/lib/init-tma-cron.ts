import { startTMACronJob } from "./tma-cron-service";

export function initializeTMACronJob() {
  // Cek env var apakah fitur ini dienable
  // Default true jika tidak diset, atau sesuaikan kebutuhan
  const enableAutoStart = process.env.TMA_CRON_AUTO_START !== "false";

  if (!enableAutoStart) {
    console.log("   [INIT-TMA] Auto-start disabled in .env");
    return;
  }

  // Default tiap 5 menit
  const schedule = process.env.TMA_CRON_SCHEDULE || "*/5 * * * *";

  console.log("   [INIT-TMA] Initializing...");
  startTMACronJob(schedule);
}
