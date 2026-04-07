'use client';

import { Activity, Box } from 'lucide-react';
import { getBboxValue } from './utils';
import type { Detection, DetectionMode } from './types';

export interface PlaygroundResultsProps {
  detections: Detection[];
  mode: DetectionMode;
}

export function PlaygroundResults({ detections, mode }: PlaygroundResultsProps) {
  if (detections.length === 0) return null;

  return (
    <div className="p-6 glass-card rounded-3xl">
      <h3 className="text-xl font-bold gradient-text mb-5 flex items-center gap-3">
        <Activity className="w-6 h-6" /> Detection Results
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {detections.map((det, idx) => (
          <div key={idx} className="p-5 bg-slate-900/60 rounded-2xl border border-blue-500/20 hover:border-blue-500/40 transition-all glass-card-hover">
            <div className="flex justify-between items-center mb-2">
              <span className="font-bold text-slate-100">{(det as any).className || 'Person'} #{idx + 1}</span>
              <span className="text-green-400 font-bold bg-green-400/15 px-3 py-1 rounded-lg">{(((det as any).bbox?.confidence || 0) * 100).toFixed(1)}%</span>
            </div>
            <div className="text-slate-500 font-mono text-sm">
              [{getBboxValue(det, 'x1')}, {getBboxValue(det, 'y1')}, {getBboxValue(det, 'x2')}, {getBboxValue(det, 'y2')}]
            </div>
            {mode === 'pose3d' && (det as any).keypoints3d && (
              <div className="mt-3 p-3 bg-blue-500/15 rounded-xl text-blue-400 font-mono text-sm flex items-center gap-2">
                <Box className="w-4 h-4" />
                3D: [{(det as any).keypoints3d[0][0].toFixed(3)}, {(det as any).keypoints3d[0][1].toFixed(3)}, {(det as any).keypoints3d[0][2].toFixed(3)}]m
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
