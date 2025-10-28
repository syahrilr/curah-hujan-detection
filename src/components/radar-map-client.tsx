"use client"

import { MapContainer, TileLayer, ImageOverlay, CircleMarker, Popup, useMap, Marker } from "react-leaflet"
import { useEffect, useState, useRef } from "react"
import L from "leaflet"
import "leaflet/dist/leaflet.css"

let omnivore: any
if (typeof window !== "undefined") {
  omnivore = require("@mapbox/leaflet-omnivore")
}

/* ==============================
   🔹 Types & Interfaces
================================= */
interface ForecastData {
  location: {
    name: string
    lat: number
    lng: number
  }
  hourly: {
    times: string[]
    precipitation: number[]
    probabilities: number[]
  }
  metrics: {
    maxPrecipitation: number
    avgPrecipitation: number
    avgProbability: number
    riskLevel: "high" | "medium" | "low" | "none"
  }
}

interface WindData {
  location: { name: string; lat: number; lng: number; kode: string }
  wind: {
    direction_deg: number
    direction_cardinal: string
    speed: number
    timestamp: string
  }
  weather: {
    temp: number
    humidity: number
    weather_code: number
    weather_desc: string
  }
}

/* ==============================
   🔹 Helper Functions
================================= */
function dBZtoRainRate(dbz: number): number {
  if (dbz < 5) return 0
  const Z = Math.pow(10, dbz / 10)
  return Math.max(0, Math.pow(Z / 200, 1 / 1.6))
}

function getRainIntensity(mmPerHour: number): string {
  if (mmPerHour < 0.5) return "No Rain"
  if (mmPerHour < 2) return "Light Rain"
  if (mmPerHour < 10) return "Moderate Rain"
  if (mmPerHour < 50) return "Heavy Rain"
  return "Very Heavy Rain"
}

function getWindArrowRotation(windDirectionDeg: number): number {
  return (windDirectionDeg + 180) % 360
}

function getWindSpeedColor(speedMS: number): string {
  if (speedMS < 0.5) return "#94a3b8"
  if (speedMS < 3.3) return "#60a5fa"
  if (speedMS < 7.9) return "#3b82f6"
  if (speedMS < 13.8) return "#f59e0b"
  return "#ef4444"
}

function msToKmh(ms: number): number {
  return ms * 3.6
}

function createWindArrowIcon(rotation: number, color: string, size = 32): L.DivIcon {
  return L.divIcon({
    className: "wind-arrow-icon",
    html: `
      <div style="width: ${size}px; height: ${size}px; display: flex; align-items: center; justify-content: center;">
        <svg width="${size}" height="${size}" viewBox="0 0 40 40" style="filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));">
          <g transform="rotate(${rotation} 20 20)">
            <line x1="20" y1="8" x2="20" y2="32" stroke="${color}" stroke-width="3" stroke-linecap="round"/>
            <polygon points="20,6 15,14 25,14" fill="${color}"/>
            <circle cx="20" cy="32" r="3" fill="${color}" stroke="white" stroke-width="1"/>
          </g>
        </svg>
      </div>
    `,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  })
}

function getForecastColor(maxPrecipitation: number, probability: number): string {
  if (maxPrecipitation === 0 && probability < 30) return "#cbd5e1"
  if (maxPrecipitation < 2.5) return "#93c5fd"
  if (maxPrecipitation < 7.6) return "#3b82f6"
  if (maxPrecipitation < 50) return "#f59e0b"
  return "#ef4444"
}

function getForecastSize(maxPrecipitation: number): number {
  if (maxPrecipitation === 0) return 6
  if (maxPrecipitation < 2.5) return 10
  if (maxPrecipitation < 7.6) return 14
  return 18
}

