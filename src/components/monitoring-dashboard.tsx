"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
  Play,
  Square,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Clock,
  MapPin,
  Droplets,
  Activity,
  AlertCircle,
  Loader2,
} from "lucide-react";

interface MonitorResult {
  name: string;
  coordinates: { lat: number; lng: number };
  rainfall: {
    dbz: number;
    rainRate: number;
    intensity: string;
    confidence: string;
  };
  alert: boolean;
  radarTime: string;
}

interface MonitorSummary {
  totalLocations: number;
  alertsFound: number;
  alertsSaved: number;
  threshold: number;
  duration: string;
  timestamp: string;
}

interface CronStatus {
  isRunning: boolean;
  message: string;
}

export default function MonitoringDashboard() {
  const [isChecking, setIsChecking] = useState(false);
  const [summary, setSummary] = useState<MonitorSummary | null>(null);
  const [results, setResults] = useState<MonitorResult[]>([]);
  const [threshold, setThreshold] = useState(2.0);
  const [cronInterval, setCronInterval] = useState("*/10 * * * *");
  const [cronStatus, setCronStatus] = useState<CronStatus | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  useEffect(() => {
    checkCronStatus();
  }, []);

  const checkCronStatus = async () => {
    try {
      const response = await fetch("/api/monitor/control");
      const data = await response.json();
      if (data.success) {
        setCronStatus(data.status);
      }
    } catch (error) {
      console.error("Failed to check cron status:", error);
    }
  };

  const controlCron = async (action: "start" | "stop" | "restart") => {
    try {
      const response = await fetch("/api/monitor/control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          interval: cronInterval,
          threshold: threshold,
        }),
      });
      const data = await response.json();

      if (data.success) {
        await checkCronStatus();
      }
    } catch (error) {
      console.error("Control cron failed:", error);
    }
  };

  const checkRainfall = async (saveToDb = true) => {
    setIsChecking(true);
    try {
      const response = await fetch(
        `/api/monitor/check?threshold=${threshold}&save=${saveToDb}&notify=false`
      );
      const data = await response.json();

      if (data.success) {
        setSummary(data.summary);
        setResults(data.results);
        setLastUpdate(new Date());
      }
    } catch (error) {
      console.error("Check failed:", error);
    } finally {
      setIsChecking(false);
    }
  };

  const getIntensityVariant = (intensity: string) => {
    const variants: Record<
      string,
      "default" | "secondary" | "destructive" | "outline"
    > = {
      "No Rain": "outline",
      "Light Rain": "secondary",
      "Moderate Rain": "default",
      "Heavy Rain": "destructive",
      "Very Heavy Rain": "destructive",
    };
    return variants[intensity] || "outline";
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold tracking-tight">
              Rainfall Monitoring
            </h1>
            <p className="text-muted-foreground mt-2">
              Automatic monitoring at pump station locations
            </p>
          </div>
          {cronStatus && (
            <Badge
              variant={cronStatus.isRunning ? "default" : "secondary"}
              className="gap-2"
            >
              <Activity className="h-3 w-3" />
              {cronStatus.isRunning ? "Active" : "Inactive"}
            </Badge>
          )}
        </div>

        <Tabs defaultValue="monitor" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 lg:w-[400px]">
            <TabsTrigger value="monitor">Monitor</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="monitor" className="space-y-6">
            {/* Summary Cards */}
            {summary && (
              <div className="grid gap-4 md:grid-cols-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                      Total Locations
                    </CardTitle>
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {summary.totalLocations}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                      Alerts Found
                    </CardTitle>
                    <AlertTriangle className="h-4 w-4 text-destructive" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-destructive">
                      {summary.alertsFound}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                      Alerts Saved
                    </CardTitle>
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-green-600">
                      {summary.alertsSaved}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                      Duration
                    </CardTitle>
                    <Clock className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{summary.duration}</div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Manual Check Section */}
            <Card>
              <CardHeader>
                <CardTitle>Manual Check</CardTitle>
                <CardDescription>
                  Trigger an immediate rainfall check at all locations
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="manual-threshold">Threshold (mm/h)</Label>
                    <Input
                      id="manual-threshold"
                      type="number"
                      value={threshold}
                      onChange={(e) =>
                        setThreshold(Number.parseFloat(e.target.value) || 2.0)
                      }
                      step="0.5"
                      min="0"
                      max="50"
                    />
                  </div>
                  <div className="flex items-end">
                    <Button
                      onClick={() => checkRainfall(true)}
                      disabled={isChecking}
                      className="w-full gap-2"
                    >
                      {isChecking ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Checking...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="h-4 w-4" />
                          Check Now
                        </>
                      )}
                    </Button>
                  </div>
                </div>
                {lastUpdate && (
                  <p className="text-sm text-muted-foreground">
                    Last updated: {lastUpdate.toLocaleString("id-ID")}
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Results Grid */}
            {results.length > 0 && (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {results.map((result, index) => (
                  <Card
                    key={index}
                    className={result.alert ? "border-destructive" : ""}
                  >
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="space-y-1 flex-1">
                          <CardTitle className="text-lg flex items-center gap-2">
                            {result.alert ? (
                              <AlertCircle className="h-5 w-5 text-destructive" />
                            ) : (
                              <CheckCircle2 className="h-5 w-5 text-green-600" />
                            )}
                            {result.name}
                          </CardTitle>
                          <CardDescription className="text-xs">
                            {result.coordinates.lat.toFixed(5)}°,{" "}
                            {result.coordinates.lng.toFixed(5)}°
                          </CardDescription>
                        </div>
                        <Badge
                          variant={getIntensityVariant(
                            result.rainfall.intensity
                          )}
                        >
                          {result.rainfall.intensity}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <div className="text-muted-foreground">Rain Rate</div>
                          <div className="font-semibold flex items-center gap-1">
                            <Droplets className="h-3 w-3" />
                            {result.rainfall.rainRate.toFixed(2)} mm/h
                          </div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">dBZ</div>
                          <div className="font-semibold">
                            {result.rainfall.dbz.toFixed(1)}
                          </div>
                        </div>
                      </div>
                      <Separator />
                      <div className="text-xs text-muted-foreground">
                        <div>Confidence: {result.rainfall.confidence}</div>
                        <div>Time: {result.radarTime}</div>
                      </div>
                      {result.alert && (
                        <Alert variant="destructive">
                          <AlertTriangle className="h-4 w-4" />
                          <AlertDescription className="text-xs">
                            Exceeds threshold ({threshold} mm/h)
                          </AlertDescription>
                        </Alert>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* Empty State */}
            {results.length === 0 && !isChecking && (
              <Card className="p-12">
                <div className="text-center space-y-4">
                  <Activity className="h-12 w-12 mx-auto text-muted-foreground" />
                  <div>
                    <h3 className="text-lg font-semibold">
                      No monitoring data yet
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Click "Check Now" to start monitoring rainfall
                    </p>
                  </div>
                </div>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="settings" className="space-y-6">
            {/* Cron Settings */}
            <Card>
              <CardHeader>
                <CardTitle>Automatic Monitoring</CardTitle>
                <CardDescription>
                  Configure automated rainfall checks and alerts
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="cron-interval">Check Interval</Label>
                    <Select
                      value={cronInterval}
                      onValueChange={setCronInterval}
                    >
                      <SelectTrigger id="cron-interval">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="* * * * *">
                          Every 1 minute (testing)
                        </SelectItem>
                        <SelectItem value="*/5 * * * *">
                          Every 5 minutes
                        </SelectItem>
                        <SelectItem value="*/10 * * * *">
                          Every 10 minutes
                        </SelectItem>
                        <SelectItem value="*/30 * * * *">
                          Every 30 minutes
                        </SelectItem>
                        <SelectItem value="0 * * * *">Every 1 hour</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="cron-threshold">
                      Alert Threshold (mm/h)
                    </Label>
                    <Input
                      id="cron-threshold"
                      type="number"
                      value={threshold}
                      onChange={(e) =>
                        setThreshold(Number.parseFloat(e.target.value) || 2.0)
                      }
                      step="0.5"
                      min="0.0"
                      max="50"
                    />
                  </div>
                </div>

                <Separator />

                <div className="flex gap-2">
                  <Button
                    onClick={() => controlCron("start")}
                    disabled={cronStatus?.isRunning}
                    className="flex-1 gap-2"
                  >
                    <Play className="h-4 w-4" />
                    Start Monitoring
                  </Button>
                  <Button
                    onClick={() => controlCron("stop")}
                    disabled={!cronStatus?.isRunning}
                    variant="destructive"
                    className="flex-1 gap-2"
                  >
                    <Square className="h-4 w-4" />
                    Stop Monitoring
                  </Button>
                </div>

                {cronStatus && (
                  <Alert>
                    <Activity className="h-4 w-4" />
                    <AlertDescription>
                      Status: {cronStatus.message}
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>

            {/* Info Card */}
            <Card>
              <CardHeader>
                <CardTitle>Cara Kerja Sistem</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 mt-0.5 text-green-600" />
                    <span>
                      Sistem memeriksa curah hujan di seluruh lokasi pompa
                      berdasarkan file KML
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 mt-0.5 text-green-600" />
                    <span>
                      Data dibaca secara real-time dari citra radar BMKG
                    </span>
                  </li>
                  {/* <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 mt-0.5 text-green-600" />
                    <span>
                      Peringatan (alert) akan muncul jika curah hujan melebihi
                      ambang batas
                    </span>
                  </li> */}
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 mt-0.5 text-green-600" />
                    <span>
                      Semua hasil pemeriksaan otomatis disimpan ke dalam database
                    </span>
                  </li>
                </ul>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
