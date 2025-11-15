"use client"

import { useState, useEffect } from "react"
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
} from "recharts"
import { AlertCircle, Download, RefreshCw, Filter, TrendingUp, Clock } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Spinner } from "@/components/ui/spinner"
import StatisticCard from "./compare-with-actual/statistic-card"
import ChartCard from "./compare-with-actual/chart-card"
import ResultsTable from "./compare-with-actual/result-table"

// Types
interface Location {
  name: string
  predicted_rain_rate: number
  confidence: number
}

interface ComparisonResult {
  location: string
  status: "matched" | "no_data"
  predicted: {
    time: string
    rainRate: number
    confidence: number
  }
  actual: {
    time: string
    radarTime?: string
    rainRate: number
    dbz: number
    intensity: string
    timeDiffMinutes: number
  } | null
  comparison: {
    error: number
    errorPercentage: number
    isAccurate: boolean
    predictionQuality: "excellent" | "good" | "fair" | "poor"
  } | null
}

interface ComparisonData {
  success: boolean
  predictionTime: string
  toleranceMinutes: number
  comparisons: ComparisonResult[]
  statistics: {
    totalLocations: number
    matchedLocations: number
    unmatchedLocations: number
    averageError: number
    averageErrorPercentage: number
    accurateCount: number
    qualityDistribution: {
      excellent: number
      good: number
      fair: number
      poor: number
    }
  }
}

interface PredictionData {
  current: Location[]
  predictions: {
    [key: string]: Location[]
  }
  timestamp: string
}

interface TimeSeriesComparison {
  minutes: string
  data: ComparisonData
}

