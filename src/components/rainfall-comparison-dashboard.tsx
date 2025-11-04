"use client"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Calendar as CalendarComponent } from "@/components/ui/calendar"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
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
  difference: number | null
  location: string
  source: "bmkg" | "openmeteo" | "both"
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

interface StatsSummary {
  totalDataPoints: number
  bmkgAvg: number
  openMeteoAvg: number
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
    const bmkgData = payload.find((p: any) => p.dataKey === "bmkgRainfall")
    const dataPoint = bmkgData?.payload

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
  const [rawBmkgData, setRawBmkgData] = useState<RawBmkgData[]>([])
  const [rawOpenMeteoData, setRawOpenMeteoData] = useState<RawOpenMeteoData[]>([])
  const [stats, setStats] = useState<StatsSummary | null>(null)
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
        const response = await fetch(`${baseUrl}/api/history?action=getLocations`)
        const data = await response.json()
        if (data.success) {
          setLocations(data.locations)
          if (data.locations.length > 0) {
            setSelectedLocation(data.locations[0].name)
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
    setRawBmkgData([])
    setRawOpenMeteoData([])
    setStats(null)

    try {
      const location = locations.find((loc) => loc.name === selectedLocation)
      if (!location) {
        throw new Error("Lokasi tidak ditemukan")
      }

      const [bmkgData, openMeteoData] = await Promise.all([
        fetchBMKGData(location, dateRange.startDate, dateRange.endDate),
        fetchOpenMeteoData(location, dateRange.startDate, dateRange.endDate),
      ])

      setRawBmkgData(bmkgData)
      setRawOpenMeteoData(openMeteoData)

      const merged = mergeDataSources(bmkgData, openMeteoData, selectedLocation)
      setComparisonData(merged)

      const calculatedStats = calculateStatistics(merged)
      setStats(calculatedStats)
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
        `${baseUrl}/api/history?action=fetchData&lat=${location.lat}&lng=${location.lng}&startDate=${startDate}&endDate=${endDate}`,
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

  function mergeDataSources(
    bmkgData: RawBmkgData[],
    openMeteoData: RawOpenMeteoData[],
    locationName: string,
  ): ComparisonData[] {
    const dataMap = new Map<string, Partial<ComparisonData>>()

    const normalizeToHourKey = (timestamp: string): string => {
      const date = new Date(timestamp)
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, "0")
      const day = String(date.getDate()).padStart(2, "0")
      const hour = String(date.getHours()).padStart(2, "0")
      return `${year}-${month}-${day}T${hour}`
    }

    const openMeteoHourMap = new Map<string, number>()
    openMeteoData.forEach((item) => {
      const hourKey = normalizeToHourKey(item.timestamp)
      openMeteoHourMap.set(hourKey, Number.parseFloat((item.rainfall ?? 0).toFixed(2)))
    })

    bmkgData.forEach((item) => {
      const hourKey = normalizeToHourKey(item.timestamp)
      const openMeteoVal = openMeteoHourMap.get(hourKey)
      const bmkgVal = Number.parseFloat((item.rainfall ?? 0).toFixed(2))
      const openMeteoRainfall = openMeteoVal !== undefined ? openMeteoVal : null

      dataMap.set(item.timestamp, {
        timestamp: item.timestamp,
        bmkgRainfall: bmkgVal,
        openMeteoRainfall: openMeteoRainfall,
        difference: openMeteoRainfall !== null ? Number.parseFloat((bmkgVal - openMeteoRainfall).toFixed(2)) : null,
        location: locationName,
        source: openMeteoRainfall !== null ? "both" : "bmkg",
        dataCount: item.dataCount ?? 0,
        minValue: item.minValue ?? 0,
        maxValue: item.maxValue ?? 0,
      })
    })

    openMeteoData.forEach((item) => {
      const hourKey = normalizeToHourKey(item.timestamp)
      const openMeteoVal = Number.parseFloat((item.rainfall ?? 0).toFixed(2))
      const existingEntry = Array.from(dataMap.values()).find(
        (entry) => normalizeToHourKey(entry.timestamp!) === hourKey,
      )

      if (!existingEntry) {
        dataMap.set(item.timestamp, {
          timestamp: item.timestamp,
          bmkgRainfall: 0,
          openMeteoRainfall: openMeteoVal,
          difference: Number.parseFloat((0 - openMeteoVal).toFixed(2)),
          location: locationName,
          source: "openmeteo",
        })
      }
    })

    const merged = Array.from(dataMap.values()) as ComparisonData[]
    return merged.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
  }

    function formatDate(date: Date): string {
    const year = date.getFullYear()
    const month = (date.getMonth() + 1).toString().padStart(2, "0")
    const day = date.getDate().toString().padStart(2, "0")
    return `${year}-${month}-${day}`
  }

  function calculateStatistics(data: ComparisonData[]): StatsSummary {
    const pairedData = data.map((d) => ({
      ...d,
      bmkgRainfall: d.bmkgRainfall ?? 0,
      openMeteoRainfall: d.openMeteoRainfall ?? 0,
      difference: (d.bmkgRainfall ?? 0) - (d.openMeteoRainfall ?? 0),
    }))

    if (pairedData.length === 0) {
      return {
        totalDataPoints: 0,
        bmkgAvg: 0,
        openMeteoAvg: 0,
        rmse: 0,
        mae: 0,
        bias: 0,
        correlation: 0,
      }
    }

    const bmkgValues = pairedData.map((d) => d.bmkgRainfall!)
    const openMeteoValues = pairedData.map((d) => d.openMeteoRainfall!)

    const bmkgAvg = bmkgValues.reduce((a, b) => a + b, 0) / pairedData.length
    const openMeteoAvg = openMeteoValues.reduce((a, b) => a + b, 0) / pairedData.length

    const mae = pairedData.reduce((sum, d) => sum + Math.abs(d.difference || 0), 0) / pairedData.length
    const mse = pairedData.reduce((sum, d) => sum + Math.pow(d.difference || 0, 2), 0) / pairedData.length
    const rmse = Math.sqrt(mse)
    const bias = pairedData.reduce((sum, d) => sum + (d.difference || 0), 0) / pairedData.length

    const bmkgDev = bmkgValues.map((v) => v - bmkgAvg)
    const openMeteoDev = openMeteoValues.map((v) => v - openMeteoAvg)
    const covariance = bmkgDev.reduce((sum, dev, i) => sum + dev * openMeteoDev[i], 0) / pairedData.length
    const bmkgStd = Math.sqrt(bmkgDev.reduce((sum, dev) => sum + dev * dev, 0) / pairedData.length)
    const openMeteoStd = Math.sqrt(openMeteoDev.reduce((sum, dev) => sum + dev * dev, 0) / pairedData.length)
    const correlation = bmkgStd && openMeteoStd ? covariance / (bmkgStd * openMeteoStd) : 0

    return {
      totalDataPoints: pairedData.length,
      bmkgAvg: Number.parseFloat(bmkgAvg.toFixed(2)),
      openMeteoAvg: Number.parseFloat(openMeteoAvg.toFixed(2)),
      rmse: Number.parseFloat(rmse.toFixed(2)),
      mae: Number.parseFloat(mae.toFixed(2)),
      bias: Number.parseFloat(bias.toFixed(2)),
      correlation: Number.parseFloat(correlation.toFixed(3)),
    }
  }

  const handleDownloadCSV = () => {
    if (comparisonData.length === 0) return

    const headers = "Timestamp,BMKG (mm/h),Open-Meteo (mm/h),Location"
    const rows = comparisonData.map(
      (d) => `${formatTimestampForCSV(d.timestamp)},${d.bmkgRainfall ?? 0},${d.openMeteoRainfall ?? 0},${d.location}`,
    )
    const csvContent = `data:text/csv;charset=utf-8,${headers}\n${rows.join("\n")}`

    const link = document.createElement("a")
    link.href = encodeURI(csvContent)
    link.download = `rainfall_comparison_${selectedLocation.replace(/\s+/g, "_")}_${dateRange.startDate}_${dateRange.endDate}.csv`
    link.click()
  }

  const combinedChartData = useMemo(() => {
    if (rawOpenMeteoData.length === 0 && rawBmkgData.length === 0) return []

    const normalizeToHourKey = (timestamp: string): string => {
      const date = new Date(timestamp)
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}T${String(date.getHours()).padStart(2, "0")}`
    }

    const bmkgMap = new Map<string, RawBmkgData>()
    rawBmkgData.forEach((item) => {
      const hourKey = normalizeToHourKey(item.timestamp)
      bmkgMap.set(hourKey, item)
    })

    return rawOpenMeteoData.map((openMeteoPoint) => {
      const hourKey = normalizeToHourKey(openMeteoPoint.timestamp)
      const bmkgData = bmkgMap.get(hourKey)

      return {
        time: formatDateTime(openMeteoPoint.timestamp),
        openMeteoRainfall: openMeteoPoint.rainfall,
        bmkgRainfall: bmkgData?.rainfall ?? 0,
        bmkgDataCount: bmkgData?.dataCount ?? 0,
        minValue: bmkgData?.minValue ?? 0,
        maxValue: bmkgData?.maxValue ?? 0,
        timestamp: openMeteoPoint.timestamp,
      }
    })
  }, [rawBmkgData, rawOpenMeteoData])

  const selectedLoc = locations.find((loc) => loc.name === selectedLocation)

  const handleDateSelect = (type: "startDate" | "endDate", date: Date | undefined) => {
    if (date) {
      const localDate = new Date(date.getFullYear(), date.getMonth(), date.getDate())
      setDateRange((prev) => ({ ...prev, [type]: formatDate(localDate) }))
    }
  }

  return (
    <div className="min-h-screen w-full bg-white p-4 md:p-8">
      <div className="space-y-8 max-w-7xl mx-auto">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <h1 className="text-4xl font-bold text-black">Perbandingan Curah Hujan</h1>
          </div>
          <p className="text-gray-700 text-lg">Analisis data BMKG Radar vs Open-Meteo</p>
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
                className="w-full sm:w-auto bg-black hover:bg-gray-800 text-white font-semibold shadow-md hover:shadow-lg transition-shadow"
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

        {comparisonData.length > 0 && (
          <Card className="bg-white border-gray-300 shadow-md overflow-hidden mt-8">
            <CardHeader className="pb-4 border-b border-gray-200">
              <CardTitle className="text-gray-900 flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-black" />
                Grafik Perbandingan Curah Hujan
              </CardTitle>
              <CardDescription className="text-gray-600 mt-3 space-y-1">
                <p className="text-xs text-gray-600">
                  Stasiun: <strong>{selectedLocation}</strong> | Periode: <strong>{dateRange.startDate}</strong> s/d{" "}
                  <strong>{dateRange.endDate}</strong>
                </p>
              </CardDescription>
            </CardHeader>
            <CardContent className="h-[500px] pt-6">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={comparisonData} margin={{ top: 5, right: 30, left: 20, bottom: 80 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis
                    dataKey="timestamp"
                    tickFormatter={formatDateTime}
                    fontSize={11}
                    angle={-45}
                    textAnchor="end"
                    interval={Math.max(0, Math.floor(comparisonData.length / 24))}
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
                    name="BMKG"
                    stroke="#3b82f6"
                    strokeWidth={3}
                    dot={false}
                    connectNulls={true}
                    isAnimationActive={true}
                  />
                  <Line
                    type="monotone"
                    dataKey="openMeteoRainfall"
                    name="Open-Meteo"
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
        )}

        {isLoading && (
          <Card className="bg-white border-gray-300 shadow-md mt-8">
            <div className="p-12 text-center space-y-4 flex flex-col items-center">
              <Loader2 className="h-16 w-16 text-black animate-spin" />
              <div>
                <h3 className="text-xl font-semibold text-gray-900">Memuat data perbandingan...</h3>
                <p className="text-sm text-gray-600 mt-2">Mengambil data dari BMKG dan Open-Meteo</p>
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


