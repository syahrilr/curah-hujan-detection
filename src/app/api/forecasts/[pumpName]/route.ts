import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(
  request: Request,
  context: { params: Promise<{ pumpName: string }> }
) {
  try {
    const { pumpName } = await context.params
    const decodedPumpName = decodeURIComponent(pumpName)
    const { searchParams } = new URL(request.url)
    const startDateParam = searchParams.get('startDate')
    const endDateParam = searchParams.get('endDate')

    // Import helper untuk koneksi DB
    const { getForecastCollection } = await import('@/lib/forecast')
    const collection = await getForecastCollection(decodedPumpName)

    let query: any = {}

    // LOGIKA BARU: Jika ada parameter tanggal, cari dokumen forecast yang relevan
    if (startDateParam && endDateParam) {
        // Parse tanggal input (YYYY-MM-DD)
        const start = new Date(startDateParam)
        const end = new Date(endDateParam)
        // Set end date ke akhir hari (23:59:59) agar mencakup seluruh jam di hari terakhir
        end.setHours(23, 59, 59, 999)

        query = {
            // Cari dokumen dimana periode forecast-nya beririsan dengan rentang yang diminta
            // Start Forecast <= Request End AND End Forecast >= Request Start
            forecastStartDate: { $lte: end },
            forecastEndDate: { $gte: start }
        }
    }

    // Ambil semua dokumen yang cocok, URUTKAN dari yang TERLAMA ke TERBARU (fetchedAt ASC)
    // Tujuannya: Data prediksi yang lebih baru akan menimpa data lama untuk jam yang sama (update data).
    const forecasts = await collection
      .find(query)
      .sort({ fetchedAt: 1 })
      .toArray()

    // Jika tidak ada filter tanggal (default), kembalikan logika lama (latest only)
    if ((!startDateParam || !endDateParam) && forecasts.length > 0) {
       // Ambil yang paling terakhir saja (paling ujung array karena sort fetchedAt: 1)
       const latest = forecasts[forecasts.length - 1]
       return NextResponse.json({ success: true, data: latest }, { headers: { 'Content-Type': 'application/json' } })
    }

    if (forecasts.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No forecast data found for this period' },
        { status: 404 }
      )
    }

    // --- LOGIKA MERGING (PENGGABUNGAN DATA) ---
    // Karena data forecast tersimpan per-16 hari, kita perlu menggabungkan potongan-potongan data
    // menjadi satu garis waktu yang utuh sesuai request user.

    const mergedHourlyData = new Map<string, {
        rain: number,
        precipitation: number,
        precipitation_probability: number,
        temperature_2m: number
    }>()

    forecasts.forEach(doc => {
        if (doc.hourly && doc.hourly.time) {
            doc.hourly.time.forEach((time: string, index: number) => {
                // Simpan ke Map (key = waktu).
                // Karena kita loop dari dokumen lama ke baru, data jam yang sama akan di-update
                // oleh prediksi yang lebih baru (lebih akurat).
                mergedHourlyData.set(time, {
                    rain: doc.hourly.rain?.[index] ?? 0,
                    precipitation: doc.hourly.precipitation?.[index] ?? 0,
                    precipitation_probability: doc.hourly.precipitation_probability?.[index] ?? 0,
                    temperature_2m: doc.hourly.temperature_2m?.[index] ?? 0
                })
            })
        }
    })

    // Sortir waktu agar urut
    const sortedTimes = Array.from(mergedHourlyData.keys()).sort()

    // Filter hasil agar tidak terlalu melebar jauh dari request (opsional, tapi rapi)
    // Kita biarkan sedikit buffer jika ada

    const responseData = {
        pumpName: decodedPumpName,
        fetchedAt: forecasts[forecasts.length - 1].fetchedAt, // Metadata ambil dari yang terbaru
        forecastStartDate: sortedTimes[0],
        forecastEndDate: sortedTimes[sortedTimes.length - 1],
        hourly: {
            time: sortedTimes,
            rain: sortedTimes.map(t => mergedHourlyData.get(t)?.rain ?? 0),
            precipitation: sortedTimes.map(t => mergedHourlyData.get(t)?.precipitation ?? 0),
            precipitation_probability: sortedTimes.map(t => mergedHourlyData.get(t)?.precipitation_probability ?? 0),
            temperature_2m: sortedTimes.map(t => mergedHourlyData.get(t)?.temperature_2m ?? 0),
        }
    }

    return NextResponse.json(
      {
        success: true,
        data: responseData
      },
      {
        headers: { 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Error fetching forecast:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
