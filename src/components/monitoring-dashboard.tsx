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
  ImageIcon,
  X,
  BarChart,
  Monitor,
  Radar,
  Settings,
  CloudRain,
  Cloud,
} from "lucide-react";

// Import komponen tab baru
import RainfallHistoryTab from "./history/rainfall-historycal-tab";
import ForecastTab from "./forecast/forecast-tab";
import TMADashboard from "./jakarta/tma-dashboard";
import CurahHujanDashboard from "./jakarta/curah-hujan-dashboard";
import PompaMonitorDashboard from "./jakarta/pompa-monitor-dashboard";

interface DetectedLocation {
  lat: number;
  lng: number;
  name: string;
  dbz: number;
  rainRate: number;
  intensity: string;
  confidence: string;
  pixelX: number;
  pixelY: number;
}

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
  detectedLocations?: number;
  recordId?: string;
}

interface CapturedData {
  radarImage?: string;
  radarImageUrl?: string;
  screenshot?: string;
  detectedLocations?: DetectedLocation[];
  timestamp?: string;
  radarStation?: string;
}

interface CronStatus {
  isRunning: boolean;
  message: string;
}

export default function MonitoringDashboard() {
  const [isChecking, setIsChecking] = useState(false);
  const [summary, setSummary] = useState<MonitorSummary | null>(null);
  const [results, setResults] = useState<MonitorResult[]>([]);
  const [capturedData, setCapturedData] = useState<CapturedData | null>(null);
  const [threshold, setThreshold] = useState(2.0);
  const [cronInterval, setCronInterval] = useState("*/10 * * * *");
  const [cronStatus, setCronStatus] = useState<CronStatus | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [selectedImageModal, setSelectedImageModal] = useState(false);

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
        `/api/monitor/check-with-capture?threshold=${threshold}&save=${saveToDb}&notify=false`
      );
      const data = await response.json();

      if (data.success) {
        setSummary(data.summary);
        setResults(data.results);
        setCapturedData({
          ...data.capturedData,
          screenshot: data.capturedData?.screenshot,
        });
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
              Automatic monitoring at pump station locations with radar image
              capture
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
          <TabsList className="grid w-full grid-cols-7 lg:w-[950px]">
            <TabsTrigger value="monitor" className="gap-2">
              <Monitor className="h-4 w-4" />
              Monitor
            </TabsTrigger>
            <TabsTrigger value="radar" className="gap-2">
              <Radar className="h-4 w-4" />
              Radar Image
            </TabsTrigger>
            <TabsTrigger value="dsda" className="gap-2">
              <Droplets className="h-4 w-4" />
              DSDA
            </TabsTrigger>
            {/* <TabsTrigger value="curah-hujan" className="gap-2">
              <CloudRain className="h-4 w-4" />
              Curah Hujan
            </TabsTrigger> */}
            <TabsTrigger value="history" className="gap-2">
              <BarChart className="h-4 w-4" />
              History
            </TabsTrigger>
            <TabsTrigger value="forecast" className="gap-2">
              <Cloud className="h-4 w-4" />
              Forecast
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-2">
              <Settings className="h-4 w-4" />
              Settings
            </TabsTrigger>
          </TabsList>

          {/* MONITOR TAB */}
          <TabsContent value="monitor" className="space-y-6">
            {/* Summary Cards */}
            {summary && (
              <div className="grid gap-4 md:grid-cols-5">
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
                      Detected Locations
                    </CardTitle>
                    <ImageIcon className="h-4 w-4 text-blue-600" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-blue-600">
                      {summary.detectedLocations || 0}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                      Saved Records
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
                  Trigger an immediate rainfall check at all locations with
                  radar image capture
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

          {/* RADAR IMAGE TAB */}
          {/* RADAR IMAGE TAB */}
          <TabsContent value="radar" className="space-y-6">
            {capturedData && capturedData.radarImage ? (
              <div className="space-y-6">
                {/* Screenshot with Annotations */}
                {capturedData.screenshot && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <ImageIcon className="h-5 w-5" />
                        Annotated Screenshot
                      </CardTitle>
                      <CardDescription>
                        Radar image with detected rainfall locations marked and
                        labeled
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="relative bg-slate-900 rounded-lg overflow-hidden border-2 border-blue-500">
                        <img
                          src={capturedData.screenshot}
                          alt="Annotated Radar Screenshot"
                          className="w-full h-auto"
                        />
                        <div className="absolute top-4 right-4 bg-blue-600 text-white px-3 py-1 rounded-lg text-xs font-bold">
                          📍 {capturedData.detectedLocations?.length || 0}{" "}
                          Locations
                        </div>
                      </div>

                      {/* Screenshot Info */}
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div className="bg-blue-50 dark:bg-blue-950 p-3 rounded-lg">
                          <div className="text-muted-foreground text-xs mb-1">
                            Radar Station
                          </div>
                          <div className="font-bold text-blue-600">
                            {capturedData.radarStation || "JAK"}
                          </div>
                        </div>
                        <div className="bg-green-50 dark:bg-green-950 p-3 rounded-lg">
                          <div className="text-muted-foreground text-xs mb-1">
                            Locations Detected
                          </div>
                          <div className="font-bold text-green-600">
                            {capturedData.detectedLocations?.length || 0}
                          </div>
                        </div>
                        <div className="bg-purple-50 dark:bg-purple-950 p-3 rounded-lg">
                          <div className="text-muted-foreground text-xs mb-1">
                            Timestamp
                          </div>
                          <div className="font-bold text-purple-600 text-xs">
                            {capturedData.timestamp
                              ? new Date(capturedData.timestamp).toLocaleString(
                                  "id-ID"
                                )
                              : "-"}
                          </div>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex gap-2">
                        <Button
                          onClick={() => setSelectedImageModal(true)}
                          className="flex-1 gap-2"
                        >
                          <ImageIcon className="h-4 w-4" />
                          View Full Size
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => {
                            const link = document.createElement("a");
                            link.href = capturedData.screenshot!;
                            link.download = `radar-screenshot-${Date.now()}.png`;
                            link.click();
                          }}
                          className="gap-2"
                        >
                          💾 Download
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Original Radar Image */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      🛰️ Original Radar Image
                    </CardTitle>
                    <CardDescription>
                      Raw radar data from BMKG without annotations
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="relative bg-muted rounded-lg overflow-hidden">
                      <img
                        src={capturedData.radarImage}
                        alt="Original Radar Image"
                        className="w-full h-auto"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <div className="text-muted-foreground">Image URL</div>
                        <div className="font-mono text-xs truncate">
                          {capturedData.radarImageUrl || "-"}
                        </div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Image Size</div>
                        <div className="font-semibold">
                          {(
                            (capturedData.radarImage?.length || 0) / 1024
                          ).toFixed(2)}{" "}
                          KB
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Detected Locations List */}
                {capturedData.detectedLocations &&
                  capturedData.detectedLocations.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle>
                          Detected Locations (
                          {capturedData.detectedLocations.length})
                        </CardTitle>
                        <CardDescription>
                          Rainfall data extracted from radar image
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          {capturedData.detectedLocations
                            .sort((a, b) => b.rainRate - a.rainRate)
                            .map((location, index) => (
                              <div
                                key={index}
                                className={`flex items-start justify-between p-4 border-2 rounded-lg transition-all hover:shadow-md ${
                                  location.rainRate >= 10
                                    ? "border-red-500 bg-red-50 dark:bg-red-950"
                                    : location.rainRate >= 2
                                    ? "border-orange-500 bg-orange-50 dark:bg-orange-950"
                                    : "border-blue-500 bg-blue-50 dark:bg-blue-950"
                                }`}
                              >
                                <div className="flex-1">
                                  <div className="flex items-center gap-3 mb-2">
                                    <div
                                      className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm ${
                                        location.rainRate >= 10
                                          ? "bg-red-600"
                                          : location.rainRate >= 2
                                          ? "bg-orange-600"
                                          : "bg-blue-600"
                                      }`}
                                    >
                                      {index + 1}
                                    </div>
                                    <div>
                                      <div className="font-bold text-lg">
                                        {location.name}
                                      </div>
                                      <div className="text-xs text-muted-foreground font-mono">
                                        {location.lat.toFixed(5)}°,{" "}
                                        {location.lng.toFixed(5)}°
                                      </div>
                                    </div>
                                  </div>

                                  <div className="grid grid-cols-3 gap-3 text-sm mt-3">
                                    <div>
                                      <div className="text-muted-foreground text-xs">
                                        Rain Rate
                                      </div>
                                      <div className="font-bold text-base flex items-center gap-1">
                                        <Droplets className="h-3 w-3" />
                                        {location.rainRate.toFixed(2)} mm/h
                                      </div>
                                    </div>
                                    <div>
                                      <div className="text-muted-foreground text-xs">
                                        dBZ
                                      </div>
                                      <div className="font-bold text-base">
                                        {location.dbz.toFixed(1)}
                                      </div>
                                    </div>
                                    <div>
                                      <div className="text-muted-foreground text-xs">
                                        Pixel
                                      </div>
                                      <div className="font-mono text-xs">
                                        ({location.pixelX}, {location.pixelY})
                                      </div>
                                    </div>
                                  </div>

                                  <div className="text-xs text-muted-foreground mt-2 italic">
                                    {location.confidence}
                                  </div>
                                </div>

                                <div className="text-right">
                                  <Badge
                                    variant={getIntensityVariant(
                                      location.intensity
                                    )}
                                    className="mb-2"
                                  >
                                    {location.intensity}
                                  </Badge>
                                  {location.rainRate >= 10 && (
                                    <div className="mt-2">
                                      <Badge
                                        variant="destructive"
                                        className="gap-1"
                                      >
                                        <AlertTriangle className="h-3 w-3" />
                                        HIGH RISK
                                      </Badge>
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                {/* Statistics Card */}
                {capturedData.detectedLocations &&
                  capturedData.detectedLocations.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle>📊 Detection Statistics</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div className="bg-red-50 dark:bg-red-950 p-4 rounded-lg">
                            <div className="text-xs text-muted-foreground mb-1">
                              High Risk
                            </div>
                            <div className="text-2xl font-bold text-red-600">
                              {
                                capturedData.detectedLocations.filter(
                                  (l) => l.rainRate >= 10
                                ).length
                              }
                            </div>
                            <div className="text-xs text-muted-foreground">
                              ≥10 mm/h
                            </div>
                          </div>

                          <div className="bg-orange-50 dark:bg-orange-950 p-4 rounded-lg">
                            <div className="text-xs text-muted-foreground mb-1">
                              Medium Risk
                            </div>
                            <div className="text-2xl font-bold text-orange-600">
                              {
                                capturedData.detectedLocations.filter(
                                  (l) => l.rainRate >= 2 && l.rainRate < 10
                                ).length
                              }
                            </div>
                            <div className="text-xs text-muted-foreground">
                              2-10 mm/h
                            </div>
                          </div>

                          <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg">
                            <div className="text-xs text-muted-foreground mb-1">
                              Low Risk
                            </div>
                            <div className="text-2xl font-bold text-blue-600">
                              {
                                capturedData.detectedLocations.filter(
                                  (l) => l.rainRate < 2
                                ).length
                              }
                            </div>
                            <div className="text-xs text-muted-foreground">
                              &lt;2 mm/h
                            </div>
                          </div>

                          <div className="bg-purple-50 dark:bg-purple-950 p-4 rounded-lg">
                            <div className="text-xs text-muted-foreground mb-1">
                              Max Rain Rate
                            </div>
                            <div className="text-2xl font-bold text-purple-600">
                              {Math.max(
                                ...capturedData.detectedLocations.map(
                                  (l) => l.rainRate
                                )
                              ).toFixed(1)}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              mm/h
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}
              </div>
            ) : (
              <Card className="p-12">
                <div className="text-center space-y-4">
                  <ImageIcon className="h-12 w-12 mx-auto text-muted-foreground" />
                  <div>
                    <h3 className="text-lg font-semibold">
                      No radar image captured yet
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Run a check to capture the latest radar image
                    </p>
                  </div>
                </div>
              </Card>
            )}
          </TabsContent>

          {/* TMA TAB - NEW */}
          {/* <TabsContent value="tma" className="space-y-6">
            <TMADashboard />
          </TabsContent> */}

          {/* CURAH HUJAN TAB - NEW */}
          <TabsContent value="dsda" className="space-y-6">
            <PompaMonitorDashboard />
          </TabsContent>

          {/* HISTORY TAB - NEW */}
          <TabsContent value="history" className="space-y-6">
            <RainfallHistoryTab />
          </TabsContent>

          {/* FORECAST TAB - NEW */}
          <TabsContent value="forecast" className="space-y-6">
            <ForecastTab />
          </TabsContent>

          {/* SETTINGS TAB */}
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
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 mt-0.5 text-green-600" />
                    <span>
                      Radar image ditangkap dan disimpan ke database sebagai
                      base64
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 mt-0.5 text-green-600" />
                    <span>
                      Semua lokasi yang terdeteksi dengan curah hujan disimpan
                      dengan koordinat dan metadata lengkap
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 mt-0.5 text-green-600" />
                    <span>
                      Peringatan (alert) akan muncul jika curah hujan melebihi
                      ambang batas
                    </span>
                  </li>
                </ul>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Full Size Image Modal */}
      {selectedImageModal && capturedData?.radarImage && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-background rounded-lg max-w-4xl w-full max-h-[90vh] overflow-auto">
            <div className="sticky top-0 flex items-center justify-between p-4 border-b bg-background">
              <h2 className="text-lg font-semibold">Radar Image - Full Size</h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedImageModal(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="p-4">
              <img
                src={capturedData.radarImage}
                alt="Radar Image Full Size"
                className="w-full h-auto"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
