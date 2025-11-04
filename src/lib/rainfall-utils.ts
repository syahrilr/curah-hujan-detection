export function getIntensityColor(intensity: string): string {
  switch (intensity) {
    case 'No Rain': return 'text-gray-400';
    case 'Light Rain': return 'text-blue-400';
    case 'Moderate Rain': return 'text-yellow-500';
    case 'Heavy Rain': return 'text-orange-500';
    case 'Very Heavy Rain': return 'text-red-500';
    default: return 'text-gray-400';
  }
}

export function getIntensityBadgeVariant(intensity: string): 'default' | 'secondary' | 'destructive' {
  switch (intensity) {
    case 'Heavy Rain':
    case 'Very Heavy Rain':
      return 'destructive';
    case 'Moderate Rain':
      return 'default';
    default:
      return 'secondary';
  }
}

export function formatRainRate(rate: number): string {
  return rate.toFixed(2);
}

export function formatConfidence(confidence: number): string {
  return `${(confidence * 100).toFixed(1)}%`;
}

export function formatTimestamp(timestamp: string | undefined): string {
  if (!timestamp) return 'N/A';

  try {
    const date = new Date(timestamp);
    return date.toLocaleString('id-ID', {
      dateStyle: 'short',
      timeStyle: 'short',
    });
  } catch {
    return timestamp;
  }
}

export function getPredictionTime(baseTime: string, minutesAhead: number): string {
  try {
    const date = new Date(baseTime);
    date.setMinutes(date.getMinutes() + minutesAhead);
    return date.toLocaleString('id-ID', {
      dateStyle: 'short',
      timeStyle: 'short',
    });
  } catch {
    return `+${minutesAhead} min`;
  }
}

export function downloadFile(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
