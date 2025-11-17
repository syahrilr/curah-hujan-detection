import { NextResponse } from "next/server";
import {
  startForecastCronJob,
  stopForecastCronJob,
  getForecastCronJobStatus,
  restartForecastCronJob,
  getLastForecastRunStats,
  resetForecastErrorCount,
  triggerManualForecastFetch,
} from "@/lib/forecast-cron-service";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 minutes

/**
 * GET - Get forecast cron job status
 */
export async function GET() {
  console.log("\n--- [API] GET /api/forecast-control ---");
  try {
    const status = getForecastCronJobStatus();
    const lastRun = getLastForecastRunStats();

    console.log("   [API] Successfully retrieved status and last run data.");

    return NextResponse.json({
      success: true,
      status: status,
      lastRun: lastRun,
    });
  } catch (error) {
    console.error("❌ [API] Error in GET /api/forecast-control:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * POST - Control forecast cron job (start/stop/restart/trigger)
 */
export async function POST(request: Request) {
  console.log("\n--- [API] POST /api/forecast-control ---");
  let action: string | undefined;

  try {
    const body = await request.json();
    action = body.action;
    const { schedule } = body;

    console.log(`   [API] Action received: ${action}, Schedule: ${schedule || "N/A"}`);

    switch (action) {
      case "start": {
        console.log("   [API] Executing action: start");
        const scheduleToUse = schedule || "0 0 */10 * *"; // Ganti default
        startForecastCronJob(scheduleToUse);

        console.log(`   [API] Action 'start' successful. Job started with schedule: ${scheduleToUse}`);
        return NextResponse.json({
          success: true,
          message: "Forecast cron job started",
          schedule: scheduleToUse,
        });
      }

      case "stop": {
        console.log("   [API] Executing action: stop");
        stopForecastCronJob();

        console.log("   [API] Action 'stop' successful. Job stopped.");
        return NextResponse.json({
          success: true,
          message: "Forecast cron job stopped",
        });
      }

      case "restart": {
        console.log("   [API] Executing action: restart");
        const scheduleToUse = schedule || "0 0 */10 * *"; // Ganti default
        restartForecastCronJob(scheduleToUse);

        console.log(`   [API] Action 'restart' successful. Job restarting with schedule: ${scheduleToUse}`);
        return NextResponse.json({
          success: true,
          message: "Forecast cron job restarted",
          schedule: scheduleToUse,
        });
      }

      case "trigger": {
        console.log("   [API] Executing action: trigger (Manual Fetch)");
        console.log("   [API] Calling triggerManualForecastFetch()... This may take a few minutes.");

        // ✅ SYNCHRONOUS VERSION - Wait until complete
        try {
          const result = await triggerManualForecastFetch();

          console.log(`   [API] Manual fetch completed. Success: ${result.successCount}/${result.totalLocations}`);
          return NextResponse.json({
            success: true,
            message: "Manual forecast fetch completed successfully",
            result: {
              totalLocations: result.totalLocations,
              successCount: result.successCount,
              failedCount: result.failedCount,
              // 🛑 Properti 'cleanup' sudah dihapus dari 'result'
              // cleanupDeleted: result.cleanup.deletedCount,
            }
          });
        } catch (error) {
          console.error("❌ [API] Manual forecast fetch failed:", error);
          return NextResponse.json(
            {
              success: false,
              error: error instanceof Error ? error.message : "Unknown error",
            },
            { status: 500 }
          );
        }
      }

      case "reset-stats": {
        console.log("   [API] Executing action: reset-stats");
        resetForecastErrorCount();

        console.log("   [API] Action 'reset-stats' successful.");
        return NextResponse.json({
          success: true,
          message: "Forecast statistics reset",
        });
      }

      case "status": {
        console.log("   [API] Executing action: status");
        const status = getForecastCronJobStatus();

        console.log("   [API] Action 'status' successful. Returning current status.");
        return NextResponse.json({
          success: true,
          status: status,
        });
      }

      default:
        console.warn(`   [API] Invalid action received: ${action}`);
        return NextResponse.json(
          {
            success: false,
            error: "Invalid action. Use: start, stop, restart, trigger, reset-stats, or status",
          },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error(`❌ [API] Error in POST /api/forecast-control (Action: ${action || 'unknown'}):`, error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
