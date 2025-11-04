'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  ReferenceLine
} from 'recharts';

interface ComparisonChartsProps {
  data: {
    scatterData: Array<{
      location: string;
      predicted: number;
      actual: number;
      error: number;
      errorPercentage: number;
      quality: string;
    }>;
    errorDistribution: Array<{
      location: string;
      error: number;
      errorPercentage: number;
    }>;
    qualityData: Array<{
      quality: string;
      count: number;
      fill: string;
    }>;
    topErrors: Array<{
      location: string;
      error: number;
      errorPercentage: number;
    }>;
  };
}

const QUALITY_COLORS: { [key: string]: string } = {
  excellent: '#10b981',
  good: '#3b82f6',
  fair: '#f59e0b',
  poor: '#ef4444',
};

export function ComparisonCharts({ data }: ComparisonChartsProps) {
  const { scatterData, errorDistribution, qualityData, topErrors } = data;

  // Custom tooltip for scatter plot
  const ScatterTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white dark:bg-gray-800 p-3 border rounded-lg shadow-lg">
          <p className="font-semibold">{data.location}</p>
          <p className="text-sm">Predicted: {data.predicted.toFixed(2)} mm/h</p>
          <p className="text-sm">Actual: {data.actual.toFixed(2)} mm/h</p>
          <p className="text-sm">Error: {data.error.toFixed(2)} mm/h ({data.errorPercentage.toFixed(1)}%)</p>
          <p className="text-sm capitalize">Quality: {data.quality}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-4">
      {/* Scatter Plot: Predicted vs Actual */}
      <Card>
        <CardHeader>
          <CardTitle>Predicted vs Actual Rain Rate</CardTitle>
          <CardDescription>
            Scatter plot showing prediction accuracy. Points closer to the diagonal line are more accurate.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={400}>
            <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                type="number"
                dataKey="predicted"
                name="Predicted"
                label={{ value: 'Predicted Rain Rate (mm/h)', position: 'insideBottom', offset: -10 }}
              />
              <YAxis
                type="number"
                dataKey="actual"
                name="Actual"
                label={{ value: 'Actual Rain Rate (mm/h)', angle: -90, position: 'insideLeft' }}
              />
              <Tooltip content={<ScatterTooltip />} />
              <Legend />

              {/* Perfect prediction line (y = x) */}
              <ReferenceLine
                stroke="#888"
                strokeDasharray="3 3"
                segment={[{ x: 0, y: 0 }, { x: 100, y: 100 }]}
              />

              {/* Scatter points colored by quality */}
              {Object.keys(QUALITY_COLORS).map((quality) => (
                <Scatter
                  key={quality}
                  name={quality.charAt(0).toUpperCase() + quality.slice(1)}
                  data={scatterData.filter(d => d.quality === quality)}
                  fill={QUALITY_COLORS[quality]}
                />
              ))}
            </ScatterChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Quality Distribution Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Prediction Quality Distribution</CardTitle>
            <CardDescription>
              Breakdown of prediction quality across all locations
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={qualityData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ quality, count, percent }) =>
                    `${quality}: ${count} (${(percent * 100).toFixed(0)}%)`
                  }
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="count"
                >
                  {qualityData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Accuracy Metrics */}
        <Card>
          <CardHeader>
            <CardTitle>Accuracy Metrics</CardTitle>
            <CardDescription>
              Overall prediction performance indicators
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Accuracy Rate */}
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-sm font-medium">Accuracy Rate</span>
                  <span className="text-sm font-medium">
                    {((qualityData.filter(q => q.quality === 'Excellent' || q.quality === 'Good')
                      .reduce((sum, q) => sum + q.count, 0) /
                      qualityData.reduce((sum, q) => sum + q.count, 0)) * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-green-500 h-2 rounded-full"
                    style={{
                      width: `${((qualityData.filter(q => q.quality === 'Excellent' || q.quality === 'Good')
                        .reduce((sum, q) => sum + q.count, 0) /
                        qualityData.reduce((sum, q) => sum + q.count, 0)) * 100)}%`
                    }}
                  />
                </div>
              </div>

              {/* Quality Breakdown */}
              <div className="space-y-2">
                {qualityData.map((item) => (
                  <div key={item.quality} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: item.fill }}
                      />
                      <span className="text-sm">{item.quality}</span>
                    </div>
                    <span className="text-sm font-medium">{item.count}</span>
                  </div>
                ))}
              </div>

              {/* Total */}
              <div className="border-t pt-2">
                <div className="flex justify-between">
                  <span className="text-sm font-semibold">Total Locations</span>
                  <span className="text-sm font-semibold">
                    {qualityData.reduce((sum, q) => sum + q.count, 0)}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top 10 Locations with Highest Errors */}
      <Card>
        <CardHeader>
          <CardTitle>Top 10 Locations with Highest Prediction Errors</CardTitle>
          <CardDescription>
            Locations where predictions deviated most from actual measurements
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={topErrors} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" label={{ value: 'Error (mm/h)', position: 'insideBottom', offset: -5 }} />
              <YAxis
                type="category"
                dataKey="location"
                width={150}
                tick={{ fontSize: 11 }}
              />
              <Tooltip
                formatter={(value: number, name: string) => {
                  if (name === 'error') return [`${value.toFixed(2)} mm/h`, 'Error'];
                  return value;
                }}
              />
              <Legend />
              <Bar dataKey="error" fill="#ef4444" name="Absolute Error" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Error Percentage Distribution */}
      <Card>
        <CardHeader>
          <CardTitle>Error Percentage Distribution</CardTitle>
          <CardDescription>
            Relative error percentage for all matched locations
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={errorDistribution.slice(0, 20)}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="location"
                angle={-45}
                textAnchor="end"
                height={100}
                tick={{ fontSize: 10 }}
              />
              <YAxis label={{ value: 'Error (%)', angle: -90, position: 'insideLeft' }} />
              <Tooltip />
              <Legend />
              <ReferenceLine y={20} stroke="green" strokeDasharray="3 3" label="Accuracy Threshold (20%)" />
              <Line
                type="monotone"
                dataKey="errorPercentage"
                stroke="#f59e0b"
                strokeWidth={2}
                name="Error %"
                dot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
