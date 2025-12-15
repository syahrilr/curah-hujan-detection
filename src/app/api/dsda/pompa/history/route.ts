import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const lokasi = searchParams.get('lokasi');
    const tanggal = searchParams.get('tanggal'); // Format: YYYY-MM-DD

    if (!lokasi) {
      return NextResponse.json({ success: false, message: 'Lokasi wajib diisi' }, { status: 400 });
    }

    // Default to today if no date provided
    const targetDate = tanggal ? new Date(tanggal) : new Date();

    // Set time range (Start of Day - End of Day in UTC)
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    const client = await clientPromise;
    const db = client.db('jakarta_flood_monitoring');

    // Regex Search (Case Insensitive)
    const query = {
      nama_lokasi: { $regex: lokasi, $options: 'i' },
      created_at: {
        $gte: startOfDay,
        $lte: endOfDay
      }
    };

    // Parallel Query for History
    const [chData, tmaData] = await Promise.all([
      db.collection('db_ch_pompa_mapped')
        .find(query)
        .sort({ created_at: 1 })
        .project({
          _id: 0,
          ch_value: 1,
          status: 1, // Added Status
          sensor_sumber: 1,
          // Prioritize returning sensor time, fallback to formatted fetch time
          waktu: { $ifNull: ["$waktu_sensor", "$waktu_fetch_wib"] }
        })
        .toArray(),

      db.collection('db_tma_pompa_mapped')
        .find(query)
        .sort({ created_at: 1 })
        .project({
          _id: 0,
          tma_value: 1,
          status: 1, // Added Status
          sensor_sumber: 1,
          // Prioritize returning sensor time, fallback to formatted fetch time
          waktu: { $ifNull: ["$waktu_sensor", "$waktu_fetch_wib"] }
        })
        .toArray()
    ]);

    return NextResponse.json({
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
    });

  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
