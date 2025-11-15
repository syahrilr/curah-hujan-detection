"use client";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { PumpLocation } from "@/lib/kml-parser";
import { HistoricalData } from "@/lib/open-meteo-archive";
import { format, formatDistanceToNow } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import {
  AlertCircle,
  BarChart,
  Calendar as CalendarIcon,
  Download,
  Loader2,
  Database,
  Cloud,
  RefreshCw,
  Info,
} from "lucide-react";
import { useEffect, useState } from "react";
import {
  Brush,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Input } from "../ui/input";
import { Label } from "../ui/label";

type ChartData = {
  time: string;
  precipitation: number | null;
  rain: number | null;
  windSpeed: number | null;
};

type CacheInfo = {
  documentsCount: number;
  lastUpdate: string;
  isFresh: boolean;
};

type DataResponse = {
  success: boolean;
  data: HistoricalData;
  fromCache: boolean;
  isFresh: boolean;
  lastUpdate: string;
  source: "mongodb" | "open-meteo";
  mongodbSaved?: boolean;
};

function formatDate(date: Date | undefined) {
  if (!date) return "";
  return date.toLocaleDateString("en-US", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function isValidDate(date: Date | undefined) {
  if (!date) return false;
  return !isNaN(date.getTime());
}

type PumpLocationWithId = PumpLocation & { id: string };

export default function RainfallHistoryTab() {
  const [locations, setLocations] = useState<PumpLocationWithId[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(
    null
  );
  const [startDate, setStartDate] = useState<Date | undefined>(
    new Date("2024-01-01")
  );
  const [endDate, setEndDate] = useState<Date | undefined>(new Date());
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dataSource, setDataSource] = useState<"mongodb" | "open-meteo" | null>(
    null
  );
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [cacheInfo, setCacheInfo] = useState<CacheInfo | null>(null);
  const [checkingCache, setCheckingCache] = useState(false);

  const [startDateOpen, setStartDateOpen] = useState(false);
  const [endDateOpen, setEndDateOpen] = useState(false);
  const [startDateValue, setStartDateValue] = useState(formatDate(startDate));
  const [endDateValue, setEndDateValue] = useState(formatDate(endDate));
  const [startMonth, setStartMonth] = useState<Date | undefined>(startDate);
  const [endMonth, setEndMonth] = useState<Date | undefined>(endDate);

  // Fetch locations on mount
  useEffect(() => {
    async function fetchLocations() {
      try {
        const response = await fetch("/api/history?action=getLocations");
        const data = await response.json();
        if (data.success) {
          setLocations(data.locations);
          if (data.locations.length > 0) {
            setSelectedLocationId(data.locations[0].id);
          }
        } else {
          setError("Gagal memuat daftar lokasi pompa.");
        }
      } catch (err) {
        setError("Terjadi kesalahan saat memuat lokasi.");
        console.error(err);
      }
    }
    fetchLocations();
  }, []);

  // Check cache info when location or dates change
  useEffect(() => {
    if (selectedLocationId && startDate && endDate) {
      checkCacheInfo();
    }
  }, [selectedLocationId, startDate, endDate]);

  // Check cache info
  const checkCacheInfo = async () => {
    const location = locations.find((loc) => loc.id === selectedLocationId);
    if (!location || !startDate || !endDate) return;

    setCheckingCache(true);
    try {
      const params = new URLSearchParams({
        action: "getCacheInfo",
        locationName: location.name,
        startDate: format(startDate, "yyyy-MM-dd"),
        endDate: format(endDate, "yyyy-MM-dd"),
      });

      const response = await fetch(`/api/history?${params.toString()}`);
      const result = await response.json();

      if (result.success && result.hasCacheInfo) {
        setCacheInfo(result.cacheInfo);
      } else {
        setCacheInfo(null);
      }
    } catch (err) {
      console.error("Error checking cache:", err);
      setCacheInfo(null);
    } finally {
      setCheckingCache(false);
    }
  };

  // Fetch history data
  const handleFetchHistory = async (forceRefresh = false) => {
    if (!selectedLocationId) {
      setError("Silakan pilih lokasi terlebih dahulu.");
      return;
    }
    if (!startDate || !endDate) {
      setError("Silakan pilih tanggal mulai dan selesai.");
      return;
    }

    const location = locations.find((loc) => loc.id === selectedLocationId);
    if (!location) {
      setError("Lokasi tidak ditemukan.");
      return;
    }

    setIsLoading(true);
    setError(null);
    setChartData([]);
    setDataSource(null);

    try {
      const params = new URLSearchParams({
        action: "fetchData",
        lat: location.lat.toString(),
        lng: location.lng.toString(),
        startDate: format(startDate, "yyyy-MM-dd"),
        endDate: format(endDate, "yyyy-MM-dd"),
        locationName: location.name,
        forceRefresh: forceRefresh.toString(),
      });

      const response = await fetch(`/api/history?${params.toString()}`);
      const result: DataResponse = await response.json();

      if (!result.success) {
        throw new Error( "Gagal mengambil data history.");
      }

      const data: HistoricalData = result.data;
      const formattedData: ChartData[] = data.hourly.time.map(
        (t: string, i: number) => ({
          time: format(new Date(t), "dd-MMM-yy HH:mm"),
          precipitation: data.hourly.precipitation[i],
          rain: data.hourly.rain[i],
          windSpeed: data.hourly.wind_speed_10m[i],
        })
      );

      setChartData(formattedData);
      setDataSource(result.source);
      setLastUpdate(new Date(result.lastUpdate));

      // Refresh cache info after fetching
      await checkCacheInfo();
    } catch (err) {
      setError((err as Error).message);
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownloadCSV = () => {
    if (chartData.length === 0) return;

    const location = locations.find((loc) => loc.id === selectedLocationId);
    const headers = "time,precipitation (mm),rain (mm),windSpeed (km/h)";
    const rows = chartData.map(
      (d) =>
        `${d.time},${d.precipitation || 0},${d.rain || 0},${d.windSpeed || 0}`
    );
    const csvContent = `data:text/csv;charset=utf-8,${headers}\n${rows.join(
      "\n"
    )}`;

    const link = document.createElement("a");
    link.href = encodeURI(csvContent);
    link.download = `history_${
      location?.name.replace(/\s+/g, "_") || "data"
    }_${startDate ? format(startDate, "yyyyMMdd") : "start"}_${
      endDate ? format(endDate, "yyyyMMdd") : "end"
    }.csv`;
    link.click();
  };

  const selectedLocation = locations.find(
    (loc) => loc.id === selectedLocationId
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            History Curah Hujan
            <Badge variant="outline" className="text-xs font-normal">
              with Auto Cron Job
            </Badge>
          </CardTitle>
          <CardDescription>
            Data otomatis dikumpulkan setiap hari. Pilih lokasi dan rentang
            tanggal untuk melihat history curah hujan.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Cache Info Banner */}
          {cacheInfo && !isLoading && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertTitle>Cache Tersedia</AlertTitle>
              <AlertDescription className="text-sm">
                {cacheInfo.isFresh ? (
                  <>
                    <Database className="inline h-3 w-3 mr-1" />
                    Data tersimpan di cache ({cacheInfo.documentsCount} hari).
                    Terakhir update:{" "}
                    {formatDistanceToNow(new Date(cacheInfo.lastUpdate), {
                      addSuffix: true,
                      locale: idLocale,
                    })}
                    . Klik "Tampilkan History" untuk menggunakan cache atau "Refresh
                    Data" untuk update terbaru.
                  </>
                ) : (
                  <>
                    <AlertCircle className="inline h-3 w-3 mr-1" />
                    Cache tersedia tapi sudah lama (
                    {formatDistanceToNow(new Date(cacheInfo.lastUpdate), {
                      addSuffix: true,
                      locale: idLocale,
                    })}
                    ). Klik "Refresh Data" untuk update.
                  </>
                )}
              </AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Location */}
            <div className="space-y-2 md:col-span-2">
              <Label>Lokasi Pompa</Label>
              <Select
                value={selectedLocationId || ""}
                onValueChange={setSelectedLocationId}
                disabled={locations.length === 0}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Memuat lokasi..." />
                </SelectTrigger>
                <SelectContent>
                  {locations.map((loc) => (
                    <SelectItem key={loc.id} value={loc.id}>
                      {loc.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedLocation && (
                <p className="text-xs text-muted-foreground">
                  Lat: {selectedLocation.lat.toFixed(5)}, Lng:{" "}
                  {selectedLocation.lng.toFixed(5)}
                </p>
              )}
            </div>

            {/* Start Date */}
            <div className="space-y-2">
              <Label htmlFor="start-date">Tanggal Mulai</Label>
              <div className="relative flex gap-2">
                <Input
                  id="start-date"
                  value={startDateValue}
                  placeholder="Jan 01, 2024"
                  className="bg-background pr-10"
                  onChange={(e) => {
                    const date = new Date(e.target.value);
                    setStartDateValue(e.target.value);
                    if (isValidDate(date)) {
                      setStartDate(date);
                      setStartMonth(date);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "ArrowDown") {
                      e.preventDefault();
                      setStartDateOpen(true);
                    }
                  }}
                />
                <Popover open={startDateOpen} onOpenChange={setStartDateOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      id="start-date-picker"
                      variant="ghost"
                      className="absolute top-1/2 right-2 size-6 -translate-y-1/2"
                    >
                      <CalendarIcon className="size-3.5" />
                      <span className="sr-only">Select start date</span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent
                    className="w-auto overflow-hidden p-0"
                    align="end"
                    alignOffset={-8}
                    sideOffset={10}
                  >
                    <Calendar
                      mode="single"
                      selected={startDate}
                      captionLayout="dropdown"
                      month={startMonth}
                      onMonthChange={setStartMonth}
                      onSelect={(date) => {
                        setStartDate(date);
                        setStartDateValue(formatDate(date));
                        setStartDateOpen(false);
                      }}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {/* End Date */}
            <div className="space-y-2">
              <Label htmlFor="end-date">Tanggal Selesai</Label>
              <div className="relative flex gap-2">
                <Input
                  id="end-date"
                  value={endDateValue}
                  placeholder="Today"
                  className="bg-background pr-10"
                  onChange={(e) => {
                    const date = new Date(e.target.value);
                    setEndDateValue(e.target.value);
                    if (isValidDate(date)) {
                      setEndDate(date);
                      setEndMonth(date);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "ArrowDown") {
                      e.preventDefault();
                      setEndDateOpen(true);
                    }
                  }}
                />
                <Popover open={endDateOpen} onOpenChange={setEndDateOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      id="end-date-picker"
                      variant="ghost"
                      className="absolute top-1/2 right-2 size-6 -translate-y-1/2"
                    >
                      <CalendarIcon className="size-3.5" />
                      <span className="sr-only">Select end date</span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent
                    className="w-auto overflow-hidden p-0"
                    align="end"
                    alignOffset={-8}
                    sideOffset={10}
                  >
                    <Calendar
                      mode="single"
                      selected={endDate}
                      captionLayout="dropdown"
                      month={endMonth}
                      onMonthChange={setEndMonth}
                      onSelect={(date) => {
                        setEndDate(date);
                        setEndDateValue(formatDate(date));
                        setEndDateOpen(false);
                      }}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col md:flex-row gap-2">
            <Button
              onClick={() => handleFetchHistory(false)}
              disabled={isLoading || !selectedLocationId}
              className="flex-1 gap-2"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : cacheInfo ? (
                <Database className="h-4 w-4" />
              ) : (
                <BarChart className="h-4 w-4" />
              )}
              {isLoading
                ? "Mengambil Data..."
                : cacheInfo
                ? "Tampilkan History (Cache)"
                : "Tampilkan History"}
            </Button>

            {cacheInfo && (
              <Button
                onClick={() => handleFetchHistory(true)}
                disabled={isLoading || !selectedLocationId}
                variant="outline"
                className="gap-2"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                Refresh Data
              </Button>
            )}

            <Button
              onClick={handleDownloadCSV}
              disabled={chartData.length === 0 || isLoading}
              variant="outline"
              className="gap-2"
            >
              <Download className="h-4 w-4" />
              Download CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Chart Display */}
      {chartData.length > 0 && !isLoading && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  Grafik History - {selectedLocation?.name}
                  {dataSource && (
                    <Badge
                      variant={
                        dataSource === "mongodb" ? "secondary" : "default"
                      }
                      className="text-xs font-normal"
                    >
                      {dataSource === "mongodb" ? (
                        <>
                          <Database className="h-3 w-3 mr-1" />
                          Dari Cache
                        </>
                      ) : (
                        <>
                          <Cloud className="h-3 w-3 mr-1" />
                          Fresh Data
                        </>
                      )}
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription>
                  Menampilkan {chartData.length.toLocaleString()} data points
                  dari {startDate && format(startDate, "dd MMM yyyy")} -{" "}
                  {endDate && format(endDate, "dd MMM yyyy")}
                  {lastUpdate && (
                    <>
                      {" · "}
                      Update:{" "}
                      {formatDistanceToNow(lastUpdate, {
                        addSuffix: true,
                        locale: idLocale,
                      })}
                    </>
                  )}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={chartData}
                margin={{ top: 5, right: 20, left: -10, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="time" fontSize={10} tickMargin={5} />
                <YAxis
                  yAxisId="left"
                  orientation="left"
                  stroke="#3b82f6"
                  fontSize={10}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  stroke="#f59e0b"
                  fontSize={10}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "rgba(255, 255, 255, 0.9)",
                    border: "1px solid #ccc",
                    borderRadius: "8px",
                  }}
                  labelStyle={{ fontWeight: "bold", color: "#000" }}
                />
                <Legend />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="precipitation"
                  name="Presipitasi (mm)"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="windSpeed"
                  name="Kecepatan Angin (km/j)"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="rain"
                  name="Hujan (mm)"
                  stroke="#22c55e"
                  strokeWidth={2}
                  dot={false}
                />
                <Brush
                  dataKey="time"
                  height={30}
                  stroke="#3b82f6"
                  fill="#f1f5f9"
                  travellerWidth={15}
                  startIndex={0}
                  endIndex={Math.min(chartData.length - 1, 168)}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Loading State */}
      {isLoading && (
        <Card className="p-12">
          <div className="text-center space-y-4 flex flex-col items-center">
            <Loader2 className="h-12 w-12 mx-auto text-muted-foreground animate-spin" />
            <div>
              <h3 className="text-lg font-semibold">
                Mengambil data history...
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                {cacheInfo
                  ? "Mengambil data terbaru dari Open-Meteo..."
                  : "Ini mungkin perlu beberapa saat tergantung rentang tanggal yang dipilih."}
              </p>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
