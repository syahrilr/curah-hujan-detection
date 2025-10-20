"use client"

import { MapContainer, TileLayer, ImageOverlay, useMap } from "react-leaflet"
import { useEffect, useState, useRef } from "react"
import L from "leaflet"
import "leaflet/dist/leaflet.css"

let omnivore: any
if (typeof window !== "undefined") {
  omnivore = require("@mapbox/leaflet-omnivore")
}

/* ==============================
   🔹 Improved dBZ → mm/h Conversion
   Marshall-Palmer relationship: Z = 200R^1.6
================================= */
function dBZtoRainRate(dbz: number): number {
  if (dbz < 5) return 0 // No rain below 5 dBZ
  const Z = Math.pow(10, dbz / 10)
  const rainRate = Math.pow(Z / 200, 1 / 1.6)
  return Math.max(0, rainRate)
}

/* ==============================
   🔹 Rain Intensity Classification
================================= */
function getRainIntensity(mmPerHour: number): string {
  if (mmPerHour < 0.5) return "No Rain"
  if (mmPerHour < 2) return "Light Rain"
  if (mmPerHour < 10) return "Moderate Rain"
  if (mmPerHour < 50) return "Heavy Rain"
  return "Very Heavy Rain"
}

/* ==============================
   🔹 Estimate Rainfall (Fallback)
================================= */
function estimateRainfallFromLocation(
  lat: number,
  lng: number,
  bounds: any,
  legends: any,
): {
  dbz: number
  rainRate: number
  intensity: string
  confidence: string
} {
  const [sw, ne] = bounds as [[number, number], [number, number]]
  const [lat1, lon1] = sw
  const [lat2, lon2] = ne

  // Check if within radar coverage
  const isInBounds = lat >= lat1 && lat <= lat2 && lng >= lon1 && lng <= lon2

  if (!isInBounds) {
    return {
      dbz: 0,
      rainRate: 0,
      intensity: "Outside Radar Coverage",
      confidence: "N/A",
    }
  }

  // Use low value as default (assuming no rain if pixel can't be read)
  const defaultDBZ = 5
  const estimatedRainRate = dBZtoRainRate(defaultDBZ)
  const intensity = getRainIntensity(estimatedRainRate)

  return {
    dbz: defaultDBZ,
    rainRate: estimatedRainRate,
    intensity,
    confidence: "Visual Estimate",
  }
}

/* ==============================
   🔹 Read Rainfall Data from Image (via proxy)
================================= */
async function fetchRadarPixelData(
  imageUrl: string,
  lat: number,
  lng: number,
  bounds: any,
  legends: any,
): Promise<{
  dbz: number
  rainRate: number
  intensity: string
  confidence: string
}> {
  try {
    // Load image (proxied -> same-origin -> safe for canvas)
    const img = new Image()
    img.crossOrigin = "anonymous"
    ;(img as any).decoding = "async"

    await new Promise((resolve, reject) => {
      img.onload = resolve as any
      img.onerror = reject as any
      img.src = imageUrl
    })

    const canvas = document.createElement("canvas")
    canvas.width = img.naturalWidth || img.width
    canvas.height = img.naturalHeight || img.height

    const ctx = canvas.getContext("2d", { willReadFrequently: true })!
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

    // Compute pixel coord for provided lat/lng
    const { x, y } = latLngToImageXY(
      lat,
      lng,
      bounds as [[number, number], [number, number]],
      canvas.width,
      canvas.height,
    )

    // Sample pixel RGBA
    const pixel = ctx.getImageData(x, y, 1, 1).data
    const pixelColor: [number, number, number, number] = [pixel[0], pixel[1], pixel[2], pixel[3]]

    // Map color → dBZ → rainfall
    const dbz = getDBZFromColor(pixelColor, legends)
    const rainRate = dBZtoRainRate(dbz)
    const intensity = getRainIntensity(rainRate)

    return {
      dbz,
      rainRate,
      intensity,
      confidence: "Actual Reading",
    }
  } catch (error) {
    console.warn("Pixel reading failed, using visual estimate:", error)
    return estimateRainfallFromLocation(lat, lng, bounds, legends)
  }
}

