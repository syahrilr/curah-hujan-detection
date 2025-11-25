// src/types/rainfall.ts

export interface Bounds {
  sw: number[]; // [lat, lng]
  ne: number[]; // [lat, lng]
}

export interface RainfallData {
  name: string;
  lat: number;
  lng: number;
  rain_rate: number;
  intensity: string;
  dbz: number;
  confidence: number;
  pixel_x: number;
  pixel_y: number;
}

export interface Statistics {
  with_rain: number;
  max_rain_rate: number;
  avg_rain_rate: number;
  avg_confidence?: number;
}

export interface PredictionResult {
  timestamp: string;
  bounds: Bounds;
  current: RainfallData[];
  predictions: {
    [key: number]: RainfallData[];
  };
  statistics: {
    current: Statistics;
    [key: string]: Statistics;
  };
}

// --- TAMBAHAN BARU UNTUK MEMPERBAIKI ERROR ---

export interface LocationInfo {
  name: string;
  lat: number;
  lng: number;
}

export interface PredictionRequest {
  num_frames?: number;
  save_visualizations?: boolean;
}

export interface PredictionTaskResponse {
  task_id: string;
  status: string;
  message: string;
}

export interface RainfallImageData {
  current?: string;
  flow?: string;
  confidence?: string;
  predictions?: Record<string, string>;
}