const ComparisonDashboard = () => {
  const [predictionData, setPredictionData] = useState<PredictionData | null>(null)
  const [allComparisons, setAllComparisons] = useState<TimeSeriesComparison[]>([])
  const [selectedLocation, setSelectedLocation] = useState<string>("all")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState<string>("")

  const timeSteps = ["30", "60", "90", "120", "150", "180"]

  const fetchPredictionData = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch("http://localhost:8000/api/results/latest")
      if (!response.ok) throw new Error("Failed to fetch prediction data")

      const data = await response.json()
      setPredictionData(data)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const compareAllTimeSteps = async () => {
    if (!predictionData) return

    try {
      setLoading(true)
      setError(null)
      setAllComparisons([])

      const results: TimeSeriesComparison[] = []

      for (let i = 0; i < timeSteps.length; i++) {
        const minutes = timeSteps[i]
        setProgress(`Comparing ${minutes} minutes prediction... (${i + 1}/${timeSteps.length})`)

        const predictions = predictionData.predictions[minutes]
        if (!predictions) {
          console.warn(`No prediction data for ${minutes} minutes`)
          continue
        }

        const baseTime = new Date(predictionData.timestamp)
        const predictionTime = new Date(baseTime.getTime() + Number.parseInt(minutes) * 60000)

        try {
          const response = await fetch("/api/rainfall/compare-prediction", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              predictionTime: predictionTime.toISOString(),
              locations: predictions,
              toleranceMinutes: 5,
            }),
          })

          if (response.ok) {
            const data = await response.json()
            results.push({ minutes, data })
          }
        } catch (err) {
          console.error(`Failed to compare ${minutes} minutes:`, err)
        }

        await new Promise((resolve) => setTimeout(resolve, 200))
      }

      setAllComparisons(results)
      setProgress("")
    } catch (err: any) {
      setError(err.message)
      setProgress("")
    } finally {
      setLoading(false)
    }
  }

  const exportAllToCSV = () => {
    if (allComparisons.length === 0) return

    const rows: string[] = []
    rows.push(
      "Time (min),Location,Status,Predicted Rain (mm/h),Confidence (%),Actual Rain (mm/h),Error (mm/h),Error (%),Quality",
    )

    allComparisons.forEach(({ minutes, data }) => {
      data.comparisons.forEach((comp) => {
        if (selectedLocation === "all" || comp.location === selectedLocation) {
          const row = [
            `+${minutes}`,
            comp.location,
            comp.status,
            (comp.predicted.rainRate || 0).toFixed(2),
            ((comp.predicted.confidence || 0) * 100).toFixed(1),
            comp.actual ? (comp.actual.rainRate || 0).toFixed(2) : "N/A",
            comp.comparison ? (comp.comparison.error || 0).toFixed(2) : "N/A",
            comp.comparison ? (comp.comparison.errorPercentage || 0).toFixed(2) : "N/A",
            comp.comparison ? comp.comparison.predictionQuality : "N/A",
          ]
          rows.push(row.join(","))
        }
      })
    })

    const csvContent = rows.join("\n")
    const blob = new Blob([csvContent], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `rainfall_comparison_all_${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  useEffect(() => {
    fetchPredictionData()
  }, [])

  const locations = predictionData?.current.map((loc) => loc.name) || []

  const getTimeSeriesData = () => {
    if (selectedLocation === "all") {
      return allComparisons.map(({ minutes, data }) => {
        const matched = data.comparisons.filter((c) => c.status === "matched" && c.actual && c.comparison)
        const avgPredicted =
          matched.length > 0 ? matched.reduce((sum, c) => sum + (c.predicted.rainRate || 0), 0) / matched.length : 0
        const avgActual =
          matched.length > 0 ? matched.reduce((sum, c) => sum + (c.actual?.rainRate || 0), 0) / matched.length : 0
        const avgError = data.statistics?.averageError || 0

        const baseTime = predictionData ? new Date(predictionData.timestamp) : new Date()
        const predTime = new Date(baseTime.getTime() + Number.parseInt(minutes) * 60000)

        const timeLabel = predTime.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })

        return {
          timeLabel,
          fullTime: predTime.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
          minutes: Number.parseInt(minutes),
          predicted: Number.parseFloat(avgPredicted.toFixed(2)),
          actual: Number.parseFloat(avgActual.toFixed(2)),
          error: Number.parseFloat(avgError.toFixed(2)),
          accuracy:
            data.statistics?.matchedLocations > 0
              ? Number.parseFloat(
                  (((data.statistics.accurateCount || 0) / data.statistics.matchedLocations) * 100).toFixed(1),
                )
              : 0,
        }
      })
    } else {
      return allComparisons.map(({ minutes, data }) => {
        const locationComp = data.comparisons.find((c) => c.location === selectedLocation)

        const baseTime = predictionData ? new Date(predictionData.timestamp) : new Date()
        const predTime = new Date(baseTime.getTime() + Number.parseInt(minutes) * 60000)

        const timeLabel = predTime.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })

        if (!locationComp || locationComp.status !== "matched") {
          return {
            timeLabel,
            fullTime: predTime.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
            minutes: Number.parseInt(minutes),
            predicted: 0,
            actual: 0,
            error: 0,
            accuracy: 0,
          }
        }

        return {
          timeLabel,
          fullTime: predTime.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
          minutes: Number.parseInt(minutes),
          predicted: locationComp.predicted.rainRate || 0,
          actual: locationComp.actual?.rainRate || 0,
          error: locationComp.comparison?.error || 0,
          accuracy: locationComp.comparison?.isAccurate ? 100 : 0,
        }
      })
    }
  }

  const getAccuracyOverTime = () => {
    return allComparisons.map(({ minutes, data }) => {
      const baseTime = predictionData ? new Date(predictionData.timestamp) : new Date()
      const predTime = new Date(baseTime.getTime() + Number.parseInt(minutes) * 60000)

      const timeLabel = predTime.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })

      return {
        timeLabel,
        accuracy:
          data.statistics?.matchedLocations > 0
            ? Number.parseFloat(
                (((data.statistics.accurateCount || 0) / data.statistics.matchedLocations) * 100).toFixed(1),
              )
            : 0,
        avgError: data.statistics?.averageError || 0,
        excellent: data.statistics?.qualityDistribution?.excellent || 0,
        good: data.statistics?.qualityDistribution?.good || 0,
        fair: data.statistics?.qualityDistribution?.fair || 0,
        poor: data.statistics?.qualityDistribution?.poor || 0,
      }
    })
  }

  const getOverallStats = () => {
    if (allComparisons.length === 0) return null

    let totalMatched = 0
    let totalAccurate = 0
    let totalError = 0
    const totalQuality = { excellent: 0, good: 0, fair: 0, poor: 0 }

    allComparisons.forEach(({ data }) => {
      totalMatched += data.statistics?.matchedLocations || 0
      totalAccurate += data.statistics?.accurateCount || 0
      totalError += (data.statistics?.averageError || 0) * (data.statistics?.matchedLocations || 0)
      totalQuality.excellent += data.statistics?.qualityDistribution?.excellent || 0
      totalQuality.good += data.statistics?.qualityDistribution?.good || 0
      totalQuality.fair += data.statistics?.qualityDistribution?.fair || 0
      totalQuality.poor += data.statistics?.qualityDistribution?.poor || 0
    })

    return {
      totalComparisons: allComparisons.length * (predictionData?.current.length || 0),
      totalMatched,
      avgError: totalMatched > 0 ? totalError / totalMatched : 0,
      overallAccuracy: totalMatched > 0 ? (totalAccurate / totalMatched) * 100 : 0,
      qualityDistribution: totalQuality,
    }
  }

  const overallStats = getOverallStats()
  const timeSeriesData = getTimeSeriesData()
  const accuracyData = getAccuracyOverTime()

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Rainfall Prediction Comparison</h1>
          <p className="text-muted-foreground">
            Compare all prediction horizons (30-180 minutes) with actual measurements
          </p>
          {predictionData && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground pt-2">
              <Clock className="w-4 h-4" />
              <span className="font-medium">Base Prediction Time:</span>
              <span className="font-semibold text-foreground">
                {new Date(predictionData.timestamp).toLocaleString("id-ID", {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </span>
            </div>
          )}
        </div>

        {/* Controls */}
        <Card>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2">
                  <Filter className="w-4 h-4" />
                  Filter by Location
                </label>
                <Select
                  value={selectedLocation}
                  onValueChange={setSelectedLocation}
                  disabled={allComparisons.length === 0}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Locations (Average)</SelectItem>
                    {locations.map((loc) => (
                      <SelectItem key={loc} value={loc}>
                        {loc}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button
                onClick={compareAllTimeSteps}
                disabled={loading || !predictionData}
                className="flex items-center justify-center gap-2 h-10 md:col-span-1 md:mt-6"
              >
                <TrendingUp className="w-4 h-4" />
                {loading ? "Comparing..." : "Compare All Time Steps"}
              </Button>

              <div className="flex gap-2 md:mt-6">
                <Button
                  onClick={fetchPredictionData}
                  disabled={loading}
                  variant="outline"
                  className="flex-1 bg-transparent"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Refresh
                </Button>
                <Button
                  onClick={exportAllToCSV}
                  disabled={allComparisons.length === 0}
                  variant="outline"
                  className="flex-1 bg-transparent"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Export
                </Button>
              </div>
            </div>

            {progress && (
              <Alert className="mt-4">
                <Clock className="h-4 w-4 animate-spin" />
                <AlertDescription>{progress}</AlertDescription>
              </Alert>
            )}

            {error && (
              <Alert variant="destructive" className="mt-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Overall Statistics */}
        {/* {overallStats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatisticCard
              label="Total Comparisons"
              value={overallStats.totalMatched}
              description={`across ${allComparisons.length} time steps`}
              valueClassName="text-blue-600"
            />
            <StatisticCard
              label="Average Error"
              value={`${overallStats.avgError.toFixed(2)} mm/h`}
              description="prediction error"
              valueClassName="text-orange-600"
            />
            <StatisticCard
              label="Overall Accuracy"
              value={`${overallStats.overallAccuracy.toFixed(1)}%`}
              description="predictions within 20% error"
              valueClassName="text-green-600"
            />
            <StatisticCard
              label="Excellent Predictions"
              value={overallStats.qualityDistribution.excellent}
              description="error < 10%"
              valueClassName="text-purple-600"
            />
          </div>
        )} */}

        {/* Charts */}
        {allComparisons.length > 0 && (
          <>
            <ChartCard
              title={
                selectedLocation === "all"
                  ? "Average Rainfall: Predicted vs Actual Over Time"
                  : `${selectedLocation}: Predicted vs Actual Over Time`
              }
              description="Comparison of predicted and actual rainfall rates over time steps"
            >
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={timeSeriesData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis
                    dataKey="timeLabel"
                    stroke="var(--color-muted-foreground)"
                    label={{ value: "Time (HH:MM)", position: "insideBottom", offset: -5 }}
                  />
                  <YAxis
                    stroke="var(--color-muted-foreground)"
                    label={{ value: "Rain Rate (mm/h)", angle: -90, position: "insideLeft" }}
                  />
                  <Tooltip
                    contentStyle={{ backgroundColor: "var(--color-card)", border: "1px solid var(--color-border)" }}
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload
                        return (
                          <div className="p-3 rounded-lg border border-border bg-card">
                            <p className="font-semibold text-foreground">{data.fullTime}</p>
                            <p className="text-sm text-blue-600">Predicted: {data.predicted.toFixed(2)} mm/h</p>
                            <p className="text-sm text-green-600">Actual: {data.actual.toFixed(2)} mm/h</p>
                            {/* <p className="text-sm text-orange-600">Error: {data.error.toFixed(2)} mm/h</p> */}
                          </div>
                        )
                      }
                      return null
                    }}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="predicted"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    name="Predicted"
                    dot={{ r: 3, fill: "#3b82f6" }}
                    activeDot={{ r: 5 }}
                  />

                  <Line
                    type="monotone"
                    dataKey="actual"
                    stroke="#f59e0b"
                    strokeWidth={2}
                    name="Actual"
                    dot={{ r: 3, fill: "#10b981" }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>

            {/* <ChartCard
              title="Prediction Error Over Time"
              description="Absolute error between predicted and actual measurements"
            >
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={timeSeriesData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis
                    dataKey="timeLabel"
                    stroke="var(--color-muted-foreground)"
                    label={{ value: "Time (HH:MM)", position: "insideBottom", offset: -5 }}
                  />
                  <YAxis
                    stroke="var(--color-muted-foreground)"
                    label={{ value: "Error (mm/h)", angle: -90, position: "insideLeft" }}
                  />
                  <Tooltip
                    contentStyle={{ backgroundColor: "var(--color-card)", border: "1px solid var(--color-border)" }}
                  />
                  <Legend />
                  <Bar dataKey="error" fill="hsl(var(--color-chart-4))" name="Absolute Error" />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard
              title="Accuracy Rate Over Time"
              description="Percentage of accurate predictions across all locations"
            >
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={accuracyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis
                    dataKey="timeLabel"
                    stroke="var(--color-muted-foreground)"
                    label={{ value: "Time (HH:MM)", position: "insideBottom", offset: -5 }}
                  />
                  <YAxis
                    stroke="var(--color-muted-foreground)"
                    domain={[0, 100]}
                    label={{ value: "Accuracy (%)", angle: -90, position: "insideLeft" }}
                  />
                  <Tooltip
                    contentStyle={{ backgroundColor: "var(--color-card)", border: "1px solid var(--color-border)" }}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="accuracy"
                    stroke="hsl(var(--color-chart-2))"
                    strokeWidth={3}
                    name="Accuracy Rate"
                    dot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Quality Distribution Over Time" description="Number of predictions by quality category">
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={accuracyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis
                    dataKey="timeLabel"
                    stroke="var(--color-muted-foreground)"
                    label={{ value: "Time (HH:MM)", position: "insideBottom", offset: -5 }}
                  />
                  <YAxis
                    stroke="var(--color-muted-foreground)"
                    label={{ value: "Number of Predictions", angle: -90, position: "insideLeft" }}
                  />
                  <Tooltip
                    contentStyle={{ backgroundColor: "var(--color-card)", border: "1px solid var(--color-border)" }}
                  />
                  <Legend />
                  <Bar dataKey="excellent" stackId="a" fill="hsl(var(--color-chart-2))" name="Excellent" />
                  <Bar dataKey="good" stackId="a" fill="hsl(var(--color-chart-1))" name="Good" />
                  <Bar dataKey="fair" stackId="a" fill="hsl(var(--color-chart-4))" name="Fair" />
                  <Bar dataKey="poor" stackId="a" fill="hsl(var(--color-chart-3))" name="Poor" />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard> */}

            <ResultsTable
              comparisons={allComparisons}
              selectedLocation={selectedLocation}
              predictionData={predictionData}
            />
          </>
        )}

        {loading && !progress && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Spinner className="h-12 w-12 text-primary mb-4" />
              <p className="text-muted-foreground">Loading prediction data...</p>
            </CardContent>
          </Card>
        )}

        {!loading && allComparisons.length === 0 && !error && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <TrendingUp className="h-16 w-16 text-muted mb-4" />
              <p className="text-foreground text-lg font-medium">
                Click "Compare All Time Steps" to analyze prediction accuracy
              </p>
              <p className="text-muted-foreground text-sm mt-2">
                This will compare predictions at 30, 60, 90, 120, 150, and 180 minutes
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

export default ComparisonDashboard
