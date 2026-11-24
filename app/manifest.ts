import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'Jassi AI',
    short_name: 'Jassi AI',
    description:
      'Your personal glamorous-voice AI phone companion (Jassi) with A-to-Z phone control, custom name calling, Hinglish voice recognition, and Android companion export.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#09090B',
    theme_color: '#E11D48',
    icons: [
      {
        src: '/pwa-192x192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa-maskable-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
