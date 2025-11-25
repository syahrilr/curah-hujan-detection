// src/lib/rainfall-utils.ts

import { format } from 'date-fns';
import { id } from 'date-fns/locale';

export const formatTimestamp = (timestamp?: string) => {
  if (!timestamp) return '-';
  try {
    return format(new Date(timestamp), 'dd MMMM yyyy, HH:mm', { locale: id });
  } catch (e) {
    return timestamp;
  }
};

export const getPredictionTime = (baseTimestamp: string, minutes: number) => {
  if (!baseTimestamp) return `+${minutes} m`;
  try {
    const date = new Date(baseTimestamp);
    const future = new Date(date.getTime() + minutes * 60000);
    return format(future, 'HH:mm', { locale: id });
  } catch (e) {
    return `+${minutes} m`;
  }
};

export const formatRainRate = (rate: number) => {
  return rate.toFixed(1);
};

export const formatConfidence = (conf: number) => {
  return `${(conf * 100).toFixed(0)}%`;
};

export const getIntensityBadgeVariant = (intensity: string) => {
  switch (intensity) {
    case 'Very Heavy Rain': return 'destructive';
    case 'Heavy Rain': return 'destructive';
    case 'Moderate Rain': return 'default'; // atau 'warning' jika ada
    case 'Light Rain': return 'secondary';
    default: return 'outline';
  }
};

// Helper untuk download file di browser
export const downloadFile = (blob: Blob, filename: string) => {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
};
