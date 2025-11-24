import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';

export const dynamic = 'force-dynamic'; // Pastikan tidak di-cache statis

export async function GET() {
  try {
    const client = await clientPromise;
    const db = client.db('jakarta_flood_monitoring');
    const collection = db.collection('db_tma_dsda');

    // 1. Fetch data dari API DSDA Jakarta
    const response = await fetch('https://poskobanjirdsda.jakarta.go.id/datatma.json', {
      cache: 'no-store',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });

    if (!response.ok) {
      throw new Error(`Gagal mengambil data TMA: ${response.status} ${response.statusText}`);
    }

    const rawData = await response.json();

    // 2. Mapping Data (PENTING: Sesuaikan key dari API ke Schema Database Anda)
    // API DSDA biasanya mengembalikan key seperti: NAMA_PINTU_AIR, TINGGI_AIR, dll.
    const mappedData = rawData.map((item: any) => {
      // Deteksi nama field dari API (karena kadang berubah casing)
      const namaPos = item.NAMA_PINTU_AIR || item.nama_pintu_air || item.nama_pos || 'Tanpa Nama';
      const tma = parseFloat(item.TINGGI_AIR || item.tinggi_air || item.tma || 0);
      const status = item.STATUS_SIAGA || item.status_siaga || item.status || 'Normal';
      const latitude = parseFloat(item.LATITUDE || item.latitude || 0);
      const longitude = parseFloat(item.LONGITUDE || item.longitude || 0);
      const id = item.ID || item.id || namaPos.replace(/\s+/g, '_').toLowerCase();

      return {
        updateOne: {
          filter: { id: id },
          update: {
            $set: {
              id: id,
              nama_pos: namaPos,
              tma: tma,
              status: status,
              latitude: latitude,
              longitude: longitude,
              // Field opsional (gunakan default jika tidak ada di API)
              elevasi: parseFloat(item.ELEVASI || 0),
              siaga1: parseFloat(item.BATAS_SIAGA1 || item.siaga1 || 0),
              siaga2: parseFloat(item.BATAS_SIAGA2 || item.siaga2 || 0),
              siaga3: parseFloat(item.BATAS_SIAGA3 || item.siaga3 || 0),
              waktu_tma: item.TANGGAL ? `${item.TANGGAL} ${item.JAM}` : new Date().toISOString(),
              fetched_at: new Date(),
              updated_at: new Date()
            }
          },
          upsert: true
        }
      };
    });

    // 3. Simpan ke Database (Bulk Write)
    if (mappedData.length > 0) {
      await collection.bulkWrite(mappedData);
    }

    // 4. Ambil kembali data bersih dari Database untuk ditampilkan
    const allData = await collection
      .find({})
      .sort({ nama_pos: 1 }) // Urutkan berdasarkan nama
      .toArray();

    return NextResponse.json({
      success: true,
      count: allData.length,
      data: allData
    });

  } catch (error: any) {
    console.error('Error fetching TMA data:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
