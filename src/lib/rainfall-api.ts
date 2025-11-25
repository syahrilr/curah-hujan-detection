// src/lib/rainfall-api.ts

import {
  PredictionResult,
  PredictionRequest,
  PredictionTaskResponse
} from '@/types/rainfall';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8002';

export const rainfallAPI = {
  /**
   * Trigger prediksi baru
   */
  triggerPrediction: async (
    params: PredictionRequest = { num_frames: 12, save_visualizations: true }
  ): Promise<PredictionTaskResponse> => {
    const response = await fetch(`${API_BASE_URL}/api/predict`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      throw new Error('Failed to trigger prediction');
    }

    return response.json();
  },

  /**
   * Ambil hasil prediksi terakhir
   */
  getLatestResults: async (): Promise<PredictionResult> => {
    const response = await fetch(`${API_BASE_URL}/api/results/latest`, {
      cache: 'no-store' // Pastikan selalu ambil data terbaru
    });

    if (!response.ok) {
      throw new Error('Failed to fetch results');
    }

    return response.json();
  },

  /**
   * Export ke Excel (Blob)
   */
  exportToExcel: async (): Promise<Blob> => {
    const response = await fetch(`${API_BASE_URL}/api/export/excel`);
    if (!response.ok) throw new Error('Export failed');
    return response.blob();
  },

  /**
   * Export ke JSON (Blob)
   */
  exportToJSON: async (): Promise<Blob> => {
    const response = await fetch(`${API_BASE_URL}/api/export/json`);
    if (!response.ok) throw new Error('Export failed');
    return response.blob();
  }
};
