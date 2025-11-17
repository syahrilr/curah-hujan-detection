// components/forecast-tab-complete.tsx
"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import {
  CloudRain,
  Loader2,
  RefreshCw,
  Calendar,
  Droplets,
  AlertTriangle,
  TrendingUp,
  Database,
  MapPin,
  ThermometerSun,
  Cloud,
  CheckCircle2,
  XCircle,
  Maximize2,
  Play,
  Square,
  Clock,
  Activity,
  Zap,
  BarChart3,
  Info,
  Settings
} from "lucide-react"
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Area,
  AreaChart
} from 'recharts'
import { getHardcodedPumpLocations } from "@/lib/kml-parser"

interface ForecastData {
  pumpName: string
  pumpLat: number
  pumpLng: number
  hourly: {
    time: string[]
    temperature_2m: number[]
    rain: number[]
    precipitation: number[]
    precipitation_probability: number[]
  }
  fetchedAt: string
  forecastStartDate: string
  forecastEndDate: string
}

interface CronStatus {
  isRunning: boolean
  hasJob: boolean
  mongodbEnabled: boolean
  database: string
  schedule: string
  forecastDays: number
  statistics: {
    successCount: number
    errorCount: number
    totalRuns: number
    successRate: string
  }
}

interface LastRun {
  success: boolean
  timestamp: string
  duration: number
  totalLocations?: number
  successCount?: number
  failedCount?: number
  cleanupDeleted?: number
  error?: {
    name: string
    message: string
  }
}

