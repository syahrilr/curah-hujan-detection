'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { RainfallData } from '@/types/rainfall';
import { formatRainRate, formatConfidence, getIntensityBadgeVariant } from '@/lib/rainfall-utils';
import { ArrowUpDown, MapPin } from 'lucide-react';
import { useState } from 'react';

interface LocationTableProps {
  data: RainfallData[];
  showConfidence?: boolean;
  title?: string;
  description?: string;
}

type SortField = 'name' | 'rain_rate' | 'dbz' | 'confidence';
type SortOrder = 'asc' | 'desc';

export function LocationTable({
  data,
  showConfidence = false,
  title = "All Locations",
  description = "Complete rainfall data table"
}: LocationTableProps) {
  const [sortField, setSortField] = useState<SortField>('rain_rate');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const sortedData = [...data].sort((a, b) => {
    let aValue: number | string = 0;
    let bValue: number | string = 0;

    switch (sortField) {
      case 'name':
        aValue = a.name;
        bValue = b.name;
        break;
      case 'rain_rate':
        aValue = a.rain_rate;
        bValue = b.rain_rate;
        break;
      case 'dbz':
        aValue = a.dbz;
        bValue = b.dbz;
        break;
      case 'confidence':
        aValue = a.confidence;
        bValue = b.confidence;
        break;
    }

    if (typeof aValue === 'string' && typeof bValue === 'string') {
      return sortOrder === 'asc'
        ? aValue.localeCompare(bValue)
        : bValue.localeCompare(aValue);
    }

    return sortOrder === 'asc'
      ? (aValue as number) - (bValue as number)
      : (bValue as number) - (aValue as number);
  });

  const SortButton = ({ field, label }: { field: SortField; label: string }) => (
    <button
      onClick={() => handleSort(field)}
      className="flex items-center gap-1 hover:text-primary transition-colors"
    >
      {label}
      <ArrowUpDown className="w-3 h-3" />
    </button>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="text-sm text-muted-foreground mb-2">
          Showing {data.length} location{data.length !== 1 ? 's' : ''}
        </div>
        <ScrollArea className="h-[500px] rounded-md border">
          <table className="w-full">
            <thead className="sticky top-0 bg-background border-b z-10">
              <tr>
                <th className="text-left p-3">
                  <SortButton field="name" label="Location" />
                </th>
                <th className="text-right p-3">
                  <SortButton field="rain_rate" label="Rain Rate" />
                </th>
                <th className="text-center p-3">Intensity</th>
                <th className="text-right p-3">
                  <SortButton field="dbz" label="dBZ" />
                </th>
                <th className="text-center p-3">Coordinates</th>
                {showConfidence && (
                  <th className="text-right p-3">
                    <SortButton field="confidence" label="Confidence" />
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {sortedData.map((location, idx) => (
                <tr
                  key={`${location.name}-${idx}`}
                  className="border-b hover:bg-muted/50 transition-colors"
                >
                  <td className="p-3">
                    <div className="flex items-start gap-2">
                      <MapPin className="w-4 h-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                      <span className="font-medium">{location.name}</span>
                    </div>
                  </td>
                  <td className="text-right p-3 font-mono">
                    <span className={`font-semibold ${
                      location.rain_rate >= 10 ? 'text-red-500' :
                      location.rain_rate >= 2 ? 'text-orange-500' :
                      location.rain_rate > 0 ? 'text-blue-500' :
                      'text-muted-foreground'
                    }`}>
                      {formatRainRate(location.rain_rate)}
                    </span>
                    <span className="text-muted-foreground text-xs ml-1">mm/h</span>
                  </td>
                  <td className="text-center p-3">
                    <Badge variant={getIntensityBadgeVariant(location.intensity)}>
                      {location.intensity}
                    </Badge>
                  </td>
                  <td className="text-right p-3 font-mono text-sm">
                    {location.dbz.toFixed(1)}
                  </td>
                  <td className="text-center p-3 font-mono text-xs text-muted-foreground">
                    <div>{location.lat.toFixed(4)}</div>
                    <div>{location.lng.toFixed(4)}</div>
                  </td>
                  {showConfidence && (
                    <td className="text-right p-3 font-mono text-sm">
                      <span className={`${
                        location.confidence >= 0.8 ? 'text-green-500' :
                        location.confidence >= 0.5 ? 'text-yellow-500' :
                        'text-red-500'
                      }`}>
                        {formatConfidence(location.confidence)}
                      </span>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
