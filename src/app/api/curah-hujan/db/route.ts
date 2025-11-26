import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const client = await clientPromise;
    const db = client.db('jakarta_flood_monitoring');
    const collection = db.collection('db_ch_dsda');

    // Aggregation untuk ambil data terbaru
    const data = await collection.aggregate([
      { $sort: { created_at: -1 } },
      {
        $group: {
          _id: "$nama_pos",
          doc: { $first: "$$ROOT" }
        }
      },
      { $replaceRoot: { newRoot: "$doc" } },
      { $sort: { ch: -1 } }
    ]).toArray();

    const lastUpdate = data.length > 0 ? data[0].created_at : null;

    return NextResponse.json({
      success: true,
      count: data.length,
      lastUpdate,
      data: data
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
