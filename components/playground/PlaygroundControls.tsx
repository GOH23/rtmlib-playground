'use client';

import {
  Search, User, Box, PawPrint, Zap, Video,
  Upload, Cpu, Gauge, Layers, Camera, Target,
  Monitor, Aperture, Terminal, Brain, BoxSelect, ScanFace, Loader2,
  Image as ImageIcon, FileVideo
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
  imageSrc: string | null;
  modelLoaded: boolean;
  isDetecting: boolean;
  onModeChange: (v: DetectionMode) => void;
  onDetectorTypeChange: (v: DetectorType) => void;
  onPerfModeChange: (v: PerfMode) => void;
  onBackendChange: (v: Backend) => void;
  onAnimalPoseModelChange: (v: AnimalPoseModel) => void;
  onUseCameraChange: (v: boolean) => void;
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRunDetection: () => void;
  onToggleClass: (cls: string) => void;
  onSelectAllClasses: () => void;
  onDeselectAllClasses: () => void;
  onToggleAnimalClass: (cls: string) => void;
}

export function PlaygroundControls({
  mode, detectorType, perfMode, backend, animalPoseModel,
  selectedClasses, selectedAnimalClasses,
  useCamera, videoSrc, imageSrc,
  modelLoaded, isDetecting,
  onModeChange, onDetectorTypeChange, onPerfModeChange, onBackendChange,
  onAnimalPoseModelChange, onUseCameraChange, onFileUpload, onRunDetection,
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
      <div className="flex flex-col gap-3 sm:col-span-2 lg:col-span-3 xl:col-span-4">
        <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2">
          <Video className="w-4 h-4" /> Input Source
        </label>
        
        {/* Source type selector */}
        <div className="flex gap-2 p-1.5 bg-slate-800/50 rounded-xl">
          <button 
            onClick={() => onUseCameraChange(false)} 
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-semibold transition-all flex-1 ${
              !useCamera && !videoSrc 
                ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-lg' 
                : 'text-slate-300 hover:text-white hover:bg-white/5'
            }`}
          >
            <ImageIcon className="w-4 h-4" />
            Image
          </button>
          <button 
            onClick={() => onUseCameraChange(false)} 
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-semibold transition-all flex-1 ${
              videoSrc 
                ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-lg' 
                : 'text-slate-300 hover:text-white hover:bg-white/5'
            }`}
          >
            <FileVideo className="w-4 h-4" />
            Video
          </button>
          <button 
            onClick={() => onUseCameraChange(!useCamera)} 
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-semibold transition-all flex-1 ${
              useCamera 
                ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-lg' 
                : 'text-slate-300 hover:text-white hover:bg-white/5'
            }`}
          >
            <Camera className="w-4 h-4" />
            Camera
          </button>
        </div>

        {/* Upload button */}
        <label className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-gradient-to-r from-blue-500 to-purple-500 text-white font-semibold rounded-xl cursor-pointer hover:shadow-lg hover:shadow-blue-500/25 transition-all text-sm">
          <Upload className="w-4 h-4" /> 
          {videoSrc ? 'Upload New Video' : imageSrc ? 'Upload New Image' : 'Upload File'}
          <input type="file" accept="image/*,video/*" onChange={onFileUpload} className="hidden" />
        </label>

        {/* Current source indicator */}
        {(videoSrc || imageSrc || useCamera) && (
          <div className="flex items-center gap-2 px-4 py-2.5 bg-slate-800/30 rounded-lg border border-white/10">
            {videoSrc ? (
              <>
                <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                <span className="text-sm text-slate-300">Video loaded</span>
              </>
            ) : imageSrc ? (
              <>
                <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                <span className="text-sm text-slate-300">Image loaded</span>
              </>
            ) : useCamera ? (
              <>
                <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                <span className="text-sm text-slate-300">Camera active</span>
              </>
            ) : null}
          </div>
        )}
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
