import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  startHistoryCronJob,
  stopHistoryCronJob,
  getHistoryCronJobStatus,
  restartHistoryCronJob,
  getLastRunStats,
  resetErrorCount,
  triggerManualFetch,
} from "@/lib/history-cron-service";

/**
 * GET - Get cron job status
 */
export async function GET(request: NextRequest) {
  try {
    const status = getHistoryCronJobStatus();
    return NextResponse.json({
      success: true,
      status,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: (error as Error).message,
      },
      { status: 500 }
    );
  }
}

/**
 * POST - Control cron job (start, stop, restart, trigger)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, schedule, daysBack } = body;

    switch (action) {
      case "start":
        const startSchedule = schedule || "0 0 * * *";
        const startDaysBack = daysBack || 7;
        startHistoryCronJob(startSchedule, startDaysBack);
        return NextResponse.json({
          success: true,
          message: "History cron job started",
          status: getHistoryCronJobStatus(),
        });

      case "stop":
        stopHistoryCronJob();
        return NextResponse.json({
          success: true,
          message: "History cron job stopped",
          status: getHistoryCronJobStatus(),
        });

      case "restart":
        const restartSchedule = schedule || "0 0 * * *";
        const restartDaysBack = daysBack || 7;
        restartHistoryCronJob(restartSchedule, restartDaysBack);
        return NextResponse.json({
          success: true,
          message: "History cron job restarted with new settings",
          status: getHistoryCronJobStatus(),
        });

      case "trigger":
        const triggerDaysBack = daysBack || 7;
        const result = await triggerManualFetch(triggerDaysBack);
        return NextResponse.json({
          success: true,
          message: "Manual fetch completed",
          result,
        });

      case "reset":
        resetErrorCount();
        return NextResponse.json({
          success: true,
          message: "Error count reset",
          status: getHistoryCronJobStatus(),
        });

      case "stats":
        const stats = getLastRunStats();
        return NextResponse.json({
          success: true,
          stats,
        });

      default:
        return NextResponse.json(
          {
            success: false,
            message: "Invalid action. Valid actions: start, stop, restart, trigger, reset, stats",
          },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("Error in /api/history-control:", error);
    return NextResponse.json(
      {
        success: false,
        error: (error as Error).message,
      },
      { status: 500 }
    );
  }
}
