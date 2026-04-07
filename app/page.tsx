'use client';

import dynamic from 'next/dynamic';

const PlaygroundContent = dynamic(
  () => import('./playground-content'),
  { ssr: false, loading: () => <LoadingScreen /> }
);

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
      <div className="text-center p-8 bg-white/5 backdrop-blur-xl rounded-3xl border border-white/10">
        <div className="w-16 h-16 mx-auto mb-6 border-4 border-blue-400 border-t-transparent rounded-full animate-spin" />
        <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent mb-2">
          Loading Playground...
        </h2>
        <p className="text-slate-400">Initializing AI models</p>
      </div>
    </div>
  );
}

export default function Home() {
  return <PlaygroundContent />;
}
