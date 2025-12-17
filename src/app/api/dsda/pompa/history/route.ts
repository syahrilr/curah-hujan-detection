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

    if (!lokasi) {
      // Return Error juga harus ada header CORS agar frontend bisa baca errornya
      return NextResponse.json(
        { success: false, message: 'Lokasi wajib diisi' },
        { status: 400, headers: corsHeaders }
      );
    }

    const targetDate = tanggal ? new Date(tanggal) : new Date();
    const startOfDay = new Date(targetDate); startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate); endOfDay.setHours(23, 59, 59, 999);

    const client = await clientPromise;
    const db = client.db('jakarta_flood_monitoring');

    const query = {
      nama_lokasi: { $regex: lokasi, $options: 'i' },
      created_at: { $gte: startOfDay, $lte: endOfDay }
    };

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

    // --- 3. RETURN RESPONSE DENGAN HEADER CORS ---
    return NextResponse.json(
      {
        success: true,
        meta: {
          filter_lokasi: lokasi,
          filter_tanggal: targetDate.toISOString().split('T')[0],
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
        headers: corsHeaders // Sisipkan header di sini
      }
    );

  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500, headers: corsHeaders } // Error juga perlu header CORS
    );
  }
}
