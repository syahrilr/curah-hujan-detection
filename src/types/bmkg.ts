export interface BMKGRadarResponse {
  changeStatus: string;
  LastOneHour: {
    timeUTC: string[];
    timeLocal: string[];
    file: string[];
  };
  Latest: {
    timeUTC: string;
    timeLocal: string;
    file: string;
  };
  bounds: {
    overlayTLC: [string, string];
    overlayBRC: [string, string];
    _id: string;
    Kota: string;
    Stasiun: string;
    kode: string;
    lat: number;
    lon: number;
    __v: number;
  };
  legends: {
    levels: number[];
    colors: string[];
    units: string;
  };
}

export interface RadarConfig {
  code: string;
  name: string;
  token: string;
}
