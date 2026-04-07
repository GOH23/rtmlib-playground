'use client';

import { Layers, Trash2 } from 'lucide-react';
import type { CacheInfo } from './types';

export interface PlaygroundCacheProps {
  cacheInfo: CacheInfo;
  onClear: () => void;
}

export function PlaygroundCache({ cacheInfo, onClear }: PlaygroundCacheProps) {
  return (
    <div className="flex justify-between items-center p-5 glass-card rounded-2xl mb-6">
      <div className="flex items-center gap-3 text-slate-400">
        <Layers className="w-5 h-5" />
        <span>Cache:</span>
        <span className="text-green-400 font-bold">{cacheInfo.size}</span>
        <span className="text-slate-500 text-sm">({cacheInfo.cached} models)</span>
      </div>
      <button
        onClick={onClear}
        className="flex items-center gap-2 px-5 py-2 rounded-xl border border-red-500/30 bg-red-500/20 text-red-400 font-semibold hover:bg-red-500/30 transition-all"
      >
        <Trash2 className="w-4 h-4" /> Clear
      </button>
    </div>
  );
}
