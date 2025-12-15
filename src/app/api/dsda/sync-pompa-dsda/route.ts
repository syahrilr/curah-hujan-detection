import { NextResponse } from 'next/server';
import { syncPompaData } from '@/lib/pompa-sync-service';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const result = await syncPompaData();
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
