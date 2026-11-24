import type { Metadata, Viewport } from 'next';
import { Plus_Jakarta_Sans, DM_Sans, JetBrains_Mono } from 'next/font/google';
import './globals.css';

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '600', '700'],
  variable: '--font-plus-jakarta',
});

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-dm-sans',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-jetbrains-mono',
});

export const viewport: Viewport = {
  themeColor: '#E11D48',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export const metadata: Metadata = {
  title: 'Jassi AI — Voice Phone Companion',
  description:
    'Your personal glamorous-voice AI phone companion (Jassi) with A-to-Z phone control, custom name calling, Hinglish voice recognition, and Android companion export.',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Jassi AI',
  },
  icons: {
    icon: '/pwa-192x192.png',
    apple: '/apple-touch-icon.png',
  },
  openGraph: {
    title: 'Jassi AI — Voice Phone Companion',
    description:
      'Your personal glamorous-voice AI phone companion (Jassi) with A-to-Z phone control, custom name calling, Hinglish voice recognition, and Android companion export.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Jassi AI — Voice Phone Companion',
    description:
      'Your personal glamorous-voice AI phone companion (Jassi) with A-to-Z phone control, custom name calling, Hinglish voice recognition, and Android companion export.',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`dark ${plusJakarta.variable} ${dmSans.variable} ${jetbrainsMono.variable}`}
    >
      <body
        suppressHydrationWarning
        className="min-h-screen bg-[#FAF8F7] text-stone-900 antialiased selection:bg-rose-100 selection:text-rose-900 dark:bg-[#09090B] dark:text-zinc-100 dark:selection:bg-rose-900/50 dark:selection:text-rose-100"
      >
        {children}
      </body>
    </html>
  );
}
