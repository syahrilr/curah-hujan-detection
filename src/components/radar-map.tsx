'use client';

import dynamic from 'next/dynamic';
import { Skeleton } from "@/components/ui/skeleton"; // opsional, kalau pakai ShadCN

const RadarMapClient = dynamic(() => import('./radar-map-client'), {
  ssr: false, // <-- penting! menonaktifkan render di server
  loading: () => <div className="p-4"><Skeleton className="w-full h-[80vh]" /></div>,
});

export default function RadarMap() {
  return <RadarMapClient />;
}
