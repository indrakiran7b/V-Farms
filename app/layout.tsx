import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import './globals.css'
import './admin/admin.css'

const siteUrl = 'https://v-farms-website-development.vercel.app'

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'V-Farms | Private Farm Stay Near Medchal, Telangana',
    template: '%s | V-Farms',
  },
  description: 'Discover V-Farms near Medchal, Telangana, for a private farm getaway, relaxing stays, and memorable gatherings. Contact us at +91 99086 27778 for bookings and enquiries.',
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    url: siteUrl,
    siteName: 'V-Farms',
    title: 'V-Farms | Private Farm Stay Near Medchal, Telangana',
    description: 'A private farm stay and event venue near Medchal and Hyderabad, Telangana.',
    locale: 'en_IN',
    images: [{
      url: `${siteUrl}/images/v-farms-logo-white.png`,
      width: 1200,
      height: 1200,
      alt: 'V-Farms private farm stay near Medchal, Telangana',
    }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'V-Farms | Private Farm Stay Near Medchal, Telangana',
    description: 'A private farm getaway and gathering place near Medchal and Hyderabad.',
    images: [`${siteUrl}/images/v-farms-logo-white.png`],
  },
  generator: 'V-Farms',
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
        url: '/images/v-farms-logo-white.png',
        type: 'image/png',
        sizes: '1200x1200',
      },
    ],
    apple: '/images/v-farms-logo-white.png',
  },
}

export const viewport: Viewport = {
  colorScheme: 'light dark',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: 'white' },
    { media: '(prefers-color-scheme: dark)', color: 'black' },
  ],
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
