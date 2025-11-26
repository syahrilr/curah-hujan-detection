import * as cron from "node-cron";
import { MongoClient, ServerApiVersion } from "mongodb";

const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = "jakarta_flood_monitoring";
const COLLECTION_NAME = "db_ch_dsda";
const MONGODB_ENABLED = !!MONGODB_URI;

// Configuration
const CH_API_URL = "https://poskobanjirdsda.jakarta.go.id/datacurahhujan.json";

let cronJob: cron.ScheduledTask | null = null;
let isRunning = false;
let lastRunStats: any = null;
let errorCount = 0;
let successCount = 0;

async function fetchAndSaveRainfallData() {
  console.log(`\n🌧️ [CH-CRON] Starting Rainfall data fetch...`);

  let client: MongoClient | null = null;

  try {
    const response = await fetch(CH_API_URL, {
      cache: "no-store",
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });

    if (!response.ok) throw new Error(`Failed to fetch Rainfall data: ${response.statusText}`);

    let rawData = await response.json();
    if (!Array.isArray(rawData) && rawData.data) rawData = rawData.data;

    console.log(`   [CH-CRON] Fetched ${rawData.length} records from API.`);

    if (!MONGODB_ENABLED || !MONGODB_URI) {
      console.warn("   [CH-CRON] MongoDB not configured. Skipping save.");
      return;
    }

    client = new MongoClient(MONGODB_URI, {
      serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true },
    });
    await client.connect();
    const db = client.db(DB_NAME);
    const collection = db.collection(COLLECTION_NAME);

    // Prepare Data Objects
    const documentsToSave = rawData.map((item: any) => {
        const namaPos = item.NAMA_POS || item.nama_pintu_air || item.nama_pos || 'Tanpa Nama';
        const idRef = item.ID || item.id || String(namaPos).replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();

        // Handle format angka dengan koma (e.g. "0,5")
        let rawCH = item.CH_HARI_INI || item.ch_hari_ini || item.TEBAL_HUJAN || item.CH || 0;
        if (typeof rawCH === 'string') rawCH = rawCH.replace(',', '.');
        const ch = parseFloat(rawCH) || 0;

        const status = item.STATUS || item.status || (ch > 0 ? (ch > 50 ? 'Hujan Lebat' : 'Hujan') : 'Terang');

        return {
            id_ref: idRef,
            nama_pos: namaPos,
            ch: ch,
            status: status,
            latitude: parseFloat(String(item.LATITUDE || item.latitude || 0)),
            longitude: parseFloat(String(item.LONGITUDE || item.longitude || 0)),
            waktu_ch_api: new Date().toISOString(), // API CH kadang tidak ada field waktu spesifik
            created_at: new Date()
        };
    });

    // Insert Many
    if (documentsToSave.length > 0) {
        const result = await collection.insertMany(documentsToSave);
        console.log(`   [CH-CRON] ✅ Inserted ${result.insertedCount} new history records.`);
    }

    return { success: true, count: rawData.length };

  } catch (error) {
    console.error("❌ [CH-CRON] Error:", error);
    throw error;
  } finally {
    if (client) await client.close();
  }
}

export function startRainfallCronJob(schedule: string = "*/5 * * * *") {
  if (isRunning) return;

  console.log(`\n🚀 [CH-CRON] Starting Rainfall monitoring cron job... Schedule: ${schedule}`);

  cronJob = cron.schedule(schedule, async () => {
    const startTime = Date.now();
    try {
      await fetchAndSaveRainfallData();
      successCount++;
      console.log(`✅ [CH-CRON] Job finished in ${((Date.now() - startTime) / 1000).toFixed(2)}s`);
      lastRunStats = { timestamp: new Date(), success: true };
    } catch (error) {
      errorCount++;
      console.error(`❌ [CH-CRON] Job failed.`);
      lastRunStats = { timestamp: new Date(), success: false, error: error };
    }
  });

  isRunning = true;
}
