"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Droplets, MapPin } from "lucide-react"

interface ForecastSummary {
  pumpName: string
  maxRain: number
  totalPrecipitation: number
  highRiskHours: number
  lat: number
  lng: number
}

export default function ForecastComparison() {
  const [summaries, setSummaries] = useState<ForecastSummary[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    loadSummaries()
  }, [])

  const loadSummaries = async () => {
    try {
      const response = await fetch('/api/forecasts/all-latest')
      const data = await response.json()

      if (data.success) {
        const processed = data.data.map((forecast: any) => ({
          pumpName: forecast.pumpName,
          lat: forecast.pumpLat,
          lng: forecast.pumpLng,
          maxRain: Math.max(...forecast.hourly.rain),
          totalPrecipitation: forecast.hourly.precipitation.reduce((a: number, b: number) => a + b, 0),
          highRiskHours: forecast.hourly.rain.filter((r: number) => r > 10).length
        }))

        // Sort by max rain (highest first)
        processed.sort((a: ForecastSummary, b: ForecastSummary) => b.maxRain - a.maxRain)
        setSummaries(processed)
      }
    } catch (error) {
      console.error('Failed to load summaries:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const getRiskLevel = (maxRain: number) => {
    if (maxRain > 20) return { label: "Extreme", color: "bg-red-600" }
    if (maxRain > 10) return { label: "High", color: "bg-orange-600" }
    if (maxRain > 5) return { label: "Moderate", color: "bg-yellow-600" }
    return { label: "Low", color: "bg-green-600" }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>All Stations - Risk Overview</CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[600px]">
          <div className="space-y-3">
            {summaries.map((summary, idx) => {
              const risk = getRiskLevel(summary.maxRain)
              return (
                <div
                  key={idx}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3 flex-1">
                    <div className={`w-2 h-12 rounded ${risk.color}`} />
                    <div>
                      <p className="font-semibold">{summary.pumpName}</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {summary.lat.toFixed(4)}°, {summary.lng.toFixed(4)}°
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-4 items-center">
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Max Rain</p>
                      <p className="font-bold flex items-center gap-1">
                        <Droplets className="h-3 w-3" />
                        {summary.maxRain.toFixed(1)} mm/h
                      </p>
                    </div>

                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">High Risk</p>
                      <p className="font-bold">{summary.highRiskHours}h</p>
                    </div>

                    <Badge variant={
                      risk.label === "Extreme" ? "destructive" :
                      risk.label === "High" ? "destructive" :
                      risk.label === "Moderate" ? "secondary" : "outline"
                    }>
                      {risk.label}
                    </Badge>
                  </div>
                </div>
              )
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
