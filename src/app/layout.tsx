
import "./globals.css";
import 'leaflet/dist/leaflet.css';
import { Inter } from 'next/font/google'
import Navigation from '@/components/navigation'
import { Metadata } from "next";
import { initializeServerStartup } from "@/lib/start-up";

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Rainfall Monitoring System',
  description: 'Real-time rainfall monitoring and alert system',
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
