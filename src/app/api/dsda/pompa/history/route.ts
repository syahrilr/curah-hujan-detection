import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';

export const dynamic = 'force-dynamic';

// --- 1. SETUP HEADER CORS ---
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// --- 2. HANDLER OPTIONS (PREFLIGHT REQUEST) ---
export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const lokasi = searchParams.get('lokasi');
    const tanggal = searchParams.get('tanggal');
    const lastHoursParam = searchParams.get('last_hours'); // Parameter baru

    // Validasi Lokasi
    if (!lokasi) {
      return NextResponse.json(
        { success: false, message: 'Lokasi wajib diisi' },
        { status: 400, headers: corsHeaders }
      );
    }

    // --- LOGIKA PENENTUAN WAKTU (FILTER) ---
    let queryStartDate: Date;
    let queryEndDate: Date;
    let filterMode: string;

    if (lastHoursParam) {
      // MODE A: Filter X Jam Terakhir
      const hours = parseInt(lastHoursParam);
      const now = new Date();

      queryEndDate = now; // Sampai detik ini
      queryStartDate = new Date(now.getTime() - (hours * 60 * 60 * 1000)); // Mundur X jam
      filterMode = `Last ${hours} hours`;

    } else {
      // MODE B: Filter Harian (Default)
      const targetDate = tanggal ? new Date(tanggal) : new Date();

      queryStartDate = new Date(targetDate);
      queryStartDate.setHours(0, 0, 0, 0); // 00:00:00

      queryEndDate = new Date(targetDate);
      queryEndDate.setHours(23, 59, 59, 999); // 23:59:59
      filterMode = `Daily: ${queryStartDate.toISOString().split('T')[0]}`;
    }

    // --- KONEKSI DB ---
    const client = await clientPromise;
    const db = client.db('jakarta_flood_monitoring');

    // Query Database
    const query = {
      nama_lokasi: { $regex: lokasi, $options: 'i' },
      created_at: { $gte: queryStartDate, $lte: queryEndDate }
    };

    // --- AMBIL DATA PARALEL ---
    const [chData, tmaData] = await Promise.all([
      db.collection('db_ch_pompa_mapped')
        .find(query)
        .sort({ created_at: 1 })
        .project({
          _id: 0,
          nama_lokasi: 1,
          location_code: 1,
          ch_value: 1,
          status: 1,
          sensor_sumber: 1,
          waktu: { $ifNull: ["$waktu_sensor", "$waktu_fetch_wib"] },
          created_at: 1
        })
        .toArray(),

      db.collection('db_tma_pompa_mapped')
        .find(query)
        .sort({ created_at: 1 })
        .project({
          _id: 0,
          nama_lokasi: 1,
          location_code: 1,
          tma_value: 1,
          status: 1,
          sensor_sumber: 1,
          waktu: { $ifNull: ["$waktu_sensor", "$waktu_fetch_wib"] },
          created_at: 1
        })
        .toArray()
    ]);

    // --- 3. RETURN RESPONSE ---
    return NextResponse.json(
      {
        success: true,
        meta: {
          filter_lokasi: lokasi,
          filter_mode: filterMode,
          time_start: queryStartDate, // Info range waktu start
          time_end: queryEndDate,     // Info range waktu end
          count_ch: chData.length,
          count_tma: tmaData.length
        },
        data: {
          ch: chData,
          tma: tmaData
        }
      },
      {
        status: 200,
        headers: corsHeaders
      }
    );

  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500, headers: corsHeaders }
    );
  }
}
