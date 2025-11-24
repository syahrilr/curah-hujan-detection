'use client';

import { useEffect, useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RefreshCw, Cloud, CloudRain, MapPin, LayoutGrid, LayoutList, TrendingUp, Droplets } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { format, isValid } from 'date-fns';
import { id } from 'date-fns/locale';

interface CurahHujanData {
  _id: string;
  id: string;
  nama_pos: string;
  latitude: number;
  longitude: number;
  ch: number;
  status: string;
  waktu_ch: string;
  last_update: string;
  fetched_at: string;
}

// Helper untuk warna custom tanpa melanggar tipe Badge
const getCustomBadgeStyle = (ch: number) => {
  const val = ch || 0;
  if (val === 0) return 'border-gray-400 text-gray-600';
  if (val < 5) return 'bg-blue-100 text-blue-800 hover:bg-blue-100/80 border-blue-200';
  if (val < 10) return 'bg-sky-100 text-sky-800 hover:bg-sky-100/80 border-sky-200';
  if (val < 20) return 'bg-amber-100 text-amber-800 hover:bg-amber-100/80 border-amber-200';
  return 'bg-red-100 text-red-800 hover:bg-red-100/80 border-red-200';
};

// Helper untuk format tanggal aman
const safeFormatDate = (dateString: string | null | undefined) => {
  if (!dateString) return '-';

  try {
    const date = new Date(dateString);
    if (!isValid(date)) {
      return dateString;
    }
    return format(date, 'dd MMM yyyy, HH:mm', { locale: id });
  } catch (e) {
    return dateString || '-';
  }
};

