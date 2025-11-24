"use client"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Calendar as CalendarComponent } from "@/components/ui/calendar"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Activity, AlertCircle, Calendar, Download, Loader2, TrendingUp } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  Tooltip as RechartsTooltip,
  ReferenceLine,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts"

interface ComparisonData {
  timestamp: string
  bmkgRainfall: number | null
  openMeteoRainfall: number | null
  forecastRainfall: number | null
  difference: number | null
  location: string
  source: "bmkg" | "openmeteo" | "both" | "forecast"
  dataCount?: number
  minValue?: number
  maxValue?: number
}

interface RawBmkgData {
  timestamp: string
  rainfall: number
  dataCount: number
  minValue: number
  maxValue: number
}

interface RawOpenMeteoData {
  timestamp: string
  rainfall: number
}

interface RawForecastData {
  pumpName: string
  hourly: {
    time: string[]
    rain: number[]
    precipitation: number[]
    precipitation_probability: number[]
  }
  fetchedAt: string
  forecastStartDate: string
  forecastEndDate: string
}

// Interface Generic untuk Statistik
interface StatsSummary {
  totalDataPoints: number
  avg1: number // Generic Average 1
  avg2: number // Generic Average 2
  rmse: number
  mae: number
  bias: number
  correlation: number
}

function formatDateTime(isoString: string): string {
  const date = new Date(isoString)
  const day = date.getDate().toString().padStart(2, "0")
  const month = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"][date.getMonth()]
  const hours = date.getHours().toString().padStart(2, "0")
  const minutes = date.getMinutes().toString().padStart(2, "0")
  return `${day}-${month} ${hours}:${minutes}`
}

function formatTimestampForCSV(isoString: string): string {
  const date = new Date(isoString)
  const year = date.getFullYear()
  const month = (date.getMonth() + 1).toString().padStart(2, "0")
  const day = date.getDate().toString().padStart(2, "0")
  const hours = date.getHours().toString().padStart(2, "0")
  const minutes = date.getMinutes().toString().padStart(2, "0")
  return `${year}-${month}-${day} ${hours}:${minutes}`
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const dataPoint = payload[0].payload
    const formattedTime = formatTimestampForCSV(dataPoint?.timestamp || label)

    return (
      <div className="p-4 bg-white border border-gray-300 rounded-lg shadow-xl">
        <p className="font-semibold text-sm text-gray-900 mb-3">{formattedTime}</p>
        {payload.map((p: any, i: number) => (
          <div key={i} style={{ color: p.color }} className="text-xs font-medium mb-2">
            {p.name}: <span className="font-bold text-sm">{(p.value ?? 0).toFixed(2)} mm/h</span>
          </div>
        ))}
      </div>
    )
  }
  return null
}

