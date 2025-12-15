import { registerCronJob } from '@/lib/cron-manager';
import { syncPompaData } from '@/lib/pompa-sync-service';

export function startPompaSyncCronJob(schedule: string) {
  const job = registerCronJob('pompa-sync', schedule, async () => {
    console.log(`[CRON-POMPA] Running sync... ${new Date().toISOString()}`);
    try {
      const result = await syncPompaData();
      console.log(`[CRON-POMPA] Success. Updated: ${result.summary.total_pompa} locations.`);
    } catch (error) {
      console.error('[CRON-POMPA] Failed:', error);
    }
  });

  // Start cron job (status running)
  job.start();
}
