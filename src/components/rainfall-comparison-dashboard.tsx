"use client"

import { useState, useEffect } from "react"
import { format } from "date-fns"
import { id } from "date-fns/locale"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar as CalendarComponent } from "@/components/ui/calendar"
import { cn } from "@/lib/utils"
import { Loader2, Activity, CloudRain, AlertCircle, CalendarIcon, Download, Database, TrendingUp } from "lucide-react"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
} from "recharts"

interface ComparisonData {
  timestamp: string
  bmkgRainfall: number | null // Izinkan null di sini
  openMeteoRainfall: number | null
  difference: number | null
  location: string
  source: "bmkg" | "openmeteo" | "both"
}

interface RawBmkgData {
  timestamp: string
  rainfall: number
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
}

function formatDateTime(isoString: string): string {
  // Format Waktu di X-Axis
  const date = new Date(isoString)
  const day = date.getDate().toString().padStart(2, "0")
  const month = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][date.getMonth()]
  const hours = date.getHours().toString().padStart(2, "0")
  const minutes = date.getMinutes().toString().padStart(2, "0")
  // Tampilkan menit agar data 10-menitan BMKG terlihat jelas
  return `${day}-${month} ${hours}:${minutes}`
}

function formatDate(date: Date): string {
  const year = date.getFullYear()
  const month = (date.getMonth() + 1).toString().padStart(2, "0")
  const day = date.getDate().toString().padStart(2, "0")
  return `${year}-${month}-${day}`
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="p-3 bg-background/90 border border-border rounded-lg shadow-lg backdrop-blur-sm">
        <p className="font-bold text-sm text-foreground mb-1">{label}</p>
        {payload.map((p: any, i: number) => (
          <div key={i} style={{ color: p.color }} className="text-xs font-medium">
            {/* Hanya tampilkan data jika tidak null */}
            {p.value !== null && (
              <>
                {p.name}: <span className="font-bold">{p.value.toFixed(2)} mm/h</span>
              </>
            )}
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

  // State untuk data gabungan (untuk CSV)
  const [comparisonData, setComparisonData] = useState<ComparisonData[]>([])

  // --- PERUBAHAN: State untuk data mentah per sumber ---
  const [rawBmkgData, setRawBmkgData] = useState<RawBmkgData[]>([])
  const [rawOpenMeteoData, setRawOpenMeteoData] = useState<RawOpenMeteoData[]>([])
  // --- AKHIR PERUBAHAN ---

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
    // --- PERUBAHAN: Reset state data mentah ---
    setRawBmkgData([])
    setRawOpenMeteoData([])
    // --- AKHIR PERUBAHAN ---
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

      // --- PERUBAHAN: Set state data mentah ---
      setRawBmkgData(bmkgData)
      setRawOpenMeteoData(openMeteoData)
      // --- AKHIR PERUBAHAN ---

      // Tetap gabungkan data untuk CSV
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
        `${baseUrl}/api/rainfall-comparison?source=bmkg&lat=${location.lat}&lng=${location.lng}&startDate=${startDate}&endDate=${endDate}`,
      )
      const data = await response.json()
      // Pastikan data diurutkan berdasarkan timestamp
      return data.success ? data.data.sort((a: RawBmkgData, b: RawBmkgData) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()) : []
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
        // Data dari Open-Meteo diasumsikan sudah terurut
      }
      return []
    } catch (error) {
      console.error("Gagal mengambil data Open-Meteo:", error)
      return []
    }
  }

  // Fungsi mergeDataSources tetap ada untuk kebutuhan CSV
  function mergeDataSources(
    bmkgData: RawBmkgData[],
    openMeteoData: RawOpenMeteoData[],
    locationName: string,
  ): ComparisonData[] {
    const dataMap = new Map<string, Partial<ComparisonData>>()

    const openMeteoHourMap = new Map<string, number>()
    openMeteoData.forEach((item) => {
      const hourKey = new Date(item.timestamp).toISOString().slice(0, 13)
      openMeteoHourMap.set(hourKey, Number.parseFloat(item.rainfall.toFixed(2)))
    })

    bmkgData.forEach((item) => {
      const timestamp = new Date(item.timestamp).toISOString()
      const hourKey = timestamp.slice(0, 13)
      const openMeteoVal = openMeteoHourMap.get(hourKey)

      const bmkgVal = Number.parseFloat(item.rainfall.toFixed(2))
      const openMeteoRainfall = openMeteoVal !== undefined ? openMeteoVal : null

      dataMap.set(timestamp, {
        timestamp: timestamp,
        bmkgRainfall: bmkgVal,
        openMeteoRainfall: openMeteoRainfall,
        difference: openMeteoRainfall !== null ? Number.parseFloat((bmkgVal - openMeteoRainfall).toFixed(2)) : null,
        location: locationName,
        source: openMeteoRainfall !== null ? "both" : "bmkg",
      })
    })

    openMeteoData.forEach((item) => {
      const timestamp = new Date(item.timestamp).toISOString()
      const openMeteoVal = Number.parseFloat(item.rainfall.toFixed(2))

      if (!dataMap.has(timestamp)) {
        dataMap.set(timestamp, {
          timestamp: timestamp,
          bmkgRainfall: null,
          openMeteoRainfall: openMeteoVal,
          difference: null,
          location: locationName,
          source: "openmeteo",
        })
      }
    })

    const merged = Array.from(dataMap.values()) as ComparisonData[]
    return merged.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
  }

  // Fungsi calculateStatistics tetap ada (meskipun tidak ditampilkan)
  function calculateStatistics(data: ComparisonData[]): StatsSummary {
    if (data.length === 0) {
      return {
        totalDataPoints: 0,
        bmkgAvg: 0,
        openMeteoAvg: 0,
        rmse: 0,
        mae: 0,
        bias: 0,
      }
    }

    const pairedData = data.filter((d) => d.openMeteoRainfall !== null && d.bmkgRainfall !== null)

    if (pairedData.length === 0) {
      return {
        totalDataPoints: data.length,
        bmkgAvg: 0,
        openMeteoAvg: 0,
        rmse: 0,
        mae: 0,
        bias: 0,
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

    return {
      totalDataPoints: data.filter((d) => d.source === "bmkg" || d.source === "both").length,
      bmkgAvg: Number.parseFloat(bmkgAvg.toFixed(2)),
      openMeteoAvg: Number.parseFloat(openMeteoAvg.toFixed(2)),
      rmse: Number.parseFloat(rmse.toFixed(2)),
      mae: Number.parseFloat(mae.toFixed(2)),
      bias: Number.parseFloat(bias.toFixed(2)),
    }
  }

  const handleDownloadCSV = () => {
    // CSV Download masih menggunakan data gabungan
    if (comparisonData.length === 0) return

    const headers = "Timestamp,BMKG Rate (mm/h),Open-Meteo Hourly Rate (mm/h),Difference (mm/h),Location,Source"
    const rows = comparisonData.map(
      (d) =>
        `${d.timestamp},${d.bmkgRainfall !== null ? d.bmkgRainfall : ""},${d.openMeteoRainfall !== null ? d.openMeteoRainfall : ""},${d.difference !== null ? d.difference : ""},${d.location},${d.source}`,
    )
    const csvContent = `data:text/csv;charset=utf-8,${headers}\n${rows.join("\n")}`

    const link = document.createElement("a")
    link.href = encodeURI(csvContent)
    link.download = `rainfall_comparison_${selectedLocation.replace(/\s+/g, "_")}_${dateRange.startDate}_${dateRange.endDate}.csv`
    link.click()
  }

  // --- PERUBAHAN: Hapus chartData gabungan ---
  // const chartData = comparisonData.map((d) => ({
  //   ...d,
  //   time: formatDateTime(d.timestamp),
  // }))

  // --- PERUBAHAN: Buat data chart terpisah ---
  const bmkgChartData = rawBmkgData.map((d) => ({
    ...d,
    time: formatDateTime(d.timestamp),
  }))

  const openMeteoChartData = rawOpenMeteoData.map((d) => ({
    ...d,
    time: formatDateTime(d.timestamp),
  }))
  // --- AKHIR PERUBAHAN ---


  const selectedLoc = locations.find((loc) => loc.name === selectedLocation)

  const handleDateSelect = (type: "startDate" | "endDate", date: Date | undefined) => {
    if (date) {
      const localDate = new Date(date.getFullYear(), date.getMonth(), date.getDate())
      setDateRange((prev) => ({ ...prev, [type]: formatDate(localDate) }))
    }
  }

  return (
    <div className="min-h-screen w-full bg-slate-50/50 p-4 md:p-6">
      <div className="space-y-6 max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Perbandingan Curah Hujan</h1>
            <p className="text-muted-foreground mt-1">Bandingkan BMKG Radar vs Open-Meteo Data</p>
          </div>
          <CloudRain className="h-8 w-8 text-blue-500" />
        </div>

        {/* Control Card */}
        <Card>
          <CardHeader>
            <CardTitle>Pemilihan Data</CardTitle>
            <CardDescription>Pilih lokasi dan rentang tanggal untuk membandingkan data</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* --- TATA LETAK DIPERBARUI --- */}
            {/* Grid HANYA untuk input */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
              {/* Stasiun Pompa */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground">Stasiun Pompa</label>
                <Select value={selectedLocation} onValueChange={setSelectedLocation}>
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih lokasi..." />
                  </SelectTrigger>
                  <SelectContent>
                    {locations.map((loc) => (
                      <SelectItem key={loc.id} value={loc.name}>
                        {loc.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedLoc && (
                  <p className="text-xs text-muted-foreground">
                    {selectedLoc.lat.toFixed(4)}°, {selectedLoc.lng.toFixed(4)}°
                  </p>
                )}
              </div>

              {/* Tanggal Mulai */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground">Tanggal Mulai</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant={"outline"}
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !dateRange.startDate && "text-muted-foreground",
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dateRange.startDate ? (
                        format(new Date(dateRange.startDate), "PPP", { locale: id })
                      ) : (
                        <span>Pilih tanggal</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <CalendarComponent
                      mode="single"
                      selected={new Date(dateRange.startDate)}
                      onSelect={(date) => handleDateSelect("startDate", date)}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* Tanggal Selesai */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground">Tanggal Selesai</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant={"outline"}
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !dateRange.endDate && "text-muted-foreground",
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dateRange.endDate ? (
                        format(new Date(dateRange.endDate), "PPP", { locale: id })
                      ) : (
                        <span>Pilih tanggal</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
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

            {/* Tombol-tombol (dipisah) */}
            <div className="flex flex-col sm:flex-row gap-2 justify-end pt-2">
              <Button
                onClick={handleFetchComparison}
                disabled={isLoading || !selectedLocation}
                className="w-full sm:w-auto" // Penuh di mobile, auto di layar lebih besar
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
                className="w-full sm:w-auto bg-transparent" // Penuh di mobile, auto di layar lebih besar
              >
                <Download className="h-4 w-4 mr-2" />
                Unduh CSV
              </Button>
            </div>
            {/* --- AKHIR TATA LETAK DIPERBARUI --- */}
          </CardContent>
        </Card>

        {/* --- BLOK STATISTIK DIHAPUS --- */}
        {/* ... (kode statistik di-comment) ... */}

        {/* --- PERUBAHAN: GRAFIK BMKG --- */}
        {bmkgChartData.length > 0 && (
          <Card>
            <CardHeader className="border-b">
              <CardTitle>Grafik BMKG Radar (10 menit)</CardTitle>
              <CardDescription>Data real-time BMKG dengan interval 10 menit.</CardDescription>
            </CardHeader>
            <CardContent className="h-[400px] pt-6">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={bmkgChartData} margin={{ top: 5, right: 20, left: 40, bottom: 80 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="time"
                    fontSize={11}
                    angle={-45}
                    textAnchor="end"
                    // Gunakan interval berdasarkan data BMKG
                    interval={Math.max(0, Math.floor(bmkgChartData.length / 48))}
                  />
                  <YAxis
                    label={{ value: "Laju Hujan (mm/h)", angle: -90, position: "left", offset: -15 }}
                    fontSize={11}
                  />
                  <RechartsTooltip content={<CustomTooltip />} />
                  <Line
                    type="monotone"
                    dataKey="rainfall" // Ubah dari bmkgRainfall
                    name="BMKG Radar (10 menit)"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    dot={false}
                    connectNulls={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* --- PERUBAHAN: GRAFIK OPEN-METEO --- */}
        {openMeteoChartData.length > 0 && (
          <Card>
            <CardHeader className="border-b">
              <CardTitle>Grafik Open-Meteo (1 jam)</CardTitle>
              <CardDescription>Data prakiraan Open-Meteo dengan interval 1 jam.</CardDescription>
            </CardHeader>
            <CardContent className="h-[400px] pt-6">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={openMeteoChartData} margin={{ top: 5, right: 20, left: 40, bottom: 80 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="time"
                    fontSize={11}
                    angle={-45}
                    textAnchor="end"
                    // Gunakan interval berdasarkan data Open-Meteo
                    interval={Math.max(0, Math.floor(openMeteoChartData.length / 48))}
                  />
                  <YAxis
                    label={{ value: "Laju Hujan (mm/h)", angle: -90, position: "left", offset: -15 }}
                    fontSize={11}
                  />
                  <RechartsTooltip content={<CustomTooltip />} />
                  <Line
                    type="monotone"
                    dataKey="rainfall" // Ubah dari openMeteoRainfall
                    name="Open-Meteo (1 jam)"
                    stroke="#f59e0b"
                    strokeWidth={2}
                    // strokeDasharray="5 5"
                    dot={false}
                    connectNulls={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* --- AKHIR PERUBAHAN --- */}

        {/* Loading State */}
        {isLoading && (
          <Card className="p-12">
            <div className="text-center space-y-4 flex flex-col items-center">
              <Loader2 className="h-12 w-12 text-blue-500 animate-spin" />
              <div>
                <h3 className="text-lg font-semibold text-foreground">Memuat data perbandingan...</h3>
                <p className="text-sm text-muted-foreground mt-1">Mengambil data dari sumber BMKG dan Open-Meteo</p>
              </div>
            </div>
          </Card>
        )}

        {/* No Data State */}
        {!isLoading && rawBmkgData.length === 0 && rawOpenMeteoData.length === 0 && selectedLocation && (
          <Card className="p-12">
            <div className="text-center space-y-4">
              <CalendarIcon className="h-12 w-12 text-muted-foreground mx-auto" />
              <div>
                <h3 className="text-lg font-semibold text-foreground">Tidak ada data</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Klik "Bandingkan Data" untuk memuat perbandingan curah hujan untuk {selectedLocation}
                </p>
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  )
}

