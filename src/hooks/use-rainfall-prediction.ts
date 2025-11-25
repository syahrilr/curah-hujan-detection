'use client';

import useSWR from 'swr';
import { PredictionResult } from '@/types/rainfall';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8002';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export function useRainfallPrediction() {
  // Auto-refresh setiap 10 menit (600,000 ms)
  const { data, error, isLoading, mutate } = useSWR<PredictionResult>(
    `${API_URL}/api/results/latest`,
    fetcher,
    {
      refreshInterval: 600000,
      revalidateOnFocus: false,
    }
  );

  const triggerPrediction = async () => {
    try {
      // Trigger backend calculation
      await fetch(`${API_URL}/api/predict`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ num_frames: 12, save_visualizations: true }),
      });

      // Force refresh data segera setelah trigger
      // Beri jeda sedikit agar backend sempat memproses inisiasi
      setTimeout(() => mutate(), 2000);
    } catch (err) {
      console.error("Failed to trigger prediction:", err);
    }
  };

  return {
    data,
    loading: isLoading,
    error: error ? (error.message || 'Failed to fetch') : null,
    triggerPrediction,
  };
}
