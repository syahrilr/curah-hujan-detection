'use client';

import { useEffect, useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RefreshCw, Droplets, AlertTriangle, MapPin, Activity, LayoutGrid, LayoutList, TrendingUp } from 'lucide-react';
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

interface TMAData {
  _id: string;
  id?: string;
  nama_pos: string;
  elevasi?: number;
  latitude?: number;
  longitude?: number;
  siaga1?: number;
  siaga2?: number;
  siaga3?: number;
  tma: number;
  status: string;
  waktu_tma?: string;
  created_at?: string; // Dari DB kita
  fetched_at?: string; // Dari DB kita
}

const getStatusBadgeStyle = (status: string) => {
  const statusLower = status?.toLowerCase();
  if (statusLower === 'siaga1') return 'bg-red-100 text-red-800 hover:bg-red-100/80 border-red-200';
  if (statusLower === 'siaga2') return 'bg-amber-100 text-amber-800 hover:bg-amber-100/80 border-amber-200';
  if (statusLower === 'siaga3') return 'bg-yellow-100 text-yellow-800 hover:bg-yellow-100/80 border-yellow-200';
  return 'bg-green-100 text-green-800 hover:bg-green-100/80 border-green-200';
};

const safeFormatDate = (dateString: string | null | undefined) => {
  if (!dateString) return '-';
  try {
    const date = new Date(dateString);
    if (!isValid(date)) return dateString;
    return format(date, 'dd MMM yyyy, HH:mm', { locale: id });
  } catch (e) {
    return dateString || '-';
  }
};

