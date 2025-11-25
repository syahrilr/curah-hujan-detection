'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PredictionResult } from '@/types/rainfall';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';

export function RainfallChart({ data }: { data: PredictionResult }) {
  // Transform data for chart
  const chartData = [
    {
      time: 'Now',
      avg: data.statistics.current.avg_rain_rate,
      max: data.statistics.current.max_rain_rate
    },
    ...Object.keys(data.predictions).map(min => ({
      time: `+${min}m`,
      avg: data.statistics[`prediction_${min}min`]?.avg_rain_rate || 0,
      max: data.statistics[`prediction_${min}min`]?.max_rain_rate || 0
    }))
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Rainfall Trend (3 Hours)</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="time" fontSize={12} />
              <YAxis fontSize={12} label={{ value: 'mm/h', angle: -90, position: 'insideLeft' }} />
              <Tooltip
                contentStyle={{ backgroundColor: 'var(--background)', borderColor: 'var(--border)' }}
                itemStyle={{ color: 'var(--foreground)' }}
              />
              <Legend />
              <Line type="monotone" dataKey="max" stroke="#ef4444" strokeWidth={2} name="Max Intensity" dot={false} />
              <Line type="monotone" dataKey="avg" stroke="#3b82f6" strokeWidth={2} name="Avg Intensity" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
