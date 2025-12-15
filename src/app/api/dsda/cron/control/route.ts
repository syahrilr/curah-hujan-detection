import { NextResponse } from 'next/server';
import { getCronStatus, controlCron } from '@/lib/cron-manager';
import { syncPompaData } from '@/lib/pompa-sync-service';

export const dynamic = 'force-dynamic';

export async function GET() {
  const status = getCronStatus();
  return NextResponse.json({ success: true, data: status });
}

export async function POST(req: Request) {
  try {
    const { name, action } = await req.json();

    if (action === 'trigger') {
      if (name === 'pompa-sync') {
        const result = await syncPompaData();
        return NextResponse.json({ success: true, message: 'Job triggered', result });
      }
      return NextResponse.json({ success: false, message: 'Trigger not implemented' });
    }

    const newStatus = controlCron(name, action);
    return NextResponse.json({ success: true, status: newStatus });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
