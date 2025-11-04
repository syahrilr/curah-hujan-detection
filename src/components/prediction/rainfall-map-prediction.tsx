'use client';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RainfallData } from '@/types/rainfall';
import { Droplets } from 'lucide-react';

interface RainfallMapProps {
  data: RainfallData[];
  showLabels?: boolean;
  highlightThreshold?: number;
}

export function RainfallMap({
  data,
  showLabels = true,
  highlightThreshold = 2.0
}: RainfallMapProps) {
  // Find bounds
  const lats = data.map(d => d.lat);
  const lngs = data.map(d => d.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);

  // Calculate position percentage
  const getPosition = (lat: number, lng: number) => {
    const x = ((lng - minLng) / (maxLng - minLng)) * 100;
    const y = ((maxLat - lat) / (maxLat - minLat)) * 100;
    return { x, y };
  };

  // Get color based on rain rate
  const getColor = (rainRate: number) => {
    if (rainRate >= 50) return 'bg-red-500';
    if (rainRate >= 10) return 'bg-orange-500';
    if (rainRate >= 2) return 'bg-yellow-500';
    if (rainRate > 0) return 'bg-blue-400';
    return 'bg-gray-300';
  };

  // Get size based on rain rate
  const getSize = (rainRate: number) => {
    if (rainRate >= 50) return 'w-6 h-6';
    if (rainRate >= 10) return 'w-5 h-5';
    if (rainRate >= 2) return 'w-4 h-4';
    return 'w-3 h-3';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Rainfall Map</CardTitle>
        <CardDescription>
          Geographic distribution of rainfall intensity
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="relative w-full h-[500px] bg-slate-100 dark:bg-slate-900 rounded-lg border">
          {data.map((location, idx) => {
            const pos = getPosition(location.lat, location.lng);
            const isHighRain = location.rain_rate >= highlightThreshold;

            return (
              <div
                key={`${location.name}-${idx}`}
                className="absolute transform -translate-x-1/2 -translate-y-1/2 group"
                style={{
                  left: `${pos.x}%`,
                  top: `${pos.y}%`,
                }}
              >
                {/* Marker */}
                <div
                  className={`
                    ${getSize(location.rain_rate)}
                    ${getColor(location.rain_rate)}
                    rounded-full
                    cursor-pointer
                    transition-all
                    duration-200
                    hover:scale-150
                    ${isHighRain ? 'ring-2 ring-red-500 ring-offset-2 animate-pulse' : ''}
                  `}
                  title={`${location.name}: ${location.rain_rate.toFixed(2)} mm/h`}
                />

                {/* Tooltip on hover */}
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-10">
                  <div className="bg-black/90 text-white text-xs rounded-lg px-3 py-2 whitespace-nowrap shadow-lg">
                    <div className="font-semibold">{location.name}</div>
                    <div className="flex items-center gap-2 mt-1">
                      <Droplets className="w-3 h-3" />
                      <span>{location.rain_rate.toFixed(2)} mm/h</span>
                    </div>
                    <div className="text-[10px] text-gray-300 mt-1">
                      {location.lat.toFixed(4)}, {location.lng.toFixed(4)}
                    </div>
                    <Badge
                      variant={location.rain_rate >= 10 ? 'destructive' : 'secondary'}
                      className="mt-1 text-[10px]"
                    >
                      {location.intensity}
                    </Badge>
                  </div>
                  {/* Arrow */}
                  <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-black/90" />
                </div>
              </div>
            );
          })}

          {/* Legend */}
          <div className="absolute bottom-4 right-4 bg-white/95 dark:bg-slate-800/95 p-3 rounded-lg shadow-lg">
            <div className="text-xs font-semibold mb-2">Rain Intensity</div>
            <div className="space-y-1 text-xs">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-red-500 rounded-full" />
                <span>&gt; 50 mm/h</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-orange-500 rounded-full" />
                <span>10-50 mm/h</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-yellow-500 rounded-full" />
                <span>2-10 mm/h</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-blue-400 rounded-full" />
                <span>&lt; 2 mm/h</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-gray-300 rounded-full" />
                <span>No Rain</span>
              </div>
            </div>
          </div>

          {/* Coordinates overlay */}
          <div className="absolute top-4 left-4 bg-white/95 dark:bg-slate-800/95 p-2 rounded text-xs">
            <div className="font-mono">
              <div>Bounds:</div>
              <div>Lat: {minLat.toFixed(4)} to {maxLat.toFixed(4)}</div>
              <div>Lng: {minLng.toFixed(4)} to {maxLng.toFixed(4)}</div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