export default function CurahHujanDashboard() {
  const [data, setData] = useState<CurahHujanData[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  const fetchData = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/curah-hujan');
      const result = await response.json();
      if (result.success) {
        const sortedData = result.data.sort((a: CurahHujanData, b: CurahHujanData) => (b.ch || 0) - (a.ch || 0));
        setData(sortedData);
        setLastUpdate(new Date());
      }
    } catch (error) {
      console.error('Error fetching Curah Hujan data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 300000);
    return () => clearInterval(interval);
  }, []);

  const getIntensityVariant = (ch: number): "outline" | "secondary" | "default" | "destructive" => {
    const val = ch || 0;
    if (val === 0) return 'outline';
    return 'secondary';
  };

  const getIntensityLabel = (ch: number) => {
    const val = ch || 0;
    if (val === 0) return 'Tidak Hujan';
    if (val < 5) return 'Hujan Ringan';
    if (val < 10) return 'Hujan Sedang';
    if (val < 20) return 'Hujan Lebat';
    return 'Hujan Sangat Lebat';
  };

  const intensityCounts = useMemo(() => ({
    noRain: data.filter(d => (d.ch || 0) === 0).length,
    light: data.filter(d => (d.ch || 0) > 0 && (d.ch || 0) < 5).length,
    moderate: data.filter(d => (d.ch || 0) >= 5 && (d.ch || 0) < 10).length,
    heavy: data.filter(d => (d.ch || 0) >= 10 && (d.ch || 0) < 20).length,
    veryHeavy: data.filter(d => (d.ch || 0) >= 20).length,
  }), [data]);

  const totalRainfall = useMemo(() => data.reduce((sum, d) => sum + (d.ch || 0), 0), [data]);
  const avgRainfall = useMemo(() => data.length > 0 ? (totalRainfall / data.length).toFixed(2) : '0', [totalRainfall, data.length]);

  if (loading && data.length === 0) {
    return (
      <div className="space-y-6 p-4 md:p-6 lg:p-8">
        <div className="flex justify-between items-center mb-6">
          <Skeleton className="h-10 w-72" />
          <Skeleton className="h-10 w-24" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <Skeleton className="h-[350px] w-full mb-6" />
        <Skeleton className="h-10 w-48 mb-4" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6 lg:p-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <CloudRain className="h-8 w-8 text-blue-600" />
            Curah Hujan
          </h2>
          <p className="text-muted-foreground mt-1">
            Menampilkan {data.length} lokasi monitoring curah hujan
          </p>
        </div>
        <div className="flex items-center gap-2">
            <div className="bg-secondary rounded-lg p-1 flex gap-1">
                <Button
                    variant={viewMode === 'grid' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setViewMode('grid')}
                    className="h-8 px-2"
                >
                    <LayoutGrid className="h-4 w-4 mr-1" /> Grid
                </Button>
                <Button
                    variant={viewMode === 'table' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setViewMode('table')}
                    className="h-8 px-2"
                >
                    <LayoutList className="h-4 w-4 mr-1" /> Tabel
                </Button>
            </div>
            <Button onClick={fetchData} disabled={loading} variant="outline" size="sm" className="gap-2 h-10">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
            </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Lokasi</CardTitle>
            <MapPin className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.length}</div>
            <p className="text-xs text-muted-foreground">Pos monitoring</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Rata-rata CH</CardTitle>
            <Cloud className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{avgRainfall} mm</div>
            <p className="text-xs text-muted-foreground">Per lokasi</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-amber-500 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Hujan Lebat</CardTitle>
            <Droplets className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{intensityCounts.heavy + intensityCounts.veryHeavy}</div>
            <p className="text-xs text-muted-foreground">≥ 10 mm</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-gray-400 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tidak Hujan</CardTitle>
            <Cloud className="h-4 w-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-600">{intensityCounts.noRain}</div>
            <p className="text-xs text-muted-foreground">0 mm</p>
          </CardContent>
        </Card>
      </div>

      {/* Line Chart Section - FULL WIDTH (No Scroll) */}
      <Card className="p-4 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <TrendingUp className="h-5 w-5 text-blue-600" />
            Tren Curah Hujan Per Lokasi
          </CardTitle>
          <CardDescription>
            Menampilkan curah hujan tertinggi per lokasi.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Removed overflow-x-auto and fixed width calculation */}
          <div className="h-[350px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={data}
                margin={{ top: 10, right: 10, left: 0, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-muted" />
                <XAxis
                  dataKey="nama_pos"
                  interval={0}
                  angle={-45}
                  textAnchor="end"
                  height={100}
                  tick={{ fill: '#6b7280', fontSize: 10 }}
                />
                <YAxis
                  label={{ value: 'Curah Hujan (mm)', angle: -90, position: 'insideLeft', fill: '#374151' }}
                  tick={{ fill: '#6b7280', fontSize: 10 }}
                />
                <Tooltip
                  cursor={{ stroke: '#0ea5e9', strokeWidth: 1 }}
                  contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', background: '#ffffff' }}
                  labelStyle={{ color: '#111827', fontWeight: 'bold' }}
                  itemStyle={{ color: '#0ea5e9' }}
                  formatter={(value: number, name: string, props: any) => [`${value} mm`, name]}
                />
                <Legend wrapperStyle={{ paddingTop: '0px' }} />
                <Line
                  type="monotone"
                  dataKey="ch"
                  name="Curah Hujan"
                  stroke="#0ea5e9"
                  strokeWidth={3}
                  dot={{ r: 3, fill: '#0ea5e9' }}
                  activeDot={{ r: 6 }}
                  connectNulls={true}
                  isAnimationActive={true}
                  animationDuration={500}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Data Display Switcher */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
            <h3 className="text-xl font-semibold">Detail Data ({data.length})</h3>
        </div>

        {viewMode === 'grid' ? (
            /* Grid View */
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {data.map((item) => (
                <Card key={item._id} className={`shadow-sm transition-all duration-200 hover:shadow-md border-l-4 ${
                  (item.ch || 0) === 0 ? 'border-gray-400' :
                  (item.ch || 0) < 5 ? 'border-blue-400' :
                  (item.ch || 0) < 10 ? 'border-sky-500' :
                  (item.ch || 0) < 20 ? 'border-amber-500' :
                  'border-red-500'
                }`}>
                <CardHeader className="pb-2">
                    <div className="flex justify-between items-start">
                    <div className="flex-1">
                        <CardTitle className="text-lg line-clamp-1" title={item.nama_pos}>
                        {item.nama_pos}
                        </CardTitle>
                        <CardDescription className="flex items-center mt-1 text-xs">
                        <MapPin className="h-3 w-3 mr-1 text-muted-foreground" />
                        {item.latitude?.toFixed(4)}, {item.longitude?.toFixed(4)}
                        </CardDescription>
                    </div>
                    <Badge variant={getIntensityVariant(item.ch)} className={getCustomBadgeStyle(item.ch)}>
                        {getIntensityLabel(item.ch)}
                    </Badge>
                    </div>
                </CardHeader>
                <CardContent className="space-y-3">
                    <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Curah Hujan</span>
                    <div className="text-right">
                        <span className="text-2xl font-bold text-foreground">{item.ch || 0}</span>
                        <span className="text-sm text-muted-foreground ml-1">mm</span>
                    </div>
                    </div>

                    <div className="w-full bg-secondary rounded-full h-2">
                      <div
                          className={`h-2 rounded-full transition-all duration-300 ${
                          (item.ch || 0) === 0 ? 'bg-gray-300' :
                          (item.ch || 0) < 5 ? 'bg-blue-400' :
                          (item.ch || 0) < 10 ? 'bg-sky-500' :
                          (item.ch || 0) < 20 ? 'bg-amber-500' :
                          'bg-red-500'
                          }`}
                          style={{ width: `${Math.min(((item.ch || 0) / 50) * 100, 100)}%` }}
                      ></div>
                    </div>

                    <p className="pt-2 text-xs text-muted-foreground border-t">
                        Update: {safeFormatDate(item.waktu_ch)}
                    </p>
                </CardContent>
                </Card>
            ))}
            </div>
        ) : (
            /* Table View */
            <div className="rounded-md border bg-card text-card-foreground shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-muted-foreground uppercase bg-muted/50">
                            <tr>
                                <th className="px-6 py-3">Nama Pos</th>
                                <th className="px-6 py-3">Lokasi</th>
                                <th className="px-6 py-3 text-right">Curah Hujan (mm)</th>
                                <th className="px-6 py-3">Status</th>
                                <th className="px-6 py-3">Waktu Update</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.map((item) => (
                                <tr key={item._id} className="border-b last:border-b-0 hover:bg-muted/30 transition-colors">
                                    <td className="px-6 py-4 font-medium">{item.nama_pos}</td>
                                    <td className="px-6 py-4 text-muted-foreground">
                                        {item.latitude?.toFixed(4)}, {item.longitude?.toFixed(4)}
                                    </td>
                                    <td className="px-6 py-4 text-right font-bold">{item.ch || 0}</td>
                                    <td className="px-6 py-4">
                                        <Badge variant={getIntensityVariant(item.ch)} className={getCustomBadgeStyle(item.ch)}>
                                            {getIntensityLabel(item.ch)}
                                        </Badge>
                                    </td>
                                    <td className="px-6 py-4 text-muted-foreground">
                                        {safeFormatDate(item.waktu_ch)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        )}
      </div>

      {lastUpdate && (
        <p className="text-sm text-muted-foreground text-center mt-8">
          Terakhir diperbarui: {safeFormatDate(lastUpdate.toISOString())}
        </p>
      )}
    </div>
  );
}
