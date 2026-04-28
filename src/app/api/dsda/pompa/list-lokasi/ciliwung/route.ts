import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';

export const dynamic = 'force-dynamic';

// --- DAFTAR LIST CILIWUNG (Hulu ke Hilir) ---
// Kita definisikan manual karena tidak ada field khusus "sungai" di database
const CILIWUNG_LIST = [
  "Rumah Pompa Katulampa",
  "Rumah Pompa Bukit Duri 1",
  "Rumah Pompa Bukit Duri 2",
  "Rumah Pompa Bukit Duri 3",
  "Rumah Pompa Bukit Duri 4",
  "Rumah Pompa Bukit Duri 5",
  "Rumah Pompa Bukit Duri 6",
  "Rumah Pompa Bukit Duri 7",
  "Rumah Pompa Bukit Duri 8",
  "Rumah Pompa Bukit Duri 9",
  "Rumah Pompa Hayam Wuruk",
  "Rumah Pompa Batu Ceper",
  "Pintu Air Tangki",
  "Rumah Pompa Kelinci",
  "Rumah Pompa Jembatan Merah",
  "Rumah Pompa Mangga 2",
  "Pintu Air Pasar Ikan/Pakin",
  "Rumah Pompa Waduk Pluit"
];

export async function GET() {
  try {
    const client = await clientPromise;
    const db = client.db('jakarta_flood_monitoring');

    // --- QUERY DATABASE ---
    // Kita gunakan .distinct() dengan FILTER
    // Artinya: "Ambil nama_lokasi unik, TAPI HANYA yang namanya ada di dalam daftar CILIWUNG_LIST"
    const locations = await db.collection('db_tma_pompa_mapped').distinct('nama_lokasi', {
      nama_lokasi: { $in: CILIWUNG_LIST }
    });

    // Urutkan sesuai Abjad (Optional, kalau mau urut hulu-hilir hapus bagian ini)
    locations.sort();

    return NextResponse.json({
      success: true,
      count: locations.length,
      filter_type: "Ciliwung Stream Only",
      data: locations
    });

  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
