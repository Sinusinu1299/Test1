import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'Mimi AI',
    short_name: 'Mimi AI',
    description:
      'Your personal cute-voice AI phone assistant with full device command orchestration, Hinglish voice recognition, and Android companion export.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#FAF8F7',
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
