"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Loader2,
  TrendingUp,
  TrendingDown,
  Target,
  AlertCircle,
  CheckCircle2,
  Calendar,
  RefreshCw,
  Download
} from "lucide-react";
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
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar
} from "recharts";

interface AccuracyMetrics {
  location: {
    name: string;
    latitude: number;
    longitude: number;
  };
  period: {
    startDate: string;
    endDate: string;
  };
  totalForecasts: number;
  verifiedForecasts: number;
  metrics: {
    mae: number;
    rmse: number;
    bias: number;
    correlation: number;
    probabilityScore: number;
    accuracy: number;
    precision: number;
    recall: number;
    f1Score: number;
    rainyDaysCorrect: number;
    rainyDaysTotal: number;
    dryDaysCorrect: number;
    dryDaysTotal: number;
  };
  summary: {
    avgPredicted: number;
    avgActual: number;
    maxError: number;
    reliability: string;
  };
}

interface HistoricalAccuracy {
  location: string;
  date: string;
  correlation: number;
  mae: number;
  rmse: number;
  reliability: string;
}

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function AccuracyDashboard() {
  const [locations, setLocations] = useState<any[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<string>("");
  const [accuracyData, setAccuracyData] = useState<AccuracyMetrics | null>(null);
  const [historicalData, setHistoricalData] = useState<HistoricalAccuracy[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verifyResult, setVerifyResult] = useState<{ verified: number; failed: number } | null>(null);
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

  // Verify forecasts with actual data
  const handleVerifyForecasts = async () => {
    setIsVerifying(true);
    setError(null);
    setVerifyResult(null);

    try {
      const response = await fetch(
        `/api/forecast-accuracy?action=verify&startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`
      );
      const data = await response.json();

      if (data.success) {
        setVerifyResult(data.result);
      } else {
        throw new Error(data.error || "Failed to verify forecasts");
      }
    } catch (err) {
      setError((err as Error).message);
      console.error(err);
    } finally {
      setIsVerifying(false);
    }
  };

  // Calculate accuracy metrics
  const handleCalculateMetrics = async () => {
    if (!selectedLocation) {
      setError("Please select a location");
      return;
    }

    setIsLoading(true);
    setError(null);
    setAccuracyData(null);

    try {
      const response = await fetch(
        `/api/forecast-accuracy?action=calculate&locationName=${encodeURIComponent(selectedLocation)}&startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`
      );
      const data = await response.json();

      if (data.success) {
        setAccuracyData(data.metrics);

        // Also fetch historical data
        await fetchHistoricalAccuracy();
      } else {
        throw new Error(data.error || "Failed to calculate metrics");
      }
    } catch (err) {
      setError((err as Error).message);
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch historical accuracy
  const fetchHistoricalAccuracy = async () => {
    try {
      const response = await fetch(
        `/api/forecast-accuracy?action=history&locationName=${encodeURIComponent(selectedLocation)}&limit=10`
      );
      const data = await response.json();

      if (data.success) {
        const formatted = data.data.map((item: any) => ({
          location: item.location.name,
          date: new Date(item.period.endDate).toLocaleDateString('id-ID', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
          }),
          correlation: item.metrics.correlation,
          mae: item.metrics.mae,
          rmse: item.metrics.rmse,
          reliability: item.summary.reliability
        }));
        setHistoricalData(formatted);
      }
    } catch (error) {
      console.error("Failed to load historical data:", error);
    }
  };

  // Download report
  const handleDownloadReport = () => {
    if (!accuracyData) return;

    const report = `
Forecast Accuracy Report
========================

Location: ${accuracyData.location.name}
Period: ${dateRange.startDate} to ${dateRange.endDate}
Total Forecasts: ${accuracyData.totalForecasts}
Verified Forecasts: ${accuracyData.verifiedForecasts}

Error Metrics:
- MAE (Mean Absolute Error): ${accuracyData.metrics.mae} mm/h
- RMSE (Root Mean Square Error): ${accuracyData.metrics.rmse} mm/h
- Bias: ${accuracyData.metrics.bias} mm/h

Performance Metrics:
- Correlation: ${accuracyData.metrics.correlation}
- Accuracy: ${(accuracyData.metrics.accuracy * 100).toFixed(1)}%
- Precision: ${(accuracyData.metrics.precision * 100).toFixed(1)}%
- Recall: ${(accuracyData.metrics.recall * 100).toFixed(1)}%
- F1 Score: ${(accuracyData.metrics.f1Score * 100).toFixed(1)}%

Probability Score:
- Brier Score: ${accuracyData.metrics.probabilityScore}

Classification Results:
- Rainy Days: ${accuracyData.metrics.rainyDaysCorrect}/${accuracyData.metrics.rainyDaysTotal} correct
- Dry Days: ${accuracyData.metrics.dryDaysCorrect}/${accuracyData.metrics.dryDaysTotal} correct

Summary:
- Average Predicted: ${accuracyData.summary.avgPredicted} mm/h
- Average Actual: ${accuracyData.summary.avgActual} mm/h
- Max Error: ${accuracyData.summary.maxError} mm/h
- Reliability Rating: ${accuracyData.summary.reliability}

Generated: ${new Date().toISOString()}
    `.trim();

    const blob = new Blob([report], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `accuracy_report_${selectedLocation.replace(/\s+/g, '_')}_${dateRange.startDate}_${dateRange.endDate}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Prepare radar chart data
  const radarData = accuracyData ? [
    {
      metric: 'Correlation',
      value: accuracyData.metrics.correlation * 100,
      fullMark: 100,
    },
    {
      metric: 'Accuracy',
      value: accuracyData.metrics.accuracy * 100,
      fullMark: 100,
    },
    {
      metric: 'Precision',
      value: accuracyData.metrics.precision * 100,
      fullMark: 100,
    },
    {
      metric: 'Recall',
      value: accuracyData.metrics.recall * 100,
      fullMark: 100,
    },
    {
      metric: 'F1 Score',
      value: accuracyData.metrics.f1Score * 100,
      fullMark: 100,
    },
  ] : [];

  // Get reliability color
  const getReliabilityColor = (reliability: string) => {
    switch (reliability) {
      case 'Excellent': return 'text-green-600 bg-green-50 border-green-200';
      case 'Good': return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'Fair': return 'text-amber-600 bg-amber-50 border-amber-200';
      case 'Poor': return 'text-red-600 bg-red-50 border-red-200';
      default: return 'text-slate-600 bg-slate-50 border-slate-200';
    }
  };

  const selectedLoc = locations.find(loc => loc.name === selectedLocation);

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Forecast Accuracy Analysis</h1>
          <p className="text-slate-600 mt-1">Evaluate Open-Meteo forecast performance</p>
        </div>
        <div className="flex items-center gap-2">
          <Target className="h-8 w-8 text-blue-500" />
        </div>
      </div>

      {/* Controls */}
      <Card>
        <CardHeader>
          <CardTitle>Analysis Configuration</CardTitle>
          <CardDescription>Select location and date range to analyze forecast accuracy</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {verifyResult && (
            <Alert>
              <CheckCircle2 className="h-4 w-4" />
              <AlertTitle>Verification Complete</AlertTitle>
              <AlertDescription>
                Successfully verified {verifyResult.verified} forecasts.
                {verifyResult.failed > 0 && ` ${verifyResult.failed} failed.`}
              </AlertDescription>
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
              onClick={handleVerifyForecasts}
              disabled={isVerifying}
              variant="outline"
              className="flex-1"
            >
              {isVerifying ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Verifying...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  1. Verify Forecasts
                </>
              )}
            </Button>
            <Button
              onClick={handleCalculateMetrics}
              disabled={isLoading || !selectedLocation}
              className="flex-1"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Calculating...
                </>
              ) : (
                <>
                  <Target className="h-4 w-4 mr-2" />
                  2. Calculate Metrics
                </>
              )}
            </Button>
            <Button
              onClick={handleDownloadReport}
              disabled={!accuracyData}
              variant="outline"
            >
              <Download className="h-4 w-4 mr-2" />
              Report
            </Button>
          </div>

          <div className="text-xs text-slate-500 p-3 bg-blue-50 rounded-lg border border-blue-200">
            <strong>Note:</strong> First verify forecasts with actual data, then calculate accuracy metrics.
            Verification fetches actual rainfall data from Open-Meteo Archive API.
          </div>
        </CardContent>
      </Card>

      {/* Metrics Overview */}
      {accuracyData && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-slate-600">Reliability</CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold px-3 py-1 rounded-lg border inline-block ${getReliabilityColor(accuracyData.summary.reliability)}`}>
                  {accuracyData.summary.reliability}
                </div>
                <p className="text-xs text-slate-500 mt-2">Overall rating</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-slate-600">Correlation</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">{accuracyData.metrics.correlation.toFixed(3)}</div>
                <p className="text-xs text-slate-500 mt-1">
                  {accuracyData.metrics.correlation > 0.8 ? "Excellent" :
                   accuracyData.metrics.correlation > 0.6 ? "Good" :
                   accuracyData.metrics.correlation > 0.4 ? "Fair" : "Poor"}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-slate-600">MAE</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-amber-600">{accuracyData.metrics.mae.toFixed(2)} mm/h</div>
                <p className="text-xs text-slate-500 mt-1">Mean absolute error</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-slate-600">Bias</CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${accuracyData.metrics.bias > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {accuracyData.metrics.bias > 0 ? '+' : ''}{accuracyData.metrics.bias.toFixed(2)} mm/h
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  {accuracyData.metrics.bias > 0 ? "Overestimation" :
                   accuracyData.metrics.bias < 0 ? "Underestimation" : "No bias"}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Performance Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Error Metrics */}
            <Card>
              <CardHeader>
                <CardTitle>Error Metrics</CardTitle>
                <CardDescription>Lower is better</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                    <span className="text-sm font-semibold text-slate-700">MAE</span>
                    <span className="text-lg font-bold text-amber-600">{accuracyData.metrics.mae.toFixed(2)} mm/h</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                    <span className="text-sm font-semibold text-slate-700">RMSE</span>
                    <span className="text-lg font-bold text-orange-600">{accuracyData.metrics.rmse.toFixed(2)} mm/h</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                    <span className="text-sm font-semibold text-slate-700">Brier Score</span>
                    <span className="text-lg font-bold text-purple-600">{accuracyData.metrics.probabilityScore.toFixed(3)}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                    <span className="text-sm font-semibold text-slate-700">Max Error</span>
                    <span className="text-lg font-bold text-red-600">{accuracyData.summary.maxError.toFixed(2)} mm/h</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Classification Metrics */}
            <Card>
              <CardHeader>
                <CardTitle>Classification Metrics</CardTitle>
                <CardDescription>Higher is better</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                    <span className="text-sm font-semibold text-slate-700">Accuracy</span>
                    <span className="text-lg font-bold text-blue-600">{(accuracyData.metrics.accuracy * 100).toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                    <span className="text-sm font-semibold text-slate-700">Precision</span>
                    <span className="text-lg font-bold text-green-600">{(accuracyData.metrics.precision * 100).toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                    <span className="text-sm font-semibold text-slate-700">Recall</span>
                    <span className="text-lg font-bold text-emerald-600">{(accuracyData.metrics.recall * 100).toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                    <span className="text-sm font-semibold text-slate-700">F1 Score</span>
                    <span className="text-lg font-bold text-teal-600">{(accuracyData.metrics.f1Score * 100).toFixed(1)}%</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Radar Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Performance Overview</CardTitle>
              <CardDescription>Visual representation of all metrics (0-100 scale)</CardDescription>
            </CardHeader>
            <CardContent className="h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData}>
                  <PolarGrid />
                  <PolarAngleAxis dataKey="metric" />
                  <PolarRadiusAxis angle={90} domain={[0, 100]} />
                  <Radar
                    name="Performance"
                    dataKey="value"
                    stroke="#3b82f6"
                    fill="#3b82f6"
                    fillOpacity={0.6}
                  />
                  <Tooltip />
                </RadarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Classification Results */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Rainy Days Detection</CardTitle>
                <CardDescription>Forecast vs Actual rain events</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-6">
                  <div className="text-4xl font-bold text-blue-600 mb-2">
                    {accuracyData.metrics.rainyDaysCorrect} / {accuracyData.metrics.rainyDaysTotal}
                  </div>
                  <div className="text-sm text-slate-600 mb-4">Correctly predicted rainy days</div>
                  <div className="w-full bg-slate-200 rounded-full h-4 overflow-hidden">
                    <div
                      className="bg-blue-600 h-full transition-all duration-500"
                      style={{
                        width: `${(accuracyData.metrics.rainyDaysCorrect / accuracyData.metrics.rainyDaysTotal * 100).toFixed(0)}%`
                      }}
                    />
                  </div>
                  <div className="text-xs text-slate-500 mt-2">
                    {((accuracyData.metrics.rainyDaysCorrect / accuracyData.metrics.rainyDaysTotal) * 100).toFixed(1)}% accuracy
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Dry Days Detection</CardTitle>
                <CardDescription>Forecast vs Actual dry conditions</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-6">
                  <div className="text-4xl font-bold text-green-600 mb-2">
                    {accuracyData.metrics.dryDaysCorrect} / {accuracyData.metrics.dryDaysTotal}
                  </div>
                  <div className="text-sm text-slate-600 mb-4">Correctly predicted dry days</div>
                  <div className="w-full bg-slate-200 rounded-full h-4 overflow-hidden">
                    <div
                      className="bg-green-600 h-full transition-all duration-500"
                      style={{
                        width: `${(accuracyData.metrics.dryDaysCorrect / accuracyData.metrics.dryDaysTotal * 100).toFixed(0)}%`
                      }}
                    />
                  </div>
                  <div className="text-xs text-slate-500 mt-2">
                    {((accuracyData.metrics.dryDaysCorrect / accuracyData.metrics.dryDaysTotal) * 100).toFixed(1)}% accuracy
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}

      {/* Historical Trend */}
      {historicalData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Historical Accuracy Trend</CardTitle>
            <CardDescription>Past 10 accuracy analyses for {selectedLocation}</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={historicalData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  fontSize={11}
                  angle={-45}
                  textAnchor="end"
                  height={80}
                />
                <YAxis fontSize={11} />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="correlation"
                  name="Correlation"
                  stroke="#3b82f6"
                  strokeWidth={2}
                />
                <Line
                  type="monotone"
                  dataKey="mae"
                  name="MAE (mm/h)"
                  stroke="#f59e0b"
                  strokeWidth={2}
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
            <Loader2 className="h-12 w-12 text-blue-500 animate-spin" />
            <div>
              <h3 className="text-lg font-semibold text-slate-800">Calculating accuracy metrics...</h3>
              <p className="text-sm text-slate-500 mt-1">
                Analyzing {accuracyData?.totalForecasts || 0} forecast records
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* No Data State */}
      {!isLoading && !accuracyData && selectedLocation && (
        <Card className="p-12">
          <div className="text-center space-y-4">
            <Calendar className="h-12 w-12 text-slate-400 mx-auto" />
            <div>
              <h3 className="text-lg font-semibold text-slate-800">No accuracy data available</h3>
              <p className="text-sm text-slate-500 mt-1">
                First verify forecasts, then calculate metrics for {selectedLocation}
              </p>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
