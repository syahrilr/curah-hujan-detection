"use client";

import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Play,
  Square,
  RotateCw,
  Activity,
  Database,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { format } from "date-fns";

type CronStatus = {
  isRunning: boolean;
  hasJob: boolean;
  mongodbEnabled: boolean;
  database: string;
  lastRun?: {
    success: boolean;
    timestamp: string;
    duration: number;
    totalLocations?: number;
    successCount?: number;
    failedCount?: number;
  };
  statistics: {
    successCount: number;
    errorCount: number;
    totalRuns: number;
    successRate: string;
  };
};

export default function HistoryCronDashboard() {
  const [status, setStatus] = useState<CronStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Fetch status
  const fetchStatus = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/history-control");
      const data = await response.json();
      if (data.success) {
        setStatus(data.status);
      }
    } catch (error) {
      console.error("Error fetching status:", error);
    } finally {
      setLoading(false);
    }
  };

  // Execute action
  const executeAction = async (action: string) => {
    try {
      setActionLoading(action);
      setMessage(null);

      const response = await fetch("/api/history-control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });

      const data = await response.json();

      if (data.success) {
        setMessage({ type: "success", text: data.message });
        await fetchStatus();
      } else {
        setMessage({ type: "error", text: data.error || "Action failed" });
      }
    } catch (error) {
      setMessage({
        type: "error",
        text: (error as Error).message || "Unknown error",
      });
    } finally {
      setActionLoading(null);
    }
  };

  // Trigger manual fetch
  const triggerManualFetch = async () => {
    try {
      setActionLoading("trigger");
      setMessage(null);

      const response = await fetch("/api/history-control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "trigger", daysBack: 7 }),
      });

      const data = await response.json();

      if (data.success) {
        setMessage({
          type: "success",
          text: `Manual fetch completed: ${data.result.successCount}/${data.result.totalLocations} locations`,
        });
        await fetchStatus();
      } else {
        setMessage({ type: "error", text: data.error || "Manual fetch failed" });
      }
    } catch (error) {
      setMessage({
        type: "error",
        text: (error as Error).message || "Unknown error",
      });
    } finally {
      setActionLoading(null);
    }
  };

  // Initial load and auto-refresh
  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  if (loading && !status) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6 mx-auto max-w-7xl mt-20">
      {/* Status Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                History Cron Job Status
              </CardTitle>
              <CardDescription>
                Automatic history data collection service
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchStatus}
              disabled={loading}
            >
              <RotateCw
                className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`}
              />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {message && (
            <Alert variant={message.type === "error" ? "destructive" : "default"}>
              {message.type === "success" ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <AlertCircle className="h-4 w-4" />
              )}
              <AlertTitle>
                {message.type === "success" ? "Success" : "Error"}
              </AlertTitle>
              <AlertDescription>{message.text}</AlertDescription>
            </Alert>
          )}

          {/* Status Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Status</p>
              <Badge
                variant={status?.isRunning ? "default" : "secondary"}
                className="text-sm"
              >
                {status?.isRunning ? "Running" : "Stopped"}
              </Badge>
            </div>

            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">MongoDB</p>
              <Badge
                variant={status?.mongodbEnabled ? "default" : "destructive"}
                className="text-sm"
              >
                {status?.mongodbEnabled ? "Connected" : "Disconnected"}
              </Badge>
            </div>

            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Database</p>
              <div className="flex items-center gap-2">
                <Database className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm font-medium">
                  {status?.database || "N/A"}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Success Rate</p>
              <p className="text-sm font-medium">
                {status?.statistics.successRate || "N/A"}
              </p>
            </div>
          </div>

          {/* Control Buttons */}
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => executeAction("start")}
              disabled={
                status?.isRunning || actionLoading !== null || !status?.mongodbEnabled
              }
              className="gap-2"
            >
              {actionLoading === "start" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              Start
            </Button>

            <Button
              onClick={() => executeAction("stop")}
              disabled={!status?.isRunning || actionLoading !== null}
              variant="outline"
              className="gap-2"
            >
              {actionLoading === "stop" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Square className="h-4 w-4" />
              )}
              Stop
            </Button>

            <Button
              onClick={() => executeAction("restart")}
              disabled={!status?.isRunning || actionLoading !== null}
              variant="outline"
              className="gap-2"
            >
              {actionLoading === "restart" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RotateCw className="h-4 w-4" />
              )}
              Restart
            </Button>

            <Button
              onClick={triggerManualFetch}
              disabled={actionLoading !== null || !status?.mongodbEnabled}
              variant="secondary"
              className="gap-2"
            >
              {actionLoading === "trigger" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Activity className="h-4 w-4" />
              )}
              Run Now
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Statistics Card */}
      {status && (
        <Card>
          <CardHeader>
            <CardTitle>Statistics</CardTitle>
            <CardDescription>Cron job execution statistics</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Total Runs</p>
                <p className="text-2xl font-bold">
                  {status.statistics.totalRuns}
                </p>
              </div>

              <div className="space-y-2">
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3 text-green-500" />
                  Success
                </p>
                <p className="text-2xl font-bold text-green-600">
                  {status.statistics.successCount}
                </p>
              </div>

              <div className="space-y-2">
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <XCircle className="h-3 w-3 text-red-500" />
                  Errors
                </p>
                <p className="text-2xl font-bold text-red-600">
                  {status.statistics.errorCount}
                </p>
              </div>

              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Success Rate</p>
                <p className="text-2xl font-bold">{status.statistics.successRate}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Last Run Card */}
      {status?.lastRun && (
        <Card>
          <CardHeader>
            <CardTitle>Last Run</CardTitle>
            <CardDescription>Most recent execution details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Status</p>
                <Badge
                  variant={status.lastRun.success ? "default" : "destructive"}
                >
                  {status.lastRun.success ? (
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                  ) : (
                    <XCircle className="h-3 w-3 mr-1" />
                  )}
                  {status.lastRun.success ? "Success" : "Failed"}
                </Badge>
              </div>

              <div className="space-y-2">
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Timestamp
                </p>
                <p className="text-sm font-medium">
                  {format(
                    new Date(status.lastRun.timestamp),
                    "dd MMM yyyy HH:mm:ss"
                  )}
                </p>
              </div>

              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Duration</p>
                <p className="text-sm font-medium">
                  {(status.lastRun.duration / 1000).toFixed(2)}s
                </p>
              </div>

              {status.lastRun.totalLocations !== undefined && (
                <>
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">Total Locations</p>
                    <p className="text-sm font-medium">
                      {status.lastRun.totalLocations}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground ">
                      Success
                    </p>
                    <p className="text-sm font-medium text-green-600">
                      {status.lastRun.successCount}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">
                      Failed
                    </p>
                    <p className="text-sm font-medium text-red-600">
                      {status.lastRun.failedCount}
                    </p>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {!status?.mongodbEnabled && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>MongoDB Not Configured</AlertTitle>
          <AlertDescription>
            Please set MONGODB_URI in your environment variables to enable history
            data collection.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
