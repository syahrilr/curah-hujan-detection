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

  // Get all locations (from latest prediction data)
  async getLocations(): Promise<LocationInfo[]> {
    try {
      const latest = await this.getLatestResults();
      if (latest && latest.current) {
        return latest.current.map((loc: any) => ({
          name: loc.name,
          lat: loc.lat,
          lng: loc.lng
        }));
      }
      return [];
    } catch (error) {
      console.warn('No locations available yet');
      return [];
    }
  }

  // Trigger prediction with MongoDB
  async triggerPrediction(request?: PredictionRequest): Promise<PredictionTaskResponse> {
    const response = await fetch(`${this.baseUrl}/api/predict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        use_mongodb: true,
        num_frames: 6,
        save_visualizations: true,
        ...request
      }),
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

  // Export to Excel (Note: improved API doesn't have Excel export yet)
  async exportToExcel(): Promise<Blob> {
    try {
      const response = await fetch(`${this.baseUrl}/api/export/excel`);
      if (!response.ok) throw new Error('Excel export not available');
      return response.blob();
    } catch (error) {
      console.warn('Excel export not available in improved API');
      // Return JSON instead
      const json = await this.exportToJSON();
      return json;
    }
  }

  // Export to JSON
  async exportToJSON(): Promise<Blob> {
    const response = await fetch(`${this.baseUrl}/api/export/json`);
    if (!response.ok) throw new Error('Failed to export JSON');
    return response.blob();
  }

  // Get image URL (for direct image display)
  getImageUrl(type: 'current' | 'flow' | 'confidence' | 'prediction', minutes?: number): string {
    if (type === 'prediction' && minutes) {
      return `${this.baseUrl}/api/images/prediction/${minutes}`;
    }
    return `${this.baseUrl}/api/images/${type}`;
  }

  // Poll prediction status until complete
  async pollPredictionStatus(taskId: string, maxAttempts: number = 60, interval: number = 2000): Promise<any> {
    for (let i = 0; i < maxAttempts; i++) {
      const status = await this.getStatus(taskId);

      if (status.status === 'completed') {
        return status;
      }

      if (status.status === 'error') {
        throw new Error(status.message || 'Prediction failed');
      }

      // Wait before next poll
      await new Promise(resolve => setTimeout(resolve, interval));
    }

    throw new Error('Prediction timeout - took too long');
  }

  // Trigger and wait for prediction to complete
  async triggerAndWaitPrediction(request?: PredictionRequest): Promise<PredictionResult> {
    // Start prediction
    const task = await this.triggerPrediction(request);

    // Poll until complete
    await this.pollPredictionStatus(task.task_id);

    // Get results
    return this.getLatestResults();
  }
}

// Singleton instance
export const rainfallAPI = new RainfallAPI();
