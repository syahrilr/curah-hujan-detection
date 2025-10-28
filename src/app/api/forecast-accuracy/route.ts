import { NextRequest, NextResponse } from "next/server";
import {
  saveForecastRecord,
  verifyForecasts,
  calculateAccuracyMetrics,
  getHistoricalAccuracy,
} from "@/lib/forecast-accuracy";

/**
 * POST /api/forecast-accuracy
 * Save forecast record untuk verification nanti
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const { locationName, latitude, longitude, forecasts } = body;

    if (!locationName || !latitude || !longitude || !Array.isArray(forecasts)) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing required fields",
          details: "locationName, latitude, longitude, and forecasts array are required",
        },
        { status: 400 }
      );
    }

    // Save semua forecast records
    const results = await Promise.allSettled(
      forecasts.map((f: any) =>
        saveForecastRecord(locationName, latitude, longitude, {
          targetTime: f.time,
          precipitation: f.precipitation,
          probability: f.probability,
          weatherCode: f.weatherCode || 0,
        })
      )
    );

    const saved = results.filter((r) => r.status === "fulfilled" && r.value === true).length;
    const failed = results.length - saved;

    return NextResponse.json({
      success: true,
      message: "Forecast records saved",
      saved,
      failed,
      total: forecasts.length,
    });
  } catch (error: any) {
    console.error("Failed to save forecast records:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to save forecast records",
        details: error.message,
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/forecast-accuracy
 * Actions:
 * - verify: Verify forecasts dengan actual data
 * - calculate: Calculate accuracy metrics
 * - history: Get historical accuracy
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action");

    // ====== ACTION: VERIFY FORECASTS ======
    if (action === "verify") {
      const startDate = searchParams.get("startDate");
      const endDate = searchParams.get("endDate");

      if (!startDate || !endDate) {
        return NextResponse.json(
          {
            success: false,
            error: "Missing required parameters",
            details: "startDate and endDate are required",
          },
          { status: 400 }
        );
      }

      const result = await verifyForecasts(new Date(startDate), new Date(endDate));

      return NextResponse.json({
        success: true,
        action: "verify",
        result,
        message: `Verified ${result.verified} forecasts, ${result.failed} failed`,
      });
    }

    // ====== ACTION: CALCULATE METRICS ======
    if (action === "calculate") {
      const locationName = searchParams.get("locationName");
      const startDate = searchParams.get("startDate");
      const endDate = searchParams.get("endDate");

      if (!locationName || !startDate || !endDate) {
        return NextResponse.json(
          {
            success: false,
            error: "Missing required parameters",
            details: "locationName, startDate, and endDate are required",
          },
          { status: 400 }
        );
      }

      const metrics = await calculateAccuracyMetrics(
        locationName,
        new Date(startDate),
        new Date(endDate)
      );

      if (!metrics) {
        return NextResponse.json(
          {
            success: false,
            error: "No verified forecasts found",
            details: `No data available for ${locationName} in the specified period`,
          },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        action: "calculate",
        metrics,
      });
    }

    // ====== ACTION: GET HISTORY ======
    if (action === "history") {
      const locationName = searchParams.get("locationName") || undefined;
      const limit = parseInt(searchParams.get("limit") || "10");

      const history = await getHistoricalAccuracy(locationName, limit);

      return NextResponse.json({
        success: true,
        action: "history",
        count: history.length,
        data: history,
      });
    }

    // ====== INVALID ACTION ======
    return NextResponse.json(
      {
        success: false,
        error: "Invalid action",
        details: "Valid actions: verify, calculate, history",
      },
      { status: 400 }
    );
  } catch (error: any) {
    console.error("Forecast accuracy API error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
        details: error.message,
      },
      { status: 500 }
    );
  }
}