export default function ForecastTab() {
  // Forecast data states
  const [allForecasts, setAllForecasts] = useState<ForecastData[]>([])
  const [selectedPump, setSelectedPump] = useState<string>("")
  const [isLoading, setIsLoading] = useState(false)
  const [isFetching, setIsFetching] = useState(false)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  const [chartView, setChartView] = useState<"3days" | "7days" | "16days">("3days")
  const [error, setError] = useState<string | null>(null)

  // Cron control states
  const [cronStatus, setCronStatus] = useState<CronStatus | null>(null)
  const [cronLastRun, setCronLastRun] = useState<LastRun | null>(null)
  const [cronSchedule, setCronSchedule] = useState("0 0 */14 * *")
  const [cronMessage, setCronMessage] = useState<{
    type: "success" | "error"
    text: string
  } | null>(null)
  const [isCronLoading, setIsCronLoading] = useState(false)

  const pumpLocations = getHardcodedPumpLocations()

  useEffect(() => {
    loadAllForecasts()
    loadCronStatus()
    // Refresh cron status every 30 seconds
    const interval = setInterval(loadCronStatus, 30000)
    return () => clearInterval(interval)
  }, [])

  const loadAllForecasts = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/forecasts/all-latest')

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const contentType = response.headers.get("content-type")
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error('Server did not return JSON')
      }

      const data = await response.json()

      if (data.success) {
        setAllForecasts(data.data || [])
        if (data.data && data.data.length > 0 && !selectedPump) {
          setSelectedPump(data.data[0].pumpName)
        }
        setLastUpdate(new Date())
      } else {
        throw new Error(data.error || 'Failed to load forecasts')
      }
    } catch (error) {
      console.error('Failed to load forecasts:', error)
      setError(error instanceof Error ? error.message : 'Unknown error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  const loadCronStatus = async () => {
    try {
      const response = await fetch("/api/forecast-control")
      const data = await response.json()

      if (data.success) {
        setCronStatus(data.status)
        setCronLastRun(data.lastRun)
      }
    } catch (error) {
      console.error("Failed to load cron status:", error)
    }
  }

  const controlCron = async (action: string) => {
  setIsCronLoading(true);
  setCronMessage(null);

  try {
    // Show estimasi waktu untuk trigger
    if (action === "trigger") {
      setCronMessage({
        type: "success",
        text: "Fetching data for 48 stations... This will take 2-3 minutes. Please wait..."
      });
    }

    const response = await fetch("/api/forecast-control", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action,
        schedule: action === "start" || action === "restart" ? cronSchedule : undefined,
      }),
    });

    const data = await response.json();

    if (data.success) {
      if (action === "trigger" && data.result) {
        // Show detailed result
        setCronMessage({
          type: "success",
          text: `Completed! Success: ${data.result.successCount}/${data.result.totalLocations} stations. Cleaned: ${data.result.cleanupDeleted} old records.`
        });
      } else {
        setCronMessage({ type: "success", text: data.message });
      }
      await loadCronStatus();

      // Refresh forecast data
      if (action === "trigger") {
        await loadAllForecasts();
      }
    } else {
      setCronMessage({ type: "error", text: data.error || "Operation failed" });
    }
  } catch (error) {
    setCronMessage({
      type: "error",
      text: error instanceof Error ? error.message : "Unknown error",
    });
  } finally {
    setIsCronLoading(false);
  }
};

  const fetchAllForecasts = async () => {
    setIsFetching(true)
    setError(null)
    try {
      const response = await fetch('/api/forecasts/fetch-all', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()

      if (data.success) {
        await loadAllForecasts()
      } else {
        throw new Error(data.error || 'Failed to fetch forecasts')
      }
    } catch (error) {
      console.error('Failed to fetch forecasts:', error)
      setError(error instanceof Error ? error.message : 'Unknown error occurred')
    } finally {
      setIsFetching(false)
    }
  }

  const selectedForecast = allForecasts.find(f => f.pumpName === selectedPump)

  const getHoursForView = () => {
    switch(chartView) {
      case "3days": return 72
      case "7days": return 168
      case "16days": return 384
      default: return 72
    }
  }

  const hourlyChartData = selectedForecast ?
    selectedForecast.hourly.time.slice(0, getHoursForView()).map((time, idx) => ({
      time: new Date(time).toLocaleDateString('id-ID', {
        month: 'short',
        day: 'numeric',
        hour: chartView === "16days" ? undefined : '2-digit'
      }),
      rain: selectedForecast.hourly.rain[idx] || 0,
      precipitation: selectedForecast.hourly.precipitation[idx] || 0,
      probability: selectedForecast.hourly.precipitation_probability[idx] || 0,
      temperature: selectedForecast.hourly.temperature_2m[idx] || 0
    })) : []

  const stats = selectedForecast ? {
    maxRain: Math.max(...selectedForecast.hourly.rain),
    totalPrecipitation: selectedForecast.hourly.precipitation.reduce((a, b) => a + b, 0),
    avgProbability: selectedForecast.hourly.precipitation_probability.reduce((a, b) => a + b, 0) / selectedForecast.hourly.precipitation_probability.length,
    highRiskHours: selectedForecast.hourly.rain.filter(r => r > 10).length,
    avgTemp: selectedForecast.hourly.temperature_2m.reduce((a, b) => a + b, 0) / selectedForecast.hourly.temperature_2m.length
  } : null

  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`
    } else {
      return `${seconds}s`
    }
  }

  if (error) {
    return (
      <Card className="border-red-500">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-600">
            <XCircle className="h-5 w-5" />
            Error Loading Forecasts
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>Error:</strong> {error}
            </AlertDescription>
          </Alert>
          <div className="flex gap-2">
            <Button onClick={loadAllForecasts} variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (isLoading) {
    return (
      <Card className="p-12">
        <div className="text-center space-y-4">
          <Loader2 className="h-12 w-12 mx-auto animate-spin text-muted-foreground" />
          <div>
            <h3 className="text-lg font-semibold">Loading Forecasts</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Fetching data for {pumpLocations.length} pump stations...
            </p>
          </div>
        </div>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header with Cron Status */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <CloudRain className="h-5 w-5" />
                Weather Forecast - 16 Days
              </CardTitle>
              <CardDescription>
                Real-time forecasts for {pumpLocations.length} pump stations
                {cronStatus && (
                  <span className="ml-2">
                    • Auto-update: <Badge variant={cronStatus.isRunning ? "default" : "secondary"} className="ml-1">
                      {cronStatus.isRunning ? "Active" : "Inactive"}
                    </Badge>
                  </span>
                )}
              </CardDescription>
            </div>
            <Button
              onClick={fetchAllForecasts}
              disabled={isFetching}
              className="gap-2"
            >
              {isFetching ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Updating...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4" />
                  Update All
                </>
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-6">
            <Card className="bg-blue-50 dark:bg-blue-950 border-blue-200">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-2xl font-bold text-blue-600">
                      {allForecasts.length}
                    </div>
                    <p className="text-xs text-muted-foreground">With Data</p>
                  </div>
                  <Database className="h-8 w-8 text-blue-600 opacity-20" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-green-50 dark:bg-green-950 border-green-200">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-2xl font-bold text-green-600">
                      {pumpLocations.length}
                    </div>
                    <p className="text-xs text-muted-foreground">Total Stations</p>
                  </div>
                  <MapPin className="h-8 w-8 text-green-600 opacity-20" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-purple-50 dark:bg-purple-950 border-purple-200">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-2xl font-bold text-purple-600">
                      16
                    </div>
                    <p className="text-xs text-muted-foreground">Days Forecast</p>
                  </div>
                  <Calendar className="h-8 w-8 text-purple-600 opacity-20" />
                </div>
              </CardContent>
            </Card>

            {/* Cron Status Cards */}
            {cronStatus && (
              <>
                <Card className="bg-orange-50 dark:bg-orange-950 border-orange-200">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-2xl font-bold text-orange-600">
                          {cronStatus.statistics.successCount}
                        </div>
                        <p className="text-xs text-muted-foreground">Auto-Runs</p>
                      </div>
                      <Activity className="h-8 w-8 text-orange-600 opacity-20" />
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-teal-50 dark:bg-teal-950 border-teal-200">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-2xl font-bold text-teal-600">
                          {cronStatus.statistics.successRate}
                        </div>
                        <p className="text-xs text-muted-foreground">Success Rate</p>
                      </div>
                      <TrendingUp className="h-8 w-8 text-teal-600 opacity-20" />
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-indigo-50 dark:bg-indigo-950 border-indigo-200">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-lg font-bold text-indigo-600">
                          14 days
                        </div>
                        <p className="text-xs text-muted-foreground">Next Update</p>
                      </div>
                      <Clock className="h-8 w-8 text-indigo-600 opacity-20" />
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </div>

          {lastUpdate && (
            <p className="text-sm text-muted-foreground flex items-center gap-2 mt-4">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              Last updated: {lastUpdate.toLocaleString('id-ID')}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Main Tabs */}
      <Tabs defaultValue="view" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="view">
            📊 View Forecasts
          </TabsTrigger>
          <TabsTrigger value="automation">
            <Settings className="h-4 w-4 mr-2" />
            Automation
          </TabsTrigger>
          <TabsTrigger value="history">
            📈 History
          </TabsTrigger>
        </TabsList>

        {/* View Forecasts Tab */}
        <TabsContent value="view" className="space-y-6">
          {allForecasts.length === 0 ? (
            <Card className="p-12">
              <div className="text-center space-y-4">
                <Database className="h-16 w-16 mx-auto text-muted-foreground" />
                <div>
                  <h3 className="text-lg font-semibold">No Forecast Data Available</h3>
                  <p className="text-sm text-muted-foreground mt-2">
                    Click "Update All" to fetch weather data or enable automation below.
                  </p>
                </div>
              </div>
            </Card>
          ) : (
            <>
              {/* Station Selector */}
              <Card>
                <CardHeader>
                  <CardTitle>Select Pump Station</CardTitle>
                </CardHeader>
                <CardContent>
                  <Select value={selectedPump} onValueChange={setSelectedPump}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a pump station..." />
                    </SelectTrigger>
                    <SelectContent>
                      {pumpLocations.map((pump) => {
                        const hasForecast = allForecasts.some(f => f.pumpName === pump.name)
                        return (
                          <SelectItem key={pump.name} value={pump.name} disabled={!hasForecast}>
                            {pump.name}
                            {hasForecast && <Badge variant="outline" className="ml-2 text-xs">✓</Badge>}
                          </SelectItem>
                        )
                      })}
                    </SelectContent>
                  </Select>
                </CardContent>
              </Card>

              {/* Forecast Display */}
              {selectedForecast && stats && (
                <>
                  <div className="grid gap-4 md:grid-cols-5">
                    <Card>
                      <CardContent className="pt-6">
                        <div className="text-xs text-muted-foreground mb-1">Max Rain</div>
                        <div className="text-2xl font-bold text-blue-600">{stats.maxRain.toFixed(1)}</div>
                        <div className="text-xs text-muted-foreground">mm/h</div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-6">
                        <div className="text-xs text-muted-foreground mb-1">Total Precip</div>
                        <div className="text-2xl font-bold text-purple-600">{stats.totalPrecipitation.toFixed(1)}</div>
                        <div className="text-xs text-muted-foreground">mm</div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-6">
                        <div className="text-xs text-muted-foreground mb-1">Avg Probability</div>
                        <div className="text-2xl font-bold text-green-600">{stats.avgProbability.toFixed(0)}</div>
                        <div className="text-xs text-muted-foreground">%</div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-6">
                        <div className="text-xs text-muted-foreground mb-1">High Risk</div>
                        <div className="text-2xl font-bold text-red-600">{stats.highRiskHours}</div>
                        <div className="text-xs text-muted-foreground">hours</div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-6">
                        <div className="text-xs text-muted-foreground mb-1">Avg Temp</div>
                        <div className="text-2xl font-bold text-orange-600">{stats.avgTemp.toFixed(1)}</div>
                        <div className="text-xs text-muted-foreground">°C</div>
                      </CardContent>
                    </Card>
                  </div>

                  <Card>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle>Rainfall Forecast</CardTitle>
                        <div className="flex gap-2">
                          <Button
                            variant={chartView === "3days" ? "default" : "outline"}
                            size="sm"
                            onClick={() => setChartView("3days")}
                          >
                            3 Days
                          </Button>
                          <Button
                            variant={chartView === "7days" ? "default" : "outline"}
                            size="sm"
                            onClick={() => setChartView("7days")}
                          >
                            7 Days
                          </Button>
                          <Button
                            variant={chartView === "16days" ? "default" : "outline"}
                            size="sm"
                            onClick={() => setChartView("16days")}
                          >
                            <Maximize2 className="h-3 w-3 mr-1" />
                            16 Days
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={400}>
                        <AreaChart data={hourlyChartData}>
                          <defs>
                            <linearGradient id="colorRain" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.1}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                          <XAxis
                            dataKey="time"
                            tick={{ fontSize: chartView === "16days" ? 9 : 11 }}
                            angle={-45}
                            textAnchor="end"
                            height={chartView === "16days" ? 100 : 80}
                          />
                          <YAxis tick={{ fontSize: 12 }} />
                          <Tooltip />
                          <Legend />
                          <Area
                            type="monotone"
                            dataKey="rain"
                            stroke="#3b82f6"
                            fillOpacity={1}
                            fill="url(#colorRain)"
                            name="Rain (mm/h)"
                            strokeWidth={2}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                </>
              )}
            </>
          )}
        </TabsContent>

        {/* Automation Tab */}
        <TabsContent value="automation" className="space-y-6">
          {/* Cron Status */}
          {cronStatus && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Activity className="h-5 w-5" />
                      Automatic Forecast Collection
                    </CardTitle>
                    <CardDescription>
                      Fetches 16-day forecasts every 14 days (2-day overlap)
                    </CardDescription>
                  </div>
                  <Badge variant={cronStatus.isRunning ? "default" : "secondary"} className="gap-2">
                    <Activity className="h-3 w-3" />
                    {cronStatus.isRunning ? "Running" : "Stopped"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Message */}
                {cronMessage && (
                  <Alert variant={cronMessage.type === "error" ? "destructive" : "default"}>
                    {cronMessage.type === "success" ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : (
                      <XCircle className="h-4 w-4" />
                    )}
                    <AlertDescription>{cronMessage.text}</AlertDescription>
                  </Alert>
                )}

                {/* System Info */}
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="p-3 border rounded-lg">
                    <p className="text-xs text-muted-foreground">Database</p>
                    <p className="font-semibold">{cronStatus.database}</p>
                  </div>
                  <div className="p-3 border rounded-lg">
                    <p className="text-xs text-muted-foreground">Forecast Period</p>
                    <p className="font-semibold">{cronStatus.forecastDays} days</p>
                  </div>
                  <div className="p-3 border rounded-lg">
                    <p className="text-xs text-muted-foreground">Update Interval</p>
                    <p className="font-semibold">Every 14 days</p>
                  </div>
                </div>

                <Separator />

                {/* Statistics */}
                <div className="grid gap-4 md:grid-cols-4">
                  <div className="p-4 border rounded-lg bg-green-50 dark:bg-green-950">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Success</p>
                        <p className="text-2xl font-bold text-green-600">
                          {cronStatus.statistics.successCount}
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
                          {cronStatus.statistics.errorCount}
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
                          {cronStatus.statistics.totalRuns}
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
                          {cronStatus.statistics.successRate}
                        </p>
                      </div>
                      <TrendingUp className="h-8 w-8 text-purple-600 opacity-20" />
                    </div>
                  </div>
                </div>

                {/* Last Run Details */}
                {cronLastRun && (
                  <>
                    <Separator />
                    <div>
                      <h4 className="font-semibold mb-3 flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        Last Run Details
                      </h4>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between p-3 border rounded-lg">
                          <div className="flex items-center gap-3">
                            {cronLastRun.success ? (
                              <CheckCircle2 className="h-5 w-5 text-green-600" />
                            ) : (
                              <XCircle className="h-5 w-5 text-red-600" />
                            )}
                            <div>
                              <p className="font-semibold">
                                {cronLastRun.success ? "Success" : "Failed"}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {new Date(cronLastRun.timestamp).toLocaleString("id-ID")}
                              </p>
                            </div>
                          </div>
                          <Badge variant={cronLastRun.success ? "default" : "destructive"}>
                            {formatDuration(cronLastRun.duration)}
                          </Badge>
                        </div>

                        {cronLastRun.success && cronLastRun.totalLocations && (
                          <div className="grid gap-3 md:grid-cols-4">
                            <div className="p-3 border rounded-lg text-center">
                              <p className="text-2xl font-bold text-blue-600">
                                {cronLastRun.totalLocations}
                              </p>
                              <p className="text-xs text-muted-foreground">Total</p>
                            </div>
                            <div className="p-3 border rounded-lg text-center">
                              <p className="text-2xl font-bold text-green-600">
                                {cronLastRun.successCount}
                              </p>
                              <p className="text-xs text-muted-foreground">Success</p>
                            </div>
                            <div className="p-3 border rounded-lg text-center">
                              <p className="text-2xl font-bold text-red-600">
                                {cronLastRun.failedCount}
                              </p>
                              <p className="text-xs text-muted-foreground">Failed</p>
                            </div>
                            <div className="p-3 border rounded-lg text-center">
                              <p className="text-2xl font-bold text-orange-600">
                                {cronLastRun.cleanupDeleted || 0}
                              </p>
                              <p className="text-xs text-muted-foreground">Cleaned</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                )}

                <Separator />

                {/* Control Panel */}
                <div className="space-y-4">
                  <h4 className="font-semibold">Control Panel</h4>

                  {/* Schedule Selector */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Collection Schedule</label>
                    <Select value={cronSchedule} onValueChange={setCronSchedule}>
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
                        <SelectItem value="*/5 * * * *">
                          Every 5 minutes (Testing)
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Control Buttons */}
                  <div className="grid gap-2 md:grid-cols-2">
                    <Button
                      onClick={() => controlCron("start")}
                      disabled={cronStatus.isRunning || isCronLoading || !cronStatus.mongodbEnabled}
                      className="gap-2"
                    >
                      <Play className="h-4 w-4" />
                      Start Auto-Collection
                    </Button>

                    <Button
                      onClick={() => controlCron("stop")}
                      disabled={!cronStatus.isRunning || isCronLoading}
                      variant="destructive"
                      className="gap-2"
                    >
                      <Square className="h-4 w-4" />
                      Stop Auto-Collection
                    </Button>

                    <Button
                      onClick={() => controlCron("restart")}
                      disabled={!cronStatus.isRunning || isCronLoading}
                      variant="outline"
                      className="gap-2"
                    >
                      <RefreshCw className="h-4 w-4" />
                      Restart with New Schedule
                    </Button>

                    <Button
                      onClick={() => controlCron("trigger")}
                      disabled={isCronLoading || !cronStatus.mongodbEnabled}
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
                        <li>Fetches 16-day forecast for all {pumpLocations.length} pump stations</li>
                        <li>Runs every 14 days (2-day overlap ensures continuity)</li>
                        <li>Automatically cleans up data older than 30 days</li>
                        <li>Each station has its own MongoDB collection</li>
                      </ul>
                    </AlertDescription>
                  </Alert>

                  {!cronStatus.mongodbEnabled && (
                    <Alert variant="destructive">
                      <XCircle className="h-4 w-4" />
                      <AlertDescription>
                        <strong>MongoDB not configured!</strong>
                        <br />
                        Add MONGODB_URI to your .env.local file to enable automation.
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Collection History
              </CardTitle>
              <CardDescription>
                Track automatic forecast collection runs
              </CardDescription>
            </CardHeader>
            <CardContent>
              {cronStatus && cronStatus.statistics.totalRuns > 0 ? (
                <div className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="p-6 border rounded-lg text-center">
                      <div className="text-3xl font-bold text-blue-600">
                        {cronStatus.statistics.totalRuns}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">Total Runs</p>
                    </div>
                    <div className="p-6 border rounded-lg text-center">
                      <div className="text-3xl font-bold text-green-600">
                        {cronStatus.statistics.successCount}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">Successful</p>
                    </div>
                    <div className="p-6 border rounded-lg text-center">
                      <div className="text-3xl font-bold text-purple-600">
                        {cronStatus.statistics.successRate}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">Success Rate</p>
                    </div>
                  </div>

                  <Alert>
                    <Info className="h-4 w-4" />
                    <AlertDescription>
                      Automation has been running successfully. Check server logs for detailed run history.
                    </AlertDescription>
                  </Alert>
                </div>
              ) : (
                <div className="text-center py-12">
                  <Clock className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold">No Collection History</h3>
                  <p className="text-sm text-muted-foreground mt-2">
                    Start automation to begin tracking collection runs
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
