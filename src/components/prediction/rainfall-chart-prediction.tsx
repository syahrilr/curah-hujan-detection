'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PredictionResult } from '@/types/rainfall';
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

interface RainfallChartProps {
  data: PredictionResult | null;
}

export function RainfallChart({ data }: RainfallChartProps) {
  if (!data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Rainfall Analysis</CardTitle>
          <CardDescription>No data available</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  // Prepare time series data
  const timeSeriesData = [];

  // Add current data
  const currentTime = data.datetime_obj ? new Date(data.datetime_obj) : new Date();

  timeSeriesData.push({
    time: currentTime.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
    locations_with_rain: data.statistics.current?.with_rain || 0,
    max_rain_rate: data.statistics.current?.max_rain_rate || 0,
    avg_rain_rate: data.statistics.current?.avg_rain_rate || 0,
  });

  // Add prediction data
  const predictionTimes = Object.keys(data.predictions).map(Number).sort((a, b) => a - b);

  predictionTimes.forEach(minutes => {
    const futureTime = new Date(currentTime);
    futureTime.setMinutes(futureTime.getMinutes() + minutes);

    const stats = data.statistics[`prediction_${minutes}min`];

    timeSeriesData.push({
      time: futureTime.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
      locations_with_rain: stats?.with_rain || 0,
      max_rain_rate: stats?.max_rain_rate || 0,
      avg_rain_rate: stats?.avg_rain_rate || 0,
    });
  });

  // Top 10 locations chart data
  const top10Current = [...data.current]
    .sort((a, b) => b.rain_rate - a.rain_rate)
    .slice(0, 10)
    .map(loc => ({
      name: loc.name.length > 20 ? loc.name.substring(0, 20) + '...' : loc.name,
      rain_rate: loc.rain_rate,
      intensity: loc.intensity,
    }));

  return (
    <div className="space-y-4">
      {/* Time Series Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Rainfall Trends Over Time</CardTitle>
          <CardDescription>
            Current and predicted rainfall metrics
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={timeSeriesData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="time"
                tick={{ fontSize: 12 }}
              />
              <YAxis
                yAxisId="left"
                label={{ value: 'Rain Rate (mm/h)', angle: -90, position: 'insideLeft' }}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                label={{ value: 'Locations', angle: 90, position: 'insideRight' }}
              />
              <Tooltip />
              <Legend />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="max_rain_rate"
                stroke="#ef4444"
                strokeWidth={2}
                name="Max Rain Rate"
                dot={{ r: 4 }}
              />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="avg_rain_rate"
                stroke="#3b82f6"
                strokeWidth={2}
                name="Avg Rain Rate"
                dot={{ r: 4 }}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="locations_with_rain"
                stroke="#10b981"
                strokeWidth={2}
                name="Locations with Rain"
                dot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Top 10 Locations Bar Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Top 10 Locations - Current Rainfall</CardTitle>
          <CardDescription>
            Highest rainfall rates across monitored locations
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={top10Current} layout="horizontal">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" label={{ value: 'Rain Rate (mm/h)', position: 'insideBottom', offset: -5 }} />
              <YAxis
                type="category"
                dataKey="name"
                width={150}
                tick={{ fontSize: 11 }}
              />
              <Tooltip />
              <Bar
                dataKey="rain_rate"
                fill="#3b82f6"
                radius={[0, 4, 4, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Statistics Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Prediction Statistics</CardTitle>
          <CardDescription>Comparison across all time periods</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-4">Time</th>
                  <th className="text-right py-2 px-4">Locations</th>
                  <th className="text-right py-2 px-4">Max Rate</th>
                  <th className="text-right py-2 px-4">Avg Rate</th>
                  <th className="text-right py-2 px-4">Confidence</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b">
                  <td className="py-2 px-4 font-medium">Current</td>
                  <td className="text-right py-2 px-4">{data.statistics.current?.with_rain || 0}</td>
                  <td className="text-right py-2 px-4">{(data.statistics.current?.max_rain_rate || 0).toFixed(2)}</td>
                  <td className="text-right py-2 px-4">{(data.statistics.current?.avg_rain_rate || 0).toFixed(2)}</td>
                  <td className="text-right py-2 px-4">100%</td>
                </tr>
                {predictionTimes.map(minutes => {
                  const stats = data.statistics[`prediction_${minutes}min`];
                  return (
                    <tr key={minutes} className="border-b">
                      <td className="py-2 px-4">+{minutes} min</td>
                      <td className="text-right py-2 px-4">{stats?.with_rain || 0}</td>
                      <td className="text-right py-2 px-4">{(stats?.max_rain_rate || 0).toFixed(2)}</td>
                      <td className="text-right py-2 px-4">{(stats?.avg_rain_rate || 0).toFixed(2)}</td>
                      <td className="text-right py-2 px-4">
                        {stats?.avg_confidence ? `${(stats.avg_confidence * 100).toFixed(1)}%` : 'N/A'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
