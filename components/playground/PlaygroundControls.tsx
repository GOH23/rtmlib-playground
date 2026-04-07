'use client';

import {
  Search, User, Box, PawPrint, Zap, Video, Play, Square,
  Upload, Cpu, Gauge, Layers, Camera, Target,
  Monitor, Aperture, Terminal, Brain, BoxSelect, ScanFace, Loader2
} from 'lucide-react';
import { CustomSelect } from '../ui/CustomSelect';
import { ClassSelector } from './ClassSelector';
import type { DetectionMode, DetectorType, PerfMode, Backend, AnimalPoseModel } from './types';
import { VITPOSE_MODELS } from 'rtmlib-ts';

export interface PlaygroundControlsProps {
  mode: DetectionMode;
  detectorType: DetectorType;
  perfMode: PerfMode;
  backend: Backend;
  animalPoseModel: AnimalPoseModel;
  selectedClasses: string[];
  selectedAnimalClasses: string[];
  useCamera: boolean;
  videoSrc: string | null;
  isPlaying: boolean;
  processEveryNFrames: number;
  modelLoaded: boolean;
  isDetecting: boolean;
  onModeChange: (v: DetectionMode) => void;
  onDetectorTypeChange: (v: DetectorType) => void;
  onPerfModeChange: (v: PerfMode) => void;
  onBackendChange: (v: Backend) => void;
  onAnimalPoseModelChange: (v: AnimalPoseModel) => void;
  onProcessEveryNFramesChange: (v: number) => void;
  onUseCameraChange: (v: boolean) => void;
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onStartVideo: () => void;
  onStopVideo: () => void;
  onRunDetection: () => void;
  onToggleClass: (cls: string) => void;
  onSelectAllClasses: () => void;
  onDeselectAllClasses: () => void;
  onToggleAnimalClass: (cls: string) => void;
}