/* ==============================
   🔹 Legend Component
================================= */
function Legend({ legends, showForecast, showWind }: { legends: any; showForecast: boolean; showWind: boolean }) {
  const map = useMap()

  useEffect(() => {
    if (!legends) return

    const legend = new L.Control({ position: "bottomright" })

    legend.onAdd = () => {
      const div = L.DomUtil.create("div", "info legend")
      const { levels, colors } = legends

      const labels = levels.map((level: number, i: number) => {
        const next = levels[i + 1]
        const rainRate = dBZtoRainRate(level)
        const intensity = getRainIntensity(rainRate)

        return `
          <div style="display:flex;align-items:center;margin-bottom:4px;font-size:11px;">
            <i style="background:${colors[i]};width:18px;height:12px;display:inline-block;margin-right:6px;border:1px solid #999;box-shadow:0 1px 2px rgba(0,0,0,0.2);"></i>
            <span style="font-weight:600;width:50px;">${level}${next ? "–" + next : "+"} dBZ</span>
            <span style="color:#666;margin-left:6px;font-size:10px;">${rainRate.toFixed(1)} mm/h</span>
          </div>
        `
      })

      div.innerHTML = `
        <div style="background:rgba(255,255,255,0.95);padding:10px;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,0.25);font-size:12px;backdrop-filter:blur(4px);border:1px solid rgba(0,0,0,0.1);max-width:240px;">
          <div style="font-weight:bold;margin-bottom:8px;font-size:12px;border-bottom:2px solid #2563eb;padding-bottom:4px;">📊 Data Layers</div>

          ${showForecast ? `
          <div style="margin-bottom:8px;padding:6px;background:#fef3c7;border-radius:4px;border-left:3px solid #f59e0b;">
            <div style="font-weight:600;font-size:11px;">🔮 Forecast</div>
            <div style="font-size:9px;color:#92400e;">6-hour prediction</div>
          </div>` : ""}

          ${showWind ? `
          <div style="margin-bottom:8px;padding:6px;background:#d1fae5;border-radius:4px;border-left:3px solid #10b981;">
            <div style="font-weight:600;font-size:11px;">💨 Wind Data</div>
            <div style="font-size:9px;color:#065f46;">BMKG stations</div>
          </div>` : ""}

          <div style="margin-top:10px;padding-top:8px;border-top:1px solid #e2e8f0;">
            <div style="font-weight:bold;margin-bottom:6px;font-size:11px;">🌧️ Rainfall</div>
            ${labels.join("")}
          </div>
        </div>
      `
      return div
    }

    legend.addTo(map)
    return () => {
      map.removeControl(legend)
    }
  }, [map, legends, showForecast, showWind])

  return null
}

/* ==============================
   🔹 KML Overlay Component
================================= */
function KmlOverlay() {
  const map = useMap()

  useEffect(() => {
    if (!map || !omnivore) return

    const customIcon = L.icon({
      iconUrl: "/icons/location-pin.png",
      iconSize: [24, 24],
      iconAnchor: [12, 24],
      popupAnchor: [0, -24],
    })

    const kmlLayer = omnivore
      .kml("/data/Mapping Titik Lokasi Pompa.kml")
      .on("ready", () => {
        kmlLayer.eachLayer((layer: any) => {
          if (layer instanceof L.Marker) {
            layer.setIcon(customIcon)
            const name = layer.feature?.properties?.name || "Unknown Location"
            layer.bindPopup(`<b>📍 ${name}</b>`)
          }
        })
      })
      .addTo(map)

    return () => {
      map.removeLayer(kmlLayer)
    }
  }, [map])

  return null
}

