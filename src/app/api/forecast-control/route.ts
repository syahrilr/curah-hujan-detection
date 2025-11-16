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

/**
 * GET - Get forecast cron job status
 */
export async function GET() {
  try {
    const status = getForecastCronJobStatus();
    const lastRun = getLastForecastRunStats();

    return NextResponse.json({
      success: true,
      status: status,
      lastRun: lastRun,
    });
  } catch (error) {
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
  try {
    const body = await request.json();
    const { action, schedule } = body;

    switch (action) {
      case "start": {
        const scheduleToUse = schedule || "0 0 */14 * *";
        startForecastCronJob(scheduleToUse);

        return NextResponse.json({
          success: true,
          message: "Forecast cron job started",
          schedule: scheduleToUse,
        });
      }

      case "stop": {
        stopForecastCronJob();
        return NextResponse.json({
          success: true,
          message: "Forecast cron job stopped",
        });
      }

      case "restart": {
        const scheduleToUse = schedule || "0 0 */14 * *";
        restartForecastCronJob(scheduleToUse);

        return NextResponse.json({
          success: true,
          message: "Forecast cron job restarted",
          schedule: scheduleToUse,
        });
      }

      case "trigger": {
        console.log("🔧 Manual forecast fetch triggered via API");

        // Run in background
        triggerManualForecastFetch()
          .then((result) => {
            console.log(
              `✅ Manual forecast fetch completed: ${result.successCount}/${result.totalLocations} successful`
            );
          })
          .catch((error) => {
            console.error("❌ Manual forecast fetch failed:", error);
          });

        return NextResponse.json({
          success: true,
          message:
            "Manual forecast fetch triggered. Check server logs for progress.",
        });
      }

      case "reset-stats": {
        resetForecastErrorCount();
        return NextResponse.json({
          success: true,
          message: "Forecast statistics reset",
        });
      }

      case "status": {
        const status = getForecastCronJobStatus();
        return NextResponse.json({
          success: true,
          status: status,
        });
      }

      default:
        return NextResponse.json(
          {
            success: false,
            error: "Invalid action. Use: start, stop, restart, trigger, reset-stats, or status",
          },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("Error in forecast-control API:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
