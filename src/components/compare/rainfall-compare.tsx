"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Loader2, CloudRain, AlertCircle, Calendar, Download } from "lucide-react"
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
  ReferenceLine,
} from "recharts"

interface LocationComparison {
  name: string
  lat: number
  lng: number
  realAvg: number
  predictedAvg: number
  correlation: number
  mape: number
  rmse: number
  dataPoints: number
}

interface ChartDataPoint {
  timestamp: string
  time: string
  [key: string]: any
}

function formatDateTime(isoString: string): string {
  const date = new Date(isoString)
  const day = date.getDate().toString().padStart(2, "0")
  const month = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][date.getMonth()]
  const hours = date.getHours().toString().padStart(2, "0")
  const minutes = date.getMinutes().toString().padStart(2, "0")
  return `${day}-${month} ${hours}:${minutes}`
}

function formatDate(date: Date): string {
  const year = date.getFullYear()
  const month = (date.getMonth() + 1).toString().padStart(2, "0")
  const day = date.getDate().toString().padStart(2, "0")
  return `${year}-${month}-${day}`
}

export default function RainfallComparisonDashboard() {
  const [locations, setLocations] = useState<any[]>([])
  const [allLocationData, setAllLocationData] = useState<Map<string, any[]>>(new Map())
  const [locationStats, setLocationStats] = useState<LocationComparison[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dateRange, setDateRange] = useState({
    startDate: formatDate(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)),
    endDate: formatDate(new Date()),
  })
  const [selectedLocationDetail, setSelectedLocationDetail] = useState<string | null>(null)

  // Fetch pump locations
  useEffect(() => {
    async function fetchLocations() {
      try {
        const response = await fetch("/api/history?action=getLocations")
        const data = await response.json()
        if (data.success) {
          setLocations(data.locations)
        }
      } catch (error) {
        console.error("Failed to load locations:", error)
      }
    }
    fetchLocations()
  }, [])

  const handleFetchAllComparisons = async () => {
    if (locations.length === 0) {
      setError("No locations available")
      return
    }

    setIsLoading(true)
    setError(null)
    setAllLocationData(new Map())
    setLocationStats([])

    try {
      const stats: LocationComparison[] = []
      const dataMap = new Map<string, any[]>()

      for (const location of locations) {
        const realData = await fetchRealData(location, dateRange.startDate, dateRange.endDate)
        const predictedData = await fetchPredictedData(location, dateRange.startDate, dateRange.endDate)
        const merged = mergeDataSources(realData, predictedData)

        dataMap.set(location.name, merged)
        const locStats = calculateLocationStats(merged, location)
        stats.push(locStats)
      }

      setAllLocationData(dataMap)
      setLocationStats(stats)
    } catch (err) {
      setError((err as Error).message)
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }

  // Fetch real data from rainfall_records (BMKG)
  async function fetchRealData(location: any, startDate: string, endDate: string) {
    try {
      const response = await fetch(
        `/api/rainfall-comparison?source=bmkg&lat=${location.lat}&lng=${location.lng}&startDate=${startDate}&endDate=${endDate}`,
      )
      const data = await response.json()
      return data.success ? data.data : []
    } catch (error) {
      console.error(`Failed to fetch real data for ${location.name}:`, error)
      return []
    }
  }

  // Fetch predicted data from Open-Meteo
  async function fetchPredictedData(location: any, startDate: string, endDate: string) {
    try {
      const response = await fetch(
        `/api/history?action=fetchData&lat=${location.lat}&lng=${location.lng}&startDate=${startDate}&endDate=${endDate}`,
      )
      const data = await response.json()

      if (data.success && data.data) {
        return data.data.hourly.time.map((time: string, i: number) => ({
          timestamp: time,
          rainfall: data.data.hourly.precipitation[i] || 0,
        }))
      }
      return []
    } catch (error) {
      console.error(`Failed to fetch predicted data for ${location.name}:`, error)
      return []
    }
  }

  // Merge data from both sources by timestamp
  function mergeDataSources(realData: any[], predictedData: any[]) {
    const merged: any[] = []
    const predictedMap = new Map()

    predictedData.forEach((item) => {
      const hourKey = new Date(item.timestamp).toISOString().slice(0, 13)
      predictedMap.set(hourKey, item.rainfall)
    })

    realData.forEach((realItem) => {
      const hourKey = new Date(realItem.timestamp).toISOString().slice(0, 13)
      const predictedValue = predictedMap.get(hourKey) || 0

      merged.push({
        timestamp: realItem.timestamp,
        realRainfall: realItem.rainfall,
        predictedRainfall: predictedValue,
        difference: realItem.rainfall - predictedValue,
      })
    })

    return merged.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
  }

  function calculateLocationStats(data: any[], location: any): LocationComparison {
    if (data.length === 0) {
      return {
        name: location.name,
        lat: location.lat,
        lng: location.lng,
        realAvg: 0,
        predictedAvg: 0,
        correlation: 0,
        mape: 0,
        rmse: 0,
        dataPoints: 0,
      }
    }

    const realValues = data.map((d) => d.realRainfall)
    const predictedValues = data.map((d) => d.predictedRainfall)

    const realAvg = realValues.reduce((a, b) => a + b, 0) / data.length
    const predictedAvg = predictedValues.reduce((a, b) => a + b, 0) / data.length

    const mae = data.reduce((sum, d) => sum + Math.abs(d.difference), 0) / data.length
    const mse = data.reduce((sum, d) => sum + Math.pow(d.difference, 2), 0) / data.length
    const rmse = Math.sqrt(mse)

    const mape =
      (data.reduce((sum, d) => {
        const divisor = Math.abs(d.realRainfall)
        return divisor > 0 ? sum + Math.abs(d.difference) / divisor : sum
      }, 0) /
        data.length) *
      100

    const correlation = calculateCorrelation(realValues, predictedValues)

    return {
      name: location.name,
      lat: location.lat,
      lng: location.lng,
      realAvg: Number.parseFloat(realAvg.toFixed(2)),
      predictedAvg: Number.parseFloat(predictedAvg.toFixed(2)),
      correlation: Number.parseFloat(correlation.toFixed(3)),
      mape: Number.parseFloat(mape.toFixed(2)),
      rmse: Number.parseFloat(rmse.toFixed(2)),
      dataPoints: data.length,
    }
  }

  function calculateCorrelation(x: number[], y: number[]): number {
    const n = x.length
    if (n === 0) return 0

    const meanX = x.reduce((a, b) => a + b, 0) / n
    const meanY = y.reduce((a, b) => a + b, 0) / n

    let numerator = 0
    let denomX = 0
    let denomY = 0

    for (let i = 0; i < n; i++) {
      const diffX = x[i] - meanX
      const diffY = y[i] - meanY
      numerator += diffX * diffY
      denomX += diffX * diffX
      denomY += diffY * diffY
    }

    if (denomX === 0 || denomY === 0) return 0
    return numerator / Math.sqrt(denomX * denomY)
  }

  // Download CSV
  const handleDownloadCSV = () => {
    if (locationStats.length === 0) return

    const headers = "Location,Real Avg (mm/h),Predicted Avg (mm/h),Correlation,RMSE,MAPE (%),Data Points"
    const rows = locationStats.map(
      (stat) =>
        `${stat.name},${stat.realAvg},${stat.predictedAvg},${stat.correlation},${stat.rmse},${stat.mape},${stat.dataPoints}`,
    )
    const csvContent = `data:text/csv;charset=utf-8,${headers}\n${rows.join("\n")}`

    const link = document.createElement("a")
    link.href = encodeURI(csvContent)
    link.download = `rainfall_all_stations_${dateRange.startDate}_${dateRange.endDate}.csv`
    link.click()
  }

  // Get detail chart data for selected location
  const selectedLocationData = selectedLocationDetail ? allLocationData.get(selectedLocationDetail) || [] : []
  const selectedChartData = selectedLocationData.map((d) => ({
    ...d,
    time: formatDateTime(d.timestamp),
  }))

  const allStationsComparisonData = locationStats.map((stat) => ({
    name: stat.name,
    realAvg: stat.realAvg,
    predictedAvg: stat.predictedAvg,
  }))

  return (
    <div className="space-y-6 p-6 bg-gradient-to-br from-slate-50 to-slate-100 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Rainfall Prediction Dashboard</h1>
          <p className="text-slate-600 mt-1">Real Data vs Predicted Rainfall for All Pump Stations</p>
        </div>
        <div className="flex items-center gap-2 bg-white p-3 rounded-lg shadow">
          <CloudRain className="h-8 w-8 text-blue-500" />
        </div>
      </div>

      {/* Controls */}
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Data Selection</CardTitle>
          <CardDescription>Select date range to compare real vs predicted rainfall for all stations</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">Start Date</label>
              <input
                type="date"
                value={dateRange.startDate}
                onChange={(e) => setDateRange((prev) => ({ ...prev, startDate: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">End Date</label>
              <input
                type="date"
                value={dateRange.endDate}
                onChange={(e) => setDateRange((prev) => ({ ...prev, endDate: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              onClick={handleFetchAllComparisons}
              disabled={isLoading || locations.length === 0}
              className="flex-1"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Loading...
                </>
              ) : (
                <>
                  <CloudRain className="h-4 w-4 mr-2" />
                  Compare All Stations
                </>
              )}
            </Button>
            <Button onClick={handleDownloadCSV} disabled={locationStats.length === 0} variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Download Summary
            </Button>
          </div>
        </CardContent>
      </Card>

      {locationStats.length > 0 && (
        <>
          <Card className="shadow-lg border-0">
            <CardHeader className="bg-slate-800 text-white rounded-t-lg">
              <CardTitle className="text-lg">Predicted vs. Actual Rain Rate by Location (All Locations)</CardTitle>
            </CardHeader>
            <CardContent className="bg-slate-800 rounded-b-lg p-0">
              <div className="h-[600px] bg-slate-900">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={allStationsComparisonData} margin={{ top: 20, right: 30, left: 60, bottom: 180 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#444" vertical={false} />
                    <XAxis
                      dataKey="name"
                      angle={-90}
                      textAnchor="end"
                      height={160}
                      interval={0}
                      tick={{ fontSize: 10, fill: "#999" }}
                      axisLine={{ stroke: "#444" }}
                    />
                    <YAxis
                      label={{ value: "Rain Rate (mm/h)", angle: -90, position: "insideLeft", fill: "#999" }}
                      tick={{ fontSize: 11, fill: "#999" }}
                      axisLine={{ stroke: "#444" }}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#1e293b",
                        border: "1px solid #475569",
                        borderRadius: "8px",
                        color: "#e2e8f0",
                      }}
                      formatter={(value) => (typeof value === "number" ? value.toFixed(4) : value)}
                      labelStyle={{ color: "#e2e8f0" }}
                    />
                    <Legend wrapperStyle={{ paddingTop: "20px", color: "#e2e8f0" }} iconType="square" />
                    <Bar dataKey="realAvg" name="Actual Rain Rate" fill="#1e40af" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="predictedAvg" name="Predicted Rain Rate" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {locationStats.map((stat) => (
              <Card
                key={stat.name}
                className="cursor-pointer hover:shadow-lg transition-shadow"
                onClick={() => setSelectedLocationDetail(stat.name)}
              >
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">{stat.name}</CardTitle>
                  <CardDescription className="text-xs">
                    {stat.lat.toFixed(4)}°, {stat.lng.toFixed(4)}°
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-green-50 p-2 rounded">
                      <p className="text-xs text-green-600 font-semibold">Real Avg</p>
                      <p className="text-lg font-bold text-green-700">{stat.realAvg}</p>
                      <p className="text-xs text-slate-500">mm/h</p>
                    </div>
                    <div className="bg-orange-50 p-2 rounded">
                      <p className="text-xs text-orange-600 font-semibold">Predicted</p>
                      <p className="text-lg font-bold text-orange-700">{stat.predictedAvg}</p>
                      <p className="text-xs text-slate-500">mm/h</p>
                    </div>
                  </div>

                  <div className="flex justify-between items-center text-sm">
                    <div>
                      <p className="text-xs text-slate-500">Correlation</p>
                      <p className={`font-bold ${stat.correlation > 0.7 ? "text-blue-600" : "text-amber-600"}`}>
                        {stat.correlation}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">MAPE</p>
                      <p className={`font-bold ${stat.mape < 30 ? "text-green-600" : "text-red-600"}`}>{stat.mape}%</p>
                    </div>
                  </div>

                  <div className="text-xs text-slate-500 border-t pt-2">{stat.dataPoints} data points</div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="shadow-lg bg-gradient-to-r from-blue-50 to-blue-100 border-blue-200">
            <CardHeader>
              <CardTitle>Overall Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-sm text-slate-600">Total Stations</p>
                  <p className="text-2xl font-bold text-blue-700">{locationStats.length}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-600">Avg Correlation</p>
                  <p className="text-2xl font-bold text-blue-700">
                    {(locationStats.reduce((sum, s) => sum + s.correlation, 0) / locationStats.length).toFixed(3)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-slate-600">Avg RMSE</p>
                  <p className="text-2xl font-bold text-blue-700">
                    {(locationStats.reduce((sum, s) => sum + s.rmse, 0) / locationStats.length).toFixed(2)} mm/h
                  </p>
                </div>
                <div>
                  <p className="text-sm text-slate-600">Avg MAPE</p>
                  <p className="text-2xl font-bold text-blue-700">
                    {(locationStats.reduce((sum, s) => sum + s.mape, 0) / locationStats.length).toFixed(2)}%
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {selectedLocationDetail && selectedChartData.length > 0 && (
        <>
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle>Time Series Comparison - {selectedLocationDetail}</CardTitle>
              <CardDescription>Real vs Predicted Rainfall Over Time</CardDescription>
              <Button variant="ghost" size="sm" onClick={() => setSelectedLocationDetail(null)} className="w-fit mt-2">
                Close Detail View
              </Button>
            </CardHeader>
            <CardContent className="h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={selectedChartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="time" fontSize={11} angle={-45} textAnchor="end" height={80} />
                  <YAxis label={{ value: "Rainfall (mm/h)", angle: -90, position: "insideLeft" }} fontSize={11} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "rgba(255, 255, 255, 0.95)",
                      border: "1px solid #ccc",
                      borderRadius: "8px",
                    }}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="realRainfall"
                    name="Real Data"
                    stroke="#10b981"
                    strokeWidth={2.5}
                    dot={{ r: 3 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="predictedRainfall"
                    name="Predicted Data"
                    stroke="#f59e0b"
                    strokeWidth={2.5}
                    dot={{ r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle>Prediction Error - {selectedLocationDetail}</CardTitle>
              <CardDescription>Difference between real and predicted (Positive = Underpredicting)</CardDescription>
            </CardHeader>
            <CardContent className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={selectedChartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="time" fontSize={11} angle={-45} textAnchor="end" height={80} />
                  <YAxis label={{ value: "Error (mm/h)", angle: -90, position: "insideLeft" }} fontSize={11} />
                  <Tooltip />
                  <ReferenceLine y={0} stroke="#666" />
                  <Bar dataKey="difference" name="Error" fill="#ef4444" fillOpacity={0.7} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </>
      )}

      {isLoading && (
        <Card className="p-12 shadow-lg">
          <div className="text-center space-y-4 flex flex-col items-center">
            <Loader2 className="h-12 w-12 text-blue-500 animate-spin" />
            <div>
              <h3 className="text-lg font-semibold text-slate-800">Loading data for all stations...</h3>
              <p className="text-sm text-slate-500 mt-1">Fetching real data and predictions</p>
            </div>
          </div>
        </Card>
      )}

      {!isLoading && locationStats.length === 0 && locations.length > 0 && (
        <Card className="p-12 shadow-lg">
          <div className="text-center space-y-4">
            <Calendar className="h-12 w-12 text-slate-400 mx-auto" />
            <div>
              <h3 className="text-lg font-semibold text-slate-800">No data available</h3>
              <p className="text-sm text-slate-500 mt-1">Click "Compare All Stations" to load rainfall predictions</p>
            </div>
          </div>
        </Card>
      )}
    </div>
  )
}
