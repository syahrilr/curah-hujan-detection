'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { RainfallData } from '@/types/rainfall';
import { Badge } from '@/components/ui/badge';

interface LocationTableProps {
  data: RainfallData[];
  title?: string;
}

export function LocationTable({ data, title = "Location Data" }: LocationTableProps) {
  // Sort by Rain Rate descending
  const sortedData = [...data].sort((a, b) => b.rain_rate - a.rain_rate);

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[400px]">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-muted-foreground uppercase bg-muted/50 sticky top-0">
              <tr>
                <th className="px-4 py-3">Location</th>
                <th className="px-4 py-3 text-right">Rain Rate</th>
                <th className="px-4 py-3 text-center">Intensity</th>
                <th className="px-4 py-3 text-right">Conf.</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {sortedData.map((loc, i) => (
                <tr key={i} className="hover:bg-muted/50 transition-colors">
                  <td className="px-4 py-2 font-medium">{loc.name}</td>
                  <td className="px-4 py-2 text-right font-mono">
                    {loc.rain_rate.toFixed(1)} <span className="text-xs text-muted-foreground">mm/h</span>
                  </td>
                  <td className="px-4 py-2 text-center">
                    <Badge variant={loc.rain_rate > 10 ? "destructive" : loc.rain_rate > 0 ? "default" : "secondary"} className="text-[10px]">
                       {loc.intensity}
                    </Badge>
                  </td>
                  <td className="px-4 py-2 text-right text-xs">
                     {(loc.confidence * 100).toFixed(0)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
