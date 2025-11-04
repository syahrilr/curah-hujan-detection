interface ComparisonData {
  predictionTime: string;
  toleranceMinutes: number;
  comparisons: Array<{
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
  }>;
  statistics: {
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
  };
}

export function exportComparisonToCSV(data: ComparisonData): void {
  const rows: string[] = [];

  // Header
  rows.push('Location,Status,Predicted Time,Predicted Rain Rate (mm/h),Confidence (%),Actual Time,Actual Rain Rate (mm/h),Actual dBZ,Actual Intensity,Time Diff (min),Error (mm/h),Error (%),Is Accurate,Quality');

  // Data rows
  data.comparisons.forEach(comp => {
    const row = [
      comp.location,
      comp.status,
      comp.predicted.time,
      comp.predicted.rainRate.toFixed(2),
      (comp.predicted.confidence * 100).toFixed(1),
      comp.actual ? comp.actual.time : 'N/A',
      comp.actual ? comp.actual.rainRate.toFixed(2) : 'N/A',
      comp.actual ? comp.actual.dbz.toFixed(1) : 'N/A',
      comp.actual ? comp.actual.intensity : 'N/A',
      comp.actual ? comp.actual.timeDiffMinutes.toFixed(1) : 'N/A',
      comp.comparison ? comp.comparison.error.toFixed(2) : 'N/A',
      comp.comparison ? comp.comparison.errorPercentage.toFixed(2) : 'N/A',
      comp.comparison ? (comp.comparison.isAccurate ? 'Yes' : 'No') : 'N/A',
      comp.comparison ? comp.comparison.predictionQuality : 'N/A',
    ];
    rows.push(row.join(','));
  });

  // Add statistics summary
  rows.push('');
  rows.push('STATISTICS SUMMARY');
  rows.push(`Total Locations,${data.statistics.totalLocations}`);
  rows.push(`Matched Locations,${data.statistics.matchedLocations}`);
  rows.push(`Unmatched Locations,${data.statistics.unmatchedLocations}`);
  rows.push(`Average Error (mm/h),${data.statistics.averageError.toFixed(2)}`);
  rows.push(`Average Error (%),${data.statistics.averageErrorPercentage.toFixed(2)}`);
  rows.push(`Accurate Count,${data.statistics.accurateCount}`);
  rows.push(`Accuracy Rate (%),${((data.statistics.accurateCount / data.statistics.matchedLocations) * 100).toFixed(2)}`);
  rows.push('');
  rows.push('QUALITY DISTRIBUTION');
  rows.push(`Excellent,${data.statistics.qualityDistribution.excellent}`);
  rows.push(`Good,${data.statistics.qualityDistribution.good}`);
  rows.push(`Fair,${data.statistics.qualityDistribution.fair}`);
  rows.push(`Poor,${data.statistics.qualityDistribution.poor}`);

  // Create CSV content
  const csvContent = rows.join('\n');

  // Create blob and download
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `rainfall_comparison_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportComparisonToJSON(data: ComparisonData): void {
  const jsonContent = JSON.stringify(data, null, 2);

  const blob = new Blob([jsonContent], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `rainfall_comparison_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// Prepare data for charts
export function prepareComparisonChartData(data: ComparisonData) {
  const matchedComparisons = data.comparisons.filter(c => c.status === 'matched' && c.comparison);

  // Scatter plot data: Predicted vs Actual
  const scatterData = matchedComparisons.map(c => ({
    location: c.location,
    predicted: c.predicted.rainRate,
    actual: c.actual!.rainRate,
    error: c.comparison!.error,
    errorPercentage: c.comparison!.errorPercentage,
    quality: c.comparison!.predictionQuality,
  }));

  // Error distribution
  const errorDistribution = matchedComparisons.map(c => ({
    location: c.location.length > 20 ? c.location.substring(0, 20) + '...' : c.location,
    error: c.comparison!.error,
    errorPercentage: c.comparison!.errorPercentage,
  })).sort((a, b) => b.error - a.error);

  // Quality distribution
  const qualityData = [
    { quality: 'Excellent', count: data.statistics.qualityDistribution.excellent, fill: '#10b981' },
    { quality: 'Good', count: data.statistics.qualityDistribution.good, fill: '#3b82f6' },
    { quality: 'Fair', count: data.statistics.qualityDistribution.fair, fill: '#f59e0b' },
    { quality: 'Poor', count: data.statistics.qualityDistribution.poor, fill: '#ef4444' },
  ];

  // Top errors
  const topErrors = errorDistribution.slice(0, 10);

  return {
    scatterData,
    errorDistribution,
    qualityData,
    topErrors,
  };
}
