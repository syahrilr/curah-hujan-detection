import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const client = await clientPromise;
    const db = client.db('jakarta_flood_monitoring');

    // Gunakan AGGREGATION untuk mengambil hanya data TERBARU per lokasi
    const pipelineLatest = [
      { $sort: { created_at: -1 } },
      {
        $group: {
          _id: "$nama_lokasi",
          doc: { $first: "$$ROOT" }
        }
      },
      { $replaceRoot: { newRoot: "$doc" } }
    ];

    const [chData, tmaData] = await Promise.all([
      db.collection('db_ch_pompa_mapped').aggregate(pipelineLatest).toArray(),
      db.collection('db_tma_pompa_mapped').aggregate(pipelineLatest).toArray()
    ]);

    const combinedMap = new Map();

    // Map CH Data
    chData.forEach((item: any) => {
      combinedMap.set(item.nama_lokasi, {
        id: item.location_id || item.id,
        nama_lokasi: item.nama_lokasi,
        lokasi_lat: item.lokasi_lat,
        lokasi_lng: item.lokasi_lng,
        ch: {
          val: item.ch_value,
          status: item.status,
          // Fallback jika data lama masih null
          source: item.sensor_sumber || "Sensor Tidak Terdeteksi",
          distance: item.jarak_sensor_km,
          updated_at: item.created_at,
          // Kirim format WIB juga jika ada
          updated_at_str: item.waktu_fetch_wib || null
        }
      });
    });

    // Merge TMA Data
    tmaData.forEach((item: any) => {
      const existing = combinedMap.get(item.nama_lokasi) || {
        id: item.location_id || item.id,
        nama_lokasi: item.nama_lokasi,
        lokasi_lat: item.lokasi_lat,
        lokasi_lng: item.lokasi_lng
      };

      combinedMap.set(item.nama_lokasi, {
        ...existing,
        tma: {
          val: item.tma_value,
          status: item.status,
          source: item.sensor_sumber || "Sensor Tidak Terdeteksi",
          distance: item.jarak_sensor_km,
          updated_at: item.created_at,
          updated_at_str: item.waktu_fetch_wib || null
        }
      });
    });

    const result = Array.from(combinedMap.values()).sort((a: any, b: any) => (b.ch?.val || 0) - (a.ch?.val || 0));

    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
