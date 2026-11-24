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
  title: 'Mimi AI — Voice Phone Assistant',
  description:
    'Your personal cute-voice AI phone assistant with full device command orchestration, Hinglish voice recognition, and Android companion export.',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Mimi AI',
  },
  icons: {
    icon: '/icon.svg',
    apple: '/apple-touch-icon.png',
  },
  openGraph: {
    title: 'Mimi AI — Voice Phone Assistant',
    description:
      'Your personal cute-voice AI phone assistant with full device command orchestration, Hinglish voice recognition, and Android companion export.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Mimi AI — Voice Phone Assistant',
    description:
      'Your personal cute-voice AI phone assistant with full device command orchestration, Hinglish voice recognition, and Android companion export.',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${plusJakarta.variable} ${dmSans.variable} ${jetbrainsMono.variable}`}
    >
      <body suppressHydrationWarning className="min-h-screen antialiased selection:bg-rose-100 selection:text-rose-900">
        {children}
      </body>
    </html>
  );
}
