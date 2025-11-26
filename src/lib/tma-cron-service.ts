import * as cron from "node-cron";
import { MongoClient, ServerApiVersion } from "mongodb";

const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = "jakarta_flood_monitoring";
const COLLECTION_NAME = "db_tma_dsda";
const STATUS_COLLECTION = "system_status"; // Collection untuk monitoring status
const MONGODB_ENABLED = !!MONGODB_URI;

// Configuration
const TMA_API_URL = "https://poskobanjirdsda.jakarta.go.id/datatma.json";

let cronJob: cron.ScheduledTask | null = null;
let isRunning = false;
let lastRunStats: any = null;
let errorCount = 0;
let successCount = 0;

async function fetchAndSaveTMAData() {
  console.log(`\n🌊 [TMA-CRON] Starting TMA data fetch...`);

  let client: MongoClient | null = null;

  try {
    // 1. Fetch Data
    const response = await fetch(TMA_API_URL, {
      cache: "no-store",
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });

    if (!response.ok) throw new Error(`Failed to fetch TMA data: ${response.statusText}`);

    let rawData = await response.json();
    if (!Array.isArray(rawData) && rawData.data) rawData = rawData.data;

    console.log(`   [TMA-CRON] Fetched ${rawData.length} records from API.`);

    if (!MONGODB_ENABLED || !MONGODB_URI) {
      console.warn("   [TMA-CRON] MongoDB not configured. Skipping save.");
      return;
    }

    // 2. Connect to MongoDB
    client = new MongoClient(MONGODB_URI, {
      serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true },
    });
    await client.connect();
    const db = client.db(DB_NAME);
    const collection = db.collection(COLLECTION_NAME);
    const statusCollection = db.collection(STATUS_COLLECTION);

    // 3. Prepare Data Objects (Insert New Data)
    const documentsToSave = rawData.map((item: any) => {
        const namaPos = item.NAMA_PINTU_AIR || item.nama_pintu_air || item.nama_pos || 'Tanpa Nama';
        const idRef = item.ID || item.id || String(namaPos).replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();

        return {
            id_ref: idRef,
            nama_pos: namaPos,
            tma: parseFloat(String(item.TINGGI_AIR || item.tinggi_air || 0)),
            status: item.STATUS_SIAGA || item.status_siaga || 'Normal',
            latitude: parseFloat(String(item.LATITUDE || item.latitude || 0)),
            longitude: parseFloat(String(item.LONGITUDE || item.longitude || 0)),
            elevasi: parseFloat(String(item.ELEVASI || 0)),
            siaga1: parseFloat(String(item.BATAS_SIAGA1 || item.siaga1 || 0)),
            siaga2: parseFloat(String(item.BATAS_SIAGA2 || item.siaga2 || 0)),
            siaga3: parseFloat(String(item.BATAS_SIAGA3 || item.siaga3 || 0)),
            waktu_tma_api: item.TANGGAL ? `${item.TANGGAL} ${item.JAM}` : null,
            created_at: new Date()
        };
    });

    // 4. Insert Many
    if (documentsToSave.length > 0) {
        const result = await collection.insertMany(documentsToSave);
        console.log(`   [TMA-CRON] ✅ Inserted ${result.insertedCount} new records.`);
    }

    // 5. Update System Status (SUCCESS)
    await statusCollection.updateOne(
      { _id: 'tma_cron' as any },
      {
        $set: {
          name: 'TMA Monitoring',
          status: 'online',
          last_run: new Date(),
          last_message: `Berhasil menyimpan ${documentsToSave.length} data`,
          is_error: false
        }
      },
      { upsert: true }
    );

    return { success: true, count: rawData.length };

  } catch (error: any) {
    // 6. Update System Status (ERROR)
    if (client) {
        const db = client.db(DB_NAME);
        await db.collection(STATUS_COLLECTION).updateOne(
            { _id: 'tma_cron' as any },
            {
                $set: {
                    status: 'error',
                    last_run: new Date(),
                    last_message: error.message || 'Unknown Error',
                    is_error: true
                }
            },
            { upsert: true }
        );
    }
    console.error("❌ [TMA-CRON] Error:", error);
    throw error;
  } finally {
    if (client) await client.close();
  }
}

export function startTMACronJob(schedule: string = "*/5 * * * *") {
  if (isRunning) return;
  console.log(`\n🚀 [TMA-CRON] Starting TMA monitoring cron job... Schedule: ${schedule}`);

  cronJob = cron.schedule(schedule, async () => {
    const startTime = Date.now();
    try {
      await fetchAndSaveTMAData();
      successCount++;
      console.log(`✅ [TMA-CRON] Job finished in ${((Date.now() - startTime) / 1000).toFixed(2)}s`);
      lastRunStats = { timestamp: new Date(), success: true };
    } catch (error) {
      errorCount++;
      console.error(`❌ [TMA-CRON] Job failed.`);
      lastRunStats = { timestamp: new Date(), success: false, error: error };
    }
  });
  isRunning = true;
}
