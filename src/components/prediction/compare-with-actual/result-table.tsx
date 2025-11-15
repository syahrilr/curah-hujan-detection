import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { CheckCircle, Clock } from "lucide-react"

interface ComparisonResult {
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
}

interface TimeSeriesComparison {
  minutes: string
  data: {
    statistics: {
      matchedLocations: number
    }
    comparisons: ComparisonResult[]
  }
}

interface ResultsTableProps {
  comparisons: TimeSeriesComparison[]
  selectedLocation: string
  predictionData: any
}

const getQualityBadgeVariant = (quality: string) => {
  switch (quality) {
    case "excellent":
      return "default"
    case "good":
      return "secondary"
    case "fair":
      return "outline"
    case "poor":
      return "destructive"
    default:
      return "outline"
  }
}

export default function ResultsTable({ comparisons, selectedLocation, predictionData }: ResultsTableProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Detailed Results by Time Step</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {comparisons.map(({ minutes, data }) => {
            const filtered = data.comparisons.filter(
              (c) =>
                (selectedLocation === "all" || c.location === selectedLocation) &&
                c.status === "matched" &&
                c.actual &&
                c.comparison,
            )

            if (filtered.length === 0) return null

            return (
              <div key={minutes} className="border border-border rounded-lg p-4">
                <h3 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
                  <Clock className="w-5 h-5" />+{minutes} Minutes Prediction
                  {predictionData &&
                    (() => {
                      const baseTime = new Date(predictionData.timestamp)
                      const predTime = new Date(baseTime.getTime() + Number.parseInt(minutes) * 60000)
                      return (
                        <span className="text-sm font-normal text-muted-foreground ml-2">
                          (
                          {predTime.toLocaleString("id-ID", {
                            hour: "2-digit",
                            minute: "2-digit",
                            day: "2-digit",
                            month: "short",
                          })}
                          )
                        </span>
                      )
                    })()}
                  <span className="ml-auto text-sm font-normal text-muted-foreground">
                    {data.statistics?.matchedLocations || 0} locations matched
                  </span>
                </h3>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Location</TableHead>
                        <TableHead>Predicted</TableHead>
                        <TableHead>Actual</TableHead>
                        <TableHead>Actual Time</TableHead>
                        <TableHead>Error</TableHead>
                        <TableHead>Error %</TableHead>
                        <TableHead>Quality</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map((comp, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="font-medium">{comp.location}</TableCell>
                          <TableCell>{(comp.predicted.rainRate || 0).toFixed(2)} mm/h</TableCell>
                          <TableCell>{(comp.actual?.rainRate || 0).toFixed(2)} mm/h</TableCell>
                          <TableCell className="text-xs">
                            {comp.actual?.time
                              ? new Date(comp.actual.time).toLocaleString("id-ID", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                  day: "2-digit",
                                  month: "short",
                                })
                              : "N/A"}
                          </TableCell>
                          <TableCell>{(comp.comparison?.error || 0).toFixed(2)} mm/h</TableCell>
                          <TableCell>{(comp.comparison?.errorPercentage || 0).toFixed(1)}%</TableCell>
                          <TableCell>
                            <Badge variant={getQualityBadgeVariant(comp.comparison?.predictionQuality || "")}>
                              {comp.comparison?.isAccurate && <CheckCircle className="w-3 h-3 mr-1" />}
                              {comp.comparison?.predictionQuality || "unknown"}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
