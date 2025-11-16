import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Map, Activity, ImageIcon, History, TrendingUp, BarChart3, Brain, Zap, CloudRain, ArrowRight, Database, Bell, Clock, Gauge, RefreshCw } from 'lucide-react'
import { RainAnimation } from '@/components/rain-animation'

export default function HomePage() {
  const features = [
    {
      icon: Map,
      title: 'Interactive Radar Map',
      description: 'Real-time BMKG radar overlay dengan visualisasi intensitas curah hujan. Pantau pola hujan secara langsung di lokasi stasiun pompa Anda.',
      href: '/radar',
      badge: 'Real-time',
      color: 'from-blue-500 to-blue-600',
    },
    {
      icon: Activity,
      title: 'Auto Monitoring',
      description: 'Sistem monitoring otomatis yang mendeteksi curah hujan di lokasi stasiun pompa. Simpan data terbaru dari radar BMKG secara berkala tanpa intervensi manual.',
      href: '/monitoring',
      badge: 'Automated',
      color: 'from-cyan-500 to-blue-500',
    },
    {
      icon: ImageIcon,
      title: 'Radar Image',
      description: 'Tampilkan gambar radar terakhir dengan resolusi tinggi. Analisis visual kondisi cuaca real-time dengan citra radar BMKG Jakarta yang selalu terbaru.',
      href: '/radar-image',
      badge: 'Latest',
      color: 'from-blue-400 to-cyan-400',
    },
    {
      icon: History,
      title: 'History Data',
      description: 'Jelajahi dan analisis riwayat curah hujan lengkap dari semua stasiun pompa. Data historis dari API Open-Meteo dengan filtering dan export options.',
      href: '/history',
      badge: 'Analytics',
      color: 'from-teal-500 to-blue-600',
    },
    {
      icon: TrendingUp,
      title: 'Forecast 16 Hari',
      description: 'Prediksi curah hujan untuk 16 hari ke depan di semua lokasi. Auto forecast berjalan setiap 14 hari sekali untuk memastikan data selalu akurat dan terkini.',
      href: '/forecast',
      badge: 'Predictive',
      color: 'from-sky-500 to-blue-500',
    },
    {
      icon: BarChart3,
      title: 'Data Comparison',
      description: 'Bandingkan data curah hujan dari Open-Meteo dan BMKG secara side-by-side. Identifikasi perbedaan dan validasi akurasi kedua sumber data.',
      href: '/comparison',
      badge: 'Analysis',
      color: 'from-blue-500 to-indigo-600',
    },
    {
      icon: Brain,
      title: 'Rainfall Prediction',
      description: 'Prediksi curah hujan menggunakan Optical Flow algorithm. Teknologi AI untuk forecasting curah hujan jangka pendek dengan akurasi tinggi.',
      href: '/prediction',
      badge: 'AI-Powered',
      color: 'from-indigo-500 to-purple-600',
    },
    {
      icon: Database,
      title: 'Auto History Sync',
      description: 'Sinkronisasi otomatis data historis curah hujan dari berbagai sumber. Sistem background jobs yang mengambil dan menyimpan data history secara konsisten.',
      href: '/auto-history',
      badge: 'Background',
      color: 'from-slate-500 to-blue-600',
    },
  ]

  const stats = [
    { icon: CloudRain, label: 'Real-time Updates', value: 'Every 5 min', desc: 'Data BMKG' },
    { icon: Gauge, label: 'Monitoring', value: '24/7', desc: 'All Locations' },
    { icon: RefreshCw, label: 'Auto Forecast', value: '14 Days', desc: 'Cycle' },
    { icon: Database, label: 'Data Source', value: 'Multi', desc: 'BMKG + OpenMeteo' },
  ]

  return (
    <div className="min-h-screen relative overflow-hidden">
      <RainAnimation />

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-12 pb-20 md:pt-20 md:pb-32">
        <div className="absolute inset-0 -z-10">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-background to-accent/5" />
          <div className="absolute top-0 right-0 w-96 h-96 bg-accent/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center space-y-8">
            <Badge variant="secondary" className="gap-2 justify-center mx-auto">
              <CloudRain className="h-4 w-4 text-primary" />
              Powered by BMKG Radar & OpenMeteo
            </Badge>

            <div className="space-y-4">
              <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-balance">
                <span className="bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
                  Rainfall Monitoring
                </span>
                <br />
                <span className="text-foreground">System</span>
              </h1>

              <p className="text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
                Platform monitoring curah hujan terpadu dengan teknologi real-time BMKG radar, forecasting 16 hari, AI prediction, dan multi-source data comparison untuk manajemen stasiun pompa yang optimal.
              </p>
            </div>

            <div className="flex flex-wrap gap-4 justify-center pt-4">
              <Button asChild size="lg" className="gap-2">
                <Link href="/radar">
                  <Map className="h-5 w-5" />
                  Buka Radar Map
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="gap-2">
                <Link href="/monitoring">
                  <Activity className="h-5 w-5" />
                  Mulai Monitoring
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold tracking-tight text-balance">Fitur Lengkap Monitoring</h2>
          <p className="text-muted-foreground mt-4 text-lg">
            Delapan tools powerful untuk monitoring, forecasting, dan analisis curah hujan
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {features.map((feature) => {
            const Icon = feature.icon
            return (
              <Link key={feature.href} href={feature.href}>
                <Card className="h-full hover:shadow-xl hover:border-primary/50 transition-all duration-300 cursor-pointer group hover:scale-105">
                  <CardHeader>
                    <div className="flex items-start justify-between mb-3">
                      <div className={`p-3 bg-gradient-to-br ${feature.color} rounded-lg`}>
                        <Icon className="h-6 w-6 text-white" />
                      </div>
                      <Badge variant="secondary" className="text-xs">{feature.badge}</Badge>
                    </div>
                    <CardTitle className="text-lg group-hover:text-primary transition-colors">{feature.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CardDescription className="text-sm leading-relaxed mb-4">
                      {feature.description}
                    </CardDescription>
                    <Button variant="ghost" size="sm" className="gap-2 group-hover:gap-3 transition-all">
                      Explore
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>
      </section>

      {/* Stats Section */}
      <section className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <Card className="bg-gradient-to-br from-primary/5 to-accent/5 border-primary/10">
          <CardHeader className="text-center pb-8">
            <CardTitle className="text-3xl">Kapabilitas Sistem</CardTitle>
            <CardDescription className="text-base mt-2">
              Dirancang untuk reliabilitas, performa real-time, dan akurasi data
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-8 md:grid-cols-4">
              {stats.map((stat, index) => {
                const Icon = stat.icon
                return (
                  <div key={index} className="text-center space-y-3">
                    <div className="flex justify-center">
                      <div className="p-4 bg-gradient-to-br from-primary to-accent rounded-full">
                        <Icon className="h-6 w-6 text-white" />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-2xl font-bold text-primary">{stat.value}</div>
                      <div className="text-sm font-semibold text-foreground">{stat.label}</div>
                      <div className="text-xs text-muted-foreground">{stat.desc}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Details Section */}
      <section className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="grid gap-6 md:grid-cols-3">
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CloudRain className="h-5 w-5 text-primary" />
                Data Sources
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <p className="font-semibold text-foreground">BMKG Radar Jakarta</p>
                <p className="text-muted-foreground">Update setiap 5 menit dengan resolusi tinggi</p>
              </div>
              <div>
                <p className="font-semibold text-foreground">Open-Meteo API</p>
                <p className="text-muted-foreground">Historical & forecast data untuk 16 hari</p>
              </div>
              <div>
                <p className="font-semibold text-foreground">Optical Flow Algorithm</p>
                <p className="text-muted-foreground">Prediksi rainfall AI-powered</p>
              </div>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5 text-accent" />
                Alert System
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <p className="font-semibold text-foreground">Monitoring Otomatis</p>
                <p className="text-muted-foreground">Deteksi setiap 10 menit di semua lokasi</p>
              </div>
              <div>
                <p className="font-semibold text-foreground">Custom Thresholds</p>
                <p className="text-muted-foreground">Atur ambang batas per stasiun pompa</p>
              </div>
              <div>
                <p className="font-semibold text-foreground">Data Logging</p>
                <p className="text-muted-foreground">Semua alert dicatat untuk audit trail</p>
              </div>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-blue-500" />
                Auto Features
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <p className="font-semibold text-foreground">Auto Save Monitoring</p>
                <p className="text-muted-foreground">Simpan data BMKG terbaru otomatis</p>
              </div>
              <div>
                <p className="font-semibold text-foreground">Auto Forecast Cycle</p>
                <p className="text-muted-foreground">Update forecast setiap 14 hari</p>
              </div>
              <div>
                <p className="font-semibold text-foreground">Auto History Sync</p>
                <p className="text-muted-foreground">Sinkronisasi background jobs</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <Card className="bg-gradient-to-r from-primary to-accent border-0">
          <CardHeader className="text-center text-primary-foreground">
            <CardTitle className="text-3xl">Siap Memulai?</CardTitle>
            <CardDescription className="text-primary-foreground/80 text-lg mt-2">
              Mulai monitoring curah hujan real-time untuk stasiun pompa Anda sekarang
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-4 justify-center">
            <Button asChild size="lg" variant="secondary" className="gap-2">
              <Link href="/monitoring">
                <Activity className="h-5 w-5" />
                Dashboard Monitoring
              </Link>
            </Button>
            <Button asChild size="lg" variant="secondary" className="gap-2">
              <Link href="/forecast">
                <TrendingUp className="h-5 w-5" />
                Lihat Forecast
              </Link>
            </Button>
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
