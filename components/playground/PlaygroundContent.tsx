'use client';

import { useState, useCallback } from 'react';
import { Loader2, AlertCircle } from 'lucide-react';
import { useDetector } from './useDetector';
import { PlaygroundHeader } from './PlaygroundHeader';
import { PlaygroundDocs } from './PlaygroundDocs';
import { PlaygroundControls } from './PlaygroundControls';
import { PlaygroundCanvas } from './PlaygroundCanvas';
import { PlaygroundStats } from './PlaygroundStats';
import { PlaygroundCache } from './PlaygroundCache';
import { PlaygroundResults } from './PlaygroundResults';

export default function PlaygroundContent() {
  const {
    refs,
    state,
    actions,
    VITPOSE_MODELS,
  } = useDetector();

  const [showDocs, setShowDocs] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const copyCode = useCallback((code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(id);
    setTimeout(() => setCopiedCode(null), 2000);
  }, []);

  const handleImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.target as HTMLImageElement;
    if (refs.canvasRef.current && refs.overlayRef.current) {
      refs.canvasRef.current.width = img.naturalWidth;
      refs.canvasRef.current.height = img.naturalHeight;
      refs.overlayRef.current.width = img.naturalWidth;
      refs.overlayRef.current.height = img.naturalHeight;
    }
  }, [refs.canvasRef, refs.overlayRef]);

  const handleVideoMetadata = useCallback((e: React.SyntheticEvent<HTMLVideoElement>) => {
    const video = e.target as HTMLVideoElement;
    if (refs.canvasRef.current && refs.overlayRef.current) {
      refs.canvasRef.current.width = video.videoWidth;
      refs.canvasRef.current.height = video.videoHeight;
      refs.overlayRef.current.width = video.videoWidth;
      refs.overlayRef.current.height = video.videoHeight;
    }
  }, [refs.canvasRef, refs.overlayRef]);

  const currentModelStatus = state.modelStatus[state.mode];

  if (currentModelStatus.loading) {
    return (
      <div className="animated-bg min-h-screen flex items-center justify-center">
        <div className="text-center p-8 glass-card rounded-3xl">
          <Loader2 className="w-16 h-16 mx-auto mb-6 text-blue-400 animate-spin" />
          <h2 className="text-2xl font-bold gradient-text mb-2">
            Loading {state.mode === 'pose3d' ? '3D Pose' : state.mode} Detector...
          </h2>
          <p className="text-slate-400">Initializing AI models</p>
        </div>
      </div>
    );
  }

  if (currentModelStatus.error) {
    return (
      <div className="animated-bg min-h-screen flex items-center justify-center p-4">
        <div className="text-center p-8 glass-card rounded-3xl max-w-md">
          <AlertCircle className="w-16 h-16 mx-auto mb-4 text-red-400" />
          <h2 className="text-2xl font-bold text-red-400 mb-4">Failed to Load Model</h2>
          <p className="text-slate-400 mb-6 break-words">{currentModelStatus.error}</p>
          <button
            onClick={() => actions.setDetectorKey(k => k + 1)}
            className="btn-glow px-8 py-4 bg-gradient-to-r from-blue-500 to-purple-500 text-white font-bold rounded-2xl shadow-lg"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="animated-bg min-h-screen">
      <div className="max-w-[1600px] mx-auto p-4 sm:p-6 lg:p-8">
        {/* Header */}
        <PlaygroundHeader
          showDocs={showDocs}
          onToggleDocs={() => setShowDocs(!showDocs)}
        />

        {/* Documentation */}
        {showDocs && (
          <PlaygroundDocs
            copiedCode={copiedCode}
            onCopyCode={copyCode}
          />
        )}

        {/* Controls */}
        <PlaygroundControls
          mode={state.mode}
          detectorType={state.detectorType}
          perfMode={state.perfMode}
          backend={state.backend}
          animalPoseModel={state.animalPoseModel}
          selectedClasses={state.selectedClasses}
          selectedAnimalClasses={state.selectedAnimalClasses}
          useCamera={state.useCamera}
          videoSrc={state.videoSrc}
          imageSrc={state.imageSrc}
          modelLoaded={currentModelStatus.loaded}
          isDetecting={state.isDetecting}
          onModeChange={actions.setMode}
          onDetectorTypeChange={actions.setDetectorType}
          onPerfModeChange={actions.setPerfMode}
          onBackendChange={actions.setBackend}
          onAnimalPoseModelChange={actions.setAnimalPoseModel}
          onUseCameraChange={actions.setUseCamera}
          onFileUpload={actions.handleFileUpload}
          onRunDetection={actions.processDetection}
          onToggleClass={actions.toggleClass}
          onSelectAllClasses={actions.selectAllClasses}
          onDeselectAllClasses={actions.deselectAllClasses}
          onToggleAnimalClass={actions.toggleAnimalClass}
        />

        {/* Canvas */}
        <PlaygroundCanvas
          canvasRef={refs.canvasRef}
          overlayRef={refs.overlayRef}
          videoRef={refs.videoRef}
          imageRef={refs.imageRef}
          imageSrc={state.imageSrc}
          videoSrc={state.videoSrc}
          useCamera={state.useCamera}
          modelLoaded={currentModelStatus.loaded}
          modelLoading={currentModelStatus.loading}
          mode={state.mode}
          onImageLoad={handleImageLoad}
          onVideoMetadata={handleVideoMetadata}
        />

        {/* Stats */}
        <PlaygroundStats
          stats={state.stats}
          mode={state.mode}
          animalPoseModel={state.animalPoseModel}
          isPlaying={state.isPlaying}
          hasVideo={!!state.videoSrc}
          modelLoaded={currentModelStatus.loaded}
        />

        {/* Cache */}
        {state.cacheInfo && (
          <PlaygroundCache
            cacheInfo={state.cacheInfo}
            onClear={actions.clearCache}
          />
        )}

        {/* Results */}
        <PlaygroundResults
          detections={state.detections}
          mode={state.mode}
        />
      </div>
    </div>
  );
}
