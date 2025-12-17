import clientPromise from '@/lib/mongodb';
import { getHardcodedPumpLocations, PumpLocation } from '@/lib/kml-parser';
import { findNearestSensor } from '@/lib/spatial-utils';
import { getLocationCode } from '@/lib/location-code-utils';

// --- HELPER BARU: KLASIFIKASI HUJAN PER JAM (BMKG) ---
function getRainStatus(val: number): string {
  if (val < 0.5) return "Terang";             // < 0.5 mm (Tidak Hujan)
  if (val <= 5)  return "Hujan Ringan";       // 0.5 - 5 mm
  if (val <= 10) return "Hujan Sedang";       // > 5 - 10 mm
  if (val <= 20) return "Hujan Lebat";        // > 10 - 20 mm
  if (val <= 50) return "Hujan Sangat Lebat"; // > 20 - 50 mm
  return "Hujan Ekstrem";                     // > 50 mm
}

export async function syncPompaData() {
  try {
    const client = await clientPromise;
    const db = client.db('jakarta_flood_monitoring');

    // 1. Ambil Data Target
    const pumpLocations: PumpLocation[] = getHardcodedPumpLocations();

    // 2. Ambil Data Sumber (API DSDA)
    const [resCH, resTMA] = await Promise.all([
      fetch('https://poskobanjirdsda.jakarta.go.id/datacurahhujan.json', { cache: 'no-store' }),
      fetch('https://poskobanjirdsda.jakarta.go.id/datatma.json', { cache: 'no-store' })
    ]);

    let rawCH = await resCH.json();
    let rawTMA = await resTMA.json();

    // --- NORMALISASI DATA SUMBER ---

    // 1. Curah Hujan
    const listCH = (Array.isArray(rawCH) ? rawCH : rawCH.data || []).map((item: any) => {
      // Prioritaskan KETINGGIAN_TERAKHIR
      const rawVal = item.KETINGGIAN_TERAKHIR || item.TEBAL_HUJAN || item.CH_HARI_INI || item.ch || '0';
      const val = parseFloat(rawVal.toString().replace(',', '.'));

      return {
        nama: item.NAMA_POS || item.nama_pos || item.NAMA_LOKASI_PEMANTAUAN || "Pos Curah Hujan Tanpa Nama",
        val: val,
        latitude: parseFloat(item.LATITUDE || item.lat || 0),
        longitude: parseFloat(item.LONGITUDE || item.long || 0),

        // UPDATE: Menggunakan logika BMKG per Jam
        status: getRainStatus(val),

        waktu_source: item.TANGGAL_TERAKHIR || item.TANGGAL_TERAKHIR_HARI_INI || item.TANGGAL || null
      };
    });

    // 2. TMA (Tetap sama)
    const listTMA = (Array.isArray(rawTMA) ? rawTMA : rawTMA.data || []).map((item: any) => {
      let sourceTime = item.TANGGAL || item.tanggal;
      if (!sourceTime && item.TANGGAL && item.JAM) {
          sourceTime = `${item.TANGGAL} ${item.JAM}`;
      }
      return {
        nama: item.NAMA_PINTU_AIR || item.nama_pintu_air || "Pintu Air Tanpa Nama",
        val: parseFloat((item.TINGGI_AIR || item.tinggi_air || item.tma || '0').toString().replace(',', '.')),
        latitude: parseFloat(item.LATITUDE || item.lat || 0),
        longitude: parseFloat(item.LONGITUDE || item.long || 0),
        status: item.STATUS_SIAGA || item.status || 'Normal',
        waktu_source: sourceTime
      };
    });

    const operationsCH = [];
    const operationsTMA = [];
    const now = new Date();
    const wibString = now.toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });

    for (const pompa of pumpLocations) {

      const locationCode = getLocationCode(pompa.name);

      // --- Mapping Curah Hujan ---
      const nearestCH = findNearestSensor(pompa.lat, pompa.lng, listCH);
      if (nearestCH) {
        const locationId = `ch_${pompa.name.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}`;

        operationsCH.push({
          insertOne: {
            document: {
              location_id: locationId,
              nama_lokasi: pompa.name,
              location_code: locationCode,
              lokasi_lat: pompa.lat,
              lokasi_lng: pompa.lng,
              sensor_sumber: nearestCH.nama || "Unknown Sensor",
              jarak_sensor_km: parseFloat(nearestCH.distance_km.toFixed(2)),
              ch_value: nearestCH.val,
              status: nearestCH.status, // Status baru (BMKG per Jam)
              created_at: now,
              fetched_at: now,
              waktu_fetch_wib: wibString,
              waktu_sensor: nearestCH.waktu_source
            }
          }
        });
      }

      // --- Mapping TMA ---
      const nearestTMA = findNearestSensor(pompa.lat, pompa.lng, listTMA);
      if (nearestTMA) {
        const locationId = `tma_${pompa.name.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}`;

        operationsTMA.push({
          insertOne: {
            document: {
              location_id: locationId,
              nama_lokasi: pompa.name,
              location_code: locationCode,
              lokasi_lat: pompa.lat,
              lokasi_lng: pompa.lng,
              sensor_sumber: nearestTMA.nama || "Unknown Sensor",
              jarak_sensor_km: parseFloat(nearestTMA.distance_km.toFixed(2)),
              tma_value: nearestTMA.val,
              status: nearestTMA.status,
              created_at: now,
              fetched_at: now,
              waktu_fetch_wib: wibString,
              waktu_sensor: nearestTMA.waktu_source
            }
          }
        });
      }
    }

    if (operationsCH.length > 0) await db.collection('db_ch_pompa_mapped').bulkWrite(operationsCH);
    if (operationsTMA.length > 0) await db.collection('db_tma_pompa_mapped').bulkWrite(operationsTMA);

    return {
      success: true,
      summary: {
        total_pompa: pumpLocations.length,
        ch_mapped: operationsCH.length,
        tma_mapped: operationsTMA.length,
        timestamp: wibString
      }
    };

  } catch (error: any) {
    console.error('Logic Error syncPompaData:', error);
    throw error;
  }
}
