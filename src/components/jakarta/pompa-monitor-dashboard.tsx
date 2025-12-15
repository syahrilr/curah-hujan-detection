'use client';

import { useEffect, useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  CloudRain, Droplets, MapPin, RefreshCw,
  Database, Loader2, DownloadCloud, LayoutGrid,
  LayoutList, TrendingUp, Settings, Play, Square,
  Search, AlertTriangle, Waves, Activity, ArrowRightLeft, Clock,
  LineChart as LineChartIcon, X, Calendar, Maximize2, ChevronDown
} from 'lucide-react';
import { format, isValid } from 'date-fns';
import { id } from 'date-fns/locale';
import {
  ComposedChart, Line, Area, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ReferenceLine
} from 'recharts';

// --- INTERFACES ---
interface MetricData {
  val: number;
  status: string;
  source: string;
  distance: number;
  updated_at: string;
  updated_at_str?: string;
  sensor_time?: string | null;
}

interface PompaData {
  id: string;
  nama_lokasi: string;
  lokasi_lat: number;
  lokasi_lng: number;
  ch?: MetricData;
  tma?: MetricData;
}

interface CronStatus {
  name: string;
  status: 'running' | 'stopped';
  lastRun: string | null;
  schedule: string;
}

// --- HELPER FUNCTIONS ---
const getStatusColor = (status: string = '') => {
  const s = status.toLowerCase();
  if (s.includes('siaga 1')) return 'border-red-500 bg-red-50 text-red-700';
  if (s.includes('siaga 2')) return 'border-orange-500 bg-orange-50 text-orange-700';
  if (s.includes('siaga 3')) return 'border-yellow-500 bg-yellow-50 text-yellow-700';
  return 'border-green-500 bg-white';
};

const getBadgeVariant = (status: string = '') => {
  const s = status.toLowerCase();
  if (s.includes('siaga 1')) return 'destructive';
  if (s.includes('siaga 2')) return 'default'; // Orange/Amber usually custom
  if (s.includes('siaga 3')) return 'secondary'; // Yellow
  return 'outline'; // Normal
};

const fmtDate = (d?: string | null, formatStr = "dd MMM HH:mm") => {
  if (!d) return '-';
  try { const date = new Date(d); return isValid(date) ? format(date, formatStr, { locale: id }) : d; } catch { return '-'; }
};

