import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const client = await clientPromise;
    const db = client.db('jakarta_flood_monitoring');
    const collection = db.collection('db_ch_dsda');

    // 1. Fetch data dari API DSDA Jakarta
    const response = await fetch('https://poskobanjirdsda.jakarta.go.id/datacurahhujan.json', {
      cache: 'no-store',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });

    if (!response.ok) {
      throw new Error(`Gagal mengambil data Curah Hujan: ${response.status} ${response.statusText}`);
    }

    let rawData = await response.json();

    // Handle jika response dibungkus dalam object (misal: { data: [...] })
    if (!Array.isArray(rawData) && rawData.data && Array.isArray(rawData.data)) {
      rawData = rawData.data;
    } else if (!Array.isArray(rawData)) {
      // Jika bukan array, coba ubah jadi array atau throw error
      console.error("Format data bukan array:", rawData);
      rawData = [];
    }

    // DEBUG: Log data pertama untuk melihat struktur asli di terminal server
    if (rawData.length > 0) {
      console.log("Contoh Data Mentah Curah Hujan:", JSON.stringify(rawData[0], null, 2));
    }

    // 2. Mapping Data dengan Logika Extra Robust
    const mappedData = rawData.map((item: any) => {
      // Cari nama pos di berbagai kemungkinan key
      const namaPos =
        item.NAMA_POS ||
        item.nama_pos ||
        item.NAMA_PH ||
        item.LOKASI ||
        item.LOKASI_PENGAMATAN ||
        item.STATION_NAME ||
        item.nama ||
        'Tanpa Nama';

      // Cari nilai Curah Hujan (prioritas: data saat ini/harian)
      // Kadang angka dikirim sebagai string "0,5" (koma) bukan "0.5" (titik)
      let rawCH =
        item.CH_HARI_INI ||
        item.ch_hari_ini ||
        item.TEBAL_HUJAN ||
        item.tebal_hujan ||
        item.CH ||
        item.ch ||
        item.TINGGI_HUJAN ||
        0;

      // Bersihkan format angka (ganti koma dengan titik)
      if (typeof rawCH === 'string') {
        rawCH = rawCH.replace(',', '.');
      }
      const ch = parseFloat(rawCH) || 0;

      const status = item.STATUS || item.status || (ch > 0 ? (ch > 50 ? 'Hujan Lebat' : 'Hujan') : 'Terang');

      // Koordinat (jika ada)
      const latitude = parseFloat(item.LATITUDE || item.latitude || item.lat || 0);
      const longitude = parseFloat(item.LONGITUDE || item.longitude || item.long || item.lon || 0);

      // Buat ID yang unik dan bersih
      const id = item.ID || item.id || String(namaPos).replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();

      return {
        updateOne: {
          filter: { id: id },
          update: {
            $set: {
              id: id,
              nama_pos: namaPos,
              ch: ch,
              status: status,
              latitude: latitude,
              longitude: longitude,
              waktu_ch: new Date().toISOString(), // Gunakan waktu server jika data tidak ada tanggal
              fetched_at: new Date(),
              updated_at: new Date()
            }
          },
          upsert: true
        }
      };
    });

    // 3. Simpan ke Database
    if (mappedData.length > 0) {
      await collection.bulkWrite(mappedData);
    }

    // 4. Return Data
    const allData = await collection
      .find({})
      .sort({ ch: -1 }) // Urutkan curah hujan tertinggi
      .toArray();

    return NextResponse.json({
      success: true,
      count: allData.length,
      data: allData
    });

  } catch (error: any) {
    console.error('Error fetching Curah Hujan data:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
