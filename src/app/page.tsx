import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Map,
  Activity,
  History,
  ArrowRight,
  Zap,
  Bell,
  Database,
  Clock
} from 'lucide-react'

export default function HomePage() {
  const features = [
    {
      icon: Map,
      title: 'Interactive Radar Map',
      description: 'Real-time BMKG radar overlay with rainfall intensity visualization',
      href: '/radar',
      badge: 'Real-time',
    },
    {
      icon: Activity,
      title: 'Auto Monitoring',
      description: 'Automatic rainfall detection at pump station locations with alerts',
      href: '/monitoring',
      badge: 'Automated',
    },
    {
      icon: History,
      title: 'Historical Data',
      description: 'Browse and analyze past rainfall records with filtering options',
      href: '/history',
      badge: 'Analytics',
    },
  ]

  const stats = [
    { icon: Zap, label: 'Real-time Updates', value: 'Every 5 min' },
    { icon: Bell, label: 'Alert System', value: 'Auto' },
    { icon: Database, label: 'Data Tracking', value: 'Multi-location' },
    { icon: Clock, label: 'Monitoring', value: '24/7' },
  ]

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-background to-blue-50 dark:from-blue-950 dark:via-background dark:to-blue-950" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 md:py-32">
          <div className="text-center space-y-8">
            <Badge variant="secondary" className="gap-2">
              <Zap className="h-3 w-3" />
              Powered by BMKG Radar Data
            </Badge>

            <h1 className="text-5xl md:text-7xl font-bold tracking-tight">
              <span className="bg-gradient-to-r from-blue-600 to-blue-400 bg-clip-text text-transparent">
                Rainfall Monitoring
              </span>
              <br />
              <span className="text-foreground">System</span>
            </h1>

            <p className="text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
              Real-time rainfall monitoring and alert system for pump station management.
              Automatic detection with notifications powered by BMKG radar integration.
            </p>

            <div className="flex flex-wrap gap-4 justify-center">
              <Button asChild size="lg" className="gap-2">
                <Link href="/radar">
                  <Map className="h-5 w-5" />
                  Open Radar Map
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="gap-2">
                <Link href="/monitoring">
                  <Activity className="h-5 w-5" />
                  Start Monitoring
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold tracking-tight">System Features</h2>
          <p className="text-muted-foreground mt-2">
            Comprehensive tools for rainfall monitoring and analysis
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {features.map((feature) => {
            const Icon = feature.icon
            return (
              <Card
                key={feature.href}
                className="group hover:shadow-lg transition-all border-2 hover:border-primary"
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <Icon className="h-6 w-6 text-primary" />
                    </div>
                    <Badge variant="secondary">{feature.badge}</Badge>
                  </div>
                  <CardTitle className="mt-4">{feature.title}</CardTitle>
                  <CardDescription>{feature.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button asChild variant="ghost" className="gap-2 group-hover:gap-4 transition-all">
                    <Link href={feature.href}>
                      Open Feature
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </section>

      {/* Stats Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-3xl">System Capabilities</CardTitle>
            <CardDescription>
              Built for reliability and real-time performance
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6 md:grid-cols-4">
              {stats.map((stat, index) => {
                const Icon = stat.icon
                return (
                  <div key={index} className="text-center space-y-2">
                    <div className="flex justify-center">
                      <div className="p-3 bg-primary/10 rounded-full">
                        <Icon className="h-6 w-6 text-primary" />
                      </div>
                    </div>
                    <div className="text-2xl font-bold">{stat.value}</div>
                    <div className="text-sm text-muted-foreground">{stat.label}</div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Info Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5 text-primary" />
                Data Source
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>• BMKG Radar Jakarta (JAK)</p>
              <p>• Updates every 5 minutes</p>
              <p>• Marshall-Palmer Z-R relationship</p>
              <p>• High-resolution radar imagery</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5 text-primary" />
                Alert System
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>• Automatic monitoring every 10 minutes</p>
              <p>• Customizable rainfall thresholds</p>
              <p>• Database logging for all alerts</p>
              <p>• Real-time notification support</p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* CTA Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <Card className="bg-gradient-to-r from-blue-600 to-blue-500 border-0">
          <CardHeader className="text-center text-white">
            <CardTitle className="text-3xl">Ready to Start Monitoring?</CardTitle>
            <CardDescription className="text-blue-100">
              Get started with real-time rainfall monitoring in minutes
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center gap-4">
            <Button asChild size="lg" variant="secondary" className="gap-2">
              <Link href="/monitoring">
                <Activity className="h-5 w-5" />
                Open Dashboard
              </Link>
            </Button>
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
