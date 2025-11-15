'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  RefreshCw,
  Download,
  CloudRain,
  MapPin,
  TrendingUp,
  AlertTriangle
} from 'lucide-react';

// Import hooks dengan proper types
import { useRainfallPrediction } from '@/hooks/use-rainfall-prediction';
import { usePredictionComparison } from '@/hooks/use-prediction-comparison';

// Import utilities
import {
  formatRainRate,
  formatConfidence,
  formatTimestamp,
  getPredictionTime,
  getIntensityBadgeVariant,
  downloadFile
} from '@/lib/rainfall-utils';

// Import API
import { rainfallAPI } from '@/lib/rainfall-api';

// Import types
import type { RainfallData } from '@/types/rainfall';

// Import components
import { RainfallMap } from './rainfall-map-prediction';
import { RainfallChart } from './rainfall-chart-prediction';
import { LocationTable } from './location-table-prediction';
import { PredictionComparisonResults } from './prediction-comparison-results';
import { SystemInfoCard } from './system-info-card';
import { useRainfallImages } from '@/hooks/use-rainfall-images';
import Image from 'next/image';
import { useEffect } from 'react';

export default function RainfallPredictionDashboard() {
  const { data, loading, error, progress, triggerPrediction } = useRainfallPrediction();
  const { images, reload: reloadImages } = useRainfallImages();
  const { compareWithActual, loading: compareLoading, data: comparisonData } = usePredictionComparison();
  const [selectedMinutes, setSelectedMinutes] = useState<number>(10);
  const [showComparison, setShowComparison] = useState(false);

  // Efek untuk memuat ulang gambar saat data prediksi berubah
  useEffect(() => {
    if (data) {
      reloadImages();
    }
  }, [data, reloadImages]);

  const handleCompareWithActual = async () => {
    if (!data?.predictions?.[selectedMinutes]) return;

    const predictionTime = new Date(data.datetime_obj || '');
    predictionTime.setMinutes(predictionTime.getMinutes() + selectedMinutes);

    const locations = data.predictions[selectedMinutes].map(loc => ({
      name: loc.name,
      predicted_rain_rate: loc.rain_rate,
      confidence: loc.confidence,
    }));

    await compareWithActual(predictionTime.toISOString(), locations, 5);
    setShowComparison(true);
  };

  const handleExportExcel = async () => {
    try {
      const blob = await rainfallAPI.exportToExcel();
      downloadFile(blob, `rainfall_prediction_${Date.now()}.xlsx`);
    } catch (err) {
      console.error('Export failed:', err);
    }
  };

  const handleExportJSON = async () => {
    try {
      const blob = await rainfallAPI.exportToJSON();
      downloadFile(blob, `rainfall_prediction_${Date.now()}.json`);
    } catch (err) {
      console.error('Export failed:', err);
    }
  };

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <div className="font-semibold mb-2">Error: {error}</div>
            <div className="text-sm">
              Pastikan:
              <ul className="list-disc list-inside mt-2">
                <li>Backend API running di http://localhost:8000</li>
                <li>MongoDB terhubung (192.168.5.192:27017)</li>
                <li>Ada data di collection rainfall_records</li>
              </ul>
            </div>
            <div className="flex gap-2 mt-4">
              <Button
                onClick={() => window.location.reload()}
                variant="outline"
              >
                Reload Page
              </Button>
              <Button
                onClick={() => triggerPrediction()}
                disabled={loading}
              >
                Try Again
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // Show loading state with progress
  if (loading && progress) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle>Generating Prediction</CardTitle>
            <CardDescription>
              Using improved optical flow algorithm with MongoDB data
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <RefreshCw className="h-5 w-5 animate-spin text-blue-500" />
              <span className="text-lg">{progress}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-500 h-2 rounded-full transition-all duration-500 animate-pulse"
                style={{ width: '70%' }}
              />
            </div>
            <div className="text-sm text-muted-foreground space-y-1">
              <div>• Fetching data from MongoDB</div>
              <div>• Computing ensemble optical flow</div>
              <div>• Generating multi-horizon predictions</div>
              <div>• Creating visualizations</div>
            </div>
            <Alert>
              <AlertDescription className="text-xs">
                This process typically takes 2-10 minutes. Please wait...
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show empty state if no data yet
  if (!data && !loading) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle>Rainfall Prediction System</CardTitle>
            <CardDescription>
              Advanced rainfall prediction using MongoDB and optical flow
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <AlertDescription>
                <div className="font-semibold mb-2">Welcome! 👋</div>
                <div className="text-sm mb-4">
                  No prediction data available yet. Click the button below to generate your first prediction.
                </div>
              </AlertDescription>
            </Alert>

            <div className="flex flex-col items-center gap-4 py-8">
              <CloudRain className="h-16 w-16 text-muted-foreground" />
              <div className="text-center">
                <h3 className="text-lg font-semibold mb-2">Ready to Start</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Generate rainfall predictions from the latest MongoDB data
                </p>
                <Button
                  onClick={() => triggerPrediction()}
                  disabled={loading}
                  size="lg"
                >
                  <RefreshCw className="mr-2 h-5 w-5" />
                  Generate First Prediction
                </Button>
              </div>
            </div>

            <div className="border-t pt-4">
              <h4 className="font-semibold text-sm mb-3">System Requirements:</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <div className="flex items-start gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-500 mt-1.5" />
                  <div>
                    <div className="font-medium">Backend API</div>
                    <div className="text-xs text-muted-foreground">Running on port 8000</div>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-500 mt-1.5" />
                  <div>
                    <div className="font-medium">MongoDB</div>
                    <div className="text-xs text-muted-foreground">Connected to rainfall_records</div>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-500 mt-1.5" />
                  <div>
                    <div className="font-medium">Optical Flow</div>
                    <div className="text-xs text-muted-foreground">DualTVL1 algorithm ready</div>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-500 mt-1.5" />
                  <div>
                    <div className="font-medium">Multi-horizon</div>
                    {/* PERBARUI TEKS DI SINI */}
                    <div className="text-xs text-muted-foreground">10-min intervals up to 180 minutes</div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const currentStats = data?.statistics?.current;
  const predictionKeys = data?.predictions
    ? Object.keys(data.predictions).map(Number).sort((a: number, b: number) => a - b)
    : [];

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-4xl font-bold">Rainfall Prediction System</h1>
          <p className="text-muted-foreground mt-2">
            {data?.timestamp ? `Last updated: ${formatTimestamp(data.timestamp)}` : 'No data yet - Click "Update Prediction"'}
          </p>
          {data && (
            <div className="flex gap-4 mt-2 text-sm text-muted-foreground">
              <span>📡 Source: MongoDB</span>
              <span>🎬 Frames: {data.frames_used}</span>
              {/* <span>⚙️ Method: {data.flow_method}</span> */}
              <span>⏱️ Interval: {data.avg_frame_interval?.toFixed(1)}min</span>
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => triggerPrediction()}
            disabled={loading}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Updating...' : 'Update Prediction'}
          </Button>
          <Button variant="outline" onClick={handleExportExcel} disabled={!data}>
            <Download className="mr-2 h-4 w-4" />
            Export Excel
          </Button>
          <Button variant="outline" onClick={handleExportJSON} disabled={!data}>
            <Download className="mr-2 h-4 w-4" />
            Export JSON
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Locations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data?.total_locations || 0}</div>
            <p className="text-xs text-muted-foreground">Monitored pump stations</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Active Rainfall</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-500">
              {currentStats?.with_rain || 0}
            </div>
            <p className="text-xs text-muted-foreground">Locations with rain</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Max Rain Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-500">
              {formatRainRate(currentStats?.max_rain_rate || 0)}
            </div>
            <p className="text-xs text-muted-foreground">mm/hour</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Avg Rain Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatRainRate(currentStats?.avg_rain_rate || 0)}
            </div>
            <p className="text-xs text-muted-foreground">mm/hour</p>
          </CardContent>
        </Card>
      </div>

      {/* System Info Card - Only show when data is available */}
      {/* {data && <SystemInfoCard data={data} />} */}

      {/* Main Content */}
      <Tabs defaultValue="current" className="space-y-4">
        <TabsList>
          <TabsTrigger value="current">Current Conditions</TabsTrigger>
          <TabsTrigger value="predictions">Predictions</TabsTrigger>
          <TabsTrigger value="comparison">Comparison</TabsTrigger>
          <TabsTrigger value="visualizations">Visualizations</TabsTrigger>
          <TabsTrigger value="analysis">Analysis</TabsTrigger>
        </TabsList>

        {/* Current Conditions Tab */}
        <TabsContent value="current" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Current Rainfall Map</CardTitle>
                <CardDescription>Real-time radar image with annotations</CardDescription>
              </CardHeader>
              <CardContent>
                {images?.current ? (
                  <Image
                    src={`data:image/png;base64,${images.current}`}
                    alt="Current rainfall"
                    className="w-full h-auto rounded-lg"
                    width={800}
                    height={800}
                  />
                ) : (
                  <div className="h-96 bg-muted rounded-lg flex items-center justify-center">
                    <p className="text-muted-foreground">Loading image...</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Top Locations</CardTitle>
                <CardDescription>Highest rainfall rates currently</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-96">
                  {data?.current
                    ?.sort((a: RainfallData, b: RainfallData) => b.rain_rate - a.rain_rate)
                    .slice(0, 10)
                    .map((location: RainfallData, idx: number) => (
                      <div
                        key={location.name}
                        className="flex items-center justify-between p-3 border-b last:border-0"
                      >
                        <div className="flex items-center gap-2">
                          <div className="text-sm font-medium text-muted-foreground">
                            #{idx + 1}
                          </div>
                          <div>
                            <div className="font-medium">{location.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {location.lat.toFixed(4)}, {location.lng.toFixed(4)}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold">{formatRainRate(location.rain_rate)}</div>
                          <Badge variant={getIntensityBadgeVariant(location.intensity)}>
                            {location.intensity}
                          </Badge>
                        </div>
                      </div>
                    ))}
                </ScrollArea>
              </CardContent>
            </Card>
          </div>

          {/* Interactive Map */}
          {data?.current && <RainfallMap data={data.current} />}

          {/* Data Table */}
          <LocationTable data={data?.current || []} />
        </TabsContent>

        {/* Predictions Tab */}
        <TabsContent value="predictions" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Time Selection</CardTitle>
                  <CardDescription>Select prediction time</CardDescription>
                </div>
                <Button
                  onClick={handleCompareWithActual}
                  disabled={compareLoading || !data?.predictions?.[selectedMinutes]}
                  variant="outline"
                >
                  {compareLoading ? 'Comparing...' : 'Compare with Actual'}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2 flex-wrap">
                {predictionKeys.map((minutes: number) => (
                  <Button
                    key={minutes}
                    variant={selectedMinutes === minutes ? 'default' : 'outline'}
                    onClick={() => setSelectedMinutes(minutes)}
                  >
                    {data?.datetime_obj
                      ? getPredictionTime(data.datetime_obj, minutes)
                      : `+${minutes} min`
                    }
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Prediction Map</CardTitle>
                <CardDescription>
                  Forecast for {getPredictionTime(data?.datetime_obj || '', selectedMinutes)}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {images?.predictions?.[selectedMinutes] ? (
                  <Image
                    src={`data:image/png;base64,${images.predictions[selectedMinutes]}`}
                    alt={`Prediction ${selectedMinutes} min`}
                    className="w-full h-auto rounded-lg"
                    width={800}
                    height={800}
                  />
                ) : (
                  <div className="h-96 bg-muted rounded-lg flex items-center justify-center">
                    <p className="text-muted-foreground">No image available</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Predicted Top Locations</CardTitle>
                <CardDescription>Expected highest rainfall</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-96">
                  {data?.predictions?.[selectedMinutes]
                    ?.sort((a: RainfallData, b: RainfallData) => b.rain_rate - a.rain_rate)
                    .slice(0, 10)
                    .filter((loc: RainfallData) => loc.rain_rate > 1.0)
                    .map((location: RainfallData, idx: number) => (
                      <div
                        key={location.name}
                        className="flex items-center justify-between p-3 border-b last:border-0"
                      >
                        <div className="flex items-center gap-2">
                          <div className="text-sm font-medium text-muted-foreground">
                            #{idx + 1}
                          </div>
                          <div>
                            <div className="font-medium">{location.name}</div>
                            <div className="text-xs text-muted-foreground">
                              Confidence: {formatConfidence(location.confidence)}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold">{formatRainRate(location.rain_rate)}</div>
                          <Badge variant={getIntensityBadgeVariant(location.intensity)}>
                            {location.intensity}
                          </Badge>
                        </div>
                      </div>
                    ))}
                </ScrollArea>
              </CardContent>
            </Card>
          </div>

          {/* Interactive Prediction Map */}
          {data?.predictions?.[selectedMinutes] && (
            <RainfallMap data={data.predictions[selectedMinutes]} />
          )}

          {/* Prediction Data Table */}
          <LocationTable
            data={data?.predictions?.[selectedMinutes] || []}
            showConfidence
            title={`Prediction +${selectedMinutes} minutes`}
            description={`Forecasted rainfall at ${getPredictionTime(data?.datetime_obj || '', selectedMinutes)}`}
          />
        </TabsContent>

        {/* Comparison Tab */}
        <TabsContent value="comparison" className="space-y-4">
          {comparisonData ? (
            <PredictionComparisonResults data={comparisonData} />
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Perbandingan Prediksi vs Data Real</CardTitle>
                <CardDescription>
                  Pilih waktu prediksi di tab Predictions dan klik "Compare with Actual"
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Alert>
                  <AlertDescription>
                    Belum ada data perbandingan. Silakan pilih waktu prediksi dan trigger comparison.
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Visualizations Tab */}
        <TabsContent value="visualizations" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Optical Flow Vectors</CardTitle>
                <CardDescription>Movement patterns detected</CardDescription>
              </CardHeader>
              <CardContent>
                {images?.flow ? (
                  <Image
                    src={`data:image/png;base64,${images.flow}`}
                    alt="Optical flow"
                    className="w-full h-auto rounded-lg"
                    width={800}
                    height={800}
                  />
                ) : (
                  <div className="h-96 bg-muted rounded-lg flex items-center justify-center">
                    <p className="text-muted-foreground">No flow data</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Flow Confidence Map</CardTitle>
                <CardDescription>Prediction confidence heatmap</CardDescription>
              </CardHeader>
              <CardContent>
                {images?.confidence ? (
                  <Image
                    src={`data:image/png;base64,${images.confidence}`}
                    alt="Confidence map"
                    className="w-full h-auto rounded-lg"
                    width={800}
                    height={800}
                  />
                ) : (
                  <div className="h-96 bg-muted rounded-lg flex items-center justify-center">
                    <p className="text-muted-foreground">No confidence data</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Flow Statistics</CardTitle>
              <CardDescription>Optical flow analysis metrics</CardDescription>
            </CardHeader>
            <CardContent>
              {data?.flow_stats ? (
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Mean Magnitude</p>
                    <p className="text-2xl font-bold">
                      {data.flow_stats.mean_magnitude.toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Max Magnitude</p>
                    <p className="text-2xl font-bold">
                      {data.flow_stats.max_magnitude.toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Confidence</p>
                    <p className="text-2xl font-bold">
                      {formatConfidence(data.flow_stats.mean_confidence)}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground">No flow statistics available</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Analysis Tab */}
        <TabsContent value="analysis" className="space-y-4">
          <RainfallChart data={data} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