// --- SUB-COMPONENT: HISTORY MODAL (PREMIUM UI) ---
function HistoryModal({ lokasi, onClose }: { lokasi: PompaData, onClose: () => void }) {
  const [historyData, setHistoryData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    const fetchHistory = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/dsda/pompa/history?lokasi=${encodeURIComponent(lokasi.nama_lokasi)}&tanggal=${date}`);
        const json = await res.json();
        if (json.success) {
          // Mapping data dari API History yang baru
          const mapped = json.data.tma.map((item: any) => ({
              time: format(new Date(item.waktu), 'HH:mm'), // Jam untuk X-Axis
              fullDate: item.waktu,
              tma: item.tma_value,
              status: item.status,
              source: item.sensor_sumber
          }));
          setHistoryData(mapped);
        }
      } catch (e) { console.error(e); } finally { setLoading(false); }
    };
    fetchHistory();
  }, [lokasi, date]);

  // Statistik untuk Header Modal
  const maxTMA = historyData.length > 0 ? Math.max(...historyData.map(d => d.tma)) : 0;
  const lastStatus = historyData.length > 0 ? historyData[historyData.length - 1].status : '-';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm animate-in fade-in duration-300">
      <Card className="w-full max-w-5xl max-h-[95vh] flex flex-col shadow-2xl border-none bg-white overflow-hidden">

        {/* 1. MODAL HEADER */}
        <div className="flex flex-row items-center justify-between px-6 py-4 border-b bg-slate-50/50 shrink-0">
          <div>
            <div className="flex items-center gap-2 text-blue-600 mb-1">
              <Activity className="h-4 w-4" />
              <span className="text-xs font-bold uppercase tracking-wider">Analisis Detail</span>
            </div>
            <CardTitle className="text-xl text-slate-800">{lokasi.nama_lokasi}</CardTitle>
            <p className="text-xs text-slate-500 font-mono mt-1">{lokasi.lokasi_lat}, {lokasi.lokasi_lng}</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full hover:bg-slate-200"><X className="h-5 w-5 text-slate-500"/></Button>
        </div>

        <div className="overflow-y-auto p-6 space-y-6">

          {/* 2. CONTROLS & SUMMARY */}
          <div className="flex flex-col md:flex-row gap-4 justify-between items-end md:items-center">
            {/* Date Picker */}
            <div className="flex items-center gap-3 bg-white border p-1 pr-3 rounded-lg shadow-sm">
              <div className="bg-blue-50 p-2 rounded-md"><Calendar className="h-4 w-4 text-blue-600"/></div>
              <input type="date" className="text-sm font-medium outline-none text-slate-600" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>

            {/* Quick Stats */}
            {!loading && historyData.length > 0 && (
              <div className="flex gap-4">
                <div className="text-right">
                  <p className="text-[10px] text-slate-400 uppercase font-bold">TMA Tertinggi</p>
                  <p className="text-xl font-bold text-slate-800">{maxTMA} <span className="text-sm font-normal text-slate-400">cm</span></p>
                </div>
                <div className="w-px bg-slate-200 h-8 self-center"></div>
                <div className="text-right">
                  <p className="text-[10px] text-slate-400 uppercase font-bold">Status Terakhir</p>
                  <Badge variant={getBadgeVariant(lastStatus)}>{lastStatus}</Badge>
                </div>
              </div>
            )}
          </div>

          {/* 3. MAIN CHART */}
          <Card className="border shadow-sm overflow-hidden">
            <CardContent className="p-0">
              {loading ? <Skeleton className="h-[350px] w-full" /> : historyData.length > 0 ? (
                <div className="h-[350px] w-full bg-gradient-to-b from-white to-slate-50/50 pt-6 pr-6">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={historyData}>
                      <defs>
                        <linearGradient id="colorTmaHistory" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis dataKey="time" tick={{fontSize:10, fill:'#94a3b8'}} minTickGap={30} axisLine={false} tickLine={false} dy={10} />
                      <YAxis label={{value:'TMA (cm)', angle:-90, position:'insideLeft', fill:'#94a3b8', fontSize:10}} tick={{fontSize:10, fill:'#64748b'}} axisLine={false} tickLine={false} />
                      <Tooltip
                        contentStyle={{borderRadius:'12px', border:'none', boxShadow:'0 10px 15px -3px rgb(0 0 0 / 0.1)'}}
                        labelStyle={{color:'#64748b', marginBottom:'4px', fontSize:'12px'}}
                        itemStyle={{fontWeight:'bold', color:'#1e293b'}}
                        formatter={(value:any) => [`${value} cm`, 'Tinggi Muka Air']}
                        labelFormatter={(l) => `Pukul ${l}`}
                      />
                      <Area type="monotone" dataKey="tma" stroke="#3b82f6" strokeWidth={3} fill="url(#colorTmaHistory)" activeDot={{r: 6, strokeWidth: 0}} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-[350px] flex flex-col items-center justify-center text-slate-400">
                  <Database className="h-12 w-12 mb-2 opacity-20"/>
                  <p>Tidak ada data rekaman pada tanggal ini.</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 4. DATA LOG TABLE */}
          {!loading && historyData.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                <LayoutList className="h-4 w-4 text-slate-400"/> Log Data ({historyData.length})
              </h4>
              <div className="border rounded-lg overflow-hidden bg-white shadow-sm">
                <div className="max-h-[250px] overflow-y-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 text-xs uppercase text-slate-500 font-semibold sticky top-0 z-10 shadow-sm">
                      <tr>
                        <th className="px-4 py-3">Waktu</th>
                        <th className="px-4 py-3 text-center">TMA (cm)</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3 text-right">Sumber Sensor</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {[...historyData].reverse().map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                          <td className="px-4 py-2 font-mono text-xs text-slate-600">{fmtDate(item.fullDate, "HH:mm:ss")}</td>
                          <td className="px-4 py-2 text-center font-bold text-slate-800">{item.tma}</td>
                          <td className="px-4 py-2"><Badge variant={getBadgeVariant(item.status)} className="h-5 text-[10px]">{item.status}</Badge></td>
                          <td className="px-4 py-2 text-right text-xs text-slate-400 truncate max-w-[200px]">{item.source}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

// --- MAIN DASHBOARD COMPONENT ---
export default function PompaMonitorDashboard() {
  const [data, setData] = useState<PompaData[]>([]);
  const [cronList, setCronList] = useState<CronStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLokasi, setSelectedLokasi] = useState<PompaData | null>(null);

  // ... (Sisa fungsi Fetch, Sync, Chart Data, dll SAMA SEPERTI SEBELUMNYA) ...
  // ... Paste bagian Logic Fetching & Chart Data dari kode sebelumnya di sini ...

  const fetchData = async () => {
    try {
      const res = await fetch('/api/dsda/pompa/dashboard');
      const json = await res.json();
      if (json.success) setData(json.data);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const fetchCron = async () => {
    try {
      const res = await fetch('/api/dsda/cron/control');
      const json = await res.json();
      if (json.success) setCronList(json.data);
    } catch (e) { console.error(e); }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch('/api/dsda/sync-pompa-dsda');
      const json = await res.json();
      if (json.success) { await fetchData(); await fetchCron(); }
      else alert("Gagal sync.");
    } catch (e) { alert("Error koneksi."); } finally { setSyncing(false); }
  };

  const handleCron = async (name: string, action: 'start' | 'stop') => {
    await fetch('/api/dsda/cron/control', { method: 'POST', body: JSON.stringify({ name, action }) });
    fetchCron();
  };

  useEffect(() => { fetchData(); fetchCron(); }, []);

  const stats = useMemo(() => {
    const total = data.length;
    const alertCount = data.filter(d => d.tma?.status.toLowerCase().includes('siaga')).length;
    const maxCH = Math.max(...data.map(d => d.ch?.val || 0), 0);
    const maxTMA = Math.max(...data.map(d => d.tma?.val || 0), 0);
    return { total, alertCount, maxCH, maxTMA };
  }, [data]);

  const filteredData = useMemo(() => data.filter(i => i.nama_lokasi.toLowerCase().includes(searchTerm.toLowerCase())), [data, searchTerm]);

  const chartData = useMemo(() => [...data].sort((a, b) => (b.tma?.val || 0) - (a.tma?.val || 0)).map(i => ({
    name: i.nama_lokasi.replace('Rumah Pompa ', '').replace('Pintu Air ', ''),
    fullName: i.nama_lokasi,
    ch: i.ch?.val || 0,
    tma: i.tma?.val || 0,
    statusTMA: i.tma?.status
  })), [data]);

  const getCHColor = (v = 0) => v === 0 ? 'text-gray-400' : v < 5 ? 'text-blue-500' : v < 20 ? 'text-amber-500' : 'text-red-600';

  if (loading && !data.length) return <div className="p-8 space-y-4"><Skeleton className="h-10 w-48"/><Skeleton className="h-96 w-full"/></div>;

  return (
    <div className="min-h-screen bg-slate-50/50 space-y-6 p-4 md:p-6 lg:p-8 font-sans">
      {/* RENDER POPUP HISTORY */}
      {selectedLokasi && <HistoryModal lokasi={selectedLokasi} onClose={() => setSelectedLokasi(null)} />}

      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
            <h2 className="text-3xl font-bold flex items-center gap-3 text-slate-800"><Database className="h-6 w-6 text-white bg-blue-600 p-1 rounded" /> Monitoring Rumah Pompa</h2>
            <p className="text-slate-500 mt-1 ml-1">Data real-time TMA & Curah Hujan (Nearest Neighbor)</p>
        </div>
        <div className="flex gap-2">
            <Button onClick={handleSync} disabled={syncing} className="bg-blue-600 hover:bg-blue-700 text-white gap-2">
                {syncing ? <Loader2 className="animate-spin h-4 w-4"/> : <DownloadCloud className="h-4 w-4"/>} Sync
            </Button>
            <Button variant="outline" onClick={() => { fetchData(); fetchCron(); }}><RefreshCw className="h-4 w-4"/></Button>
        </div>
      </div>

      <Tabs defaultValue="dashboard" className="w-full">
        {/* TABS HEADER */}
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-6">
           <TabsList className="bg-white border shadow-sm p-1">
              <TabsTrigger value="dashboard"><Activity className="h-4 w-4 mr-2"/> Dashboard</TabsTrigger>
              <TabsTrigger value="control"><Settings className="h-4 w-4 mr-2"/> Control</TabsTrigger>
           </TabsList>
           <div className="relative w-full sm:w-72">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-slate-400" />
              <input type="text" placeholder="Cari..." className="w-full pl-9 pr-4 py-2 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
           </div>
        </div>

        <TabsContent value="dashboard" className="space-y-6">
          {/* KPI CARDS */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="border-l-4 border-l-blue-500 p-4 shadow-sm bg-white"><div><p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Total Lokasi</p><h3 className="text-2xl font-bold mt-1">{stats.total}</h3></div></Card>
            <Card className="border-l-4 border-l-red-500 p-4 shadow-sm bg-white"><div><p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Siaga</p><h3 className="text-2xl font-bold text-red-600 mt-1">{stats.alertCount}</h3></div></Card>
            <Card className="border-l-4 border-l-cyan-500 p-4 shadow-sm bg-white"><div><p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Max Hujan</p><h3 className="text-2xl font-bold text-cyan-700 mt-1">{stats.maxCH} <span className="text-sm text-slate-400">mm</span></h3></div></Card>
            <Card className="border-l-4 border-l-indigo-500 p-4 shadow-sm bg-white"><div><p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Max TMA</p><h3 className="text-2xl font-bold text-indigo-700 mt-1">{stats.maxTMA} <span className="text-sm text-slate-400">cm</span></h3></div></Card>
          </div>

          {/* MAIN DASHBOARD CHART */}
          {data.length > 0 && (
            <Card className="border-none shadow-sm bg-white">
                <CardHeader className="border-b pb-4"><CardTitle className="text-base flex items-center gap-2"><TrendingUp className="h-4 w-4 text-blue-500"/> Analisis Seluruh Lokasi (TMA)</CardTitle></CardHeader>
                <CardContent className="h-[400px] pt-6">
                    <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={chartData} margin={{top:0, right:10, left:0, bottom:0}}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis dataKey="name" angle={-90} textAnchor="end" height={80} interval={0} tick={{fontSize:9, fill:'#94a3b8'}} axisLine={false} tickLine={false} />
                            <YAxis yAxisId="left" label={{value:'CH', angle:-90, position:'insideLeft', fontSize:10, fill:'#cbd5e1'}} tick={{fill:'#94a3b8', fontSize:10}} axisLine={false} tickLine={false}/>
                            <YAxis yAxisId="right" orientation="right" label={{value:'TMA', angle:90, position:'insideRight', fontSize:10, fill:'#cbd5e1'}} tick={{fill:'#94a3b8', fontSize:10}} axisLine={false} tickLine={false}/>
                            <Tooltip contentStyle={{borderRadius:'8px', border:'none', boxShadow:'0 4px 6px -1px rgb(0 0 0 / 0.1)'}}/>
                            <Bar yAxisId="left" dataKey="ch" name="Curah Hujan" fill="#93c5fd" barSize={12} radius={[2,2,0,0]} />
                            <Area yAxisId="right" type="monotone" dataKey="tma" name="TMA" stroke="#ef4444" strokeWidth={2} fill="#fee2e2" fillOpacity={0.6} />
                        </ComposedChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>
          )}

          {/* VIEW SWITCHER */}
          <div className="flex justify-end gap-1 mb-4">
              <div className="bg-slate-200 p-1 rounded-lg flex">
                <Button size="sm" variant={viewMode==='grid'?'default':'ghost'} onClick={()=>setViewMode('grid')} className="h-7 text-xs rounded-md shadow-sm"><LayoutGrid className="h-3 w-3 mr-1"/> Grid</Button>
                <Button size="sm" variant={viewMode==='table'?'default':'ghost'} onClick={()=>setViewMode('table')} className="h-7 text-xs rounded-md shadow-sm"><LayoutList className="h-3 w-3 mr-1"/> Tabel</Button>
              </div>
          </div>

          {/* VIEW: GRID */}
          {viewMode === 'grid' ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {filteredData.map(p => (
                      <Card key={p.id} className={`hover:shadow-lg transition-all border-l-4 ${getStatusColor(p.tma?.status)} overflow-hidden relative group bg-white`}>
                          <Button size="sm" variant="ghost" className="absolute top-2 right-2 h-8 w-8 p-0 text-slate-300 hover:text-blue-600 hover:bg-blue-50 transition-colors" onClick={() => setSelectedLokasi(p)}><Maximize2 className="h-4 w-4" /></Button>
                          <CardHeader className="pb-3 border-b border-slate-50 bg-slate-50/30">
                              <CardTitle className="text-sm font-bold line-clamp-2 pr-8 text-slate-700 leading-tight" title={p.nama_lokasi}>{p.nama_lokasi}</CardTitle>
                              <p className="text-[10px] text-slate-400 font-mono mt-1">{p.lokasi_lat.toFixed(4)}, {p.lokasi_lng.toFixed(4)}</p>
                          </CardHeader>
                          <CardContent className="p-0">
                              <div className="grid grid-cols-2 divide-x divide-slate-50">
                                  <div className="p-3 text-center flex flex-col justify-center">
                                      <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Hujan</span>
                                      <div className={`text-xl font-bold ${getCHColor(p.ch?.val)}`}>{p.ch?.val ?? 0} <span className="text-[10px] text-slate-400 font-normal">mm</span></div>
                                      <div className="text-[9px] text-slate-400 mt-1 truncate w-full" title={p.ch?.source}>{p.ch?.source}</div>
                                  </div>
                                  <div className="p-3 text-center flex flex-col justify-center bg-slate-50/30">
                                      <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">TMA</span>
                                      <div className="text-xl font-bold text-slate-800">{p.tma?.val ?? 0} <span className="text-[10px] text-slate-400 font-normal">cm</span></div>
                                      <div className="mt-1"><Badge variant={getBadgeVariant(p.tma?.status)} className="h-4 text-[9px] px-1">{p.tma?.status || 'N/A'}</Badge></div>
                                  </div>
                              </div>
                              <div className="bg-slate-50 px-3 py-2 border-t border-slate-100 flex justify-between items-center text-[10px]">
                                <div className="flex items-center gap-1 text-slate-600 font-medium"><Clock className="h-3 w-3 text-slate-400"/> {fmtDate(p.tma?.sensor_time || p.tma?.updated_at_str, "HH:mm")}</div>
                                <div className="text-slate-400">Sync: {fmtDate(p.ch?.updated_at, "HH:mm")}</div>
                              </div>
                          </CardContent>
                      </Card>
                  ))}
              </div>
          ) : (
            /* VIEW: TABLE */
            <div className="border rounded-xl overflow-hidden shadow-sm bg-white">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                      <thead className="bg-slate-50 text-slate-500 uppercase text-xs font-semibold tracking-wider">
                        <tr>
                          <th className="p-4 text-left">Nama Lokasi</th>
                          <th className="p-4 text-center">CH (mm)</th>
                          <th className="p-4 text-left">Sumber CH</th>
                          <th className="p-4 text-center">TMA (cm)</th>
                          <th className="p-4 text-left">Sumber TMA</th>
                          <th className="p-4 text-right">Waktu</th>
                          <th className="p-4 text-center">Detail</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                          {filteredData.map(p => (
                              <tr key={p.id} className="hover:bg-slate-50/80 transition-colors group">
                                  <td className="p-4"><div className="font-semibold text-slate-700">{p.nama_lokasi}</div><div className="text-xs text-slate-400 font-mono mt-0.5">{p.lokasi_lat.toFixed(4)}, {p.lokasi_lng.toFixed(4)}</div></td>
                                  <td className="p-4 text-center"><div className={`font-bold text-base ${getCHColor(p.ch?.val)}`}>{p.ch?.val ?? 0}</div></td>
                                  <td className="p-4 text-xs text-slate-500"><div title={p.ch?.source} className="font-medium text-slate-700 truncate max-w-[150px]">{p.ch?.source}</div><div className="text-[10px] flex items-center gap-1 mt-0.5"><ArrowRightLeft className="h-3 w-3 text-slate-400" /> {p.ch?.distance} km</div></td>
                                  <td className="p-4 text-center"><div className="font-bold text-base text-slate-700">{p.tma?.val ?? 0}</div><div className="mt-1"><Badge variant={getBadgeVariant(p.tma?.status)} className="text-[10px] h-5">{p.tma?.status || 'Normal'}</Badge></div></td>
                                  <td className="p-4 text-xs text-slate-500"><div title={p.tma?.source} className="font-medium text-slate-700 truncate max-w-[150px]">{p.tma?.source}</div><div className="text-[10px] flex items-center gap-1 mt-0.5"><ArrowRightLeft className="h-3 w-3 text-slate-400" /> {p.tma?.distance} km</div></td>
                                  <td className="p-4 text-right text-xs text-slate-500 font-mono align-top"><div className="flex flex-col items-end gap-1"><div className="font-bold text-slate-700 text-sm">{fmtDate(p.tma?.sensor_time || p.tma?.updated_at_str, "dd MMM HH:mm")}</div><div className="text-[10px] text-slate-400 flex items-center gap-1 bg-slate-50 px-1.5 py-0.5 rounded"><RefreshCw className="h-3 w-3"/> Sync: {fmtDate(p.ch?.updated_at, "HH:mm")}</div></div></td>
                                  <td className="p-4 text-center"><Button size="sm" variant="ghost" onClick={() => setSelectedLokasi(p)} className="text-slate-400 hover:text-blue-600 hover:bg-blue-50"><LineChartIcon className="h-4 w-4"/></Button></td>
                              </tr>
                          ))}
                      </tbody>
                  </table>
                </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="control" className="mt-6">
            {/* CRON JOB UI (Tetap sama) */}
            <Card className="shadow-sm border-none bg-white"><CardHeader><CardTitle>Cron Job Manager</CardTitle></CardHeader><CardContent><div className="rounded-xl border overflow-hidden"><table className="w-full text-sm text-left"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="p-4">Name</th><th className="p-4">Schedule</th><th className="p-4">Status</th><th className="p-4">Last Run</th><th className="p-4 text-right">Action</th></tr></thead><tbody className="divide-y divide-slate-100">{cronList.map(job => (<tr key={job.name} className="bg-white"><td className="p-4 font-bold text-slate-700">{job.name}</td><td className="p-4 font-mono text-slate-500 bg-slate-50/50">{job.schedule}</td><td className="p-4"><Badge variant={job.status==='running'?'default':'secondary'}>{job.status}</Badge></td><td className="p-4 text-slate-500">{fmtDate(job.lastRun)}</td><td className="p-4 text-right"><Button size="sm" variant={job.status==='running'?'destructive':'default'} onClick={()=>handleCron(job.name, job.status==='running'?'stop':'start')} className="h-8 w-8 p-0 rounded-full shadow-sm">{job.status==='running'?<Square className="h-3 w-3 fill-current"/>:<Play className="h-3 w-3 fill-current"/>}</Button></td></tr>))}</tbody></table></div></CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
