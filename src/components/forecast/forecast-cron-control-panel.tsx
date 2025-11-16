"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Play,
  Square,
  RefreshCw,
  Clock,
  Activity,
  CheckCircle2,
  XCircle,
  Calendar,
  Database,
  Zap,
  TrendingUp,
  Info,
  CloudRain,
  BarChart3,
  Loader2,
} from "lucide-react";

interface CronStatus {
  isRunning: boolean;
  hasJob: boolean;
  mongodbEnabled: boolean;
  database: string;
  schedule: string;
  forecastDays: number;
  statistics: {
    successCount: number;
    errorCount: number;
    totalRuns: number;
    successRate: string;
  };
}

interface LastRun {
  success: boolean;
  timestamp: string;
  duration: number;
  totalLocations?: number;
  successCount?: number;
  failedCount?: number;
  cleanupDeleted?: number;
  error?: {
    name: string;
    message: string;
  };
}

export default function ForecastCronControlPanel() {
  const [status, setStatus] = useState<CronStatus | null>(null);
  const [lastRun, setLastRun] = useState<LastRun | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [schedule, setSchedule] = useState("0 0 */14 * *");
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  useEffect(() => {
    loadStatus();
    // Refresh status every 30 seconds
    const interval = setInterval(loadStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadStatus = async () => {
    try {
      const response = await fetch("/api/forecast-control");
      const data = await response.json();

      if (data.success) {
        setStatus(data.status);
        setLastRun(data.lastRun);
      }
    } catch (error) {
      console.error("Failed to load status:", error);
    }
  };

  const controlCron = async (action: string) => {
    setIsLoading(true);
    setMessage(null);

    try {
      const response = await fetch("/api/forecast-control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          schedule: action === "start" || action === "restart" ? schedule : undefined,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setMessage({ type: "success", text: data.message });
        await loadStatus();
      } else {
        setMessage({ type: "error", text: data.error || "Operation failed" });
      }
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  };

  if (!status) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center space-x-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            <p className="text-sm text-muted-foreground">Loading status...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Status Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <CloudRain className="h-5 w-5" />
                Forecast Cron Job Status
              </CardTitle>
              <CardDescription>
                Automatic 16-day forecast collection every 14 days
              </CardDescription>
            </div>
            <Badge
              variant={status.isRunning ? "default" : "secondary"}
              className="gap-2"
            >
              <Activity className="h-3 w-3" />
              {status.isRunning ? "Running" : "Stopped"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* System Info */}
          <div className="grid gap-4 md:grid-cols-4">
            <div className="flex items-center space-x-3 p-3 border rounded-lg">
              <Database className="h-8 w-8 text-blue-600" />
              <div>
                <p className="text-xs text-muted-foreground">Database</p>
                <p className="font-semibold">{status.database}</p>
              </div>
            </div>

            <div className="flex items-center space-x-3 p-3 border rounded-lg">
              <Calendar className="h-8 w-8 text-purple-600" />
              <div>
                <p className="text-xs text-muted-foreground">Forecast Days</p>
                <p className="font-semibold">{status.forecastDays} days</p>
              </div>
            </div>

            <div className="flex items-center space-x-3 p-3 border rounded-lg">
              <Clock className="h-8 w-8 text-orange-600" />
              <div>
                <p className="text-xs text-muted-foreground">Interval</p>
                <p className="font-semibold">Every 14 days</p>
              </div>
            </div>

            <div className="flex items-center space-x-3 p-3 border rounded-lg">
              <Zap className="h-8 w-8 text-green-600" />
              <div>
                <p className="text-xs text-muted-foreground">MongoDB</p>
                <p className="font-semibold">
                  {status.mongodbEnabled ? "Enabled" : "Disabled"}
                </p>
              </div>
            </div>
          </div>

          {/* Message Alert */}
          {message && (
            <Alert variant={message.type === "error" ? "destructive" : "default"}>
              {message.type === "success" ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <XCircle className="h-4 w-4" />
              )}
              <AlertDescription>{message.text}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Statistics Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Statistics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="p-4 border rounded-lg bg-green-50 dark:bg-green-950">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Success</p>
                  <p className="text-2xl font-bold text-green-600">
                    {status.statistics.successCount}
                  </p>
                </div>
                <CheckCircle2 className="h-8 w-8 text-green-600 opacity-20" />
              </div>
            </div>

            <div className="p-4 border rounded-lg bg-red-50 dark:bg-red-950">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Errors</p>
                  <p className="text-2xl font-bold text-red-600">
                    {status.statistics.errorCount}
                  </p>
                </div>
                <XCircle className="h-8 w-8 text-red-600 opacity-20" />
              </div>
            </div>

            <div className="p-4 border rounded-lg bg-blue-50 dark:bg-blue-950">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Runs</p>
                  <p className="text-2xl font-bold text-blue-600">
                    {status.statistics.totalRuns}
                  </p>
                </div>
                <Activity className="h-8 w-8 text-blue-600 opacity-20" />
              </div>
            </div>

            <div className="p-4 border rounded-lg bg-purple-50 dark:bg-purple-950">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Success Rate</p>
                  <p className="text-2xl font-bold text-purple-600">
                    {status.statistics.successRate}
                  </p>
                </div>
                <TrendingUp className="h-8 w-8 text-purple-600 opacity-20" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Last Run Card */}
      {lastRun && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Last Run Details
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  {lastRun.success ? (
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                  ) : (
                    <XCircle className="h-5 w-5 text-red-600" />
                  )}
                  <div>
                    <p className="font-semibold">
                      {lastRun.success ? "Success" : "Failed"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(lastRun.timestamp).toLocaleString("id-ID")}
                    </p>
                  </div>
                </div>
                <Badge variant={lastRun.success ? "default" : "destructive"}>
                  {formatDuration(lastRun.duration)}
                </Badge>
              </div>

              {lastRun.success && lastRun.totalLocations && (
                <div className="grid gap-3 md:grid-cols-4">
                  <div className="p-3 border rounded-lg text-center">
                    <p className="text-2xl font-bold text-blue-600">
                      {lastRun.totalLocations}
                    </p>
                    <p className="text-xs text-muted-foreground">Total Locations</p>
                  </div>
                  <div className="p-3 border rounded-lg text-center">
                    <p className="text-2xl font-bold text-green-600">
                      {lastRun.successCount}
                    </p>
                    <p className="text-xs text-muted-foreground">Successful</p>
                  </div>
                  <div className="p-3 border rounded-lg text-center">
                    <p className="text-2xl font-bold text-red-600">
                      {lastRun.failedCount}
                    </p>
                    <p className="text-xs text-muted-foreground">Failed</p>
                  </div>
                  <div className="p-3 border rounded-lg text-center">
                    <p className="text-2xl font-bold text-orange-600">
                      {lastRun.cleanupDeleted || 0}
                    </p>
                    <p className="text-xs text-muted-foreground">Cleaned Up</p>
                  </div>
                </div>
              )}

              {!lastRun.success && lastRun.error && (
                <Alert variant="destructive">
                  <XCircle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>{lastRun.error.name}:</strong> {lastRun.error.message}
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Control Panel */}
      <Card>
        <CardHeader>
          <CardTitle>Control Panel</CardTitle>
          <CardDescription>Manage forecast data collection schedule</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Schedule Selector */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Collection Schedule</label>
            <Select value={schedule} onValueChange={setSchedule}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0 0 */14 * *">
                  Every 14 days at midnight (Recommended)
                </SelectItem>
                <SelectItem value="0 0 */7 * *">
                  Every 7 days at midnight
                </SelectItem>
                <SelectItem value="0 2 */14 * *">
                  Every 14 days at 2 AM
                </SelectItem>
                <SelectItem value="0 0 1 * *">
                  Monthly on the 1st at midnight
                </SelectItem>
                <SelectItem value="*/5 * * * *">
                  Every 5 minutes (Testing Only)
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              ℹ️ 14-day interval recommended: fetches 16-day forecast with 2-day overlap
            </p>
          </div>

          <Separator />

          {/* Control Buttons */}
          <div className="grid gap-2 md:grid-cols-2">
            <Button
              onClick={() => controlCron("start")}
              disabled={status.isRunning || isLoading || !status.mongodbEnabled}
              className="gap-2"
            >
              <Play className="h-4 w-4" />
              Start Cron Job
            </Button>

            <Button
              onClick={() => controlCron("stop")}
              disabled={!status.isRunning || isLoading}
              variant="destructive"
              className="gap-2"
            >
              <Square className="h-4 w-4" />
              Stop Cron Job
            </Button>

            <Button
              onClick={() => controlCron("restart")}
              disabled={!status.isRunning || isLoading || !status.mongodbEnabled}
              variant="outline"
              className="gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Restart with New Schedule
            </Button>

            <Button
              onClick={() => controlCron("trigger")}
              disabled={isLoading || !status.mongodbEnabled}
              variant="secondary"
              className="gap-2"
            >
              <Zap className="h-4 w-4" />
              Run Now (Manual)
            </Button>
          </div>

          {/* Info Alert */}
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription className="text-xs">
              <strong>How it works:</strong>
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Fetches 16-day forecast for all 48 pump stations</li>
                <li>Runs every 14 days (2-day overlap ensures continuity)</li>
                <li>Automatically cleans up forecast data older than 30 days</li>
                <li>Each pump station has its own MongoDB collection</li>
                <li>Check server logs for detailed progress</li>
              </ul>
            </AlertDescription>
          </Alert>

          {!status.mongodbEnabled && (
            <Alert variant="destructive">
              <XCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>MongoDB not configured!</strong>
                <br />
                Add MONGODB_URI to your .env.local file to enable forecast storage.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
