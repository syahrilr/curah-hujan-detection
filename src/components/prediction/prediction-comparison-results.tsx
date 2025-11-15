"use client"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  exportComparisonToCSV,
  exportComparisonToJSON,
  prepareComparisonChartData,
} from "@/lib/comparison-export-utils"
import {
  Activity,
  AlertTriangle,
  BarChart3,
  CheckCircle,
  FileJson,
  FileSpreadsheet,
  Target,
  TrendingUp,
  XCircle,
} from "lucide-react"
import { ComparisonCharts } from "./comparison-charts"

interface ComparisonResultsProps {
  data: {
    predictionTime: string
    toleranceMinutes: number
    comparisons: Array<{
      location: string
      status: "matched" | "no_data"
      predicted: {
        time: string
        rainRate: number
        confidence: number
      }
      actual: {
        time: string
        radarTime?: string
        rainRate: number
        dbz: number
        intensity: string
        timeDiffMinutes: number
      } | null
      comparison: {
        error: number
        errorPercentage: number
        isAccurate: boolean
        predictionQuality: "excellent" | "good" | "fair" | "poor"
      } | null
    }>
    statistics: {
      totalLocations: number
      matchedLocations: number
      unmatchedLocations: number
      averageError: number
      averageErrorPercentage: number
      accurateCount: number
      qualityDistribution: {
        excellent: number
        good: number
        fair: number
        poor: number
      }
    }
  }
}

