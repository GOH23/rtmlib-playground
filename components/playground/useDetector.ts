'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  ObjectDetector,
  PoseDetector,
  Pose3DDetector,
  AnimalDetector,
  clearModelCache,
  drawDetectionsOnCanvas,
  drawPoseOnCanvas,
  getCacheInfo,
  MediaPipePoseDetector,
  COCO_CLASSES,
  VITPOSE_MODELS,
} from 'rtmlib-ts';
import type { Detection, DetectionStats, CacheInfo, ModelStatus, DetectionMode, DetectorType, PerfMode, Backend, AnimalPoseModel } from './types';

export function useDetector() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  const [objectDetector, setObjectDetector] = useState<any>(null);
  const [poseDetector, setPoseDetector] = useState<any>(null);
  const [pose3DDetector, setPose3DDetector] = useState<any>(null);
  const [animalDetector, setAnimalDetector] = useState<any>(null);

  const [mode, setMode] = useState<DetectionMode>('object');
  const [detectorType, setDetectorType] = useState<DetectorType>('mediapipe');
  const [perfMode, setPerfMode] = useState<PerfMode>('balanced');
  const [backend, setBackend] = useState<Backend>(() => {
    if (typeof navigator !== 'undefined' && (navigator as any).gpu) return 'webgpu';
    return 'webgl';
  });
  const [animalPoseModel, setAnimalPoseModel] = useState<AnimalPoseModel>('vitpose-b');
  const [selectedClasses, setSelectedClasses] = useState<string[]>(['person']);
  const [selectedAnimalClasses, setSelectedAnimalClasses] = useState<string[]>([]);
  const [detections, setDetections] = useState<Detection[]>([]);
  const [stats, setStats] = useState<DetectionStats | null>(null);
  const [useCamera, setUseCamera] = useState(false);
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const isPlayingRef = useRef(false);
  const [isPlaying, setIsPlaying] = useState(false); // For UI only
  const [detectionInterval, setDetectionInterval] = useState<NodeJS.Timeout | null>(null);
  const [cacheInfo, setCacheInfo] = useState<CacheInfo | null>(null);
  const [isDetecting, setIsDetecting] = useState(false);

  const [modelStatus, setModelStatus] = useState<Record<string, ModelStatus>>({
    object: { loaded: false, loading: false },
    pose: { loaded: false, loading: false },
    pose3d: { loaded: false, loading: false },
    animal: { loaded: false, loading: false },
  });

  const [detectorKey, setDetectorKey] = useState(0);

  // Load cache info
  useEffect(() => {
    async function loadCacheInfo() {
      const cacheInfo = await getCacheInfo();
      setCacheInfo({ size: cacheInfo.totalSizeFormatted, cached: cacheInfo.cachedModels.length });
    }
    loadCacheInfo();
  }, []);

  // Auto-set default detector type and backend when mode changes
  useEffect(() => {
    if (mode === 'pose') {
      setDetectorType('mediapipe');
      // MediaPipe works best with WASM
      setBackend('wasm');
    } else if (mode === 'pose3d') {
      setDetectorType('mediapipe-rtmw3d');
      // MediaPipe RTMW3D with WebGPU for best performance
      if (typeof navigator !== 'undefined' && (navigator as any).gpu) {
        setBackend('webgpu');
      } else {
        setBackend('webgl');
      }
    } else if (mode === 'object') {
      setDetectorType('yolo');
      // YOLO with WebGPU for best performance
      if (typeof navigator !== 'undefined' && (navigator as any).gpu) {
        setBackend('webgpu');
      } else {
        setBackend('webgl');
      }
    } else if (mode === 'animal') {
      setDetectorType('yolo');
      // Animal detection with WebGPU
      if (typeof navigator !== 'undefined' && (navigator as any).gpu) {
        setBackend('webgpu');
      } else {
        setBackend('webgl');
      }
    }
  }, []); // Only run on mount to avoid overriding user selection

  // Init detector with fallback
  const initDetectorWithFallback = useCallback(async (mode: DetectionMode) => {
    try {
      let detector: any;
      const be: 'wasm' | 'webgpu' = 'wasm';
      if (mode === 'object') detector = new ObjectDetector({ classes: selectedClasses.length > 0 ? selectedClasses : null, mode: perfMode, backend: be, confidence: 0.3, cache: true });
      else if (mode === 'pose') detector = new PoseDetector({ detConfidence: 0.5, poseConfidence: 0.3, backend: be, cache: true });
      else if (mode === 'pose3d') detector = new Pose3DDetector({ detConfidence: 0.45, poseConfidence: 0.3, backend: "webgl", cache: true, detectorType: detectorType === 'mediapipe-rtmw3d' ? 'mediapipe-rtmw3d' : 'yolo-rtmw3d' });
      else if (mode === 'animal') detector = new AnimalDetector({ classes: selectedAnimalClasses.length > 0 ? selectedAnimalClasses : null, poseModelType: animalPoseModel, detConfidence: 0.5, poseConfidence: 0.3, backend: be, cache: true });
      await detector.init();
      if (mode === 'object') setObjectDetector(detector);
      else if (mode === 'pose') setPoseDetector(detector);
      else if (mode === 'pose3d') setPose3DDetector(detector);
      else if (mode === 'animal') setAnimalDetector(detector);
      setModelStatus(prev => ({ ...prev, [mode]: { loaded: true, loading: false } }));
    } catch (error) {
      setModelStatus(prev => ({ ...prev, [mode]: { loaded: false, loading: false, error: (error as Error).message } }));
    }
  }, [selectedClasses, selectedAnimalClasses, perfMode, animalPoseModel, detectorType]);

  // Main detector init effect
  useEffect(() => {
    async function initDetector() {
      const currentModel = modelStatus[mode];
      if (currentModel.loading) return;

      const needsReinit = currentModel.loaded && (
        (mode === 'object' && objectDetector?.config?.detectorType !== detectorType) ||
        (mode === 'pose' && ((detectorType === 'mediapipe') !== (poseDetector?.constructor?.name === 'MediaPipePoseDetector'))) ||
        (mode === 'pose3d' && pose3DDetector?.config?.detectorType !== (detectorType === 'mediapipe-rtmw3d' ? 'mediapipe-rtmw3d' : 'yolo-rtmw3d'))
      );

      if (currentModel.loaded && !needsReinit) return;

      if (needsReinit) {
        if (mode === 'object') setObjectDetector(null);
        else if (mode === 'pose') setPoseDetector(null);
        else if (mode === 'pose3d') setPose3DDetector(null);
        setModelStatus(prev => ({ ...prev, [mode]: { loaded: false, loading: false } }));
        return;
      }

      setModelStatus(prev => ({ ...prev, [mode]: { loaded: false, loading: true } }));

      try {
        let detector: any;
        console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        console.log(`🔧 [Playground] Creating detector:`);
        console.log(`   Mode: ${mode}`);
        console.log(`   Backend: ${backend}`);
        console.log(`   DeviceType: gpu (default)`);
        console.log(`   PowerPreference: high-performance (default)`);
        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

        if (detectorType === 'mediapipe' && mode === 'object') {
          detector = new ObjectDetector({ detectorType: 'mediapipe', mediaPipeModelPath: 'https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite0/int8/latest/efficientdet_lite0.tflite', mediaPipeScoreThreshold: 0.5, mediaPipeMaxResults: -1, classes: selectedClasses.length > 0 ? selectedClasses : undefined });
        } else if (detectorType === 'mediapipe' && mode === 'pose') {
          detector = new MediaPipePoseDetector({ numPoses: 3, minPoseDetectionConfidence: 0.5, minPosePresenceConfidence: 0.5 });
        } else if (mode === 'object') {
          detector = new ObjectDetector({ classes: selectedClasses.length > 0 ? selectedClasses : null, mode: perfMode, backend: backend as any, confidence: 0.3, cache: true, detectorType: 'yolo' });
        } else if (mode === 'pose') {
          detector = new PoseDetector({ detConfidence: 0.5, poseConfidence: 0.3, backend: backend as any, cache: true, detectorType: 'yolo-rtmpose' });
        } else if (mode === 'pose3d') {
          detector = new Pose3DDetector({ detConfidence: 0.45, poseConfidence: 0.3, backend: backend as any, cache: true, detectorType: detectorType === 'mediapipe-rtmw3d' ? 'mediapipe-rtmw3d' : 'yolo-rtmw3d' });
        } else if (mode === 'animal') {
          detector = new AnimalDetector({ classes: selectedAnimalClasses.length > 0 ? selectedAnimalClasses : null, poseModelType: animalPoseModel, detConfidence: 0.5, poseConfidence: 0.3, backend: backend as any, cache: true });
        }

        console.log(`[Playground] Initializing ${mode} detector with type: ${detectorType}, backend: ${backend}`);
        await detector.init();
        console.log(`[Playground] Detector initialization successfully`);

        if (mode === 'object') setObjectDetector(detector);
        else if (mode === 'pose') setPoseDetector(detector);
        else if (mode === 'pose3d') setPose3DDetector(detector);
        else if (mode === 'animal') setAnimalDetector(detector);
        setModelStatus(prev => ({ ...prev, [mode]: { loaded: true, loading: false } }));
      } catch (error: any) {
        console.error('[Playground] Initialization error:', error);
        if (backend === 'webgpu' && error.message.includes('WebGPU')) {
          setBackend('webgl' as any);
          await initDetectorWithFallback(mode);
          return;
        }
        setModelStatus(prev => ({ ...prev, [mode]: { loaded: false, loading: false, error: error.message } }));
      }
    }
    initDetector();
  }, [mode, perfMode, backend, animalPoseModel, detectorType, detectorKey, initDetectorWithFallback]);

  // Update classes
  useEffect(() => {
    if (objectDetector?.setClasses) objectDetector.setClasses(selectedClasses.length > 0 ? selectedClasses : null);
  }, [selectedClasses, objectDetector]);

  useEffect(() => {
    if (animalDetector?.setClasses) animalDetector.setClasses(selectedAnimalClasses.length > 0 ? selectedAnimalClasses : null);
  }, [selectedAnimalClasses, animalDetector]);

  // Detector key reset
  useEffect(() => {
    setDetectorKey(k => k + 1);
  }, [detectorType]);

  // Keep video playing after React re-renders
  useEffect(() => {
    if (isPlaying && videoRef.current && videoRef.current.paused && !videoRef.current.ended) {
      videoRef.current.play().catch(() => {});
    }
  }, [isPlaying]);

  // Camera setup
  useEffect(() => {
    async function setupCamera() {
      if (useCamera && videoRef.current) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720 } });
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        } catch { setUseCamera(false); }
      } else if (videoRef.current?.srcObject) {
        (videoRef.current.srcObject as MediaStream).getTracks().forEach(track => track.stop());
        videoRef.current.srcObject = null;
      }
    }
    setupCamera();
  }, [useCamera]);

  // Canvas reset on mode change
  useEffect(() => {
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }
      setDetections([]);
      setStats(null);
    }
  }, [mode]);

  // Cleanup
  const stopDetectionLoop = useCallback(() => {
    if (detectionInterval) {
      // New style: cancel the async loop
      if ('cancel' in detectionInterval) {
        (detectionInterval as any).cancel();
      } else {
        // Old style: clear interval
        clearInterval(detectionInterval as NodeJS.Timeout);
      }
      setDetectionInterval(null);
    }
    if (videoRef.current) videoRef.current.pause();
    setIsPlaying(false);
  }, [detectionInterval]);

  useEffect(() => {
    return () => {
      stopDetectionLoop();
      if (videoSrc) URL.revokeObjectURL(videoSrc);
    };
  }, [videoSrc, stopDetectionLoop]);

  useEffect(() => {
    if (!videoRef.current) return;
    const h = () => { setIsPlaying(false); stopDetectionLoop(); };
    videoRef.current.addEventListener('ended', h);
    return () => videoRef.current?.removeEventListener('ended', h);
  }, [videoSrc, stopDetectionLoop]);

  // Process 3D result
  const process3DResult = useCallback((result3d: any, canvasWidth?: number, canvasHeight?: number): Detection[] => {
    const keypoints = result3d.keypoints || [], keypoints2d = result3d.keypoints2d || [], scores = result3d.scores || [];
    const detections: Detection[] = [];
    for (let i = 0; i < keypoints.length; i++) {
      const personKeypoints2d = keypoints2d[i], personScores = scores[i];
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const kpt of personKeypoints2d) { minX = Math.min(minX, kpt[0]); minY = Math.min(minY, kpt[1]); maxX = Math.max(maxX, kpt[0]); maxY = Math.max(maxY, kpt[1]); }
      const width = canvasWidth || canvasRef.current?.width || 640, height = canvasHeight || canvasRef.current?.height || 480;
      detections.push({
        bbox: { x1: Math.max(0, minX - 20), y1: Math.max(0, minY - 20), x2: Math.min(width, maxX + 20), y2: Math.min(height, maxY + 20), confidence: personScores.reduce((a: number, b: number) => a + b, 0) / personScores.length },
        keypoints: personKeypoints2d.map((kpt: number[], idx: number) => ({ x: kpt[0], y: kpt[1], score: personScores[idx], visible: personScores[idx] > 0.3 })),
        keypoints3d: keypoints[i]
      });
    }
    (detections as any).stats = result3d.stats;
    return detections;
  }, []);

  // Draw animal results
  const drawAnimalResults = useCallback((ctx: CanvasRenderingContext2D, animals: any[]) => {
    const colors = ['#ff6b6b', '#51cf66', '#339af0', '#ffd43b', '#da77f2', '#ff922b'];
    animals.forEach((animal: any, idx: number) => {
      const color = colors[idx % colors.length];
      ctx.strokeStyle = color; ctx.lineWidth = 3;
      ctx.strokeRect(animal.bbox.x1, animal.bbox.y1, animal.bbox.x2 - animal.bbox.x1, animal.bbox.y2 - animal.bbox.y1);
      ctx.fillStyle = color; ctx.font = 'bold 14px Inter, sans-serif';
      ctx.fillText(`${animal.className} ${(animal.bbox.confidence * 100).toFixed(0)}%`, animal.bbox.x1, animal.bbox.y1 - 8);
      animal.keypoints?.forEach((kp: any) => { if (kp.visible) { ctx.fillStyle = '#51cf66'; ctx.beginPath(); ctx.arc(kp.x, kp.y, 5, 0, Math.PI * 2); ctx.fill(); } });
    });
  }, []);

  // Core detection - single frame processing
  const processDetectionCore = useCallback(async () => {
    if (!canvasRef.current || !overlayRef.current) {
      console.error('[Playground] Canvas not ready');
      return;
    }
    if (!modelStatus[mode].loaded) {
      console.error('[Playground] Model not loaded');
      return;
    }

    const canvas = canvasRef.current, overlay = overlayRef.current;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const overlayCtx = overlay.getContext('2d', { willReadFrequently: true });
    if (!ctx || !overlayCtx) {
      console.error('[Playground] Context not ready');
      return;
    }

    let sourceWidth: number, sourceHeight: number;
    if (imageRef.current && imageSrc) { sourceWidth = imageRef.current.naturalWidth; sourceHeight = imageRef.current.naturalHeight; }
    else if (videoRef.current && (videoSrc || useCamera)) { sourceWidth = videoRef.current.videoWidth; sourceHeight = videoRef.current.videoHeight; }
    else { sourceWidth = canvas.width; sourceHeight = canvas.height; }

    if (sourceWidth === 0 || sourceHeight === 0) {
      console.error('[Playground] Invalid source dimensions');
      return;
    }

    canvas.width = sourceWidth; canvas.height = sourceHeight;
    overlay.width = sourceWidth; overlay.height = sourceHeight;
    overlayCtx.clearRect(0, 0, overlay.width, overlay.height);

    setIsDetecting(true);
    let results: any[] = [];
    const startTime = performance.now();

    try {
      let detector: any;
      if (mode === 'object') detector = objectDetector;
      else if (mode === 'pose') detector = poseDetector;
      else if (mode === 'pose3d') detector = pose3DDetector;
      else if (mode === 'animal') detector = animalDetector;

      if (!detector) {
        console.error('[Playground] No detector available');
        return;
      }

      if (videoRef.current && (useCamera || videoSrc)) {
        ctx.drawImage(videoRef.current, 0, 0, sourceWidth, sourceHeight);
        if (mode === 'pose3d') {
          results = await detector.detectFromVideo(videoRef.current, canvas);
          results = process3DResult(results, sourceWidth, sourceHeight);
        } else {
          results = await detector.detectFromVideo(videoRef.current, canvas);
        }
      } else if (imageRef.current && imageSrc) {
        ctx.drawImage(imageRef.current, 0, 0, sourceWidth, sourceHeight);
        if (mode === 'pose3d') {
          results = await detector.detectFromImage(imageRef.current, canvas);
          results = process3DResult(results, sourceWidth, sourceHeight);
        } else {
          results = await detector.detectFromImage(imageRef.current, canvas);
        }
      } else {
        if (mode === 'pose3d') {
          results = await detector.detectFromCanvas(canvas);
          results = process3DResult(results, sourceWidth, sourceHeight);
        } else {
          results = await detector.detectFromCanvas(canvas);
        }
      }

      if (mode === 'object') drawDetectionsOnCanvas(overlayCtx, results);
      else if (mode === 'pose' || mode === 'pose3d') drawPoseOnCanvas(overlayCtx, results);
      else if (mode === 'animal') drawAnimalResults(overlayCtx, results);

      const detStats = (results as any).stats;
      setDetections(results);
      setStats({ time: Math.round(performance.now() - startTime), count: results.length, detTime: detStats?.detTime, poseTime: detStats?.poseTime });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('[Playground] Detection error:', errorMessage);
    } finally {
      setIsDetecting(false); // Reset button state
    }
  }, [mode, useCamera, videoSrc, imageSrc, objectDetector, poseDetector, pose3DDetector, animalDetector, modelStatus, process3DResult, drawAnimalResults]);

  // Main detection - auto-starts video/camera loops
  const processDetection = useCallback(async () => {
    // Auto-start video playback and detection loop
    if (videoSrc && !useCamera && !isPlayingRef.current) {
      if (!videoRef.current || !videoSrc) return;
      try {
        // Reset to beginning if needed
        if (videoRef.current.currentTime > 0 || videoRef.current.ended) {
          videoRef.current.currentTime = 0;
        }

        // Wait a tick for currentTime to apply
        await new Promise(resolve => setTimeout(resolve, 50));

        if (canvasRef.current && videoRef.current) {
          canvasRef.current.width = videoRef.current.videoWidth || 640;
          canvasRef.current.height = videoRef.current.videoHeight || 480;
        }

        await videoRef.current.play();

        // Update ref first (doesn't cause re-render)
        isPlayingRef.current = true;
        // Then update state for UI
        setIsPlaying(true);

        // Use sequential detection loop - wait for each detection to finish before starting next
        // This prevents "Session already started" error while keeping continuous detection
        let cancelled = false;
        const detectionLoop = async () => {
          while (!cancelled && videoRef.current && !videoRef.current.paused && !videoRef.current.ended) {
            // Wait for detection to complete
            await processDetectionCore();
            // Small delay to prevent tight loop
            await new Promise(resolve => setTimeout(resolve, 16)); // ~60fps cap
          }
          
          if (cancelled || !videoRef.current || videoRef.current.paused || videoRef.current.ended) {
            isPlayingRef.current = false;
            setIsPlaying(false);
          }
        };
        
        detectionLoop();
        setDetectionInterval({ cancel: () => { cancelled = true; } } as any);
      } catch (e) {
        console.error('[Playground] Failed to start video:', e);
        isPlayingRef.current = false;
        setIsPlaying(false);
      }
      return;
    }

    // Auto-start camera detection loop
    if (useCamera && !isPlayingRef.current) {
      isPlayingRef.current = true;
      setIsPlaying(true);
      
      let cancelled = false;
      const detectionLoop = async () => {
        while (!cancelled && videoRef.current && !videoRef.current.paused && !videoRef.current.ended) {
          await processDetectionCore();
          await new Promise(resolve => setTimeout(resolve, 16));
        }
        
        if (cancelled || !videoRef.current || videoRef.current.paused || videoRef.current.ended) {
          isPlayingRef.current = false;
          setIsPlaying(false);
        }
      };
      
      detectionLoop();
      setDetectionInterval({ cancel: () => { cancelled = true; } } as any);
      return;
    }

    // Single frame detection (image or manual trigger)
    await processDetectionCore();
  }, [videoSrc, useCamera, processDetectionCore]);

  // File upload
  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    if (file.type.startsWith('video/')) { setVideoSrc(url); setImageSrc(null); setUseCamera(false); setIsPlaying(false); stopDetectionLoop(); }
    else { setImageSrc(url); setVideoSrc(null); setUseCamera(false); setIsPlaying(false); stopDetectionLoop(); }
  }, [stopDetectionLoop]);

  // Video detection control
  const startVideoDetection = useCallback(async () => {
    if (!videoRef.current || !videoSrc) return;
    try {
      videoRef.current.load();
      await new Promise((resolve) => { const t = setTimeout(resolve, 5000); videoRef.current!.addEventListener('loadeddata', () => { clearTimeout(t); resolve(true); }, { once: true }); });
      if (canvasRef.current && videoRef.current) { canvasRef.current.width = videoRef.current.videoWidth || 640; canvasRef.current.height = videoRef.current.videoHeight || 480; }
      await videoRef.current.play(); setIsPlaying(true);
      setDetectionInterval(setInterval(() => { if (videoRef.current && !videoRef.current.paused && !videoRef.current.ended) processDetectionCore(); }, 100));
    } catch { setIsPlaying(false); }
  }, [videoSrc, processDetectionCore]);

  // Class selection helpers
  const toggleClass = useCallback((cls: string) => setSelectedClasses(prev => prev.includes(cls) ? prev.filter(c => c !== cls) : [...prev, cls]), []);
  const toggleAnimalClass = useCallback((cls: string) => setSelectedAnimalClasses(prev => prev.includes(cls) ? prev.filter(c => c !== cls) : [...prev, cls]), []);
  const selectAllClasses = useCallback(() => setSelectedClasses([...COCO_CLASSES]), []);
  const deselectAllClasses = useCallback(() => setSelectedClasses([]), []);

  // Clear cache
  const clearCache = useCallback(async () => {
    await clearModelCache();
    setCacheInfo({ size: '0 B', cached: 0 });
    setModelStatus({ object: { loaded: false, loading: false }, pose: { loaded: false, loading: false }, pose3d: { loaded: false, loading: false }, animal: { loaded: false, loading: false } });
    setDetectorKey(k => k + 1);
  }, []);

  return {
    refs: { canvasRef, overlayRef, videoRef, imageRef },
    state: {
      mode, detectorType, perfMode, backend, animalPoseModel,
      selectedClasses, selectedAnimalClasses, detections, stats,
      useCamera, videoSrc, imageSrc, isPlaying, cacheInfo,
      isDetecting, modelStatus,
    },
    actions: {
      setMode, setDetectorType, setPerfMode, setBackend, setAnimalPoseModel,
      setSelectedClasses, setSelectedAnimalClasses, setUseCamera, setVideoSrc, setImageSrc,
      setIsPlaying, setIsDetecting,
      toggleClass, toggleAnimalClass, selectAllClasses, deselectAllClasses,
      handleFileUpload, startVideoDetection, stopDetectionLoop, processDetection,
      clearCache, setDetectorKey,
    },
    VITPOSE_MODELS,
  };
}
