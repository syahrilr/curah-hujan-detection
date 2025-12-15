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

    // Default ke hari ini jika tanggal kosong
    const targetDate = tanggal ? new Date(tanggal) : new Date();

    // Set range waktu (00:00 - 23:59 WIB dalam UTC)
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    const client = await clientPromise;
    const db = client.db('jakarta_flood_monitoring');

    // Gunakan Regex agar pencarian fleksibel (case-insensitive)
    const query = {
      nama_lokasi: { $regex: lokasi, $options: 'i' },
      created_at: {
        $gte: startOfDay,
        $lte: endOfDay
      }
    };

    // Ambil History TMA
    const [tmaData] = await Promise.all([
      db.collection('db_tma_pompa_mapped')
        .find(query)
        .sort({ created_at: 1 })
        .project({
          _id: 0,
          nama_lokasi: 1,   // <-- REQUEST ANDA: Menambahkan nama lokasi
          tma_value: 1,
          status: 1,        // Penting untuk Badge status di tabel
          sensor_sumber: 1, // Penting untuk info sumber
          // Logic Waktu: Prioritaskan waktu sensor, jika null pakai waktu fetch
          waktu: { $ifNull: ["$waktu_sensor", "$waktu_fetch_wib"] },
          created_at: 1
        })
        .toArray()
    ]);

    return NextResponse.json({
      success: true,
      meta: {
        filter_lokasi: lokasi,
        filter_tanggal: targetDate.toISOString().split('T')[0],
        count_data: tmaData.length
      },
      data: {
        tma: tmaData
      }
    });

  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
