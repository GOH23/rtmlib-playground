'use client';

import { Target, Clock, Zap, User, Box, PawPrint, CheckCircle2, Play, Square } from 'lucide-react';
import type { DetectionStats, DetectionMode, AnimalPoseModel } from './types';
import { VITPOSE_MODELS } from 'rtmlib-ts';

export interface PlaygroundStatsProps {
  stats: DetectionStats | null;
  mode: DetectionMode;
  animalPoseModel: AnimalPoseModel;
  isPlaying: boolean;
  hasVideo: boolean;
  modelLoaded: boolean;
}

export function PlaygroundStats({ stats, mode, animalPoseModel, isPlaying, hasVideo, modelLoaded }: PlaygroundStatsProps) {
  return (
    <>
      {/* Status badges */}
      <div className="flex flex-wrap gap-3 mb-6">
        {hasVideo && (
          <div className={`badge ${isPlaying ? 'badge-green' : 'badge-purple'}`}>
            {isPlaying ? <Play className="w-4 h-4" /> : <Square className="w-4 h-4" />}
            {isPlaying ? 'Playing' : 'Paused'}
          </div>
        )}
        {mode === 'pose3d' && (
          <div className="badge badge-blue">
            <Box className="w-4 h-4" /> 3D Mode: Z in meters
          </div>
        )}
        {mode === 'animal' && (
          <div className="badge badge-blue">
            <PawPrint className="w-4 h-4" /> {VITPOSE_MODELS[animalPoseModel]?.name} ({VITPOSE_MODELS[animalPoseModel]?.ap} AP)
          </div>
        )}
        {modelLoaded && (
          <div className="badge badge-green">
            <CheckCircle2 className="w-4 h-4" /> Ready
          </div>
        )}
      </div>

      {/* Stats grid */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <div className="p-6 glass-card rounded-2xl text-center glass-card-hover">
            <Target className="w-10 h-10 mx-auto mb-2 text-green-400" />
            <div className="text-4xl font-extrabold gradient-text-green mb-2">{stats.count}</div>
            <div className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Detections</div>
          </div>
          <div className="p-6 glass-card rounded-2xl text-center glass-card-hover">
            <Clock className="w-10 h-10 mx-auto mb-2 text-green-400" />
            <div className="text-4xl font-extrabold gradient-text-green mb-2">{stats.time}ms</div>
            <div className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Total Time</div>
          </div>
          {stats.detTime && (
            <div className="p-6 glass-card rounded-2xl text-center glass-card-hover">
              <Zap className="w-10 h-10 mx-auto mb-2 text-green-400" />
              <div className="text-4xl font-extrabold gradient-text-green mb-2">{stats.detTime}ms</div>
              <div className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Detection</div>
            </div>
          )}
          {stats.poseTime && (
            <div className="p-6 glass-card rounded-2xl text-center glass-card-hover">
              <User className="w-10 h-10 mx-auto mb-2 text-green-400" />
              <div className="text-4xl font-extrabold gradient-text-green mb-2">{stats.poseTime}ms</div>
              <div className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Pose</div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
