import { startPompaSyncCronJob } from "@/lib/pompa-sync-cron-service";

let isInitialized = false;

export function initializePompaSyncCronJob() {
  if (isInitialized) return;

  const enableAutoStart = process.env.POMPA_CRON_AUTO_START !== "false";

  if (!enableAutoStart) {
    console.log("   [INIT-POMPA] Auto-start disabled in .env");
    return;
  }

  // Default: tiap 5 menit
  const schedule = process.env.POMPA_CRON_SCHEDULE || "*/5 * * * *";

  console.log(`   [INIT-POMPA] Initializing with schedule: ${schedule}`);
  startPompaSyncCronJob(schedule);
  isInitialized = true;
}