/* ==============================
   🔹 Main Component
================================= */
export default function RadarMapClient() {
  const [data, setData] = useState<any>(null)
  const [currentImage, setCurrentImage] = useState<string | null>(null)
  const [frameIndex, setFrameIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(true)
  const [mapInstance, setMapInstance] = useState<L.Map | null>(null)
  const [error, setError] = useState<string | null>(null)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const [frames, setFrames] = useState<string[]>([])
  const [overlayOpacity, setOverlayOpacity] = useState(0.7)

  // Layer toggles
  const [showRadar, setShowRadar] = useState(true)
  const [showForecast, setShowForecast] = useState(true)
  const [showWind, setShowWind] = useState(true)

  // Data states
  const [windData, setWindData] = useState<WindData[]>([])
  const [forecastData, setForecastData] = useState<ForecastData[]>([])
  const [loadingWind, setLoadingWind] = useState(false)
  const [loadingForecast, setLoadingForecast] = useState(false)

  const bounds: L.LatLngBoundsExpression = data
    ? [
        [Number(data.bounds.overlayBRC[0]), Number(data.bounds.overlayTLC[1])],
        [Number(data.bounds.overlayTLC[0]), Number(data.bounds.overlayBRC[1])],
      ]
    : [
        [-6.5, 106.0],
        [-5.8, 107.0],
      ]

  /* ==============================
     🔹 Fetch Radar Data
  ================================= */
  useEffect(() => {
    async function fetchRadar() {
      try {
        const res = await fetch(
          "https://radar.bmkg.go.id:8090/sidarmaimage?token=46dc1e64b6843d45a7adc26b2fb6abe44a9385139002590339dc40e09090&radar=JAK",
        )
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`)
        const json = await res.json()

        const proxied = Array.isArray(json.LastOneHour?.file)
          ? json.LastOneHour.file.map((u: string) => `/api/radar-proxy?url=${encodeURIComponent(u)}`)
          : []

        setData(json)
        setFrames(proxied)

        const latestUrl = json?.Latest?.file
          ? `/api/radar-proxy?url=${encodeURIComponent(json.Latest.file)}`
          : (proxied[0] ?? null)

        setCurrentImage(latestUrl)
        setFrameIndex(Math.max(0, proxied.length - 1))
        setError(null)
      } catch (err) {
        console.error("❌ Failed to load radar data:", err)
        setError("Failed to load radar data")
      }
    }

    fetchRadar()
    const refreshInterval = setInterval(fetchRadar, 300000)
    return () => clearInterval(refreshInterval)
  }, [])

  /* ==============================
     🔹 Fetch Wind Data
  ================================= */
  useEffect(() => {
    async function fetchWind() {
      setLoadingWind(true)
      try {
        const response = await fetch("/api/wind?area=jakarta")
        const data = await response.json()
        if (data.success) {
          setWindData(data.data)
        }
      } catch (error) {
        console.error("Failed to load wind data:", error)
      } finally {
        setLoadingWind(false)
      }
    }

    fetchWind()
    const interval = setInterval(fetchWind, 1800000)
    return () => clearInterval(interval)
  }, [])

  /* ==============================
     🔹 Fetch Forecast Data
  ================================= */
  useEffect(() => {
    async function fetchForecast() {
      setLoadingForecast(true)
      try {
        const response = await fetch("/api/forecast?area=jakarta&hours=6&grid=3")
        const data = await response.json()
        if (data.success) {
          setForecastData(data.forecasts)
        }
      } catch (error) {
        console.error("Failed to load forecast:", error)
      } finally {
        setLoadingForecast(false)
      }
    }

    fetchForecast()
    const interval = setInterval(fetchForecast, 1800000)
    return () => clearInterval(interval)
  }, [])

  /* ==============================
     🔹 Animation Control
  ================================= */
  useEffect(() => {
    if (!data?.LastOneHour?.file || frames.length === 0) return
    if (isPlaying) {
      intervalRef.current = setInterval(() => {
        setFrameIndex((prev) => {
          const next = (prev + 1) % frames.length
          setCurrentImage(frames[next])
          return next
        })
      }, 1500)
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current)
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [data, isPlaying, frames])

  /* ==============================
     🔹 Frame Controls
  ================================= */
  const handleNext = () => {
    if (frames.length === 0) return
    setFrameIndex((prev) => {
      const next = (prev + 1) % frames.length
      setCurrentImage(frames[next])
      return next
    })
  }

  const handlePrev = () => {
    if (frames.length === 0) return
    setFrameIndex((prev) => {
      const next = (prev - 1 + frames.length) % frames.length
      setCurrentImage(frames[next])
      return next
    })
  }

  const handlePlayPause = () => setIsPlaying((prev) => !prev)

  /* ==============================
     🔹 Calculate Statistics
  ================================= */
  const forecastStats = {
    highRisk: forecastData.filter((f) => f.metrics.riskLevel === "high").length,
    mediumRisk: forecastData.filter((f) => f.metrics.riskLevel === "medium").length,
    avgProbability:
      forecastData.length > 0
        ? (forecastData.reduce((sum, f) => sum + f.metrics.avgProbability, 0) / forecastData.length).toFixed(0)
        : 0,
  }

  const windStats = windData.length > 0 ? {
    avgSpeed: (windData.reduce((sum, w) => sum + w.wind.speed, 0) / windData.length).toFixed(1),
    maxSpeed: Math.max(...windData.map((w) => w.wind.speed)).toFixed(1),
  } : null

  /* ==============================
     🔹 Render
  ================================= */
  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-slate-900 to-slate-800">
        <div className="text-center p-8 bg-red-950/40 rounded-xl border border-red-500/50">
          <p className="text-red-300 text-lg font-semibold">⚠️ {error}</p>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-slate-900 to-slate-800">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-500 mx-auto mb-4"></div>
          <p className="text-slate-300 text-lg font-medium">Loading radar...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="relative w-full h-screen bg-slate-900 overflow-hidden">
      <MapContainer
        center={[data.bounds.lat, data.bounds.lon]}
        zoom={9}
        scrollWheelZoom
        className="w-full h-full"
        ref={(mapRef): void => {
          if (mapRef) setMapInstance(mapRef)
        }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/">OSM</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Radar Overlay */}
        {showRadar && currentImage && (
          <ImageOverlay
            key={currentImage}
            url={currentImage}
            bounds={bounds}
            opacity={overlayOpacity}
            zIndex={400}
          />
        )}

        {/* Forecast Markers */}
        {showForecast &&
          forecastData.map((forecast, index) => (
            <CircleMarker
              key={`forecast-${index}`}
              center={[forecast.location.lat, forecast.location.lng]}
              radius={getForecastSize(forecast.metrics.maxPrecipitation)}
              fillColor={getForecastColor(forecast.metrics.maxPrecipitation, forecast.metrics.avgProbability)}
              color="white"
              weight={2}
              opacity={1}
              fillOpacity={0.65}
            >
              <Popup>
                <div style={{ minWidth: "220px", fontFamily: "system-ui" }}>
                  <h3 style={{ fontWeight: "bold", marginBottom: "10px", color: "#1e40af", fontSize: "13px" }}>
                    🔮 6-Hour Forecast
                  </h3>
                  <div style={{ padding: "8px", background: "#f8fafc", borderRadius: "6px", marginBottom: "8px" }}>
                    <div style={{ fontSize: "12px", marginBottom: "4px" }}>
                      <strong>Max:</strong>{" "}
                      <span style={{ color: "#ef4444", fontWeight: "700" }}>
                        {forecast.metrics.maxPrecipitation.toFixed(1)} mm/h
                      </span>
                    </div>
                    <div style={{ fontSize: "12px" }}>
                      <strong>Probability:</strong>{" "}
                      <span style={{ color: "#f59e0b", fontWeight: "700" }}>
                        {forecast.metrics.avgProbability.toFixed(0)}%
                      </span>
                    </div>
                  </div>
                </div>
              </Popup>
            </CircleMarker>
          ))}

        {/* Wind Arrows */}
        {showWind &&
          windData.map((wind, index) => {
            const rotation = getWindArrowRotation(wind.wind.direction_deg)
            const color = getWindSpeedColor(wind.wind.speed)
            const icon = createWindArrowIcon(rotation, color)

            return (
              <Marker
                key={`wind-${index}`}
                position={[wind.location.lat, wind.location.lng]}
                icon={icon}
                zIndexOffset={500}
              >
                <Popup>
                  <div style={{ minWidth: "200px", fontFamily: "system-ui" }}>
                    <h3 style={{ margin: "0 0 8px 0", color: "#1e40af", fontSize: "13px", fontWeight: "bold" }}>
                      💨 Wind Data
                    </h3>
                    <div style={{ fontSize: "11px", lineHeight: "1.8" }}>
                      <strong>Location:</strong> {wind.location.name}
                      <br />
                      <strong>Direction:</strong> {wind.wind.direction_cardinal} ({wind.wind.direction_deg}°)
                      <br />
                      <strong>Speed:</strong> {wind.wind.speed.toFixed(1)} m/s ({msToKmh(wind.wind.speed).toFixed(1)} km/h)
                    </div>
                  </div>
                </Popup>
              </Marker>
            )
          })}

        <Legend legends={data.legends} showForecast={showForecast} showWind={showWind} />
        <KmlOverlay />
      </MapContainer>

      {/* Control Panel */}
      <div className="absolute top-4 left-4 z-[1000]">
        <div className="bg-white/95 backdrop-blur-sm rounded-lg shadow-lg border border-slate-200 p-4 w-[280px]">
          {/* Header */}
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-200">
            <div className="p-2 bg-blue-500 rounded-lg">
              <span className="text-white text-lg">📡</span>
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800">Weather Radar</h3>
              <p className="text-xs text-slate-500">Jakarta Area</p>
            </div>
          </div>

          {/* Layer Toggles */}
          <div className="space-y-2 mb-4">
            <ToggleButton
              label="BMKG Radar"
              active={showRadar}
              onClick={() => setShowRadar(!showRadar)}
              color="blue"
            />
            <ToggleButton
              label="Forecast"
              active={showForecast}
              onClick={() => setShowForecast(!showForecast)}
              color="amber"
              loading={loadingForecast}
            />
            <ToggleButton
              label="Wind"
              active={showWind}
              onClick={() => setShowWind(!showWind)}
              color="emerald"
              loading={loadingWind}
            />
          </div>

          {/* Stats */}
          {showForecast && forecastData.length > 0 && (
            <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="text-xs font-bold text-amber-900 mb-2">🔮 Forecast Summary</div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-white p-2 rounded">
                  <div className="text-slate-600">High Risk</div>
                  <div className="text-lg font-bold text-red-600">{forecastStats.highRisk}</div>
                </div>
                <div className="bg-white p-2 rounded">
                  <div className="text-slate-600">Avg Prob</div>
                  <div className="text-lg font-bold text-blue-600">{forecastStats.avgProbability}%</div>
                </div>
              </div>
            </div>
          )}

          {showWind && windStats && (
            <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
              <div className="text-xs font-bold text-emerald-900 mb-2">💨 Wind Summary</div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-white p-2 rounded">
                  <div className="text-slate-600">Avg Speed</div>
                  <div className="text-lg font-bold text-blue-600">{windStats.avgSpeed} m/s</div>
                </div>
                <div className="bg-white p-2 rounded">
                  <div className="text-slate-600">Max Speed</div>
                  <div className="text-lg font-bold text-emerald-600">{windStats.maxSpeed} m/s</div>
                </div>
              </div>
            </div>
          )}

          {/* Opacity Slider */}
          {showRadar && (
            <div className="pt-3 border-t border-slate-200">
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold text-slate-700">Opacity</label>
                <span className="text-xs font-bold text-blue-600">{(overlayOpacity * 100).toFixed(0)}%</span>
              </div>
              <input
                type="range"
                min={0.3}
                max={1}
                step={0.05}
                value={overlayOpacity}
                onChange={(e) => setOverlayOpacity(Number.parseFloat(e.target.value))}
                className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
            </div>
          )}
        </div>
      </div>

      {/* Timeline Controls */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[1000]">
        <div className="bg-white/95 backdrop-blur-sm px-6 py-4 rounded-lg shadow-lg border border-slate-200 flex flex-col gap-3">
          {/* Timeline Dots */}
          <div className="flex gap-2 items-center justify-center">
            {frames.map((_: any, idx: number) => (
              <button
                key={idx}
                onClick={() => {
                  setFrameIndex(idx)
                  setCurrentImage(frames[idx])
                }}
                className={`transition-all ${
                  frameIndex === idx
                    ? "w-4 h-4 bg-blue-500 rounded-full scale-125"
                    : "w-2.5 h-2.5 bg-slate-300 rounded-full hover:bg-slate-400"
                }`}
                title={data.LastOneHour.timeLocal[idx]}
              />
            ))}
          </div>

          {/* Controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrev}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              title="Previous"
            >
              <span className="text-lg">⏮️</span>
            </button>

            <button
              onClick={handlePlayPause}
              className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-semibold flex items-center gap-2"
            >
              <span>{isPlaying ? "⏸️" : "▶️"}</span>
              <span className="text-sm">{isPlaying ? "Pause" : "Play"}</span>
            </button>

            <button
              onClick={handleNext}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              title="Next"
            >
              <span className="text-lg">⏭️</span>
            </button>
          </div>

          {/* Time Display */}
          <div className="text-center text-xs text-slate-600 font-semibold border-t border-slate-200 pt-2">
            🕐 {data.LastOneHour.timeLocal[frameIndex]}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ==============================
   🔹 Toggle Button Component
================================= */
function ToggleButton({
  label,
  active,
  onClick,
  color,
  loading = false
}: {
  label: string
  active: boolean
  onClick: () => void
  color: "blue" | "amber" | "emerald"
  loading?: boolean
}) {
  const colors = {
    blue: {
      bg: "bg-blue-50",
      border: "border-blue-200",
      active: "bg-blue-500",
      dot: "bg-blue-500"
    },
    amber: {
      bg: "bg-amber-50",
      border: "border-amber-200",
      active: "bg-amber-500",
      dot: "bg-amber-500"
    },
    emerald: {
      bg: "bg-emerald-50",
      border: "border-emerald-200",
      active: "bg-emerald-500",
      dot: "bg-emerald-500"
    }
  }

  const c = colors[color]

  return (
    <div className={`flex items-center justify-between p-2.5 ${c.bg} border ${c.border} rounded-lg`}>
      <div className="flex items-center gap-2">
        <div className={`w-2 h-2 ${c.dot} rounded-full ${active ? 'animate-pulse' : ''}`}></div>
        <span className="text-sm font-semibold text-slate-700">{label}</span>
        {loading && <span className="text-xs text-slate-400 animate-pulse">...</span>}
      </div>
      <button
        onClick={onClick}
        className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${
          active ? `${c.active} text-white` : "bg-slate-200 text-slate-600"
        }`}
      >
        {active ? "ON" : "OFF"}
      </button>
    </div>
  )
}