export default function TMADashboard() {
  const [data, setData] = useState<TMAData[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  const fetchData = async () => {
    setLoading(true);
    try {
      // UBAH DISINI: Panggil API Database lokal
      const response = await fetch('/api/tma/db');
      const result = await response.json();

      if (result.success) {
        // Data sudah disortir oleh API (nama_pos asc)
        // Kita sort ulang agar Siaga di atas (opsional, bisa dihandle API juga)
        const sortedData = result.data.sort((a: TMAData, b: TMAData) => {
          const statusOrder: { [key: string]: number } = { 'siaga1': 4, 'siaga2': 3, 'siaga3': 2, 'normal': 1 };
          const statusA = statusOrder[a.status?.toLowerCase()] || 0;
          const statusB = statusOrder[b.status?.toLowerCase()] || 0;

          if (statusA !== statusB) return statusB - statusA; // Status lebih tinggi di atas
          return (b.tma || 0) - (a.tma || 0); // TMA lebih tinggi di atas
        });

        setData(sortedData);

        if (result.lastUpdate) {
            setLastUpdate(new Date(result.lastUpdate));
        } else {
            setLastUpdate(new Date());
        }
      }
    } catch (error) {
      console.error('Error fetching TMA data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, []);

  const getStatusVariant = (status: string): "outline" | "secondary" | "default" | "destructive" => {
    const statusLower = status?.toLowerCase();
    if (statusLower === 'siaga1') return 'destructive';
    if (statusLower === 'siaga2') return 'secondary';
    if (statusLower === 'siaga3') return 'secondary';
    return 'outline';
  };

  const stats = useMemo(() => {
    const siaga1Count = data.filter((d: TMAData) => d.status?.toLowerCase() === 'siaga1').length;
    const siaga2Count = data.filter((d: TMAData) => d.status?.toLowerCase() === 'siaga2').length;
    const siaga3Count = data.filter((d: TMAData) => d.status?.toLowerCase() === 'siaga3').length;
    const normalCount = data.filter((d: TMAData) => d.status?.toLowerCase() === 'normal').length;
    return { siaga1: siaga1Count, siaga2: siaga2Count, siaga3: siaga3Count, normal: normalCount };
  }, [data]);

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
            <Droplets className="h-8 w-8 text-blue-600" />
            Tinggi Muka Air (TMA)
          </h2>
          <p className="text-muted-foreground mt-1">
            Menampilkan {data.length} lokasi monitoring TMA
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
        {/* ... (Card Summary sama persis, tidak berubah) ... */}
        <Card className="border-l-4 border-red-500 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Siaga 1</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.siaga1}</div>
            <p className="text-xs text-muted-foreground">Status kritis</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-amber-500 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Siaga 2</CardTitle>
            <AlertTriangle className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{stats.siaga2}</div>
            <p className="text-xs text-muted-foreground">Status waspada</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-yellow-500 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Siaga 3</CardTitle>
            <Droplets className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{stats.siaga3}</div>
            <p className="text-xs text-muted-foreground">Status siaga</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-green-500 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Normal</CardTitle>
            <Activity className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.normal}</div>
            <p className="text-xs text-muted-foreground">Status aman</p>
          </CardContent>
        </Card>
      </div>

      {/* Line Chart Section */}
      <Card className="p-4 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <TrendingUp className="h-5 w-5 text-blue-600" />
            Tren Tinggi Muka Air Per Lokasi
          </CardTitle>
          <CardDescription>
            Menampilkan tinggi muka air (cm) per lokasi.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[350px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
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
                  label={{ value: 'TMA (cm)', angle: -90, position: 'insideLeft', fill: '#374151' }}
                  tick={{ fill: '#6b7280', fontSize: 10 }}
                />
                <Tooltip
                  cursor={{ stroke: '#2563eb', strokeWidth: 1 }}
                  contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', background: '#ffffff' }}
                  labelStyle={{ color: '#111827', fontWeight: 'bold' }}
                  itemStyle={{ color: '#2563eb' }}
                  formatter={(value: number, name: string, props: any) => [`${value} cm`, `${name} (${props.payload.status})`]}
                />
                <Legend wrapperStyle={{ paddingTop: '0px' }} />
                <Line
                  type="monotone"
                  dataKey="tma"
                  name="Tinggi Muka Air"
                  stroke="#2563eb"
                  strokeWidth={3}
                  dot={{ r: 3, fill: '#2563eb' }}
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
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {data.map((item) => (
                <Card key={item._id} className={`shadow-sm transition-all duration-200 hover:shadow-md border-l-4 ${
                    item.status?.toLowerCase() === 'siaga1' ? 'border-red-500' :
                    item.status?.toLowerCase() === 'siaga2' ? 'border-amber-500' :
                    item.status?.toLowerCase() === 'siaga3' ? 'border-yellow-500' :
                    'border-green-500'
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
                    <Badge variant={getStatusVariant(item.status)} className={getStatusBadgeStyle(item.status)}>
                        {item.status}
                    </Badge>
                    </div>
                </CardHeader>
                <CardContent className="space-y-3">
                    <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">TMA Saat Ini</span>
                    <span className="text-2xl font-bold text-foreground">{item.tma} cm</span>
                    </div>

                    <div className="space-y-1.5 bg-muted/30 p-2 rounded text-xs">
                        <div className="flex justify-between">
                            <span>Siaga 1:</span>
                            <span className="font-medium text-red-500">{item.siaga1 || 0}</span>
                        </div>
                        <div className="flex justify-between">
                            <span>Siaga 2:</span>
                            <span className="font-medium text-amber-500">{item.siaga2 || 0}</span>
                        </div>
                        <div className="flex justify-between">
                            <span>Siaga 3:</span>
                            <span className="font-medium text-yellow-500">{item.siaga3 || 0}</span>
                        </div>
                    </div>

                    <p className="pt-2 text-xs text-muted-foreground border-t">
                    {/* Gunakan created_at dari DB, fallback ke fetched_at atau waktu_tma */}
                    Update: {safeFormatDate(item.created_at || item.fetched_at || item.waktu_tma)}
                    </p>
                </CardContent>
                </Card>
            ))}
            </div>
        ) : (
            <div className="rounded-md border bg-card text-card-foreground shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-muted-foreground uppercase bg-muted/50">
                            <tr>
                                <th className="px-6 py-3">Nama Pintu Air</th>
                                <th className="px-6 py-3 text-right">TMA (cm)</th>
                                <th className="px-6 py-3">Status</th>
                                <th className="px-6 py-3 text-right">S1 / S2 / S3</th>
                                <th className="px-6 py-3">Waktu Update</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.map((item) => (
                                <tr key={item._id} className="border-b last:border-b-0 hover:bg-muted/30 transition-colors">
                                    <td className="px-6 py-4 font-medium">
                                        {item.nama_pos}
                                        <div className="text-xs text-muted-foreground mt-1">
                                            {item.latitude?.toFixed(4)}, {item.longitude?.toFixed(4)}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-right font-bold text-base">{item.tma}</td>
                                    <td className="px-6 py-4">
                                        <Badge variant={getStatusVariant(item.status)} className={getStatusBadgeStyle(item.status)}>
                                            {item.status}
                                        </Badge>
                                    </td>
                                    <td className="px-6 py-4 text-right text-xs text-muted-foreground font-mono">
                                        <span className="text-red-500">{item.siaga1 || 0}</span> /
                                        <span className="text-amber-500"> {item.siaga2 || 0}</span> /
                                        <span className="text-yellow-500"> {item.siaga3 || 0}</span>
                                    </td>
                                    <td className="px-6 py-4 text-muted-foreground">
                                        {safeFormatDate(item.created_at || item.fetched_at || item.waktu_tma)}
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
