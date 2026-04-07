'use client';

import dynamic from 'next/dynamic';

const PlaygroundContent = dynamic(
  () => import('./playground-content'),
  { ssr: false }
);

export default function Home() {
  return <PlaygroundContent />;
}