export function PlaygroundControls({
  mode, detectorType, perfMode, backend, animalPoseModel,
  selectedClasses, selectedAnimalClasses,
  useCamera, videoSrc, isPlaying, processEveryNFrames,
  modelLoaded, isDetecting,
  onModeChange, onDetectorTypeChange, onPerfModeChange, onBackendChange,
  onAnimalPoseModelChange, onProcessEveryNFramesChange,
  onUseCameraChange, onFileUpload, onStartVideo, onStopVideo, onRunDetection,
  onToggleClass, onSelectAllClasses, onDeselectAllClasses, onToggleAnimalClass,
}: PlaygroundControlsProps) {
  const backendOptions = [
    { value: 'webgpu', label: 'WebGPU (GPU)', icon: <Monitor className="w-5 h-5" /> },
    { value: 'webgl', label: 'WebGL (GPU)', icon: <Aperture className="w-5 h-5" /> },
    { value: 'webnn', label: 'WebNN (AI Accelerator)', icon: <Cpu className="w-5 h-5" /> },
    { value: 'wasm', label: 'WASM (CPU)', icon: <Terminal className="w-5 h-5" /> },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-6 p-6 glass-card rounded-3xl">
      {/* Mode */}
      <div className="flex flex-col gap-2">
        <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2">
          <Target className="w-4 h-4" /> Mode
        </label>
        <CustomSelect
          value={mode}
          onChange={(v) => onModeChange(v as DetectionMode)}
          options={[
            { value: 'object', label: 'Object Detection', icon: <Search className="w-5 h-5" /> },
            { value: 'pose', label: 'Pose Estimation (2D)', icon: <User className="w-5 h-5" /> },
            { value: 'pose3d', label: 'Pose Estimation (3D)', icon: <Box className="w-5 h-5" /> },
            { value: 'animal', label: 'Animal Detection', icon: <PawPrint className="w-5 h-5" /> },
          ]}
        />
      </div>

      {/* Detector Type */}
      {(mode === 'object' || mode === 'pose' || mode === 'pose3d') && (
        <div className="flex flex-col gap-2">
          <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2">
            <Layers className="w-4 h-4" /> Detector Type
          </label>
          <CustomSelect
            value={detectorType}
            onChange={(v) => onDetectorTypeChange(v as DetectorType)}
            options={mode === 'pose3d' ? [
              { value: 'yolo-rtmw3d', label: 'YOLO + RTMW3D', icon: <Target className="w-5 h-5" /> },
              { value: 'mediapipe-rtmw3d', label: 'MediaPipe + RTMW3D (FAST)', icon: <Zap className="w-5 h-5" /> },
            ] : [
              { value: 'yolo', label: 'YOLO (ONNX)', icon: <Target className="w-5 h-5" /> },
              { value: 'mediapipe', label: 'MediaPipe (TFLite)', icon: <Brain className="w-5 h-5" /> },
            ]}
          />
        </div>
      )}

      {/* Performance */}
      <div className="flex flex-col gap-2">
        <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2">
          <Gauge className="w-4 h-4" /> Performance
        </label>
        <CustomSelect
          value={perfMode}
          onChange={(v) => onPerfModeChange(v as PerfMode)}
          options={[
            { value: 'performance', label: 'Performance (640×640)', icon: <Zap className="w-5 h-5" /> },
            { value: 'balanced', label: 'Balanced (416×416)', icon: <BoxSelect className="w-5 h-5" /> },
            { value: 'lightweight', label: 'Lightweight (320×320)', icon: <Gauge className="w-5 h-5" /> },
          ]}
        />
      </div>

      {/* Backend */}
      <div className="flex flex-col gap-2">
        <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2">
          <Cpu className="w-4 h-4" /> Backend
        </label>
        <CustomSelect
          value={backend}
          onChange={(v) => onBackendChange(v as Backend)}
          options={backendOptions}
        />
      </div>

      {/* Frame Skip */}
      {(useCamera || videoSrc) && (
        <div className="flex flex-col gap-2">
          <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Frame Skip</label>
          <CustomSelect
            value={String(processEveryNFrames)}
            onChange={(v) => onProcessEveryNFramesChange(Number(v))}
            options={[
              { value: '1', label: 'Every frame' },
              { value: '2', label: 'Every 2nd frame' },
              { value: '3', label: 'Every 3rd (recommended)' },
              { value: '4', label: 'Every 4th frame' },
              { value: '5', label: 'Every 5th frame' },
            ]}
          />
        </div>
      )}

      {/* Animal Model */}
      {mode === 'animal' && (
        <div className="flex flex-col gap-2">
          <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Animal Model</label>
          <CustomSelect
            value={animalPoseModel}
            onChange={(v) => onAnimalPoseModelChange(v as AnimalPoseModel)}
            options={(Object.keys(VITPOSE_MODELS) as string[]).map(key => ({
              value: key,
              label: `${VITPOSE_MODELS[key as keyof typeof VITPOSE_MODELS].name} - ${VITPOSE_MODELS[key as keyof typeof VITPOSE_MODELS].ap} AP`,
            }))}
          />
        </div>
      )}

      {/* Input Source */}
      <div className="flex flex-col gap-2">
        <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2">
          <Video className="w-4 h-4" /> Input Source
        </label>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => onUseCameraChange(!useCamera)} className={`flex items-center gap-2 px-4 py-3 rounded-xl font-semibold transition-all ${useCamera ? 'bg-gradient-to-r from-cyan-400 to-green-400 text-slate-900' : 'bg-blue-500/20 text-slate-100 border border-white/15'}`}>
            <Camera className="w-4 h-4" /> {useCamera ? 'On' : 'Camera'}
          </button>
          {videoSrc && (
            <button onClick={isPlaying ? onStopVideo : onStartVideo} className={`flex items-center gap-2 px-4 py-3 rounded-xl font-semibold transition-all ${isPlaying ? 'bg-gradient-to-r from-green-400 to-cyan-400 text-slate-900' : 'bg-gradient-to-r from-cyan-400 to-green-400 text-slate-900'}`}>
              {isPlaying ? <Square className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              {isPlaying ? 'Stop' : 'Play'}
            </button>
          )}
        </div>
        <label className="inline-flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-blue-500 to-purple-500 text-white font-semibold rounded-xl text-center cursor-pointer hover:shadow-lg hover:shadow-blue-500/25 transition-all text-sm">
          <Upload className="w-4 h-4" /> Upload
          <input type="file" accept="image/*,video/*" onChange={onFileUpload} className="hidden" />
        </label>
      </div>

      {/* Object Classes */}
      {mode === 'object' && (
        <div className="flex flex-col gap-2 sm:col-span-2 lg:col-span-3 xl:col-span-4">
          <ClassSelector
            selectedClasses={selectedClasses}
            onToggleClass={onToggleClass}
            onSelectAll={onSelectAllClasses}
            onDeselectAll={onDeselectAllClasses}
          />
        </div>
      )}

      {/* Animal Classes */}
      {mode === 'animal' && (
        <div className="flex flex-col gap-2 sm:col-span-2 lg:col-span-3 xl:col-span-4">
          <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Animal Classes</label>
          <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
            {['dog', 'cat', 'horse', 'zebra', 'elephant', 'tiger', 'lion', 'panda'].map(cls => (
              <label key={cls} className="flex items-center gap-2 text-sm p-3 bg-blue-500/10 rounded-xl cursor-pointer hover:bg-blue-500/20 transition-all text-slate-100">
                <input type="checkbox" checked={selectedAnimalClasses.includes(cls)} onChange={() => onToggleAnimalClass(cls)} className="w-4 h-4 accent-blue-500" />{cls}
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Run Detection Button */}
      <button
        onClick={onRunDetection}
        disabled={isDetecting || !modelLoaded}
        className="sm:col-span-2 lg:col-span-3 xl:col-span-4 py-5 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 text-white font-bold rounded-2xl shadow-lg hover:shadow-xl hover:shadow-blue-500/25 transition-all text-lg btn-glow disabled:opacity-50 disabled:cursor-not-allowed disabled:grayscale flex items-center justify-center gap-3"
      >
        {isDetecting ? (
          <>
            <Loader2 className="w-6 h-6 animate-spin" />
            Detecting...
          </>
        ) : (
          <>
            <ScanFace className="w-6 h-6" />
            Run Detection
          </>
        )}
      </button>
    </div>
  );
}