/* ==============================
   🔹 Improved Color Matching (Euclidean Distance)
================================= */
function getDBZFromColor(pixelColor: [number, number, number, number], legends: any): number {
  const [r, g, b, a] = pixelColor

  // If pixel is transparent or near-transparent, treat as no data
  if (a < 16) return 0

  // Common "no data" backgrounds
  if ((r < 10 && g < 10 && b < 10) || (r > 245 && g > 245 && b > 245)) return 0

  let minDistance = Number.POSITIVE_INFINITY
  let matchedIndex = 0

  legends.colors.forEach((colorHex: string, i: number) => {
    const colorInt = Number.parseInt(colorHex.slice(1), 16)
    const cr = (colorInt >> 16) & 0xff
    const cg = (colorInt >> 8) & 0xff
    const cb = colorInt & 0xff

    // Euclidean distance in RGB space
    const distance = Math.hypot(r - cr, g - cg, b - cb)

    if (distance < minDistance) {
      minDistance = distance
      matchedIndex = i
    }
  })

  // If it's too far from any legend color, likely anti-aliased background; treat as no rain
  // You can calibrate this threshold (20–40); lower means stricter matching.
  if (minDistance > 28) return 0

  return legends.levels[matchedIndex]
}

/* ==============================
   🔹 Helper: lat/lng -> image pixel (clamped) for robust sampling
================================= */
function latLngToImageXY(
  lat: number,
  lng: number,
  bounds: [[number, number], [number, number]],
  imgW: number,
  imgH: number,
) {
  const [sw, ne] = bounds
  const [lat1, lon1] = sw
  const [lat2, lon2] = ne

  // Guard for degenerate bounds
  const dx = Math.max(1e-12, lon2 - lon1)
  const dy = Math.max(1e-12, lat2 - lat1)

  const fx = (lng - lon1) / dx
  const fy = (lat2 - lat) / dy // y=0 top

  // Convert to integer pixel coords and clamp
  const x = Math.min(imgW - 1, Math.max(0, Math.round(fx * (imgW - 1))))
  const y = Math.min(imgH - 1, Math.max(0, Math.round(fy * (imgH - 1))))

  return { x, y }
}

