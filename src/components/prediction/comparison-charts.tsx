"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
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
  ReferenceLine,
} from "recharts"

interface ComparisonChartsProps {
  data: {
    scatterData: Array<{
      location: string
      predicted: number
      actual: number
      error: number
      errorPercentage: number
      quality: string
    }>
    errorDistribution: Array<{
      location: string
      error: number
      errorPercentage: number
    }>
    qualityData: Array<{
      quality: string
      count: number
      fill: string
    }>
    topErrors: Array<{
      location: string
      error: number
      errorPercentage: number
    }>
  }
  predictionTime?: string
}

const QUALITY_COLORS: { [key: string]: string } = {
  excellent: "#10b981",
  good: "#3b82f6",
  fair: "#f59e0b",
  poor: "#ef4444",
}

export function ComparisonCharts({ data, predictionTime }: ComparisonChartsProps) {
  const { scatterData, errorDistribution, qualityData, topErrors } = data

   const getRainIntensity = (mm_per_hour: number): { text: string; color: string } => {
    if (mm_per_hour < 0.5) return { text: "No Rain", color: "text-gray-500 dark:text-gray-400" };
    if (mm_per_hour < 2) return { text: "Light Rain", color: "text-cyan-600 dark:text-cyan-400" };
    if (mm_per_hour < 10) return { text: "Moderate Rain", color: "text-blue-600 dark:text-blue-400" };
    if (mm_per_hour < 50) return { text: "Heavy Rain", color: "text-yellow-500 dark:text-yellow-400" };
    return { text: "Very Heavy Rain", color: "text-red-500 dark:text-red-400" };
  };

  const formatPredictionTime = (isoString?: string) => {
    if (!isoString) return ""
    try {
      const date = new Date(isoString)
      return date.toLocaleString("id-ID", {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
    } catch {
      return isoString
    }
  }

  // Custom tooltip for scatter plot
   const ScatterTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload
    const predIntensity = getRainIntensity(data.predicted)
    const actualIntensity = getRainIntensity(data.actual)

    return (
      <div className="bg-white dark:bg-gray-800 px-3 py-2 rounded-lg border shadow-sm text-sm space-y-0.5">
        <p className="font-medium">{data.location}</p>
        <p className="text-[#3b82f6]">
          Predicted: {data.predicted.toFixed(2)} mm/h ({predIntensity.text})
        </p>
        <p className="text-[#f59e0b]">
          Actual: {data.actual.toFixed(2)} mm/h ({actualIntensity.text})
        </p>
      </div>
    )
  }
  return null
}

  return (
    <div className="space-y-4">
      {predictionTime && (
        <Card className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
          <CardHeader>
            <CardTitle className="text-blue-900 dark:text-blue-100">Waktu Prediksi</CardTitle>
            <CardDescription className="text-blue-700 dark:text-blue-300">
              {formatPredictionTime(predictionTime)}
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {/* Scatter Plot: Predicted vs Actual */}
      <Card>
        <CardHeader>
          <CardTitle>Predicted vs Actual Values - All Locations ({scatterData.length} Pump Stations) - {formatPredictionTime(predictionTime)}</CardTitle>
          <CardDescription>Direct comparison of predicted and actual rain rates for all pump stations</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={500}>
            <LineChart data={scatterData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="location" angle={-90} textAnchor="end" height={150} interval={0} tick={{ fontSize: 6 }} />
              <YAxis
                label={{
                  value: "Rain Rate (mm/h)",
                  angle: -90,
                  position: "insideLeft",
                }}
              />
              <Tooltip
                content={<ScatterTooltip />}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="predicted"
                stroke="#3b82f6"
                strokeWidth={2}
                name="Predicted"
                dot={{ r: 3, fill: "#3b82f6" }}
                activeDot={{ r: 5 }}
              />
              <Line
                type="monotone"
                dataKey="actual"
                stroke="#f59e0b"
                strokeWidth={2}
                name="Actual"
                dot={{ r: 3, fill: "#10b981" }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Quality Distribution Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Prediction Quality Distribution</CardTitle>
            <CardDescription>Breakdown of prediction quality across all locations</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={qualityData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ quality, count, percent }) => `${quality}: ${count} (${(percent * 100).toFixed(0)}%)`}
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
            <CardDescription>Overall prediction performance indicators</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Accuracy Rate */}
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-sm font-medium">Accuracy Rate</span>
                  <span className="text-sm font-medium">
                    {(
                      (qualityData
                        .filter((q) => q.quality === "Excellent" || q.quality === "Good")
                        .reduce((sum, q) => sum + q.count, 0) /
                        qualityData.reduce((sum, q) => sum + q.count, 0)) *
                      100
                    ).toFixed(1)}
                    %
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-green-500 h-2 rounded-full"
                    style={{
                      width: `${
                        (qualityData
                          .filter((q) => q.quality === "Excellent" || q.quality === "Good")
                          .reduce((sum, q) => sum + q.count, 0) /
                          qualityData.reduce((sum, q) => sum + q.count, 0)) *
                        100
                      }%`,
                    }}
                  />
                </div>
              </div>

              {/* Quality Breakdown */}
              <div className="space-y-2">
                {qualityData.map((item) => (
                  <div key={item.quality} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.fill }} />
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
                  <span className="text-sm font-semibold">{qualityData.reduce((sum, q) => sum + q.count, 0)}</span>
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
          <CardDescription>Locations where predictions deviated most from actual measurements</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={topErrors} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                type="number"
                label={{
                  value: "Error (mm/h)",
                  position: "insideBottom",
                  offset: -5,
                }}
              />
              <YAxis type="category" dataKey="location" width={150} tick={{ fontSize: 11 }} />
              <Tooltip
                formatter={(value: number, name: string) => {
                  if (name === "error") return [`${value.toFixed(2)} mm/h`, "Error"]
                  return value
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
          <CardDescription>Relative error percentage for all matched locations</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={errorDistribution.slice(0, 20)}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="location" angle={-45} textAnchor="end" height={100} tick={{ fontSize: 10 }} />
              <YAxis
                label={{
                  value: "Error (%)",
                  angle: -90,
                  position: "insideLeft",
                }}
              />
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
  )
}
