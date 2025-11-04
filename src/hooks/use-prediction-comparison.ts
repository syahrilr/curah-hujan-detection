import { useState } from 'react';

interface ComparisonResult {
  location: string;
  status: 'matched' | 'no_data';
  predicted: {
    time: string;
    rainRate: number;
    confidence: number;
  };
  actual: {
    time: string;
    radarTime?: string;
    rainRate: number;
    dbz: number;
    intensity: string;
    timeDiffMinutes: number;
  } | null;
  comparison: {
    error: number;
    errorPercentage: number;
    isAccurate: boolean;
    predictionQuality: 'excellent' | 'good' | 'fair' | 'poor';
  } | null;
}

interface ComparisonStatistics {
  totalLocations: number;
  matchedLocations: number;
  unmatchedLocations: number;
  averageError: number;
  averageErrorPercentage: number;
  accurateCount: number;
  qualityDistribution: {
    excellent: number;
    good: number;
    fair: number;
    poor: number;
  };
}

interface ComparisonResponse {
  success: boolean;
  predictionTime: string;
  toleranceMinutes: number;
  comparisons: ComparisonResult[];
  statistics: ComparisonStatistics;
}

export function usePredictionComparison() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ComparisonResponse | null>(null);

  const compareWithActual = async (
    predictionTime: string,
    locations: Array<{
      name: string;
      predicted_rain_rate: number;
      confidence: number;
    }>,
    toleranceMinutes: number = 5
  ) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/rainfall/compare-prediction', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          predictionTime,
          locations,
          toleranceMinutes,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.details || 'Failed to compare prediction');
      }

      const result = await response.json();
      setData(result);
      return result;

    } catch (err: any) {
      setError(err.message);
      console.error('Comparison error:', err);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const getComparisonHistory = async (location?: string, limit: number = 10) => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (location) params.append('location', location);
      params.append('limit', limit.toString());

      const response = await fetch(`/api/rainfall/compare-prediction?${params}`);

      if (!response.ok) {
        throw new Error('Failed to fetch comparison history');
      }

      const result = await response.json();
      return result.data;

    } catch (err: any) {
      setError(err.message);
      console.error('History fetch error:', err);
      return null;
    } finally {
      setLoading(false);
    }
  };

  return {
    compareWithActual,
    getComparisonHistory,
    loading,
    error,
    data,
  };
}
