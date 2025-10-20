"use client"

import { MapContainer, TileLayer, ImageOverlay, useMap } from "react-leaflet"
import { useEffect, useState, useRef, useCallback } from "react"
import L from "leaflet"
import "leaflet/dist/leaflet.css"
import html2canvas from "html2canvas"

let omnivore: any
if (typeof window !== "undefined") {
  omnivore = require("@mapbox/leaflet-omnivore")
}

/* ==============================
   🔹 Improved dBZ → mm/h Conversion
================================= */
function dBZtoRainRate(dbz: number): number {
  if (dbz < 5) return 0
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

  const isInBounds = lat >= lat1 && lat <= lat2 && lng >= lon1 && lng <= lon2

  if (!isInBounds) {
    return {
      dbz: 0,
      rainRate: 0,
      intensity: "Outside Radar Coverage",
      confidence: "N/A",
    }
  }

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
   🔹 Read Rainfall Data from Image
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

    const { x, y } = latLngToImageXY(
      lat,
      lng,
      bounds as [[number, number], [number, number]],
      canvas.width,
      canvas.height,
    )

    const pixel = ctx.getImageData(x, y, 1, 1).data
    const pixelColor: [number, number, number, number] = [pixel[0], pixel[1], pixel[2], pixel[3]]

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
   🔹 Improved Color Matching
================================= */
function getDBZFromColor(pixelColor: [number, number, number, number], legends: any): number {
  const [r, g, b, a] = pixelColor
  if (a < 16) return 0
  if ((r < 10 && g < 10 && b < 10) || (r > 245 && g > 245 && b > 245)) return 0

  let minDistance = Number.POSITIVE_INFINITY
  let matchedIndex = 0

  legends.colors.forEach((colorHex: string, i: number) => {
    const colorInt = Number.parseInt(colorHex.slice(1), 16)
    const cr = (colorInt >> 16) & 0xff
    const cg = (colorInt >> 8) & 0xff
    const cb = colorInt & 0xff
    const distance = Math.hypot(r - cr, g - cg, b - cb)

    if (distance < minDistance) {
      minDistance = distance
      matchedIndex = i
    }
  })

  if (minDistance > 28) return 0
  return legends.levels[matchedIndex]
}

/* ==============================
   🔹 Helper: lat/lng -> image pixel
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
  const dx = Math.max(1e-12, lon2 - lon1)
  const dy = Math.max(1e-12, lat2 - lat1)
  const fx = (lng - lon1) / dx
  const fy = (lat2 - lat) / dy
  const x = Math.min(imgW - 1, Math.max(0, Math.round(fx * (imgW - 1))))
  const y = Math.min(imgH - 1, Math.max(0, Math.round(fy * (imgH - 1))))
  return { x, y }
}

/* ==============================
   🔹 Legend Component
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
            <i style="background:${colors[i]};width:20px;height:14px;display:inline-block;margin-right:8px;border:1px solid rgb(153,153,153);box-shadow:0 1px 2px rgba(0,0,0,0.2);"></i>
            <span style="font-weight:600;width:55px;">${level}${next ? "–" + next : "+"} dBZ</span>
            <span style="color:rgb(102,102,102);margin-left:6px;">${rainRate.toFixed(1)} mm/h</span>
            <span style="color:rgb(136,136,136);margin-left:6px;font-size:10px;font-style:italic;">(${intensity})</span>
          </div>
        `
      })

      div.innerHTML = `
        <div style="background:rgba(255,255,255,0.95);padding:12px;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,0.25);font-size:12px;backdrop-filter:blur(4px);border:1px solid rgba(0,0,0,0.1);">
          <div style="font-weight:bold;margin-bottom:8px;font-size:13px;border-bottom:2px solid rgb(37,99,235);padding-bottom:4px;">🌧️ Rainfall Intensity</div>
          ${labels.join("")}
          <div style="margin-top:8px;padding-top:8px;border-top:1px solid rgb(221,221,221);font-size:10px;color:rgb(102,102,102);">Marshall-Palmer: Z = 200R<sup>1.6</sup></div>
        </div>
      `
      return div
    }

    legend.addTo(map)
    return () => map.removeControl(legend)
  }, [map, legends])

  return null
}

/* ==============================
   🔹 Info Panel Component
================================= */
function InfoPanel({ data, frameIndex }: { data: any; frameIndex: number }) {
  const map = useMap()

  useEffect(() => {
    if (!data) return

    const info = new L.Control({ position: "topleft" })

    info.onAdd = () => {
      const div = L.DomUtil.create("div", "info")
      div.innerHTML = `
        <div style="background:rgba(255,255,255,0.95);padding:12px;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,0.25);backdrop-filter:blur(4px);border:1px solid rgba(0,0,0,0.1);">
          <h4 style="margin:0 0 8px 0;font-size:14px;font-weight:bold;color:rgb(30,64,175);">📡 ${data.bounds.Stasiun}</h4>
          <div style="font-size:11px;color:rgb(85,85,85);line-height:1.6;">
            <strong>Location:</strong> ${data.bounds.Kota}<br/>
            <strong>Station:</strong> ${data.bounds.kode}<br/>
            <strong>Coordinates:</strong> ${data.bounds.lat.toFixed(4)}°, ${data.bounds.lon.toFixed(4)}°<br/>
            <strong>Current Time:</strong><br/>
            <span style="color:rgb(37,99,235);font-weight:600;">${data.LastOneHour.timeLocal[frameIndex]}</span>
          </div>
        </div>
      `
      return div
    }

    info.addTo(map)
    return () => map.removeControl(info)
  }, [map, data, frameIndex])

  return null
}

/* ==============================
   🔹 KML Overlay Component
================================= */
function KmlOverlay() {
  const map = useMap()

  useEffect(() => {
    if (!map) return

    const customIcon = L.icon({
      iconUrl: "/icons/location-pin.png",
      iconSize: [28, 28],
      iconAnchor: [14, 28],
      popupAnchor: [0, -28],
    })

    // Try to load with omnivore first, fallback to manual parsing
    const loadKml = async () => {
      try {
        if (omnivore) {
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
            .on("error", (error: any) => {
              console.warn("KML load error with omnivore, trying manual parse:", error)
              loadKmlManually()
            })
            .addTo(map)

          return () => map.removeLayer(kmlLayer)
        } else {
          loadKmlManually()
        }
      } catch (error) {
        console.warn("Omnivore not available, using manual KML parsing:", error)
        loadKmlManually()
      }
    }

    const loadKmlManually = () => {
      fetch("/data/Mapping Titik Lokasi Pompa.kml")
        .then(response => response.text())
        .then(kmlText => {
          const parser = new DOMParser()
          const kmlDoc = parser.parseFromString(kmlText, "text/xml")
          const placemarks = kmlDoc.getElementsByTagName("Placemark")
          const markers: L.Marker[] = []

          Array.from(placemarks).forEach(placemark => {
            const name = placemark.getElementsByTagName("name")[0]?.textContent || "Unknown Location"
            const coordinates = placemark.getElementsByTagName("coordinates")[0]?.textContent?.trim()

            if (coordinates) {
              const [lng, lat] = coordinates.split(",").map(Number)

              if (!isNaN(lat) && !isNaN(lng)) {
                const marker = L.marker([lat, lng], { icon: customIcon })
                  .bindPopup(`<b>📍 ${name}</b>`)
                  .addTo(map)

                markers.push(marker)
              }
            }
          })
        })
        .catch(error => {
          console.error("Failed to load KML:", error)
        })
    }

    loadKml()
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
  const mapContainerRef = useRef<HTMLDivElement>(null)

  const bounds: L.LatLngBoundsExpression = data
    ? [
        [Number(data.bounds.overlayBRC[0]), Number(data.bounds.overlayTLC[1])],
        [Number(data.bounds.overlayTLC[0]), Number(data.bounds.overlayBRC[1])],
      ]
    : [
        [-6.5, 106.0],
        [-5.8, 107.0],
      ]

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
        setError("Failed to load radar data. Please try again later.")
      }
    }
    fetchRadar()
    const refreshInterval = setInterval(fetchRadar, 300000)
    return () => clearInterval(refreshInterval)
  }, [])

  const handleSaveData = useCallback(async (markerId: string) => {
    if (!mapContainerRef.current || !data || !currentImage) {
      alert("Error: Map data is not ready.")
      return
    }

    const marker = clickedMarkers.find(m => m.id === markerId)
    if (!marker) {
      alert("Error: Marker not found.")
      return
    }

    const popupElement = document.getElementById(`popup-content-${marker.id}`)
    if (popupElement) {
      popupElement.innerHTML = `<div style="padding:10px; text-align:center; font-weight:bold; color:rgb(30,64,175);">⏳ Menyimpan data...</div>`
    }

    try {
      const onCloneHandler = (clonedDoc: Document) => {
        const sheets = Array.from(clonedDoc.styleSheets);
        for (const sheet of sheets) {
          try {
            if (sheet.cssRules) {
              for (let i = sheet.cssRules.length - 1; i >= 0; i--) {
                const rule = sheet.cssRules[i];
                if (rule && /\b(oklch|lab|lch|color|hwb)\(/.test(rule.cssText)) {
                  sheet.deleteRule(i);
                }
              }
            }
          } catch (e) {
            console.warn("Could not process stylesheet:", e);
          }
        }

        if (!mapContainerRef.current) return;
        const originalElements = mapContainerRef.current.querySelectorAll('*');
        const clonedElements = clonedDoc.querySelectorAll('*');

        originalElements.forEach((originalEl, index) => {
          const clonedEl = clonedElements[index];
          if (clonedEl && clonedEl instanceof HTMLElement) {
            try {
              const computedStyle = window.getComputedStyle(originalEl);

              const criticalProps = [
                'color', 'backgroundColor', 'borderColor',
                'fill', 'stroke', 'outlineColor', 'textDecorationColor',
                'caretColor', 'columnRuleColor'
              ];

              criticalProps.forEach(prop => {
                const value = computedStyle.getPropertyValue(prop);
                if (value) {
                  clonedEl.style.setProperty(prop, value);
                }
              });

              clonedEl.style.cssText = computedStyle.cssText;
            } catch (e) {
              console.warn("Could not apply styles to element:", e);
            }
          }
        });

        clonedDoc.querySelectorAll('[style]').forEach(el => {
          const styleAttr = el.getAttribute('style');
          if (styleAttr && /\b(oklch|lab|lch|color|hwb)\(/.test(styleAttr)) {
            const computedStyle = window.getComputedStyle(el as Element);
            (el as HTMLElement).style.cssText = computedStyle.cssText;
          }
        });
      };

      const canvas = await html2canvas(mapContainerRef.current, {
        useCORS: true,
        allowTaint: false,
        logging: false,
        scale: 1,
        backgroundColor: '#ffffff',
        removeContainer: true,
        ignoreElements: (element) => {
          return element.classList?.contains('leaflet-control-attribution') || false;
        },
        onclone: onCloneHandler,
      })
      const screenshotBase64 = canvas.toDataURL("image/jpeg", 0.9)

      const rainfallData = await fetchRadarPixelData(
        currentImage,
        marker.lat,
        marker.lng,
        bounds,
        data.legends
      )

      const payload = {
        lat: marker.lat,
        lng: marker.lng,
        timestamp: data.LastOneHour.timeUTC[frameIndex],
        locationName: "Clicked Location",
        radarStation: data.bounds.kode,
        radarImage: currentImage,
        screenshot: screenshotBase64,
        markers: clickedMarkers,
        notes: `Rainfall Intensity: ${rainfallData.intensity} (${rainfallData.rainRate.toFixed(2)} mm/h)`,
        metadata: {
          radarTime: data.LastOneHour.timeLocal[frameIndex],
          bounds: bounds,
          zoom: mapInstance?.getZoom(),
          dbz: rainfallData.dbz,
          rainRate: rainfallData.rainRate,
          intensity: rainfallData.intensity,
          confidence: rainfallData.confidence,
        },
      }

      const response = await fetch('/api/rainfall', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to save data.");
      }

      if (popupElement) {
        popupElement.innerHTML = `<div style="padding:10px; text-align:center; font-weight:bold; color:rgb(22,163,74);">✅ Data berhasil disimpan!<br/><span style="font-size:10px;color:rgb(107,114,128);margin-top:4px;display:block;">ID: ${result.id?.slice(0,8)}...</span></div>`
      }
      console.log("Save successful:", result);

      setTimeout(() => {
        if (popupElement && mapInstance) {
          mapInstance.closePopup();
        }
      }, 3000);

    } catch (err) {
      console.error("Failed to save rainfall data:", err);
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      if (popupElement) {
        popupElement.innerHTML = `<div style="padding:10px; text-align:center; font-weight:bold; color:rgb(220,38,38);">❌ Gagal menyimpan data<br/><span style="font-size:10px;color:rgb(107,114,128);margin-top:4px;display:block;">${errorMessage}</span></div>`
      }
    }
  }, [clickedMarkers, data, currentImage, frameIndex, bounds, mapInstance])

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

  useEffect(() => {
    (window as any).handleSaveData = handleSaveData
    if (!mapInstance || !markersLayerRef.current || !data || !currentImage) return

    markersLayerRef.current.clearLayers()

    const processMarkers = async () => {
      for (let index = 0; index < clickedMarkers.length; index++) {
        const marker = clickedMarkers[index]
        const rainfallData = await fetchRadarPixelData(currentImage, marker.lat, marker.lng, bounds, data.legends)

        const customIcon = L.divIcon({
          className: "custom-marker",
          html: `
            <div style="position:relative;">
              <div style="width: 32px; height: 32px; background: linear-gradient(135deg, rgb(37,99,235) 0%, rgb(30,64,175) 100%); border: 3px solid white; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); box-shadow: 0 4px 8px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center;">
                <span style="color: white; font-weight: bold; font-size: 14px; transform: rotate(45deg);">${index + 1}</span>
              </div>
            </div>`,
          iconSize: [32, 32],
          iconAnchor: [16, 32],
          popupAnchor: [0, -32],
        })

        const leafletMarker = L.marker([marker.lat, marker.lng], { icon: customIcon })
        leafletMarker.bindPopup(
          `
          <div id="popup-content-${marker.id}">
            <div style="padding:6px;min-width:240px;font-family:system-ui;">
              <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
                <h4 style="margin:0;color:rgb(30,64,175);font-size:14px;">📍 Lokasi #${index + 1}</h4>
                <button onclick="window.removeMarker('${marker.id}')" style="background:rgb(239,68,68);color:white;border:none;border-radius:4px;padding:2px 8px;font-size:11px;cursor:pointer;font-weight:600;" title="Hapus marker">✕</button>
              </div>
              <div style="font-size:11px;line-height:1.8;color:rgb(55,65,81);">
                <div style="background:rgb(243,244,246);padding:6px;border-radius:4px;margin-bottom:8px;">
                  <strong style="color:rgb(31,41,55);">Koordinat:</strong><br/>
                  <span style="font-family:monospace;color:rgb(37,99,235);">${marker.lat.toFixed(5)}°, ${marker.lng.toFixed(5)}°</span>
                </div>
                <div style="background:rgb(254,243,199);padding:6px;border-radius:4px;margin-bottom:8px;">
                  <strong style="color:rgb(146,64,14);">⏰ Waktu:</strong><br/>
                  <span style="color:rgb(120,53,15);">${marker.time}</span>
                </div>
                <div style="background:rgb(219,234,254);padding:8px;border-radius:4px;border-left:3px solid rgb(37,99,235);">
                  <strong style="color:rgb(30,64,175);">🌧️ Data Curah Hujan:</strong><br/>
                  <div style="margin-top:4px;"><span style="display:inline-block;background:rgb(37,99,235);color:white;padding:2px 8px;border-radius:3px;font-weight:600;font-size:10px;">${rainfallData.intensity}</span></div>
                  <div style="margin-top:6px;color:rgb(30,64,175);"><strong>dBZ:</strong> ${rainfallData.dbz.toFixed(1)}<br/><strong>Rain Rate:</strong> ${rainfallData.rainRate.toFixed(2)} mm/h</div>
                </div>
                <div style="margin-top:8px;padding-top:6px;border-top:1px solid rgb(229,231,235);font-size:10px;color:rgb(107,114,128);font-style:italic;">${rainfallData.confidence === "Actual Reading" ? "✓ Data dari radar" : "⚠️ Estimasi visual"}</div>
              </div>
              <div style="margin-top:12px; padding-top:10px; border-top:1px solid rgb(229,231,235);">
                <button onclick="window.handleSaveData('${marker.id}')" style="background:linear-gradient(135deg, rgb(22,163,74) 0%, rgb(21,128,61) 100%); color:white; border:none; border-radius:6px; width:100%; padding:8px 0; font-size:13px; cursor:pointer; font-weight:600;">💾 Simpan Data</button>
              </div>
            </div>
          </div>`,
          { maxWidth: 280, className: "custom-popup" }
        )

        if (markersLayerRef.current) {
          leafletMarker.addTo(markersLayerRef.current)
        }
      }
    }

    processMarkers()
  }, [clickedMarkers, mapInstance, data, frameIndex, bounds, currentImage, handleSaveData])

  useEffect(() => {
    if (!mapInstance || !data) return
    let hoverPopup: L.Popup | null = null
    ;(window as any).removeMarker = (markerId: string) => {
      setClickedMarkers((prev) => prev.filter((m) => m.id !== markerId))
    }
    const handleMouseMove = (e: L.LeafletMouseEvent) => {
      const [sw, ne] = bounds as [[number, number], [number, number]]
      const [lat1, lon1] = sw
      const [lat2, lon2] = ne
      const isInBounds = e.latlng.lat >= lat1 && e.latlng.lat <= lat2 && e.latlng.lng >= lon1 && e.latlng.lng <= lon2
      if (!isInBounds) {
        if (hoverPopup) {
          mapInstance.closePopup(hoverPopup)
          hoverPopup = null
        }
        return
      }
      if (!hoverPopup) {
        hoverPopup = L.popup({ closeButton: false, autoClose: false, className: "hover-popup" }).setLatLng(e.latlng).setContent(`<div style="font-size:11px;min-width:120px;"><strong>📍 Location:</strong><br/>${e.latlng.lat.toFixed(4)}°, ${e.latlng.lng.toFixed(4)}°<br/><em style="color:rgb(136,136,136);font-size:10px;">Klik untuk tandai lokasi</em></div>`).openOn(mapInstance)
      } else {
        hoverPopup.setLatLng(e.latlng).setContent(`<div style="font-size:11px;min-width:120px;"><strong>📍 Location:</strong><br/>${e.latlng.lat.toFixed(4)}°, ${e.latlng.lng.toFixed(4)}°<br/><em style="color:rgb(136,136,136);font-size:10px;">Klik untuk tandai lokasi</em></div>`)
      }
    }
    const handleClick = (e: L.LeafletMouseEvent) => {
      const newMarker = {
        lat: e.latlng.lat,
        lng: e.latlng.lng,
        time: data.LastOneHour.timeLocal[frameIndex],
        id: `marker-${Date.now()}-${Math.random()}`,
      }
      setClickedMarkers((prev) => [...prev, newMarker])
      const notification = L.popup({ closeButton: false, autoClose: true, autoPanPadding: [10, 10] }).setLatLng(e.latlng).setContent(`<div style="padding:8px;text-align:center;font-size:12px;color:rgb(5,150,105);font-weight:600;">✓ Lokasi ditandai!<br/><span style="font-size:10px;color:rgb(102,102,102);">Marker #${clickedMarkers.length + 1} ditambahkan</span></div>`).openOn(mapInstance)
      setTimeout(() => mapInstance.closePopup(notification), 2000)
    }
    mapInstance.on("mousemove", handleMouseMove)
    mapInstance.on("click", handleClick)
    return () => {
      mapInstance.off("mousemove", handleMouseMove)
      mapInstance.off("click", handleClick)
      if (hoverPopup) mapInstance.closePopup(hoverPopup)
      delete (window as any).removeMarker
      delete (window as any).handleSaveData
    }
  }, [mapInstance, data, frameIndex, bounds, clickedMarkers.length])

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

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900">
        <div className="text-center p-8 bg-red-900/20 rounded-lg border border-red-500"><p className="text-red-400 text-lg">⚠️ {error}</p></div>
      </div>
    )
  }
  if (!data) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900">
        <div className="text-center"><div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-500 mx-auto mb-4"></div><p className="text-gray-400 text-lg">Loading radar data...</p></div>
      </div>
    )
  }

  return (
    <div className="relative w-full h-screen bg-gray-900" ref={mapContainerRef}>
      <MapContainer center={[data.bounds.lat, data.bounds.lon]} zoom={9} scrollWheelZoom className="w-full h-full" ref={(mapRef) => { if (mapRef) { setMapInstance(mapRef) } }}>
        <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/">OSM</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        {currentImage && (<ImageOverlay key={currentImage} url={currentImage} bounds={bounds} opacity={0.65} zIndex={10} crossOrigin={true} />)}
        <Legend legends={data.legends} />
        <InfoPanel data={data} frameIndex={frameIndex} />
        <KmlOverlay />
      </MapContainer>

      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[1000]">
        <div className="bg-white/95 backdrop-blur-sm px-6 py-3 rounded-2xl shadow-2xl border border-gray-200 flex flex-col gap-3">
          <div className="flex gap-2 items-center justify-center">
            {frames.map((_: any, idx: number) => (
              <button key={idx} onClick={() => handleFrameSelect(idx)} className={`w-3 h-3 rounded-full transition-all ${frameIndex === idx ? "bg-blue-600 scale-125" : "bg-gray-300 hover:bg-gray-400"}`} title={data.LastOneHour.timeLocal[idx]} />
            ))}
          </div>
          <div className="flex items-center gap-3">
            <button onClick={handlePrev} className="text-gray-700 hover:text-blue-600 transition-colors p-2 hover:bg-blue-50 rounded-lg" title="Previous frame"><span className="text-xl">⏮️</span></button>
            <button onClick={handlePlayPause} className="px-5 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 text-white hover:from-blue-700 hover:to-blue-800 transition-all shadow-lg font-semibold flex items-center gap-2"><span className="text-lg">{isPlaying ? "⏸️" : "▶️"}</span>{isPlaying ? "Pause" : "Play"}</button>
            <button onClick={handleNext} className="text-gray-700 hover:text-blue-600 transition-colors p-2 hover:bg-blue-50 rounded-lg" title="Next frame"><span className="text-xl">⏭️</span></button>
          </div>
          <div className="text-center text-sm text-gray-700 font-semibold border-t pt-2 border-gray-200">{data.LastOneHour.timeLocal[frameIndex]}</div>
        </div>
      </div>

      {clickedMarkers.length > 0 && (
        <div className="absolute top-6 right-6 z-[1000]">
          <button onClick={() => setClickedMarkers([])} className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg shadow-lg font-semibold flex items-center gap-2 transition-all" title="Hapus semua marker"><span>🗑️</span>Hapus Semua Marker ({clickedMarkers.length})</button>
        </div>
      )}
    </div>
  )
}
