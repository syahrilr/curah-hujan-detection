// hooks/use-rainfall-prediction.ts
import { useState, useCallback, useEffect } from 'react';
import { rainfallAPI } from '@/lib/rainfall-api';
import type { PredictionResult } from '@/types/rainfall';

interface UseRainfallPredictionReturn {
  data: PredictionResult | null;
  loading: boolean;
  error: string | null;
  progress: string | null;
  triggerPrediction: () => Promise<void>;
  refetch: () => Promise<void>;
}

export function useRainfallPrediction(): UseRainfallPredictionReturn {
  const [data, setData] = useState<PredictionResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);

  // Fetch latest results
  const fetchLatestResults = useCallback(async () => {
    try {
      setError(null);
      const results = await rainfallAPI.getLatestResults();
      setData(results);
      console.log('✅ Loaded existing prediction results');
    } catch (err: any) {
      // It's okay if no results exist yet (404)
      if (err.message?.includes('No prediction data') || err.message?.includes('404')) {
        console.log('ℹ️  No existing results, will need to trigger prediction');
        setData(null);
        setError(null); // Don't show error for missing data
      } else {
        console.error('❌ Error loading results:', err);
        setError(err.message);
      }
    }
  }, []);

  // Load existing data on mount
  useEffect(() => {
    fetchLatestResults();
  }, [fetchLatestResults]);

  // Trigger new prediction with improved API
  const triggerPrediction = useCallback(async () => {
    setLoading(true);
    setError(null);
    setProgress('Starting prediction...');

    try {
      // Step 1: Trigger prediction
            console.log('🚀 Triggering prediction...');
            const task = await rainfallAPI.triggerPrediction({
              use_mongodb: true,
              num_frames: 6,
              save_visualizations: true
            } as any);

      console.log(`📋 Task started: ${task.task_id}`);
      setProgress('Fetching data from MongoDB...');

      // Step 2: Poll for status
      let attempts = 0;
      const maxAttempts = 300; // NAIKKAN: 10 menit max (300 * 2s)
      const pollInterval = 2000; // 2 seconds

      while (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, pollInterval));
        attempts++;

        try {
          const status = await rainfallAPI.getStatus(task.task_id);
          console.log(`📊 Status check ${attempts}:`, status.status);

          if (status.status === 'completed') {
            setProgress('Loading results...');

            // Step 3: Fetch results with retry
            let retries = 3;
            while (retries > 0) {
              try {
                const results = await rainfallAPI.getLatestResults();
                setData(results);
                console.log('✅ Prediction completed successfully');
                setProgress(null);
                setLoading(false);
                return;
              } catch (fetchErr) {
                retries--;
                if (retries === 0) throw fetchErr;
                await new Promise(resolve => setTimeout(resolve, 1000));
              }
            }
          }

          if (status.status === 'error') {
            throw new Error(status.message || 'Prediction failed');
          }

          // PERBARUI PESAN PROGRESS UNTUK 18 LANGKAH
          if (attempts < 10) {
            setProgress('Fetching data & decoding images...');
          } else if (attempts < 25) {
            setProgress('Computing optical flow (this takes a moment)...');
          } else if (attempts < 35) {
            setProgress('Analyzing current conditions...');
          } else if (attempts < 90) {
            // (25s - 3 menit)
            const step = Math.ceil((attempts - 35) / (55 / 18)); // Perkiraan langkah
            setProgress(`Generating prediction step ${step}/18...`);
          } else if (attempts < 150) {
            // (3 - 5 menit)
            const step = Math.ceil((attempts - 90) / (60 / 18)) + 6; // Perkiraan langkah
            setProgress(`Generating prediction step ${Math.min(step, 18)}/18...`);
          } else if (attempts < 240) {
            // (5 - 8 menit)
            setProgress('Creating visualizations...');
          } else {
            // (8 - 10 menit)
            setProgress('Finalizing results...');
          }
        } catch (statusErr: any) {
          console.warn(`⚠️  Status check failed:`, statusErr.message);
          // Continue polling even if status check fails
        }
      }

      throw new Error('Prediction timeout - taking too long (>10 minutes). Please try again.');

    } catch (err: any) {
      const errorMessage = err.message || 'Failed to generate prediction';
      console.error('❌ Prediction error:', errorMessage);
      setError(errorMessage);
      setProgress(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // Refetch (reload existing data)
  const refetch = useCallback(async () => {
    await fetchLatestResults();
  }, [fetchLatestResults]);

  return {
    data,
    loading,
    error,
    progress,
    triggerPrediction,
    refetch
  };
}
