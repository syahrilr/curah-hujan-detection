import { BMKGRadarResponse } from '@/types/bmkg';

export class BMKGRadarAPI {
  private baseUrl = 'https://radar.bmkg.go.id:8090/sidarmaimage';
  private token: string;

  constructor(token: string) {
    this.token = token;
  }

  async getRadarData(radarCode: string): Promise<BMKGRadarResponse> {
    const url = `${this.baseUrl}?token=${this.token}&radar=${radarCode}`;

    try {
      const response = await fetch(url, {
        next: { revalidate: 300 } // Cache for 5 minutes
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch radar data: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching BMKG radar data:', error);
      throw error;
    }
  }

  static dbzToRainfall(dbz: number): number {
    const Z = Math.pow(10, dbz / 10);
    const R = Math.pow(Z / 200, 1 / 1.6);
    return parseFloat(R.toFixed(2));
  }

  static getRainfallCategory(mmPerHour: number): {
    label: string;
    color: string;
  } {
    if (mmPerHour < 1) return { label: 'Sangat Ringan', color: 'blue' };
    if (mmPerHour < 5) return { label: 'Ringan', color: 'cyan' };
    if (mmPerHour < 10) return { label: 'Sedang', color: 'yellow' };
    if (mmPerHour < 20) return { label: 'Lebat', color: 'orange' };
    return { label: 'Sangat Lebat', color: 'red' };
  }
}
