import { useState, useEffect, useCallback } from 'react';
import { rainfallAPI } from '@/lib/rainfall-api';
import { PredictionRequest, PredictionResult } from '@/types/rainfall';

export function useRainfallPrediction() {
  const [data, setData] = useState<PredictionResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [taskId, setTaskId] = useState<string | null>(null);

  // Memuat hasil terbaru
  const loadLatestResults = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const results = await rainfallAPI.getLatestResults();
      setData(results);
    } catch (err) {
      // PERBAIKAN: Tangani error 404 (data belum ada) dengan baik
      // Jika 404 (Not Found), jangan set error, biarkan data tetap null.
      if (err instanceof Error && (err.message.includes('404') || err.message.includes('No prediction data'))) {
        setData(null); // Pastikan data null
        setError(null); // Hapus error sebelumnya
      } else {
        setError(err instanceof Error ? err.message : 'Failed to load results');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // Memicu prediksi baru
  const triggerPrediction = useCallback(async (request?: PredictionRequest) => {
    try {
      setLoading(true);
      setError(null);
      const response = await rainfallAPI.triggerPrediction(request);
      setTaskId(response.task_id);

      // Polling status sampai selesai
      const pollStatus = async () => {
        const status = await rainfallAPI.getStatus(response.task_id);

        if (status.status === 'completed') {
          await loadLatestResults(); // Muat data baru setelah selesai
          return true;
        } else if (status.status === 'error') {
          throw new Error(status.message);
        }
        return false;
      };

      // Poll setiap 2 detik
      const maxAttempts = 60; // Maksimal 2 menit
      for (let i = 0; i < maxAttempts; i++) {
        const completed = await pollStatus();
        if (completed) break;

        // Penanganan timeout
        if (i === maxAttempts - 1) {
          throw new Error("Prediction task timed out. Please try again.");
        }

        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Prediction failed');
    } finally {
      setLoading(false);
    }
  }, [loadLatestResults]);

  // Auto-load saat komponen dimuat
  useEffect(() => {
    loadLatestResults();
  }, [loadLatestResults]);

  return {
    data,
    loading,
    error,
    taskId,
    triggerPrediction,
    reload: loadLatestResults,
  };
}
