
import "./globals.css";
import 'leaflet/dist/leaflet.css';
import { Inter } from 'next/font/google'
import Navigation from '@/components/navigation'
import { Metadata } from "next";
import { initializeServerStartup } from "@/lib/start-up";

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Rainfall Monitoring System | BMKG Radar & OpenMeteo Integration',
  description: 'Platform monitoring curah hujan real-time dengan radar BMKG, forecasting 16 hari, AI prediction, dan multi-source data comparison untuk manajemen stasiun pompa.',
  generator: 'v0.app',
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon.png',
  },
}

if (typeof window === 'undefined') {
  initializeServerStartup();
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <Navigation />
        {children}
      </body>
    </html>
  )
}
