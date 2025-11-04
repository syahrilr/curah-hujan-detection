export interface LocationInfo {
  name: string;
  lat: number;
  lng: number;
}

export interface RainfallData {
  name: string;
  lat: number;
  lng: number;
  dbz: number;
  rain_rate: number;
  intensity: 'No Rain' | 'Light Rain' | 'Moderate Rain' | 'Heavy Rain' | 'Very Heavy Rain';
  pixel_x: number;
  pixel_y: number;
  valid_samples: number;
  confidence: number;
}

export interface PredictionStats {
  with_rain: number;
  max_rain_rate: number;
  avg_rain_rate: number;
  avg_confidence?: number;
}

export interface FlowStats {
  mean_magnitude: number;
  max_magnitude: number;
  mean_confidence: number;
}

export interface PredictionResult {
  timestamp: string;
  datetime_obj?: string;
  radar_station: string;
  frames_used: number;
  avg_frame_interval: number;
  flow_method: string;
  total_locations: number;
  current: RainfallData[];
  predictions: Record<number, RainfallData[]>;
  statistics: Record<string, PredictionStats>;
  flow_stats?: FlowStats;
}

export interface PredictionRequest {
  radar_station?: string;
  prediction_mode?: 'every_10min' | 'every_8min' | 'sparse' | 'custom';
  flow_method?: 'DualTVL1' | 'Farneback';
  save_visualizations?: boolean;
}

export interface PredictionTaskResponse {
  task_id: string;
  status: 'processing' | 'completed' | 'error';
  message: string;
}

export interface RainfallImageData {
  current?: string;
  flow?: string;
  confidence?: string;
  predictions: Record<string, string>;
}