/* ==============================
   🔹 Enhanced Legend Component
================================= */
function Legend({ legends }: { legends: any }) {
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
            <i style="background:${colors[i]};width:20px;height:14px;
              display:inline-block;margin-right:8px;border:1px solid #999;
              box-shadow:0 1px 2px rgba(0,0,0,0.2);"></i>
            <span style="font-weight:600;width:55px;">${level}${next ? "–" + next : "+"} dBZ</span>
            <span style="color:#666;margin-left:6px;">
              ${rainRate.toFixed(1)} mm/h
            </span>
            <span style="color:#888;margin-left:6px;font-size:10px;font-style:italic;">
              (${intensity})
            </span>
          </div>
        `
      })

      div.innerHTML = `
        <div style="background:rgba(255,255,255,0.95);padding:12px;border-radius:8px;
          box-shadow:0 2px 8px rgba(0,0,0,0.25);font-size:12px;backdrop-filter:blur(4px);
          border:1px solid rgba(0,0,0,0.1);">
          <div style="font-weight:bold;margin-bottom:8px;font-size:13px;
            border-bottom:2px solid #2563eb;padding-bottom:4px;">
            🌧️ Rainfall Intensity
          </div>
          ${labels.join("")}
          <div style="margin-top:8px;padding-top:8px;border-top:1px solid #ddd;
            font-size:10px;color:#666;">
            Marshall-Palmer: Z = 200R<sup>1.6</sup>
          </div>
        </div>
      `
      return div
    }

    legend.addTo(map)
    return () => {
      map.removeControl(legend)
    }
  }, [map, legends])

  return null
}

/* ==============================
   🔹 Info Panel Component
================================= */
// function InfoPanel({ data, frameIndex }: { data: any; frameIndex: number }) {
//   const map = useMap()

//   useEffect(() => {
//     if (!data) return

//     const info = new L.Control({ position: "topleft" })

//     info.onAdd = () => {
//       const div = L.DomUtil.create("div", "info")
//       div.innerHTML = `
//         <div style="background:rgba(255,255,255,0.95);padding:12px;border-radius:8px;
//           box-shadow:0 2px 8px rgba(0,0,0,0.25);backdrop-filter:blur(4px);
//           border:1px solid rgba(0,0,0,0.1);">
//           <h4 style="margin:0 0 8px 0;font-size:14px;font-weight:bold;color:#1e40af;">
//             📡 ${data.bounds.Stasiun}
//           </h4>
//           <div style="font-size:11px;color:#555;line-height:1.6;">
//             <strong>Location:</strong> ${data.bounds.Kota}<br/>
//             <strong>Station:</strong> ${data.bounds.kode}<br/>
//             <strong>Coordinates:</strong> ${data.bounds.lat.toFixed(4)}°, ${data.bounds.lon.toFixed(4)}°<br/>
//             <strong>Current Time:</strong><br/>
//             <span style="color:#2563eb;font-weight:600;">${data.LastOneHour.timeLocal[frameIndex]}</span>
//           </div>
//         </div>
//       `
//       return div
//     }

//     info.addTo(map)
//     return () => {
//       map.removeControl(info)
//     }
//   }, [map, data, frameIndex])

//   return null
// }

/* ==============================
   🔹 KML Overlay Component
================================= */
function KmlOverlay() {
  const map = useMap()

  useEffect(() => {
    if (!map || !omnivore) return

    const customIcon = L.icon({
      iconUrl: "/icons/location-pin.png",
      iconSize: [28, 28],
      iconAnchor: [14, 28],
      popupAnchor: [0, -28],
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
   🔹 Main Radar Map Component
================================= */
export default function RadarMapClient() {
  const [data, setData] = useState<any>(null)
  const [currentImage, setCurrentImage] = useState<string | null>(null)
  const [frameIndex, setFrameIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(true)
  const [mapInstance, setMapInstance] = useState<L.Map | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [clickedMarkers, setClickedMarkers] = useState<
    Array<{
      lat: number
      lng: number
      time: string
      id: string
    }>
  >([])
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const markersLayerRef = useRef<L.LayerGroup | null>(null)
  const [frames, setFrames] = useState<string[]>([])
  const [overlayOpacity, setOverlayOpacity] = useState(0.8)

  /* ==============================
     🔹 Corrected Radar Bounds
     API gives: overlayTLC (top-left) and overlayBRC (bottom-right)
     TLC: [lat_north, lon_west]
     BRC: [lat_south, lon_east]
     Leaflet needs: [[lat_south, lon_west], [lat_north, lon_east]]
  ================================= */
  const bounds: L.LatLngBoundsExpression = data
    ? [
        // Southwest corner: [south latitude, west longitude]
        [Number(data.bounds.overlayBRC[0]), Number(data.bounds.overlayTLC[1])],
        // Northeast corner: [north latitude, east longitude]
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

        // Prefer Latest.file when present; otherwise use first proxied frame
        const latestUrl = json?.Latest?.file
          ? `/api/radar-proxy?url=${encodeURIComponent(json.Latest.file)}`
          : (proxied[0] ?? null)

        setCurrentImage(latestUrl)
        setFrameIndex(
          // also align the timeline to the latest when possible
          Math.max(0, proxied.length - 1),
        )

        setError(null)
      } catch (err) {
        console.error("❌ Failed to load radar data:", err)
        setError("Failed to load radar data. Please try again later.")
      }
    }

    fetchRadar()
    const refreshInterval = setInterval(fetchRadar, 300000)
    return () => clearInterval(refreshInterval)
  }, [])

  /* ==============================
     🔹 Initialize Markers Layer
  ================================= */
  useEffect(() => {
    if (!mapInstance) return

    if (!markersLayerRef.current) {
      markersLayerRef.current = L.layerGroup().addTo(mapInstance)
    }

    return () => {
      if (markersLayerRef.current) {
        markersLayerRef.current.clearLayers()
      }
    }
  }, [mapInstance])

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
     🔹 Update Markers when clicked locations change
  ================================= */
  useEffect(() => {
    if (!mapInstance || !markersLayerRef.current || !data || !currentImage) return

    markersLayerRef.current.clearLayers()

    const processMarkers = async () => {
      for (let index = 0; index < clickedMarkers.length; index++) {
        const marker = clickedMarkers[index]

        const rainfallData = await fetchRadarPixelData(currentImage!, marker.lat, marker.lng, bounds, data.legends)

        // Custom icon for clicked location
        const customIcon = L.divIcon({
          className: "custom-marker",
          html: `
            <div style="position:relative;">
              <div style="
                width: 32px;
                height: 32px;
                background: linear-gradient(135deg, #2563eb 0%, #1e40af 100%);
                border: 3px solid white;
                border-radius: 50% 50% 50% 0;
                transform: rotate(-45deg);
                box-shadow: 0 4px 8px rgba(0,0,0,0.3);
                display: flex;
                align-items: center;
                justify-content: center;
              ">
                <span style="
                  color: white;
                  font-weight: bold;
                  font-size: 14px;
                  transform: rotate(45deg);
                ">${index + 1}</span>
              </div>
            </div>
          `,
          iconSize: [32, 32],
          iconAnchor: [16, 32],
          popupAnchor: [0, -32],
        })

        const leafletMarker = L.marker([marker.lat, marker.lng], {
          icon: customIcon,
        })

        leafletMarker.bindPopup(
          `
          <div style="padding:6px;min-width:220px;font-family:system-ui;">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
              <h4 style="margin:0;color:#1e40af;font-size:14px;">
                📍 Lokasi #${index + 1}
              </h4>
              <button
                onclick="window.removeMarker('${marker.id}')"
                style="background:#ef4444;color:white;border:none;border-radius:4px;
                       padding:2px 8px;font-size:11px;cursor:pointer;font-weight:600;"
                title="Hapus marker"
              >✕</button>
            </div>
            <div style="font-size:11px;line-height:1.8;color:#374151;">
              <div style="background:#f3f4f6;padding:6px;border-radius:4px;margin-bottom:8px;">
                <strong style="color:#1f2937;">Koordinat:</strong><br/>
                <span style="font-family:monospace;color:#2563eb;">
                  ${marker.lat.toFixed(5)}°, ${marker.lng.toFixed(5)}°
                </span>
              </div>

              <div style="background:#fef3c7;padding:6px;border-radius:4px;margin-bottom:8px;">
                <strong style="color:#92400e;">⏰ Waktu:</strong><br/>
                <span style="color:#78350f;">${marker.time}</span>
              </div>

              <div style="background:#dbeafe;padding:8px;border-radius:4px;border-left:3px solid #2563eb;">
                <strong style="color:#1e40af;">🌧️ Data Curah Hujan:</strong><br/>
                <div style="margin-top:4px;">
                  <span style="display:inline-block;background:#2563eb;color:white;
                        padding:2px 8px;border-radius:3px;font-weight:600;font-size:10px;">
                    ${rainfallData.intensity}
                  </span>
                </div>
                <div style="margin-top:6px;color:#1e40af;">
                  <strong>dBZ:</strong> ${rainfallData.dbz.toFixed(1)}<br/>
                  <strong>Rain Rate:</strong> ${rainfallData.rainRate.toFixed(2)} mm/h
                </div>
              </div>

              <div style="margin-top:8px;padding-top:6px;border-top:1px solid #e5e7eb;
                          font-size:10px;color:#6b7280;font-style:italic;">
                ${rainfallData.confidence === "Actual Reading" ? "✓ Data dari radar" : "⚠️ Estimasi visual"}
              </div>
            </div>
          </div>
        `,
          {
            maxWidth: 280,
            className: "custom-popup",
          },
        )

        if (markersLayerRef.current) {
          leafletMarker.addTo(markersLayerRef.current)
        }
      }
    }

    processMarkers()
  }, [clickedMarkers, mapInstance, data, frameIndex, bounds, currentImage])

  /* ==============================
     🔹 Map Interaction - Add Markers on Click
  ================================= */
  useEffect(() => {
    if (!mapInstance || !data) return

    let hoverPopup: L.Popup | null = null

    // Global function to remove marker
    ;(window as any).removeMarker = (markerId: string) => {
      setClickedMarkers((prev) => prev.filter((m) => m.id !== markerId))
    }

    // Hover handler - show location only
    const handleMouseMove = (e: L.LeafletMouseEvent) => {
      const [sw, ne] = bounds as [[number, number], [number, number]]
      const [lat1, lon1] = sw
      const [lat2, lon2] = ne

      // Check if within radar bounds
      const isInBounds = e.latlng.lat >= lat1 && e.latlng.lat <= lat2 && e.latlng.lng >= lon1 && e.latlng.lng <= lon2

      if (!isInBounds) {
        if (hoverPopup) {
          mapInstance.closePopup(hoverPopup)
          hoverPopup = null
        }
        return
      }

      if (!hoverPopup) {
        hoverPopup = L.popup({
          closeButton: false,
          autoClose: false,
          className: "hover-popup",
        })
          .setLatLng(e.latlng)
          .setContent(`
            <div style="font-size:11px;min-width:120px;">
              <strong>📍 Location:</strong><br/>
              ${e.latlng.lat.toFixed(4)}°, ${e.latlng.lng.toFixed(4)}°<br/>
              <em style="color:#888;font-size:10px;">Klik untuk tandai lokasi</em>
            </div>
          `)
          .openOn(mapInstance)
      } else {
        hoverPopup.setLatLng(e.latlng).setContent(`
            <div style="font-size:11px;min-width:120px;">
              <strong>📍 Location:</strong><br/>
              ${e.latlng.lat.toFixed(4)}°, ${e.latlng.lng.toFixed(4)}°<br/>
              <em style="color:#888;font-size:10px;">Klik untuk tandai lokasi</em>
            </div>
          `)
      }
    }

    // Click handler - add marker
    const handleClick = (e: L.LeafletMouseEvent) => {
      const newMarker = {
        lat: e.latlng.lat,
        lng: e.latlng.lng,
        time: data.LastOneHour.timeLocal[frameIndex],
        id: `marker-${Date.now()}-${Math.random()}`,
      }

      setClickedMarkers((prev) => [...prev, newMarker])

      // Show temporary notification
      const notification = L.popup({ closeButton: false, autoClose: true, autoPanPadding: [10, 10] })
        .setLatLng(e.latlng)
        .setContent(`
          <div style="padding:8px;text-align:center;font-size:12px;color:#059669;font-weight:600;">
            ✓ Lokasi ditandai!<br/>
            <span style="font-size:10px;color:#666;">Marker #${clickedMarkers.length + 1} ditambahkan</span>
          </div>
        `)
        .openOn(mapInstance)

      setTimeout(() => mapInstance.closePopup(notification), 2000)
    }

    mapInstance.on("mousemove", handleMouseMove)
    mapInstance.on("click", handleClick)

    return () => {
      mapInstance.off("mousemove", handleMouseMove)
      mapInstance.off("click", handleClick)
      if (hoverPopup) {
        mapInstance.closePopup(hoverPopup)
      }
      delete (window as any).removeMarker
    }
  }, [mapInstance, data, frameIndex, bounds, clickedMarkers.length])

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

  const handleFrameSelect = (index: number) => {
    if (frames.length === 0) return
    setFrameIndex(index)
    setCurrentImage(frames[index])
  }

  /* ==============================
     🔹 Render
  ================================= */
  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900">
        <div className="text-center p-8 bg-red-900/20 rounded-lg border border-red-500">
          <p className="text-red-400 text-lg">⚠️ {error}</p>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-400 text-lg">Loading radar data...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="relative w-full h-screen bg-gray-900">
      <MapContainer
        center={[data.bounds.lat, data.bounds.lon]}
        zoom={9}
        scrollWheelZoom
        className="w-full h-full"
        ref={(mapRef): void => {
          if (mapRef) {
            setMapInstance(mapRef)
          }
        }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/">OSM</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {currentImage && (
          <ImageOverlay
            key={currentImage}
            url={currentImage}
            bounds={bounds}
            opacity={overlayOpacity}
            zIndex={400}
            crossOrigin={true}
          />
        )}
        <Legend legends={data.legends} />
        {/* <InfoPanel data={data} frameIndex={frameIndex} /> */}
        <KmlOverlay />
      </MapContainer>

      <div className="absolute top-6 left-20 z-[1000]">
        <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border border-white/20 p-5 w-[280px]">
          {/* Header */}
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-gray-200">
            <span className="text-xl">📡</span>
            <div>
              <h3 className="text-sm font-bold text-gray-900">BMKG Radar Overlay</h3>
              <p className="text-xs text-gray-500">Jakarta Radar Station</p>
            </div>
          </div>

          {/* Station Info */}
          <div className="space-y-2 mb-4 text-xs">
            <div className="flex justify-between items-start">
              <span className="text-gray-600 font-medium">Location:</span>
              <span className="text-gray-900 font-semibold text-right">Tangerang</span>
            </div>
            <div className="flex justify-between items-start">
              <span className="text-gray-600 font-medium">Station:</span>
              <span className="text-gray-900 font-semibold text-right">JAK</span>
            </div>
            <div className="flex justify-between items-start">
              <span className="text-gray-600 font-medium">Coordinates:</span>
              <span className="text-gray-900 font-mono text-right text-[10px]">
                -6.1713°
                <br />
                106.6466°
              </span>
            </div>
          </div>

          {/* Divider */}
          <div className="h-px bg-gradient-to-r from-transparent via-gray-300 to-transparent my-3"></div>

          {/* Opacity Control */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-gray-700">Overlay Opacity</label>
              <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded">
                {(overlayOpacity * 100).toFixed(0)}%
              </span>
            </div>
            <input
              type="range"
              min={0.3}
              max={1}
              step={0.05}
              value={overlayOpacity}
              onChange={(e) => setOverlayOpacity(Number.parseFloat(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
            />
            <div className="flex justify-between text-[10px] text-gray-500">
              <span>Transparent</span>
              <span>Opaque</span>
            </div>
          </div>

          {/* Footer Info */}
          <div className="mt-4 pt-3 border-t border-gray-200">
            <p className="text-[10px] text-gray-500 text-center">
              💡 Adjust opacity to see map details beneath radar overlay
            </p>
          </div>
        </div>
      </div>

      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[1000]">
        <div
          className="bg-white/95 backdrop-blur-md px-6 py-4 rounded-2xl shadow-2xl
                        border border-white/20 flex flex-col gap-4"
        >
          {/* Timeline Dots */}
          <div className="flex gap-1.5 items-center justify-center px-2">
            {frames.map((_: any, idx: number) => (
              <button
                key={idx}
                onClick={() => handleFrameSelect(idx)}
                className={`transition-all duration-200 ${
                  frameIndex === idx
                    ? "w-4 h-4 bg-blue-600 rounded-full shadow-lg scale-125"
                    : "w-2.5 h-2.5 bg-gray-300 rounded-full hover:bg-gray-400"
                }`}
                title={data.LastOneHour.timeLocal[idx]}
              />
            ))}
          </div>

          {/* Control Buttons */}
          <div className="flex items-center gap-2 justify-center">
            <button
              onClick={handlePrev}
              className="text-gray-700 hover:text-blue-600 hover:bg-blue-50 transition-all p-2.5 rounded-lg font-semibold"
              title="Previous frame"
            >
              ⏮️
            </button>

            <button
              onClick={handlePlayPause}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-blue-700
                         text-white hover:from-blue-700 hover:to-blue-800 hover:shadow-lg
                         transition-all shadow-md font-semibold flex items-center gap-2 min-w-[120px] justify-center"
            >
              <span className="text-lg">{isPlaying ? "⏸️" : "▶️"}</span>
              <span className="text-sm">{isPlaying ? "Pause" : "Play"}</span>
            </button>

            <button
              onClick={handleNext}
              className="text-gray-700 hover:text-blue-600 hover:bg-blue-50 transition-all p-2.5 rounded-lg font-semibold"
              title="Next frame"
            >
              ⏭️
            </button>
          </div>

          {/* Time Display */}
          <div className="text-center text-sm text-gray-900 font-bold border-t pt-3 border-gray-200">
            🕐 {data.LastOneHour.timeLocal[frameIndex]}
          </div>
        </div>
      </div>

      {clickedMarkers.length > 0 && (
        <div className="absolute top-6 right-6 z-[1000]">
          <button
            onClick={() => setClickedMarkers([])}
            className="bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700
                       text-white px-5 py-2.5 rounded-xl shadow-lg font-semibold flex items-center gap-2
                       transition-all hover:shadow-xl border border-red-400/30"
            title="Hapus semua marker"
          >
            <span>🗑️</span>
            <span>Clear All ({clickedMarkers.length})</span>
          </button>
        </div>
      )}
    </div>
  )
}
