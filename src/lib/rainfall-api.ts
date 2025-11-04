import { LocationInfo, PredictionRequest, PredictionResult, PredictionTaskResponse, RainfallImageData } from "@/types/rainfall";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export class RainfallAPI {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  // Health check
  async healthCheck() {
    const response = await fetch(`${this.baseUrl}/api/health`);
    if (!response.ok) throw new Error('API health check failed');
    return response.json();
  }

  // Get all locations
  async getLocations(): Promise<LocationInfo[]> {
    const response = await fetch(`${this.baseUrl}/api/locations`);
    if (!response.ok) throw new Error('Failed to fetch locations');
    return response.json();
  }

  // Trigger prediction
  async triggerPrediction(request?: PredictionRequest): Promise<PredictionTaskResponse> {
    const response = await fetch(`${this.baseUrl}/api/predict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request || {}),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to trigger prediction');
    }
    return response.json();
  }

  // Check prediction status
  async getStatus(taskId: string) {
    const response = await fetch(`${this.baseUrl}/api/status/${taskId}`);
    if (!response.ok) throw new Error('Failed to fetch status');
    return response.json();
  }

  // Get latest results
  async getLatestResults(): Promise<PredictionResult> {
    const response = await fetch(`${this.baseUrl}/api/results/latest`);
    if (!response.ok) throw new Error('No prediction data available');
    return response.json();
  }

  // Get current conditions only
  async getCurrentConditions() {
    const response = await fetch(`${this.baseUrl}/api/results/current`);
    if (!response.ok) throw new Error('Failed to fetch current conditions');
    return response.json();
  }

  // Get prediction for specific time
  async getPredictionByTime(minutes: number) {
    const response = await fetch(`${this.baseUrl}/api/results/predictions/${minutes}`);
    if (!response.ok) throw new Error(`No prediction for ${minutes} minutes`);
    return response.json();
  }

  // Get images as base64
  async getAllImagesBase64(): Promise<RainfallImageData> {
    const response = await fetch(`${this.baseUrl}/api/images/all-base64`);
    if (!response.ok) throw new Error('Failed to fetch images');
    return response.json();
  }

  // Get statistics summary
  async getStatisticsSummary() {
    const response = await fetch(`${this.baseUrl}/api/statistics/summary`);
    if (!response.ok) throw new Error('Failed to fetch statistics');
    return response.json();
  }

  // Export to Excel
  async exportToExcel(): Promise<Blob> {
    const response = await fetch(`${this.baseUrl}/api/export/excel`);
    if (!response.ok) throw new Error('Failed to export Excel');
    return response.blob();
  }

  // Export to JSON
  async exportToJSON(): Promise<Blob> {
    const response = await fetch(`${this.baseUrl}/api/export/json`);
    if (!response.ok) throw new Error('Failed to export JSON');
    return response.blob();
  }

  // Get image URL (for direct image display)
  getImageUrl(type: 'current' | 'flow' | 'prediction', minutes?: number): string {
    if (type === 'prediction' && minutes) {
      return `${this.baseUrl}/api/images/prediction/${minutes}`;
    }
    return `${this.baseUrl}/api/images/${type}`;
  }
}

export const rainfallAPI = new RainfallAPI();
