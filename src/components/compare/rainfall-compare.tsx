"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, TrendingUp, Activity, CloudRain, AlertCircle, Calendar, Download } from "lucide-react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine
} from "recharts";

interface ComparisonData {
  timestamp: string;
  bmkgRainfall: number;
  openMeteoRainfall: number;
  difference: number;
  location: string;
}

interface StatsSummary {
  totalDataPoints: number;
  bmkgAvg: number;
  openMeteoAvg: number;
  correlation: number;
  rmse: number;
  mae: number;
  bias: number;
}

function formatDateTime(isoString: string): string {
  const date = new Date(isoString);
  const day = date.getDate().toString().padStart(2, '0');
  const month = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][date.getMonth()];
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${day}-${month} ${hours}:${minutes}`;
}

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function RainfallComparisonDashboard() {
  const [locations, setLocations] = useState<any[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<string>("");
  const [comparisonData, setComparisonData] = useState<ComparisonData[]>([]);
  const [stats, setStats] = useState<StatsSummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState({
    startDate: formatDate(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)),
    endDate: formatDate(new Date())
  });

  // Fetch pump locations
  useEffect(() => {
    async function fetchLocations() {
      try {
        const response = await fetch("/api/history?action=getLocations");
        const data = await response.json();
        if (data.success) {
          setLocations(data.locations);
          if (data.locations.length > 0) {
            setSelectedLocation(data.locations[0].name);
          }
        }
      } catch (error) {
        console.error("Failed to load locations:", error);
      }
    }
    fetchLocations();
  }, []);

  // Fetch comparison data
  const handleFetchComparison = async () => {
    if (!selectedLocation) {
      setError("Please select a location");
      return;
    }

    setIsLoading(true);
    setError(null);
    setComparisonData([]);
    setStats(null);

    try {
      const location = locations.find(loc => loc.name === selectedLocation);
      if (!location) {
        throw new Error("Location not found");
      }

      // Fetch data from both sources
      const [bmkgData, openMeteoData] = await Promise.all([
        fetchBMKGData(location, dateRange.startDate, dateRange.endDate),
        fetchOpenMeteoData(location, dateRange.startDate, dateRange.endDate)
      ]);

      // Merge and compare data
      const merged = mergeDataSources(bmkgData, openMeteoData);
      setComparisonData(merged);

      // Calculate statistics
      const calculatedStats = calculateStatistics(merged);
      setStats(calculatedStats);

    } catch (err) {
      setError((err as Error).message);
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch BMKG data from rainfall_records
  async function fetchBMKGData(location: any, startDate: string, endDate: string) {
    try {
      const response = await fetch(
        `/api/rainfall-comparison?source=bmkg&lat=${location.lat}&lng=${location.lng}&startDate=${startDate}&endDate=${endDate}`
      );
      const data = await response.json();
      return data.success ? data.data : [];
    } catch (error) {
      console.error("Failed to fetch BMKG data:", error);
      return [];
    }
  }

  // Fetch Open-Meteo historical data
  async function fetchOpenMeteoData(location: any, startDate: string, endDate: string) {
    try {
      const response = await fetch(
        `/api/history?action=fetchData&lat=${location.lat}&lng=${location.lng}&startDate=${startDate}&endDate=${endDate}`
      );
      const data = await response.json();

      if (data.success && data.data) {
        return data.data.hourly.time.map((time: string, i: number) => ({
          timestamp: time,
          rainfall: data.data.hourly.precipitation[i] || 0
        }));
      }
      return [];
    } catch (error) {
      console.error("Failed to fetch Open-Meteo data:", error);
      return [];
    }
  }

  // Merge data from both sources by timestamp
  function mergeDataSources(bmkgData: any[], openMeteoData: any[]) {
    const merged: ComparisonData[] = [];

    // Create a map of Open-Meteo data by hour
    const openMeteoMap = new Map();
    openMeteoData.forEach(item => {
      const hourKey = new Date(item.timestamp).toISOString().slice(0, 13); // YYYY-MM-DDTHH
      openMeteoMap.set(hourKey, item.rainfall);
    });

    // Merge BMKG data with Open-Meteo data
    bmkgData.forEach(bmkgItem => {
      const hourKey = new Date(bmkgItem.timestamp).toISOString().slice(0, 13);
      const openMeteoValue = openMeteoMap.get(hourKey) || 0;

      merged.push({
        timestamp: bmkgItem.timestamp,
        bmkgRainfall: bmkgItem.rainfall,
        openMeteoRainfall: openMeteoValue,
        difference: bmkgItem.rainfall - openMeteoValue,
        location: selectedLocation
      });
    });

    return merged.sort((a, b) =>
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
  }

  // Calculate statistical metrics
  function calculateStatistics(data: ComparisonData[]): StatsSummary {
    if (data.length === 0) {
      return {
        totalDataPoints: 0,
        bmkgAvg: 0,
        openMeteoAvg: 0,
        correlation: 0,
        rmse: 0,
        mae: 0,
        bias: 0
      };
    }

    const bmkgValues = data.map(d => d.bmkgRainfall);
    const openMeteoValues = data.map(d => d.openMeteoRainfall);

    const bmkgAvg = bmkgValues.reduce((a, b) => a + b, 0) / data.length;
    const openMeteoAvg = openMeteoValues.reduce((a, b) => a + b, 0) / data.length;

    // Mean Absolute Error
    const mae = data.reduce((sum, d) => sum + Math.abs(d.difference), 0) / data.length;

    // Root Mean Square Error
    const mse = data.reduce((sum, d) => sum + Math.pow(d.difference, 2), 0) / data.length;
    const rmse = Math.sqrt(mse);

    // Bias
    const bias = data.reduce((sum, d) => sum + d.difference, 0) / data.length;

    // Correlation
    const correlation = calculateCorrelation(bmkgValues, openMeteoValues);

    return {
      totalDataPoints: data.length,
      bmkgAvg: parseFloat(bmkgAvg.toFixed(2)),
      openMeteoAvg: parseFloat(openMeteoAvg.toFixed(2)),
      correlation: parseFloat(correlation.toFixed(3)),
      rmse: parseFloat(rmse.toFixed(2)),
      mae: parseFloat(mae.toFixed(2)),
      bias: parseFloat(bias.toFixed(2))
    };
  }

  function calculateCorrelation(x: number[], y: number[]): number {
    const n = x.length;
    if (n === 0) return 0;

    const meanX = x.reduce((a, b) => a + b, 0) / n;
    const meanY = y.reduce((a, b) => a + b, 0) / n;

    let numerator = 0;
    let denomX = 0;
    let denomY = 0;

    for (let i = 0; i < n; i++) {
      const diffX = x[i] - meanX;
      const diffY = y[i] - meanY;
      numerator += diffX * diffY;
      denomX += diffX * diffX;
      denomY += diffY * diffY;
    }

    if (denomX === 0 || denomY === 0) return 0;
    return numerator / Math.sqrt(denomX * denomY);
  }

  // Download CSV
  const handleDownloadCSV = () => {
    if (comparisonData.length === 0) return;

    const headers = "Timestamp,BMKG Rainfall (mm/h),Open-Meteo Rainfall (mm/h),Difference (mm/h),Location";
    const rows = comparisonData.map(d =>
      `${d.timestamp},${d.bmkgRainfall},${d.openMeteoRainfall},${d.difference},${d.location}`
    );
    const csvContent = `data:text/csv;charset=utf-8,${headers}\n${rows.join("\n")}`;

    const link = document.createElement("a");
    link.href = encodeURI(csvContent);
    link.download = `rainfall_comparison_${selectedLocation.replace(/\s+/g, "_")}_${dateRange.startDate}_${dateRange.endDate}.csv`;
    link.click();
  };

  // Prepare chart data with formatted timestamps
  const chartData = comparisonData.map(d => ({
    ...d,
    time: formatDateTime(d.timestamp)
  }));

  // Scatter plot data
  const scatterData = comparisonData.map(d => ({
    bmkg: d.bmkgRainfall,
    openMeteo: d.openMeteoRainfall,
    name: formatDateTime(d.timestamp)
  }));

  const selectedLoc = locations.find(loc => loc.name === selectedLocation);

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Rainfall Comparison</h1>
          <p className="text-slate-600 mt-1">Compare BMKG Radar vs Open-Meteo Data</p>
        </div>
        <div className="flex items-center gap-2">
          <CloudRain className="h-8 w-8 text-blue-500" />
        </div>
      </div>

      {/* Controls */}
      <Card>
        <CardHeader>
          <CardTitle>Data Selection</CardTitle>
          <CardDescription>Choose location and date range to compare rainfall data</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Location */}
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">Pump Station</label>
              <Select value={selectedLocation} onValueChange={setSelectedLocation}>
                <SelectTrigger>
                  <SelectValue placeholder="Select location..." />
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
                <p className="text-xs text-slate-500">
                  {selectedLoc.lat.toFixed(4)}°, {selectedLoc.lng.toFixed(4)}°
                </p>
              )}
            </div>

            {/* Start Date */}
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">Start Date</label>
              <input
                type="date"
                value={dateRange.startDate}
                onChange={(e) => setDateRange(prev => ({ ...prev, startDate: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* End Date */}
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">End Date</label>
              <input
                type="date"
                value={dateRange.endDate}
                onChange={(e) => setDateRange(prev => ({ ...prev, endDate: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              onClick={handleFetchComparison}
              disabled={isLoading || !selectedLocation}
              className="flex-1"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Loading...
                </>
              ) : (
                <>
                  <Activity className="h-4 w-4 mr-2" />
                  Compare Data
                </>
              )}
            </Button>
            <Button
              onClick={handleDownloadCSV}
              disabled={comparisonData.length === 0}
              variant="outline"
            >
              <Download className="h-4 w-4 mr-2" />
              Download CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Statistics Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">Data Points</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-800">{stats.totalDataPoints}</div>
              <p className="text-xs text-slate-500 mt-1">Total comparisons</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">Correlation</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{stats.correlation}</div>
              <p className="text-xs text-slate-500 mt-1">
                {stats.correlation > 0.8 ? "Excellent" : stats.correlation > 0.6 ? "Good" : stats.correlation > 0.4 ? "Fair" : "Poor"}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">RMSE</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-600">{stats.rmse} mm/h</div>
              <p className="text-xs text-slate-500 mt-1">Root mean square error</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">Bias</CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${stats.bias > 0 ? 'text-red-600' : 'text-green-600'}`}>
                {stats.bias > 0 ? '+' : ''}{stats.bias} mm/h
              </div>
              <p className="text-xs text-slate-500 mt-1">
                {stats.bias > 0 ? "BMKG overestimates" : stats.bias < 0 ? "BMKG underestimates" : "No bias"}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Time Series Comparison Chart */}
      {chartData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Time Series Comparison</CardTitle>
            <CardDescription>
              Rainfall measurements over time from both sources
            </CardDescription>
          </CardHeader>
          <CardContent className="h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="time"
                  fontSize={11}
                  angle={-45}
                  textAnchor="end"
                  height={80}
                />
                <YAxis
                  label={{ value: 'Rainfall (mm/h)', angle: -90, position: 'insideLeft' }}
                  fontSize={11}
                />
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
                  dataKey="bmkgRainfall"
                  name="BMKG Radar"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
                <Line
                  type="monotone"
                  dataKey="openMeteoRainfall"
                  name="Open-Meteo"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Difference Chart */}
      {chartData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Difference Analysis</CardTitle>
            <CardDescription>
              BMKG - Open-Meteo (Positive = BMKG higher, Negative = Open-Meteo higher)
            </CardDescription>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="time"
                  fontSize={11}
                  angle={-45}
                  textAnchor="end"
                  height={80}
                />
                <YAxis
                  label={{ value: 'Difference (mm/h)', angle: -90, position: 'insideLeft' }}
                  fontSize={11}
                />
                <Tooltip />
                <ReferenceLine y={0} stroke="#666" />
                <Bar
                  dataKey="difference"
                  name="Difference"
                  fill="#8b5cf6"
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Scatter Plot */}
      {scatterData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Correlation Plot</CardTitle>
            <CardDescription>
              Direct comparison (perfect correlation would be a 45° line)
            </CardDescription>
          </CardHeader>
          <CardContent className="h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                <CartesianGrid />
                <XAxis
                  type="number"
                  dataKey="bmkg"
                  name="BMKG"
                  label={{ value: 'BMKG Rainfall (mm/h)', position: 'bottom' }}
                />
                <YAxis
                  type="number"
                  dataKey="openMeteo"
                  name="Open-Meteo"
                  label={{ value: 'Open-Meteo Rainfall (mm/h)', angle: -90, position: 'insideLeft' }}
                />
                <Tooltip cursor={{ strokeDasharray: '3 3' }} />
                <ReferenceLine
                  segment={[{ x: 0, y: 0 }, { x: 50, y: 50 }]}
                  stroke="#666"
                  strokeDasharray="3 3"
                  label="Perfect correlation"
                />
                <Scatter
                  name="Data Points"
                  data={scatterData}
                  fill="#3b82f6"
                  fillOpacity={0.6}
                />
              </ScatterChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Loading State */}
      {isLoading && (
        <Card className="p-12">
          <div className="text-center space-y-4 flex flex-col items-center">
            <Loader2 className="h-12 w-12 text-blue-500 animate-spin" />
            <div>
              <h3 className="text-lg font-semibold text-slate-800">Loading comparison data...</h3>
              <p className="text-sm text-slate-500 mt-1">
                Fetching data from both BMKG and Open-Meteo sources
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* No Data State */}
      {!isLoading && comparisonData.length === 0 && selectedLocation && (
        <Card className="p-12">
          <div className="text-center space-y-4">
            <Calendar className="h-12 w-12 text-slate-400 mx-auto" />
            <div>
              <h3 className="text-lg font-semibold text-slate-800">No data available</h3>
              <p className="text-sm text-slate-500 mt-1">
                Click "Compare Data" to load rainfall comparison for {selectedLocation}
              </p>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