export function PredictionComparisonResults({ data }: ComparisonResultsProps) {
  const { comparisons, statistics } = data

  const getQualityBadge = (quality: string) => {
    switch (quality) {
      case "excellent":
        return <Badge className="bg-green-500">Excellent</Badge>
      case "good":
        return <Badge className="bg-blue-500">Good</Badge>
      case "fair":
        return <Badge className="bg-yellow-500">Fair</Badge>
      case "poor":
        return <Badge variant="destructive">Poor</Badge>
      default:
        return <Badge variant="secondary">Unknown</Badge>
    }
  }

  const accuracyPercentage =
    statistics.totalLocations > 0 ? (statistics.accurateCount / statistics.matchedLocations) * 100 : 0

  const chartData = prepareComparisonChartData(data)

  const handleExportCSV = () => {
    exportComparisonToCSV(data)
  }

  const handleExportJSON = () => {
    exportComparisonToJSON(data)
  }

  return (
    <div className="space-y-4">
      {/* Export Buttons */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Comparison Results</CardTitle>
              <CardDescription>Prediction accuracy analysis for {statistics.totalLocations} locations</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleExportCSV} variant="outline" size="sm">
                <FileSpreadsheet className="w-4 h-4 mr-2" />
                Export CSV
              </Button>
              <Button onClick={handleExportJSON} variant="outline" size="sm">
                <FileJson className="w-4 h-4 mr-2" />
                Export JSON
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Statistics Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Target className="w-4 h-4" />
              Akurasi
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">{accuracyPercentage.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">
              {statistics.accurateCount} dari {statistics.matchedLocations} lokasi
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Activity className="w-4 h-4" />
              Rata-rata Error
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statistics.averageError.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">{statistics.averageErrorPercentage.toFixed(1)}% relatif</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              Data Matched
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-500">{statistics.matchedLocations}</div>
            <p className="text-xs text-muted-foreground">dari {statistics.totalLocations} lokasi</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Kualitas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span>Excellent:</span>
                <span className="font-bold text-green-500">{statistics.qualityDistribution.excellent}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span>Good:</span>
                <span className="font-bold text-blue-500">{statistics.qualityDistribution.good}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs for Details and Charts */}
      <Tabs defaultValue="details" className="space-y-4">
        <TabsList>
          <TabsTrigger value="details">
            <Activity className="w-4 h-4 mr-2" />
            Details
          </TabsTrigger>
          <TabsTrigger value="charts">
            <BarChart3 className="w-4 h-4 mr-2" />
            Charts
          </TabsTrigger>
        </TabsList>

        {/* Details Tab */}
        <TabsContent value="details">
          {/* Detailed Comparisons */}
          <Card>
            <CardHeader>
              <CardTitle>Detail Perbandingan per Lokasi</CardTitle>
              <CardDescription>Prediksi vs Data Real (± {data.toleranceMinutes} menit)</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                <div className="space-y-3">
                  {comparisons.map((comp, idx) => (
                    <Card key={idx} className="p-4">
                      <div className="space-y-3">
                        {/* Header */}
                        <div className="flex items-start justify-between">
                          <div>
                            <h4 className="font-semibold">{comp.location}</h4>
                            {comp.status === "matched" && comp.comparison && (
                              <div className="flex items-center gap-2 mt-1">
                                {getQualityBadge(comp.comparison.predictionQuality)}
                                {comp.comparison.isAccurate ? (
                                  <CheckCircle className="w-4 h-4 text-green-500" />
                                ) : (
                                  <AlertTriangle className="w-4 h-4 text-yellow-500" />
                                )}
                              </div>
                            )}
                          </div>
                          {comp.status === "no_data" && (
                            <Badge variant="secondary">
                              <XCircle className="w-3 h-3 mr-1" />
                              No Data
                            </Badge>
                          )}
                        </div>

                        {comp.status === "matched" && comp.actual && comp.comparison ? (
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {/* Predicted */}
                            <div className="space-y-1">
                              <p className="text-xs text-muted-foreground font-semibold">PREDIKSI</p>
                              <div className="space-y-1">
                                <div className="flex justify-between">
                                  <span className="text-xs">Rain Rate:</span>
                                  <span className="text-sm font-bold text-blue-500">
                                    {comp.predicted.rainRate.toFixed(2)} mm/h
                                  </span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-xs">Confidence:</span>
                                  <span className="text-xs">{(comp.predicted.confidence * 100).toFixed(1)}%</span>
                                </div>
                              </div>
                            </div>

                            {/* Actual */}
                            <div className="space-y-1">
                              <p className="text-xs text-muted-foreground font-semibold">DATA REAL</p>
                              <div className="space-y-1">
                                <div className="flex justify-between">
                                  <span className="text-xs">Rain Rate:</span>
                                  <span className="text-sm font-bold text-green-500">
                                    {comp.actual.rainRate.toFixed(2)} mm/h
                                  </span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-xs">Intensity:</span>
                                  <span className="text-xs">{comp.actual.intensity}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-xs">Time Diff:</span>
                                  <span className="text-xs">{comp.actual.timeDiffMinutes.toFixed(1)} min</span>
                                </div>
                              </div>
                            </div>

                            {/* Comparison */}
                            <div className="space-y-1">
                              <p className="text-xs text-muted-foreground font-semibold">ANALISIS</p>
                              <div className="space-y-1">
                                <div className="flex justify-between">
                                  <span className="text-xs">Error:</span>
                                  <span className="text-sm font-bold text-red-500">
                                    {comp.comparison.error.toFixed(2)} mm/h
                                  </span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-xs">Error %:</span>
                                  <span className="text-sm font-bold">
                                    {comp.comparison.errorPercentage.toFixed(1)}%
                                  </span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-xs">Status:</span>
                                  {comp.comparison.isAccurate ? (
                                    <Badge className="bg-green-500 text-xs">Akurat</Badge>
                                  ) : (
                                    <Badge variant="secondary" className="text-xs">
                                      Kurang Akurat
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <Alert>
                            <AlertDescription>
                              Data real tidak ditemukan dalam rentang waktu yang ditentukan
                            </AlertDescription>
                          </Alert>
                        )}
                      </div>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Charts Tab */}
        <TabsContent value="charts">
          <ComparisonCharts data={chartData} predictionTime={data.predictionTime} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
