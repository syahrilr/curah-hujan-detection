'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { RainfallData, Bounds } from '@/types/rainfall';

interface RainfallMapProps {
  data: RainfallData[];
  bounds?: Bounds;
}

export function RainfallMap({
  data,
  // Default Bounds Jakarta (Fallback)
  bounds = { sw: [-6.4, 106.6], ne: [-6.0, 107.1] }
}: RainfallMapProps) {

  // Ekstrak batas koordinat
  const minLat = bounds.sw[0];
  const maxLat = bounds.ne[0];
  const minLng = bounds.sw[1];
  const maxLng = bounds.ne[1];

  // Konversi Lat/Lng ke Persentase CSS (Top/Left)
  const getPosition = (lat: number, lng: number) => {
    // Clamp values agar marker tidak keluar kotak
    const safeLat = Math.max(minLat, Math.min(lat, maxLat));
    const safeLng = Math.max(minLng, Math.min(lng, maxLng));

    const x = ((safeLng - minLng) / (maxLng - minLng)) * 100;
    // Lat makin kecil = makin Selatan (Bawah), maka (Max - Current) / Range
    const y = ((maxLat - safeLat) / (maxLat - minLat)) * 100;

    return { x, y };
  };

  const getColor = (rate: number) => {
    if (rate >= 50) return 'bg-red-600 shadow-[0_0_10px_rgba(220,38,38,0.8)]';
    if (rate >= 10) return 'bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.6)]';
    if (rate >= 2) return 'bg-yellow-400';
    if (rate > 0) return 'bg-blue-400';
    return 'bg-slate-300 dark:bg-slate-600';
  };

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Interactive Map</CardTitle>
        <CardDescription>
          Distribution based on radar bounds: {minLat.toFixed(2)}, {minLng.toFixed(2)} to {maxLat.toFixed(2)}, {maxLng.toFixed(2)}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Container Peta: Aspect Ratio Square agar sesuai dengan gambar radar */}
        <div className="relative w-full aspect-square bg-slate-100 dark:bg-slate-900 rounded-lg border overflow-hidden">

          {/* Grid Lines (Opsional: Kosmetik) */}
          <div className="absolute inset-0 opacity-10 pointer-events-none"
               style={{backgroundImage: 'radial-gradient(circle, #000 1px, transparent 1px)', backgroundSize: '20px 20px'}}>
          </div>

          {data.map((loc, idx) => {
            const pos = getPosition(loc.lat, loc.lng);
            return (
              <div
                key={`${loc.name}-${idx}`}
                className="absolute transform -translate-x-1/2 -translate-y-1/2 group z-10"
                style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
              >
                {/* Marker Point */}
                <div
                  className={`w-3 h-3 rounded-full ${getColor(loc.rain_rate)} ring-1 ring-white/50 transition-transform duration-200 hover:scale-150 cursor-pointer`}
                />

                {/* Tooltip Hover */}
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-50">
                   <div className="bg-black/90 text-white text-[10px] px-2 py-1 rounded whitespace-nowrap shadow-xl border border-white/10">
                      <div className="font-bold">{loc.name}</div>
                      <div className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-blue-400 inline-block"></span>
                        {loc.rain_rate.toFixed(1)} mm/h
                      </div>
                   </div>
                   {/* Arrow Tooltip */}
                   <div className="w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[4px] border-t-black/90 absolute left-1/2 -translate-x-1/2 top-full"></div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
