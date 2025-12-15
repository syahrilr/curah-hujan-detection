import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const client = await clientPromise;
    const db = client.db('jakarta_flood_monitoring');

    // Ambil nama lokasi unik dari collection TMA (karena biasanya lebih lengkap/utama)
    // Gunakan .distinct() untuk performa cepat
    const locations = await db.collection('db_tma_pompa_mapped').distinct('nama_lokasi');

    // Urutkan abjad A-Z
    locations.sort();

    return NextResponse.json({
      success: true,
      count: locations.length,
      data: locations
    });

  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
