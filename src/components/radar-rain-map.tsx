'use client'

import { useEffect, useRef, useState } from 'react'

const RADAR_URL =
  'https://radar.bmkg.go.id:8090/sidarmaimage?token=46dc1e64b6843d45a7adc26b2fb6abe44a9385139002590339dc40e09090&radar=JAK'

// Legenda BMKG
const legend = {
  levels: [5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70],
  colors: [
    '#07fef6', '#0096ff', '#0002fe', '#01fe03', '#00c703', '#009902',
    '#fffe00', '#ffc801', '#ff7707', '#fb0103', '#c90002', '#980001',
    '#ff00ff', '#9800fe',
  ],
}

const hexToRgb = (hex: string) => {
  const bigint = parseInt(hex.replace('#', ''), 16)
  return { r: (bigint >> 16) & 255, g: (bigint >> 8) & 255, b: bigint & 255 }
}

const colorDistance = (c1: any, c2: any) => {
  return Math.sqrt(
    (c1.r - c2.r) ** 2 +
    (c1.g - c2.g) ** 2 +
    (c1.b - c2.b) ** 2
  )
}

const matchDbz = (r: number, g: number, b: number) => {
  let minDist = Infinity
  let matchedDbz = 0
  for (let i = 0; i < legend.levels.length; i++) {
    const rgb = hexToRgb(legend.colors[i])
    const dist = colorDistance({ r, g, b }, rgb)
    if (dist < minDist) {
      minDist = dist
      matchedDbz = legend.levels[i]
    }
  }
  return matchedDbz
}

export default function RadarRainMap() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [result, setResult] = useState<any>(null)
  const [imageLoaded, setImageLoaded] = useState(false)
  const [imgSize, setImgSize] = useState<{ width: number; height: number }>({
    width: 0,
    height: 0,
  })

  useEffect(() => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.src = RADAR_URL
    img.onload = () => {
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      canvas.width = img.width
      canvas.height = img.height
      ctx.drawImage(img, 0, 0)
      setImgSize({ width: img.width, height: img.height })
      setImageLoaded(true)
    }
  }, [])

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!imageLoaded) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const pixel = ctx.getImageData(x, y, 1, 1).data
    const [r, g, b] = pixel

    // Konversi posisi ke koordinat geografis radar Jakarta
    const bounds = {
      latMin: -8.418959280187721,
      latMax: -3.9237287198122797,
      lonMin: 104.39898771981228,
      lonMax: 108.89421828018772,
    }

    const lon =
      bounds.lonMin + (x / imgSize.width) * (bounds.lonMax - bounds.lonMin)
    const lat =
      bounds.latMax - (y / imgSize.height) * (bounds.latMax - bounds.latMin)

    const dbz = matchDbz(r, g, b)
    const Z = Math.pow(10, dbz / 10)
    const rainRate = Math.pow(Z / 200, 1 / 1.6)

    // Crop area sekitar 50x50
    const cropCanvas = document.createElement('canvas')
    const cropCtx = cropCanvas.getContext('2d')!
    const cropSize = 50
    cropCanvas.width = cropSize
    cropCanvas.height = cropSize
    cropCtx.drawImage(
      canvas,
      x - cropSize / 2,
      y - cropSize / 2,
      cropSize,
      cropSize,
      0,
      0,
      cropSize,
      cropSize
    )
    const croppedImage = cropCanvas.toDataURL('image/png')

    setResult({
      lat: lat.toFixed(4),
      lon: lon.toFixed(4),
      dbz,
      rainRate: rainRate.toFixed(2),
      color: `rgb(${r},${g},${b})`,
      croppedImage,
    })
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <h2 className="text-xl font-semibold">🛰️ Peta Radar BMKG - Jakarta</h2>
      <canvas
        ref={canvasRef}
        onClick={handleClick}
        className="border rounded-lg shadow-lg cursor-crosshair"
        style={{ maxWidth: '100%', height: 'auto' }}
      />
      {result && (
        <div className="p-4 border rounded-lg bg-white shadow-lg w-80">
          <h3 className="font-semibold mb-2">📍 Hasil Klik</h3>
          <p>🌐 Lat: {result.lat}, Lon: {result.lon}</p>
          <p>💧 Curah hujan: <b>{result.rainRate} mm/jam</b></p>
          <p>📶 dBZ: <b>{result.dbz}</b></p>
          <div className="mt-2">
            <p>🎨 Warna piksel:</p>
            <div
              style={{ background: result.color, width: 40, height: 20 }}
              className="border"
            ></div>
          </div>
          <div className="mt-3">
            <p>🖼️ Potongan lokasi:</p>
            <img src={result.croppedImage} alt="Crop" className="border rounded mt-1" />
          </div>
        </div>
      )}
    </div>
  )
}
