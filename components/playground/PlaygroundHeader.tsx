'use client';

import { Activity, FileText } from 'lucide-react';

export interface PlaygroundHeaderProps {
  showDocs: boolean;
  onToggleDocs: () => void;
}

export function PlaygroundHeader({ showDocs, onToggleDocs }: PlaygroundHeaderProps) {
  return (
    <header className="mb-8 p-6 sm:p-8 glass-card rounded-3xl">
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-gradient-to-br from-blue-500 to-purple-500 rounded-2xl">
            <Activity className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold gradient-text mb-2 neon-blue">rtmlib-ts Playground</h1>
            <p className="text-slate-400 text-sm sm:text-base">Real-time AI Vision: Object Detection, 2D/3D Pose & Animal Detection</p>
          </div>
        </div>
        <button
          onClick={onToggleDocs}
          className="btn-glow flex items-center gap-2 px-6 py-3 rounded-2xl border border-purple-500/30 bg-gradient-to-r from-purple-500/20 to-blue-500/20 text-slate-100 font-semibold hover:from-purple-500/40 hover:to-blue-500/40 transition-all"
        >
          <FileText className="w-5 h-5" />
          {showDocs ? 'Hide Docs' : 'Quick Docs'}
        </button>
      </div>
    </header>
  );
}
