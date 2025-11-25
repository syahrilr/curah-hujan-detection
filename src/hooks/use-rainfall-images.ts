'use client';

import { useState, useEffect } from 'react';

export function useRainfallImages(dataTimestamp?: string) {
  // State timestamp untuk memaksa browser reload gambar
  // setiap kali dataTimestamp dari API berubah
  const [ts, setTs] = useState(Date.now());

  useEffect(() => {
    if (dataTimestamp) {
      setTs(Date.now());
    }
  }, [dataTimestamp]);

  const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8002';

  // Helper generate URL dengan cache buster
  const getUrl = (endpoint: string) => `${API_BASE}${endpoint}?t=${ts}`;

  return {
    images: {
      current: getUrl('/api/images/current'),
      flow: getUrl('/api/images/flow'),
      confidence: getUrl('/api/images/confidence'),
      getPrediction: (minutes: number) => getUrl(`/api/images/prediction/${minutes}`),
    },
    // Fungsi manual jika ingin refresh gambar saja
    refreshImages: () => setTs(Date.now()),
  };
}
