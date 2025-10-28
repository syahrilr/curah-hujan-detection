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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { PumpLocation } from "@/lib/kml-parser";
import {
  HistoricalData,
  HistoricalHourly,
} from "@/lib/open-meteo-archive";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import {
  Calendar as CalendarIcon,
  Loader2,
  BarChart,
  AlertCircle,
  Download,
} from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  Line,
  Brush,
} from "recharts";
import { cn } from "@/lib/utils";
import { Label } from "../ui/label";

// Tipe data untuk chart
type ChartData = {
  time: string;
  precipitation: number | null;
  rain: number | null;
  windSpeed: number | null;
};

// Tipe lokasi dengan ID
type PumpLocationWithId = PumpLocation & { id: string };

export default function RainfallHistoryTab() {
  const [locations, setLocations] = useState<PumpLocationWithId[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(
    null
  );
  const [startDate, setStartDate] = useState<Date>(new Date("2024-01-01"));
  const [endDate, setEndDate] = useState<Date>(new Date("2025-10-23"));
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 1. Ambil daftar lokasi saat komponen dimuat
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

  // 2. Fungsi untuk mengambil data history
  const handleFetchHistory = async () => {
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

    try {
      const params = new URLSearchParams({
        action: "fetchData",
        lat: location.lat.toString(),
        lng: location.lng.toString(),
        startDate: format(startDate, "yyyy-MM-dd"),
        endDate: format(endDate, "yyyy-MM-dd"),
        locationName: location.name, // Kirim nama lokasi
      });

      const response = await fetch(`/api/history?${params.toString()}`);
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.message || "Gagal mengambil data history.");
      }

      // 3. Format data untuk chart - PERBAIKAN: Include tahun
      const data: HistoricalData = result.data;
      const formattedData: ChartData[] = data.hourly.time.map((t, i) => ({
        time: format(new Date(t), "dd-MMM-yy HH:mm"),
        precipitation: data.hourly.precipitation[i],
        rain: data.hourly.rain[i],
        windSpeed: data.hourly.wind_speed_10m[i],
      }));

      console.log('Total data points:', formattedData.length);
      console.log('First data point:', formattedData[0]);
      console.log('Last data point:', formattedData[formattedData.length - 1]);

      setChartData(formattedData);
    } catch (err) {
      setError((err as Error).message);
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  // 4. Fungsi untuk download CSV
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
    }_${format(startDate, "yyyyMMdd")}_${format(endDate, "yyyyMMdd")}.csv`;
    link.click();
  };

  const selectedLocation = locations.find(
    (loc) => loc.id === selectedLocationId
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>History Curah Hujan (Open-Meteo Archive)</CardTitle>
          <CardDescription>
            Pilih lokasi pompa dan rentang tanggal untuk melihat history curah
            hujan.
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

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Lokasi Pompa */}
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

            {/* Tanggal Mulai */}
            <div className="space-y-2">
              <Label>Tanggal Mulai</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={"outline"}
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !startDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {startDate ? (
                      format(startDate, "dd MMMM yyyy", { locale: id })
                    ) : (
                      <span>Pilih tanggal</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={(date) => setStartDate(date || new Date())}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Tanggal Selesai */}
            <div className="space-y-2">
              <Label>Tanggal Selesai</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={"outline"}
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !endDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {endDate ? (
                      format(endDate, "dd MMMM yyyy", { locale: id })
                    ) : (
                      <span>Pilih tanggal</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={endDate}
                    onSelect={(date) => setEndDate(date || new Date())}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className="flex flex-col md:flex-row gap-2">
            <Button
              onClick={handleFetchHistory}
              disabled={isLoading || !selectedLocationId}
              className="flex-1 gap-2"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <BarChart className="h-4 w-4" />
              )}
              {isLoading ? "Mengambil Data..." : "Tampilkan History"}
            </Button>
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

      {/* Tampilan Chart */}
      {chartData.length > 0 && !isLoading && (
        <Card>
          <CardHeader>
            <CardTitle>Grafik History - {selectedLocation?.name}</CardTitle>
            <CardDescription>
              Menampilkan {chartData.length.toLocaleString()} data points dari{" "}
              {format(startDate, "dd MMM yyyy")} - {format(endDate, "dd MMM yyyy")}
            </CardDescription>
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
                Ini mungkin perlu beberapa saat tergantung rentang tanggal yang
                dipilih.
              </p>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
