'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { RefreshCw, AlertTriangle, CloudRain } from 'lucide-react';

import { useRainfallPrediction } from '@/hooks/use-rainfall-prediction';
import { useRainfallImages } from '@/hooks/use-rainfall-images';
import { RainfallMap } from './rainfall-map-prediction';
import { LocationTable } from './location-table-prediction';
import { RainfallChart } from './rainfall-chart-prediction';

export default function RainfallPage() {
  const { data, loading, error, triggerPrediction } = useRainfallPrediction();
  const { images } = useRainfallImages(data?.timestamp);

  const [selectedMinutes, setSelectedMinutes] = useState(10);
  const [imgLoading, setImgLoading] = useState(true);

  // Reset loading state saat waktu prediksi berubah
  useEffect(() => {
    setImgLoading(true);
  }, [selectedMinutes, data]); // Reset juga saat data baru masuk

  // Initial Loading State
  if (loading && !data) {
    return (
      <div className="container max-w-7xl mx-auto p-6 space-y-6">
        <div className="flex justify-between items-center">
           <Skeleton className="h-10 w-64" />
           <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
           <Skeleton className="h-[500px] w-full" />
           <Skeleton className="h-[500px] w-full" />
        </div>
      </div>
    );
  }

  // Error State
  if (error && !data) {
    return (
      <div className="flex h-screen items-center justify-center p-6">
        <Alert variant="destructive" className="max-w-md">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Connection Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
          <Button onClick={() => window.location.reload()} className="mt-4 w-full" variant="outline">
            Retry
          </Button>
        </Alert>
      </div>
    );
  }

  // Empty State (Belum ada data di DB)
  if (!data) {
     return (
        <div className="flex flex-col h-screen items-center justify-center p-6 text-center space-y-4">
           <CloudRain className="w-16 h-16 text-muted-foreground" />
           <h1 className="text-2xl font-bold">No Rainfall Data Available</h1>
           <p className="text-muted-foreground">Click the button below to generate the first prediction.</p>
           <Button onClick={() => triggerPrediction()} disabled={loading}>
              {loading ? 'Generating...' : 'Start Prediction System'}
           </Button>
        </div>
     );
  }

  return (
    <div className="container max-w-7xl mx-auto p-4 lg:p-6 space-y-6">

      {/* --- HEADER --- */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Rainfall Prediction</h1>
          <p className="text-muted-foreground">
             Updated: {data.timestamp ? format(new Date(data.timestamp), 'dd MMM yyyy, HH:mm') : '-'}
          </p>
        </div>
        <div className="flex items-center gap-2">
           <div className={`text-xs px-2 py-1 rounded-full bg-green-100 text-green-700 font-medium ${loading ? 'opacity-50' : ''}`}>
              {loading ? 'Updating...' : 'Live'}
           </div>
           <Button size="sm" onClick={() => triggerPrediction()} disabled={loading}>
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
           </Button>
        </div>
      </div>

      {/* --- MAIN TABS --- */}
      <Tabs defaultValue="predictions" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 lg:w-[400px]">
          <TabsTrigger value="predictions">Predictions</TabsTrigger>
          <TabsTrigger value="current">Current View</TabsTrigger>
          <TabsTrigger value="analysis">Analysis</TabsTrigger>
        </TabsList>

        {/* === TAB 1: PREDICTIONS === */}
        <TabsContent value="predictions" className="space-y-6">

          {/* Time Horizon Selector */}
          <div className="flex overflow-x-auto pb-2 gap-2 scrollbar-hide">
             {[10, 30, 60, 90, 120, 150, 180].map((min) => (
               <Button
                 key={min}
                 variant={selectedMinutes === min ? "default" : "outline"}
                 className="flex-shrink-0"
                 onClick={() => setSelectedMinutes(min)}
               >
                 +{min} min
               </Button>
             ))}
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
             {/* LEFT: Prediction Image */}
             <Card className="overflow-hidden">
                <CardHeader>
                   <CardTitle className="flex justify-between">
                      <span>Forecast Visual</span>
                      <span className="text-sm font-normal text-muted-foreground">+{selectedMinutes} Minutes</span>
                   </CardTitle>
                </CardHeader>
                <CardContent className="p-0 relative min-h-[400px] flex items-center justify-center bg-black/5 dark:bg-black/20">
                    {/* Skeleton overlay saat loading gambar baru */}
                    {imgLoading && (
                        <Skeleton className="absolute inset-0 z-10" />
                    )}

                    <Image
                       src={images.getPrediction(selectedMinutes)}
                       alt={`Prediction +${selectedMinutes}`}
                       width={600}
                       height={600}
                       className={`w-full h-auto object-contain transition-opacity duration-500 ${imgLoading ? 'opacity-0' : 'opacity-100'}`}
                       unoptimized // bypass Next.js optimization for localhost
                       onLoadingComplete={() => setImgLoading(false)}
                    />
                </CardContent>
             </Card>

             {/* RIGHT: Map & Table (Split vertical) */}
             <div className="flex flex-col gap-6 h-full">
                <div className="flex-1 min-h-[300px]">
                   <RainfallMap
                      data={data.predictions[selectedMinutes] || []}
                      bounds={data.bounds}
                   />
                </div>
                <div className="flex-1">
                   <LocationTable
                      data={data.predictions[selectedMinutes] || []}
                      title={`Forecast Data (+${selectedMinutes}m)`}
                   />
                </div>
             </div>
          </div>
        </TabsContent>

        {/* === TAB 2: CURRENT VIEW === */}
        <TabsContent value="current" className="space-y-6">
           <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              <Card>
                 <CardHeader><CardTitle>Current Radar (Actual)</CardTitle></CardHeader>
                 <CardContent className="p-0 flex items-center justify-center bg-black/5 dark:bg-black/20 min-h-[400px]">
                    <Image
                       src={images.current}
                       alt="Current Radar"
                       width={600}
                       height={600}
                       className="w-full h-auto object-contain"
                       unoptimized
                    />
                 </CardContent>
              </Card>
              <div className="h-full">
                 <RainfallMap
                    data={data.current}
                    bounds={data.bounds}
                 />
              </div>
           </div>
           <LocationTable data={data.current} title="Current Location Data" />
        </TabsContent>

        {/* === TAB 3: ANALYSIS === */}
        <TabsContent value="analysis" className="space-y-6">
           <RainfallChart data={data} />

           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                 <CardHeader>
                    <CardTitle>Optical Flow Vectors</CardTitle>
                    <CardDescription>Visualisasi arah pergerakan awan</CardDescription>
                 </CardHeader>
                 <CardContent className="p-0">
                    <Image
                       src={images.flow}
                       alt="Optical Flow"
                       width={600}
                       height={600}
                       className="w-full h-auto"
                       unoptimized
                    />
                 </CardContent>
              </Card>
              <Card>
                 <CardHeader>
                    <CardTitle>Confidence Map</CardTitle>
                    <CardDescription>Tingkat kepercayaan prediksi berdasarkan flow</CardDescription>
                 </CardHeader>
                 <CardContent className="p-0">
                    <Image
                       src={images.confidence}
                       alt="Confidence Map"
                       width={600}
                       height={600}
                       className="w-full h-auto"
                       unoptimized
                    />
                 </CardContent>
              </Card>
           </div>
        </TabsContent>

      </Tabs>
    </div>
  );
}