export default function RainfallComparisonDashboard() {
  const [locations, setLocations] = useState<any[]>([])
  const [selectedLocation, setSelectedLocation] = useState<string>("")
  const [comparisonData, setComparisonData] = useState<ComparisonData[]>([])

  // State untuk Statistik
  const [historicalStats, setHistoricalStats] = useState<StatsSummary | null>(null)
  const [forecastStats, setForecastStats] = useState<StatsSummary | null>(null)

  // State Tab Aktif
  const [activeTab, setActiveTab] = useState("historical")

  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dateRange, setDateRange] = useState({
    startDate: formatDate(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)),
    endDate: formatDate(new Date()),
  })

  useEffect(() => {
    async function fetchLocations() {
      const baseUrl = window.location.origin
      try {
        const response = await fetch(`${baseUrl}/api/forecasts/all-latest`)
        const data = await response.json()
        if (data.success && data.data.length > 0) {
          const pumpLocations = data.data.map((pump: any, index: number) => ({
            id: `${pump.pumpName.replace(/\s+/g, "-")}-${index}`,
            name: pump.pumpName,
            lat: pump.pumpLat,
            lng: pump.pumpLng,
          }))
          setLocations(pumpLocations)
          if (pumpLocations.length > 0) {
            setSelectedLocation(pumpLocations[0].name)
          }
        } else {
          const historyResponse = await fetch(`${baseUrl}/api/history?action=getLocations`)
          const historyData = await historyResponse.json()
          if (historyData.success) {
            setLocations(historyData.locations)
            if (historyData.locations.length > 0) {
              setSelectedLocation(historyData.locations[0].name)
            }
          }
        }
      } catch (error) {
        console.error("Gagal memuat lokasi:", error)
      }
    }
    fetchLocations()
  }, [])

  const handleFetchComparison = async () => {
    if (!selectedLocation) {
      setError("Silakan pilih lokasi")
      return
    }

    setIsLoading(true)
    setError(null)
    setComparisonData([])
    setHistoricalStats(null)
    setForecastStats(null)

    try {
      const location = locations.find((loc) => loc.name === selectedLocation)
      if (!location) {
        throw new Error("Lokasi tidak ditemukan")
      }

      const [bmkgData, openMeteoData, forecastData] = await Promise.all([
        fetchBMKGData(location, dateRange.startDate, dateRange.endDate),
        fetchOpenMeteoData(location, dateRange.startDate, dateRange.endDate),
        fetchForecastData(location.name, dateRange.startDate, dateRange.endDate),
      ])

      const merged = mergeDataSources(bmkgData, openMeteoData, forecastData, selectedLocation)
      setComparisonData(merged)

      // Hitung Statistik Historis (BMKG vs Open-Meteo)
      const hStats = calculateStatistics(merged, "bmkgRainfall", "openMeteoRainfall")
      setHistoricalStats(hStats)

      // Hitung Statistik Forecast (Open-Meteo History vs Forecast)
      const fStats = calculateStatistics(merged, "openMeteoRainfall", "forecastRainfall")
      setForecastStats(fStats)

    } catch (err) {
      setError((err as Error).message)
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }

  async function fetchBMKGData(location: any, startDate: string, endDate: string): Promise<RawBmkgData[]> {
    const baseUrl = window.location.origin
    try {
      const response = await fetch(
        `${baseUrl}/api/rainfall-comparison?source=bmkg&name=${encodeURIComponent(location.name)}&startDate=${startDate}&endDate=${endDate}`,
      )
      const data = await response.json()
      return data.success
        ? data.data.sort(
            (a: RawBmkgData, b: RawBmkgData) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
          )
        : []
    } catch (error) {
      console.error("Gagal mengambil data BMKG:", error)
      return []
    }
  }

  async function fetchOpenMeteoData(location: any, startDate: string, endDate: string): Promise<RawOpenMeteoData[]> {
    const baseUrl = window.location.origin
    try {
      const response = await fetch(
        `${baseUrl}/api/history?action=fetchData&lat=${location.lat}&lng=${location.lng}&startDate=${startDate}&endDate=${endDate}&locationName=${encodeURIComponent(location.name)}`,
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
      console.error("Gagal mengambil data Open-Meteo:", error)
      return []
    }
  }

  async function fetchForecastData(pumpName: string, startDate: string, endDate: string): Promise<RawForecastData | null> {
    const baseUrl = window.location.origin
    try {
      const response = await fetch(
        `${baseUrl}/api/forecasts/${encodeURIComponent(pumpName)}?startDate=${startDate}&endDate=${endDate}`,
      )
      const data = await response.json()
      if (data.success && data.data) {
        return data.data
      }
      return null
    } catch (error) {
      console.error("Gagal mengambil data Forecast:", error)
      return null
    }
  }

  function mergeDataSources(
    bmkgData: RawBmkgData[],
    openMeteoData: RawOpenMeteoData[],
    forecastData: RawForecastData | null,
    locationName: string,
  ): ComparisonData[] {
    const dataMap = new Map<string, Partial<ComparisonData>>()

    const normalizeToHourKey = (timestamp: string): string => {
      if (!timestamp) return ""
      const date = new Date(timestamp)
      if (isNaN(date.getTime())) return ""

      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, "0")
      const day = String(date.getDate()).padStart(2, "0")
      const hour = String(date.getHours()).padStart(2, "0")
      return `${year}-${month}-${day}T${hour}`
    }

    // 1. Map data Open-Meteo (History)
    const openMeteoHourMap = new Map<string, number>()
    openMeteoData.forEach((item) => {
      const hourKey = normalizeToHourKey(item.timestamp)
      if (hourKey) {
        openMeteoHourMap.set(hourKey, Number.parseFloat((item.rainfall ?? 0).toFixed(2)))
      }
    })

    // 2. Map data Forecast
    const forecastMap = new Map<string, number>()
    if (forecastData) {
      forecastData.hourly.time.forEach((time, index) => {
        const hourKey = normalizeToHourKey(time)
        if (hourKey) {
          const precip = forecastData.hourly.precipitation?.[index] ?? forecastData.hourly.rain?.[index] ?? 0
          forecastMap.set(hourKey, Number.parseFloat(precip.toFixed(2)))
        }
      })
    }

    // 3. Proses BMKG Data (History)
    bmkgData.forEach((item) => {
      const hourKey = normalizeToHourKey(item.timestamp)
      if (!hourKey) return

      const openMeteoVal = openMeteoHourMap.get(hourKey)
      const forecastVal = forecastMap.get(hourKey)

      const bmkgVal = Number.parseFloat((item.rainfall ?? 0).toFixed(2))
      const openMeteoRainfall = openMeteoVal !== undefined ? openMeteoVal : null
      const forecastRainfall = forecastVal !== undefined ? forecastVal : null

      dataMap.set(item.timestamp, {
        timestamp: item.timestamp,
        bmkgRainfall: bmkgVal,
        openMeteoRainfall: openMeteoRainfall,
        forecastRainfall: forecastRainfall,
        difference: openMeteoRainfall !== null ? Number.parseFloat((bmkgVal - openMeteoRainfall).toFixed(2)) : null,
        location: locationName,
        source: openMeteoRainfall !== null ? "both" : "bmkg",
        dataCount: item.dataCount ?? 0,
        minValue: item.minValue ?? 0,
        maxValue: item.maxValue ?? 0,
      })
    })

    // 4. Proses sisa Open-Meteo Data (History)
    openMeteoData.forEach((item) => {
      const hourKey = normalizeToHourKey(item.timestamp)
      if (!hourKey) return

      const existingEntry = Array.from(dataMap.values()).find(
        (entry) => entry.timestamp && normalizeToHourKey(entry.timestamp) === hourKey
      )

      if (!existingEntry) {
        const openMeteoVal = Number.parseFloat((item.rainfall ?? 0).toFixed(2))

        const forecastVal = forecastMap.get(hourKey)
        const forecastRainfall = forecastVal !== undefined ? forecastVal : null

        dataMap.set(item.timestamp, {
          timestamp: item.timestamp,
          bmkgRainfall: 0,
          openMeteoRainfall: openMeteoVal,
          forecastRainfall: forecastRainfall,
          difference: Number.parseFloat((0 - openMeteoVal).toFixed(2)),
          location: locationName,
          source: "openmeteo",
        })
      }
    })

    // 5. Proses sisa Forecast Data
    if (forecastData) {
      forecastData.hourly.time.forEach((time, index) => {
        const hourKey = normalizeToHourKey(time)
        if (!hourKey) return

        const existingEntry = Array.from(dataMap.values()).find(
          (entry) => entry.timestamp && normalizeToHourKey(entry.timestamp) === hourKey
        )

        if (!existingEntry && !dataMap.has(time)) {
          const precip = forecastData.hourly.precipitation?.[index] ?? forecastData.hourly.rain?.[index] ?? 0
          const forecastVal = Number.parseFloat(precip.toFixed(2))

          dataMap.set(time, {
            timestamp: time,
            bmkgRainfall: null,
            openMeteoRainfall: null,
            forecastRainfall: forecastVal,
            difference: null,
            location: locationName,
            source: "forecast",
          })
        }
      })
    }

    const merged = Array.from(dataMap.values()) as ComparisonData[]
    return merged.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
  }

  function formatDate(date: Date): string {
    const year = date.getFullYear()
    const month = (date.getMonth() + 1).toString().padStart(2, "0")
    const day = date.getDate().toString().padStart(2, "0")
    return `${year}-${month}-${day}`
  }

  // Update: Fungsi Generik untuk menghitung statistik berdasarkan key dinamis
  function calculateStatistics(data: ComparisonData[], key1: keyof ComparisonData, key2: keyof ComparisonData): StatsSummary {
    const pairedData = data
      .filter((d) => {
        const val1 = d[key1];
        const val2 = d[key2];
        return typeof val1 === 'number' && typeof val2 === 'number';
      })
      .map((d) => ({
        val1: d[key1] as number,
        val2: d[key2] as number,
        diff: (d[key1] as number) - (d[key2] as number),
      }))

    if (pairedData.length === 0) {
      return {
        totalDataPoints: 0,
        avg1: 0,
        avg2: 0,
        rmse: 0,
        mae: 0,
        bias: 0,
        correlation: 0,
      }
    }

    const values1 = pairedData.map((d) => d.val1)
    const values2 = pairedData.map((d) => d.val2)

    const avg1 = values1.reduce((a, b) => a + b, 0) / pairedData.length
    const avg2 = values2.reduce((a, b) => a + b, 0) / pairedData.length

    const mae = pairedData.reduce((sum, d) => sum + Math.abs(d.diff), 0) / pairedData.length
    const mse = pairedData.reduce((sum, d) => sum + Math.pow(d.diff, 2), 0) / pairedData.length
    const rmse = Math.sqrt(mse)
    const bias = pairedData.reduce((sum, d) => sum + d.diff, 0) / pairedData.length

    const dev1 = values1.map((v) => v - avg1)
    const dev2 = values2.map((v) => v - avg2)
    const covariance = dev1.reduce((sum, dev, i) => sum + dev * dev2[i], 0) / pairedData.length
    const std1 = Math.sqrt(dev1.reduce((sum, dev) => sum + dev * dev, 0) / pairedData.length)
    const std2 = Math.sqrt(dev2.reduce((sum, dev) => sum + dev * dev, 0) / pairedData.length)
    const correlation = std1 && std2 ? covariance / (std1 * std2) : 0

    return {
      totalDataPoints: pairedData.length,
      avg1: Number.parseFloat(avg1.toFixed(2)),
      avg2: Number.parseFloat(avg2.toFixed(2)),
      rmse: Number.parseFloat(rmse.toFixed(2)),
      mae: Number.parseFloat(mae.toFixed(2)),
      bias: Number.parseFloat(bias.toFixed(2)),
      correlation: Number.parseFloat(correlation.toFixed(3)),
    }
  }

  const handleDownloadCSV = () => {
    if (comparisonData.length === 0) return

    const headers = "Timestamp,BMKG (mm/h),Open-Meteo (mm/h),Forecast (mm/h),Location"
    const rows = comparisonData.map(
      (d) =>
        `${formatTimestampForCSV(d.timestamp)},${d.bmkgRainfall ?? 0},${
          d.openMeteoRainfall ?? 0
        },${d.forecastRainfall ?? 0},${d.location}`,
    )
    const csvContent = `data:text/csv;charset=utf-8,${headers}\n${rows.join("\n")}`

    const link = document.createElement("a")
    link.href = encodeURI(csvContent)
    link.download = `rainfall_comparison_${selectedLocation.replace(/\s+/g, "_")}_${dateRange.startDate}_${dateRange.endDate}.csv`
    link.click()
  }

  const historicalChartData = useMemo(() => {
    return comparisonData.filter(d => d.bmkgRainfall !== null || d.openMeteoRainfall !== null)
  }, [comparisonData])

  const forecastChartData = useMemo(() => {
    return comparisonData.filter(d => d.openMeteoRainfall !== null || d.forecastRainfall !== null)
  }, [comparisonData])

  const selectedLoc = locations.find((loc) => loc.name === selectedLocation)

  const handleDateSelect = (type: "startDate" | "endDate", date: Date | undefined) => {
    if (date) {
      const localDate = new Date(date.getFullYear(), date.getMonth(), date.getDate())
      setDateRange((prev) => ({ ...prev, [type]: formatDate(localDate) }))
    }
  }

  // Helper untuk konten Card Statistik Dinamis
  const currentStats = activeTab === "historical" ? historicalStats : forecastStats
  const statsTitle = activeTab === "historical"
    ? "Statistik Perbandingan Historis (BMKG vs Open-Meteo)"
    : "Statistik Evaluasi Forecast (History vs Forecast)"

  const labelAVG1 = activeTab === "historical" ? "Rata-rata BMKG" : "Rata-rata O-M (History)"
  const labelAVG2 = activeTab === "historical" ? "Rata-rata O-M" : "Rata-rata Forecast"

  return (
    <div className="min-h-screen w-full bg-white p-4 md:p-8">
      <div className="space-y-8 max-w-7xl mx-auto">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <h1 className="text-4xl font-bold text-black">Perbandingan Curah Hujan</h1>
          </div>
          <p className="text-gray-700 text-lg">Analisis Data Historis (BMKG Radar vs Open-Meteo) dan Prakiraan (Forecast)</p>
        </div>

        <Card className="bg-white border-gray-300 shadow-md hover:shadow-lg transition-shadow">
          <CardHeader className="pb-4 border-b border-gray-200">
            <CardTitle className="text-gray-900">Filter Data</CardTitle>
            <CardDescription className="text-gray-600">Pilih lokasi dan rentang tanggal untuk analisis</CardDescription>
          </CardHeader>
          <CardContent className="pt-6 space-y-6">
            {error && (
              <Alert variant="destructive" className="bg-red-50 border-red-200">
                <AlertCircle className="h-4 w-4 text-red-600" />
                <AlertTitle className="text-red-900">Error</AlertTitle>
                <AlertDescription className="text-red-800">{error}</AlertDescription>
              </Alert>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-3">
                <label className="text-sm font-semibold text-gray-900">Stasiun Pompa</label>
                <Select value={selectedLocation} onValueChange={setSelectedLocation}>
                  <SelectTrigger className="bg-white border-gray-300 text-gray-900 hover:border-gray-400 focus:border-gray-600 focus:ring-gray-500">
                    <SelectValue placeholder="Pilih lokasi..." />
                  </SelectTrigger>
                  <SelectContent className="bg-white border-gray-300">
                    {locations.map((loc) => (
                      <SelectItem key={loc.id} value={loc.name} className="text-gray-900">
                        {loc.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedLoc && (
                  <p className="text-xs text-gray-600">
                    📍 {selectedLoc.lat.toFixed(4)}°, {selectedLoc.lng.toFixed(4)}°
                  </p>
                )}
              </div>

              <div className="space-y-3">
                <label className="text-sm font-semibold text-gray-900">Tanggal Mulai</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-start text-left font-normal bg-white border-gray-300 text-gray-700 hover:bg-gray-50 hover:text-gray-900"
                    >
                      <Calendar className="mr-2 h-4 w-4 text-gray-600" />
                      {dateRange.startDate || <span>Pilih tanggal</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 bg-white border-gray-300">
                    <CalendarComponent
                      mode="single"
                      selected={new Date(dateRange.startDate)}
                      onSelect={(date) => handleDateSelect("startDate", date)}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-3">
                <label className="text-sm font-semibold text-gray-900">Tanggal Selesai</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-start text-left font-normal bg-white border-gray-300 text-gray-700 hover:bg-gray-50 hover:text-gray-900"
                    >
                      <Calendar className="mr-2 h-4 w-4 text-gray-600" />
                      {dateRange.endDate || <span>Pilih tanggal</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 bg-white border-gray-300">
                    <CalendarComponent
                      mode="single"
                      selected={new Date(dateRange.endDate)}
                      onSelect={(date) => handleDateSelect("endDate", date)}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 justify-end pt-2">
              <Button
                onClick={handleFetchComparison}
                disabled={isLoading || !selectedLocation}
                className="w-full sm:w-auto font-semibold shadow-md hover:shadow-lg transition-shadow"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Memuat...
                  </>
                ) : (
                  <>
                    <Activity className="h-4 w-4 mr-2" />
                    Bandingkan Data
                  </>
                )}
              </Button>
              <Button
                onClick={handleDownloadCSV}
                disabled={comparisonData.length === 0}
                variant="outline"
                className="w-full sm:w-auto bg-white border-gray-300 text-gray-900 hover:bg-gray-50"
              >
                <Download className="h-4 w-4 mr-2" />
                Unduh CSV
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* --- Card Statistik Dinamis --- */}
        {currentStats && currentStats.totalDataPoints > 0 && (
          <Card className="bg-white border-gray-300 shadow-md overflow-hidden mt-8">
            <CardHeader className="pb-4 border-b border-gray-200">
              <CardTitle className="text-gray-900">{statsTitle}</CardTitle>
              <CardDescription className="text-gray-600">
                Statistik dihitung berdasarkan data yang tumpang tindih (overlap) pada rentang tanggal yang dipilih.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {[
                { label: "Total Data", value: currentStats.totalDataPoints },
                { label: labelAVG1, value: `${currentStats.avg1} mm/h` },
                { label: labelAVG2, value: `${currentStats.avg2} mm/h` },
                { label: "RMSE", value: `${currentStats.rmse} mm/h` },
                { label: "MAE", value: `${currentStats.mae} mm/h` },
                { label: "Korelasi", value: currentStats.correlation },
              ].map((stat) => (
                <div key={stat.label} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <p className="text-xs font-medium text-gray-600">{stat.label}</p>
                  <p className="text-xl font-bold text-black">{stat.value}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {comparisonData.length > 0 && (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full mt-8">
            <TabsList className="grid w-full grid-cols-2 bg-gray-100 border border-gray-300">
              <TabsTrigger value="historical" className="data-[state=active]:bg-primary data-[state=active]:text-white">
                Perbandingan Historis
              </TabsTrigger>
              <TabsTrigger value="forecast" className="data-[state=active]:bg-primary data-[state=active]:text-white">
                Perbandingan Forecast
              </TabsTrigger>
            </TabsList>

            <TabsContent value="historical">
              <Card className="bg-white border-gray-300 shadow-md overflow-hidden mt-2">
                <CardHeader className="pb-4 border-b border-gray-200">
                  <CardTitle className="text-gray-900 flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-black" />
                    Grafik Perbandingan Historis
                  </CardTitle>
                  <CardDescription className="text-gray-600 mt-3 space-y-1">
                    <p>BMKG (History) vs Open-Meteo (History)</p>
                    <p className="text-xs text-gray-600">
                      Stasiun: <strong>{selectedLocation}</strong> | Periode: <strong>{dateRange.startDate}</strong> s/d{" "}
                      <strong>{dateRange.endDate}</strong>
                    </p>
                  </CardDescription>
                </CardHeader>
                <CardContent className="h-[500px] pt-6">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={historicalChartData} margin={{ top: 5, right: 30, left: 20, bottom: 80 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis
                        dataKey="timestamp"
                        tickFormatter={formatDateTime}
                        fontSize={11}
                        angle={-45}
                        textAnchor="end"
                        interval={Math.max(0, Math.floor(historicalChartData.length / 24))}
                        stroke="#6b7280"
                      />
                      <YAxis
                        label={{
                          value: "Laju Hujan (mm/h)",
                          angle: -90,
                          position: "insideLeft",
                          style: { textAnchor: "middle", fill: "#374151" },
                        }}
                        fontSize={11}
                        stroke="#6b7280"
                      />
                      <RechartsTooltip content={<CustomTooltip />} />
                      <Legend verticalAlign="top" height={36} wrapperStyle={{ paddingBottom: "10px" }} />
                      <Line
                        type="monotone"
                        dataKey="bmkgRainfall"
                        name="BMKG (History)"
                        stroke="#3b82f6"
                        strokeWidth={3}
                        dot={false}
                        connectNulls={true}
                        isAnimationActive={true}
                      />
                      <Line
                        type="monotone"
                        dataKey="openMeteoRainfall"
                        name="Open-Meteo (History)"
                        stroke="#f59e0b"
                        strokeWidth={3}
                        dot={false}
                        connectNulls={true}
                        isAnimationActive={true}
                      />
                      <ReferenceLine y={0} stroke="#d1d5db" strokeDasharray="3 3" />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="forecast">
              <Card className="bg-white border-gray-300 shadow-md overflow-hidden mt-2">
                <CardHeader className="pb-4 border-b border-gray-200">
                  <CardTitle className="text-gray-900 flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-black" />
                    Grafik Perbandingan Forecast
                  </CardTitle>
                  <CardDescription className="text-gray-600 mt-3 space-y-1">
                    <p>Open-Meteo (History) vs Open-Meteo (Forecast)</p>
                     <p className="text-xs text-gray-600">
                      Stasiun: <strong>{selectedLocation}</strong> | Data forecast ditampilkan 16 hari ke depan.
                    </p>
                  </CardDescription>
                </CardHeader>
                <CardContent className="h-[500px] pt-6">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={forecastChartData} margin={{ top: 5, right: 30, left: 20, bottom: 80 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis
                        dataKey="timestamp"
                        tickFormatter={formatDateTime}
                        fontSize={11}
                        angle={-45}
                        textAnchor="end"
                        interval={Math.max(0, Math.floor(forecastChartData.length / 24))}
                        stroke="#6b7280"
                      />
                      <YAxis
                        label={{
                          value: "Laju Hujan (mm/h)",
                          angle: -90,
                          position: "insideLeft",
                          style: { textAnchor: "middle", fill: "#374151" },
                        }}
                        fontSize={11}
                        stroke="#6b7280"
                      />
                      <RechartsTooltip content={<CustomTooltip />} />
                      <Legend verticalAlign="top" height={36} wrapperStyle={{ paddingBottom: "10px" }} />
                      <Line
                        type="monotone"
                        dataKey="openMeteoRainfall"
                        name="Open-Meteo (History)"
                        stroke="#f59e0b"
                        strokeWidth={3}
                        dot={false}
                        connectNulls={true}
                        isAnimationActive={true}
                      />
                      <Line
                        type="monotone"
                        dataKey="forecastRainfall"
                        name="Open-Meteo (Forecast)"
                        stroke="#22c55e"
                        strokeWidth={2}
                        dot={false}
                        connectNulls={true}
                        isAnimationActive={true}
                      />
                      <ReferenceLine y={0} stroke="#d1d5db" strokeDasharray="3 3" />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}

        {isLoading && (
          <Card className="bg-white border-gray-300 shadow-md mt-8">
            <div className="p-12 text-center space-y-4 flex flex-col items-center">
              <Loader2 className="h-16 w-16 text-black animate-spin" />
              <div>
                <h3 className="text-xl font-semibold text-gray-900">Memuat data perbandingan...</h3>
                <p className="text-sm text-gray-600 mt-2">Mengambil data dari BMKG, Open-Meteo History, dan Open-Meteo Forecast</p>
              </div>
            </div>
          </Card>
        )}

        {!isLoading && comparisonData.length === 0 && selectedLocation && (
          <Card className="bg-white border-gray-300 shadow-md mt-8">
            <div className="p-12 text-center space-y-4">
              <Calendar className="h-16 w-16 text-gray-400 mx-auto" />
              <div>
                <h3 className="text-xl font-semibold text-gray-900">Tidak ada data</h3>
                <p className="text-sm text-gray-600 mt-2">
                  Klik <strong>"Bandingkan Data"</strong> untuk memuat perbandingan untuk {selectedLocation}
                </p>
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  )
}
