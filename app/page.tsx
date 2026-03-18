'use client';

import { useEffect, useState, useRef, useMemo } from 'react';
import {
  ObjectDetector,
  PoseDetector,
  Pose3DDetector,
  AnimalDetector,
  VITPOSE_MODELS,
  ANIMAL_CLASSES,
  clearModelCache,
  drawDetectionsOnCanvas,
  drawPoseOnCanvas,
  getCacheInfo,
  MediaPipeObjectDetector,
  MediaPipePoseDetector,
  COCO_CLASSES,
} from "rtmlib-ts";
import {
  Search,
  User,
  Box,
  PawPrint,
  Zap,
  FileText,
  Video,
  Play,
  Square,
  Upload,
  Cpu,
  Gauge,
  Layers,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Camera,
  Image as ImageIcon,
  Activity,
  Clock,
  Target,
  ScanFace,
  ChevronDown,
  X,
  Eye,
  EyeOff,
  Filter,
  Grid3X3,
  List,
  Check,
  Github,
  ExternalLink,
  Copy,
  Terminal,
  Monitor,
  Aperture,
  BoxSelect,
  Brain,
} from 'lucide-react';

interface Detection {
  bbox: { x1: number; y1: number; x2: number; y2: number; confidence: number };
  className?: string;
  keypoints?: any[];
  keypoints3d?: number[][];
  classId?: number;
}

interface ModelStatus {
  loaded: boolean;
  loading: boolean;
  error?: string;
}

function getBboxValue(det: any, key: 'x1' | 'y1' | 'x2' | 'y2'): number {
  if (!det.bbox) return 0;
  if (det.bbox[key] !== undefined) return Math.round(det.bbox[key]);
  if (key === 'x1') return det.bbox.originX !== undefined ? Math.round(det.bbox.originX) : 0;
  if (key === 'y1') return det.bbox.originY !== undefined ? Math.round(det.bbox.originY) : 0;
  if (key === 'x2') {
    if (det.bbox.originX !== undefined && det.bbox.width !== undefined) return Math.round(det.bbox.originX + det.bbox.width);
    return 0;
  }
  if (key === 'y2') {
    if (det.bbox.originY !== undefined && det.bbox.height !== undefined) return Math.round(det.bbox.originY + det.bbox.height);
    return 0;
  }
  return 0;
}

// Custom Select Component
interface CustomSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string; icon?: React.ReactNode }[];
  placeholder?: string;
  className?: string;
}

function CustomSelect({ value, onChange, options, placeholder, className = '' }: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const selectRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (selectRef.current && !selectRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedOption = options.find(opt => opt.value === value);

  return (
    <div ref={selectRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full p-4 rounded-xl border border-white/15 bg-slate-900/80 text-slate-100 font-medium cursor-pointer hover:border-blue-500/50 transition-all flex items-center justify-between gap-3"
      >
        <span className="flex items-center gap-2">
          {selectedOption?.icon}
          {selectedOption?.label || placeholder || 'Select...'}
        </span>
        <ChevronDown className={`w-5 h-5 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      
      {isOpen && (
        <div className="absolute z-50 w-full mt-2 p-2 bg-slate-900/95 backdrop-blur-xl rounded-xl border border-white/15 shadow-2xl max-h-64 overflow-y-auto">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => { onChange(option.value); setIsOpen(false); }}
              className={`w-full p-3 rounded-lg flex items-center gap-3 transition-all ${
                value === option.value 
                  ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' 
                  : 'text-slate-300 hover:bg-slate-800/50'
              }`}
            >
              {option.icon}
              <span className="flex-1 text-left">{option.label}</span>
              {value === option.value && <Check className="w-4 h-4" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Class Selector Component with Search
interface ClassSelectorProps {
  selectedClasses: string[];
  onToggleClass: (cls: string) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
}

function ClassSelector({ selectedClasses, onToggleClass, onSelectAll, onDeselectAll }: ClassSelectorProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const filteredClasses = useMemo(() => {
    let classes = COCO_CLASSES;
    if (searchQuery) {
      classes = classes.filter(cls => cls.toLowerCase().includes(searchQuery.toLowerCase()));
    }
    if (!showAll) {
      classes = classes.slice(0, 20);
    }
    return classes;
  }, [searchQuery, showAll]);

  const selectedCount = selectedClasses.length;
  const totalCount = COCO_CLASSES.length;

  return (
    <div className="space-y-4">
      {/* Header with search and actions */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Search classes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 rounded-xl border border-white/15 bg-slate-900/80 text-slate-100 placeholder-slate-500 focus:border-blue-500/50 transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
            className="p-3 rounded-xl border border-white/15 bg-slate-900/80 text-slate-400 hover:text-slate-200 transition-all"
          >
            {viewMode === 'grid' ? <List className="w-5 h-5" /> : <Grid3X3 className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Stats and actions */}
      <div className="flex items-center justify-between flex-wrap gap-3 p-4 rounded-xl bg-slate-900/50 border border-white/10">
        <div className="flex items-center gap-3">
          <Filter className="w-5 h-5 text-blue-400" />
          <span className="text-slate-400">
            <span className="text-blue-400 font-bold">{selectedCount}</span> / {totalCount} selected
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onSelectAll}
            className="px-4 py-2 rounded-lg bg-blue-500/20 text-blue-400 font-medium hover:bg-blue-500/30 transition-all text-sm"
          >
            Select All
          </button>
          <button
            onClick={onDeselectAll}
            className="px-4 py-2 rounded-lg bg-red-500/20 text-red-400 font-medium hover:bg-red-500/30 transition-all text-sm"
          >
            Deselect All
          </button>
        </div>
      </div>

      {/* Classes grid/list */}
      <div className={viewMode === 'grid' 
        ? 'grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7 gap-2 max-h-[400px] overflow-y-auto p-2' 
        : 'flex flex-col gap-2 max-h-[400px] overflow-y-auto p-2'
      }>
        {filteredClasses.map((cls) => {
          const isSelected = selectedClasses.includes(cls);
          return (
            <button
              key={cls}
              onClick={() => onToggleClass(cls)}
              className={`p-3 rounded-xl flex items-center gap-3 transition-all ${
                viewMode === 'list' ? 'justify-between' : 'flex-col text-center'
              } ${
                isSelected 
                  ? 'bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-blue-500/30 text-slate-100' 
                  : 'bg-slate-900/50 border border-white/10 text-slate-400 hover:bg-slate-800/50 hover:border-white/20'
              }`}
            >
              <span className={viewMode === 'list' ? 'font-medium' : 'text-sm font-medium'}>{cls}</span>
              {isSelected ? (
                <CheckCircle2 className="w-5 h-5 text-blue-400 flex-shrink-0" />
              ) : (
                <div className="w-5 h-5 rounded-full border-2 border-slate-600 flex-shrink-0" />
              )}
            </button>
          );
        })}
      </div>

      {/* Show more/less */}
      {!searchQuery && (
        <button
          onClick={() => setShowAll(!showAll)}
          className="w-full py-3 rounded-xl border border-white/15 bg-slate-900/50 text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 transition-all flex items-center justify-center gap-2"
        >
          {showAll ? (
            <>
              <EyeOff className="w-4 h-4" /> Show Less
            </>
          ) : (
            <>
              <Eye className="w-4 h-4" /> Show All {totalCount} Classes
            </>
          )}
        </button>
      )}
    </div>
  );
}

export default function Home() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  const [objectDetector, setObjectDetector] = useState<any>(null);
  const [poseDetector, setPoseDetector] = useState<any>(null);
  const [pose3DDetector, setPose3DDetector] = useState<any>(null);
  const [animalDetector, setAnimalDetector] = useState<any>(null);

  const [mode, setMode] = useState<'object' | 'pose' | 'pose3d' | 'animal'>('object');
  const [detectorType, setDetectorType] = useState<'yolo' | 'mediapipe' | 'yolo-rtmw3d' | 'mediapipe-rtmw3d'>('yolo');
  const [perfMode, setPerfMode] = useState<'performance' | 'balanced' | 'lightweight'>('balanced');
  const [backend, setBackend] = useState<'wasm' | 'webgl' | 'webgpu' | 'webnn'>(() => {
    if (typeof navigator !== 'undefined' && (navigator as any).gpu) return 'webgpu';
    return 'webgl';
  });
  const [animalPoseModel, setAnimalPoseModel] = useState<'vitpose-s' | 'vitpose-b' | 'vitpose-l'>('vitpose-b');
  const [selectedClasses, setSelectedClasses] = useState<string[]>(['person']);
  const [selectedAnimalClasses, setSelectedAnimalClasses] = useState<string[]>([]);
  const [detections, setDetections] = useState<Detection[]>([]);
  const [stats, setStats] = useState<{ time: number; count: number; detTime?: number; poseTime?: number } | null>(null);
  const [useCamera, setUseCamera] = useState(false);
  const [hasImage, setHasImage] = useState(false);
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [detectionInterval, setDetectionInterval] = useState<NodeJS.Timeout | null>(null);
  const [cacheInfo, setCacheInfo] = useState<{ size: string; cached: number } | null>(null);
  const [showDocs, setShowDocs] = useState(false);
  const [processEveryNFrames, setProcessEveryNFrames] = useState(3);
  const frameCountRef = useRef(0);
  const [isDetecting, setIsDetecting] = useState(false);
  const [showClassSelector, setShowClassSelector] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const [modelStatus, setModelStatus] = useState<Record<string, ModelStatus>>({
    object: { loaded: false, loading: false },
    pose: { loaded: false, loading: false },
    pose3d: { loaded: false, loading: false },
    animal: { loaded: false, loading: false },
  });

  const [detectorKey, setDetectorKey] = useState(0);

  useEffect(() => {
    async function loadCacheInfo() {
      const cacheInfo = await getCacheInfo();
      setCacheInfo({ size: cacheInfo.totalSizeFormatted, cached: cacheInfo.cachedModels.length });
    }
    loadCacheInfo();
  }, []);

  const copyCode = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(id);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const initDetectorWithFallback = async (mode: 'object' | 'pose' | 'pose3d' | 'animal') => {
    try {
      let detector: any;
      const be: 'wasm' | 'webgpu' | undefined = 'wasm';
      if (mode === 'object') detector = new ObjectDetector({ classes: selectedClasses.length > 0 ? selectedClasses : null, mode: perfMode, backend: be, confidence: 0.3, cache: true });
      else if (mode === 'pose') detector = new PoseDetector({ detConfidence: 0.5, poseConfidence: 0.3, backend: be, cache: true });
      else if (mode === 'pose3d') detector = new Pose3DDetector({ detConfidence: 0.45, poseConfidence: 0.3, backend: be, cache: true, detectorType: detectorType === 'mediapipe-rtmw3d' ? 'mediapipe-rtmw3d' : 'yolo-rtmw3d' });
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
  };

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
        console.log(`[Playground] Detector initialized successfully`);
        
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
  }, [mode, perfMode, backend, animalPoseModel, detectorType, detectorKey]);

  useEffect(() => {
    if (objectDetector?.setClasses) objectDetector.setClasses(selectedClasses.length > 0 ? selectedClasses : null);
  }, [selectedClasses, objectDetector]);

  useEffect(() => {
    setDetectorKey(k => k + 1);
  }, [detectorType]);

  useEffect(() => {
    if (animalDetector?.setClasses) animalDetector.setClasses(selectedAnimalClasses.length > 0 ? selectedAnimalClasses : null);
  }, [selectedAnimalClasses, animalDetector]);

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

  const processDetection = async () => {
    if (!canvasRef.current || !overlayRef.current) {
      console.error('[Playground] Canvas not ready');
      return;
    }
    if (!modelStatus[mode].loaded) {
      console.error('[Playground] Model not loaded');
      return;
    }
    if (isDetecting) return;

    if ((useCamera || videoSrc) && frameCountRef.current++ % processEveryNFrames !== 0) return;

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
      console.error('[Playground] Detection error:', error);
    } finally {
      setIsDetecting(false);
    }
  };

  const process3DResult = (result3d: any, canvasWidth?: number, canvasHeight?: number): Detection[] => {
    const keypoints = result3d.keypoints || [], keypoints2d = result3d.keypoints2d || [], scores = result3d.scores || [];
    const detections: Detection[] = [];
    for (let i = 0; i < keypoints.length; i++) {
      const personKeypoints2d = keypoints2d[i], personScores = scores[i];
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const kpt of personKeypoints2d) { minX = Math.min(minX, kpt[0]); minY = Math.min(minY, kpt[1]); maxX = Math.max(maxX, kpt[0]); maxY = Math.max(maxY, kpt[1]); }
      const width = canvasWidth || canvasRef.current?.width || 640, height = canvasHeight || canvasRef.current?.height || 480;
      detections.push({ bbox: { x1: Math.max(0, minX - 20), y1: Math.max(0, minY - 20), x2: Math.min(width, maxX + 20), y2: Math.min(height, maxY + 20), confidence: personScores.reduce((a: number, b: number) => a + b, 0) / personScores.length }, keypoints: personKeypoints2d.map((kpt: number[], idx: number) => ({ x: kpt[0], y: kpt[1], score: personScores[idx], visible: personScores[idx] > 0.3 })), keypoints3d: keypoints[i] });
    }
    (detections as any).stats = result3d.stats;
    return detections;
  };

  const drawAnimalResults = (ctx: CanvasRenderingContext2D, animals: any[]) => {
    const colors = ['#ff6b6b', '#51cf66', '#339af0', '#ffd43b', '#da77f2', '#ff922b'];
    animals.forEach((animal: any, idx: number) => {
      const color = colors[idx % colors.length];
      ctx.strokeStyle = color; ctx.lineWidth = 3;
      ctx.strokeRect(animal.bbox.x1, animal.bbox.y1, animal.bbox.x2 - animal.bbox.x1, animal.bbox.y2 - animal.bbox.y1);
      ctx.fillStyle = color; ctx.font = 'bold 14px Inter, sans-serif';
      ctx.fillText(`${animal.className} ${(animal.bbox.confidence * 100).toFixed(0)}%`, animal.bbox.x1, animal.bbox.y1 - 8);
      animal.keypoints?.forEach((kp: any) => { if (kp.visible) { ctx.fillStyle = '#51cf66'; ctx.beginPath(); ctx.arc(kp.x, kp.y, 5, 0, Math.PI * 2); ctx.fill(); } });
    });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    if (file.type.startsWith('video/')) { setVideoSrc(url); setImageSrc(null); setHasImage(false); setUseCamera(false); setIsPlaying(false); stopDetectionLoop(); }
    else { setImageSrc(url); setVideoSrc(null); setUseCamera(false); setHasImage(true); setIsPlaying(false); stopDetectionLoop(); }
  };

  const startVideoDetection = async () => {
    if (!videoRef.current || !videoSrc) return;
    try {
      videoRef.current.src = videoSrc; videoRef.current.load();
      await new Promise((resolve) => { const t = setTimeout(resolve, 5000); videoRef.current!.addEventListener('loadeddata', () => { clearTimeout(t); resolve(true); }, { once: true }); });
      if (canvasRef.current && videoRef.current) { canvasRef.current.width = videoRef.current.videoWidth || 640; canvasRef.current.height = videoRef.current.videoHeight || 480; }
      await videoRef.current.play(); setIsPlaying(true); setHasImage(false);
      setDetectionInterval(setInterval(() => { if (videoRef.current && !videoRef.current.paused && !videoRef.current.ended) processDetection(); }, 100));
    } catch { setIsPlaying(false); }
  };

  const stopDetectionLoop = () => { if (detectionInterval) { clearInterval(detectionInterval); setDetectionInterval(null); } if (videoRef.current) videoRef.current.pause(); setIsPlaying(false); };

  useEffect(() => { return () => { stopDetectionLoop(); if (videoSrc) URL.revokeObjectURL(videoSrc); }; }, []);
  useEffect(() => { if (!videoRef.current) return; const h = () => { setIsPlaying(false); stopDetectionLoop(); }; videoRef.current.addEventListener('ended', h); return () => videoRef.current?.removeEventListener('ended', h); }, [videoSrc]);

  const toggleClass = (cls: string) => setSelectedClasses(prev => prev.includes(cls) ? prev.filter(c => c !== cls) : [...prev, cls]);
  const toggleAnimalClass = (cls: string) => setSelectedAnimalClasses(prev => prev.includes(cls) ? prev.filter(c => c !== cls) : [...prev, cls]);
  const selectAllClasses = () => setSelectedClasses([...COCO_CLASSES]);
  const deselectAllClasses = () => setSelectedClasses([]);

  useEffect(() => { if (canvasRef.current) { const ctx = canvasRef.current.getContext('2d'); if (ctx) { ctx.fillStyle = '#1e293b'; ctx.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height); } setDetections([]); setStats(null); } }, [mode]);

  const backendOptions = [
    { value: 'webgpu', label: 'WebGPU (GPU)', icon: <Monitor className="w-5 h-5" /> },
    { value: 'webgl', label: 'WebGL (GPU)', icon: <Aperture className="w-5 h-5" /> },
    { value: 'webnn', label: 'WebNN (AI Accelerator)', icon: <Cpu className="w-5 h-5" /> },
    { value: 'wasm', label: 'WASM (CPU)', icon: <Terminal className="w-5 h-5" /> },
  ];

  const modeIcons = { object: Search, pose: User, pose3d: Box, animal: PawPrint };
  const ModeIcon = modeIcons[mode];

  if (modelStatus[mode].loading) {
    return (
      <div className="animated-bg min-h-screen flex items-center justify-center">
        <div className="text-center p-8 glass-card rounded-3xl">
          <Loader2 className="w-16 h-16 mx-auto mb-6 text-blue-400 animate-spin" />
          <h2 className="text-2xl font-bold gradient-text mb-2">Loading {mode === 'pose3d' ? '3D Pose' : mode} Detector...</h2>
          <p className="text-slate-400">Initializing AI models</p>
        </div>
      </div>
    );
  }

  if (modelStatus[mode].error) {
    return (
      <div className="animated-bg min-h-screen flex items-center justify-center p-4">
        <div className="text-center p-8 glass-card rounded-3xl max-w-md">
          <AlertCircle className="w-16 h-16 mx-auto mb-4 text-red-400" />
          <h2 className="text-2xl font-bold text-red-400 mb-4">Failed to Load Model</h2>
          <p className="text-slate-400 mb-6 break-words">{modelStatus[mode].error}</p>
          <button onClick={() => setModelStatus(prev => ({ ...prev, [mode]: { loaded: false, loading: true } }))} className="btn-glow px-8 py-4 bg-gradient-to-r from-blue-500 to-purple-500 text-white font-bold rounded-2xl shadow-lg">Try Again</button>
        </div>
      </div>
    );
  }

  return (
    <div className="animated-bg min-h-screen">
      <div className="max-w-[1600px] mx-auto p-4 sm:p-6 lg:p-8">
        {/* Header */}
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
            <button onClick={() => setShowDocs(!showDocs)} className="btn-glow flex items-center gap-2 px-6 py-3 rounded-2xl border border-purple-500/30 bg-gradient-to-r from-purple-500/20 to-blue-500/20 text-slate-100 font-semibold hover:from-purple-500/40 hover:to-blue-500/40 transition-all">
              <FileText className="w-5 h-5" />
              {showDocs ? 'Hide Docs' : 'Quick Docs'}
            </button>
          </div>
        </header>

        {/* Documentation */}
        {showDocs && (
          <div className="mb-8 p-6 glass-card rounded-3xl card-enter">
            {/* GitHub Link */}
            <div className="mb-6 p-4 bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-2xl border border-blue-500/20 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-gradient-to-br from-blue-500 to-purple-500 rounded-xl">
                  <Github className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-100">rtmlib-ts on GitHub</h3>
                  <p className="text-slate-400 text-sm">TypeScript port of rtmlib for browser-based AI inference</p>
                </div>
              </div>
              <a
                href="https://github.com/GOH23/rtmlib-ts"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-blue-500 to-purple-500 text-white font-semibold rounded-xl hover:shadow-lg hover:shadow-blue-500/25 transition-all"
              >
                <ExternalLink className="w-5 h-5" />
                View on GitHub
              </a>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {[
                {
                  icon: Search,
                  title: 'Object Detection',
                  desc: 'Detect 80 COCO classes using YOLOv12 or MediaPipe EfficientDet',
                  code: `import { ObjectDetector } from 'rtmlib-ts';

// Initialize with YOLO
const detector = new ObjectDetector({
  model: 'https://huggingface.co/demon2233/rtmlib-ts/resolve/main/yolo/yolov12n.onnx',
  classes: ['person', 'car', 'dog'],
  confidence: 0.5,
  inputSize: [416, 416],
  backend: 'webgl',
});
await detector.init();

// Detect from canvas
const results = await detector.detectFromCanvas(canvas);
console.log(\`Found \${results.length} objects\`);`,
                  id: 'object'
                },
                {
                  icon: User,
                  title: 'Pose Estimation (2D)',
                  desc: '17 keypoints (COCO) with RTMW or 33 with MediaPipe BlazePose',
                  code: `import { PoseDetector } from 'rtmlib-ts';

// Initialize with YOLO + RTMW
const detector = new PoseDetector({
  detModel: 'https://huggingface.co/demon2233/rtmlib-ts/resolve/main/yolo/yolov12n.onnx',
  poseModel: 'https://huggingface.co/demon2233/rtmlib-ts/resolve/main/rtmpose/end2end.onnx',
  detInputSize: [416, 416],
  poseInputSize: [384, 288],
  detConfidence: 0.5,
  poseConfidence: 0.3,
  backend: 'webgl',
});
await detector.init();

const poses = await detector.detectFromCanvas(canvas);
console.log(\`Found \${poses.length} people\`);`,
                  id: 'pose'
                },
                {
                  icon: Box,
                  title: 'Pose Estimation (3D)',
                  desc: '3D pose with Z-coordinates in meters using RTMW3D-X',
                  code: `import { Pose3DDetector } from 'rtmlib-ts';

// Initialize with YOLO + RTMW3D
const detector = new Pose3DDetector({
  detModel: 'https://huggingface.co/demon2233/rtmlib-ts/resolve/main/yolo/yolov12n.onnx',
  poseModel: 'https://huggingface.co/Soykaf/RTMW3D-x/resolve/main/onnx/rtmw3d-x.onnx',
  detInputSize: [640, 640],
  poseInputSize: [288, 384],
  detConfidence: 0.45,
  poseConfidence: 0.3,
  backend: 'webgl',
  detectorType: 'yolo-rtmw3d', // or 'mediapipe-rtmw3d' for faster
});
await detector.init();

const result = await detector.detectFromCanvas(canvas);
console.log(result.keypoints[0][0]); // [x, y, z] in meters`,
                  id: 'pose3d'
                },
                {
                  icon: PawPrint,
                  title: 'Animal Detection',
                  desc: '30 animal species with ViTPose++ pose estimation',
                  code: `import { AnimalDetector } from 'rtmlib-ts';

// Initialize with ViTPose-B
const detector = new AnimalDetector({
  poseModelType: 'vitpose-b',
  classes: ['dog', 'cat', 'horse'],
  detConfidence: 0.5,
  poseConfidence: 0.3,
  backend: 'webgl',
});
await detector.init();

const animals = await detector.detectFromCanvas(canvas);
console.log(\`Found \${animals.length} animals\`);`,
                  id: 'animal'
                },
              ].map((card) => {
                const Icon = card.icon;
                const isCopied = copiedCode === card.id;
                return (
                  <div key={card.id} className="p-5 rounded-2xl border bg-blue-500/10 border-blue-500/20 glass-card-hover">
                    <div className="flex items-center gap-3 mb-3">
                      <Icon className="w-6 h-6 text-blue-400" />
                      <h3 className="text-lg font-bold text-slate-100">{card.title}</h3>
                    </div>
                    <p className="text-slate-400 text-sm mb-4">{card.desc}</p>
                    <div className="relative">
                      <pre className="block p-4 bg-black/60 rounded-xl text-xs text-green-400 font-mono overflow-x-auto whitespace-pre-wrap border border-white/10">
                        <code>{card.code}</code>
                      </pre>
                      <button
                        onClick={() => copyCode(card.code, card.id)}
                        className="absolute top-3 right-3 p-2 rounded-lg bg-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-700/80 transition-all"
                        title="Copy code"
                      >
                        {isCopied ? (
                          <CheckCircle2 className="w-4 h-4 text-green-400" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* MediaPipe + RTMW3D Card */}
            <div className="mt-4 p-5 rounded-2xl border bg-green-500/10 border-green-500/30 glass-card-hover">
              <div className="flex items-center gap-3 mb-3">
                <Zap className="w-6 h-6 text-green-400" />
                <h3 className="text-lg font-bold text-slate-100">MediaPipe + RTMW3D (FASTEST)</h3>
              </div>
              <p className="text-slate-400 text-sm mb-4">Best combination: MediaPipe for detection (fast) + RTMW3D for 3D pose (accurate). 2-3x faster than YOLO+3D.</p>
              <div className="relative">
                <pre className="block p-4 bg-black/60 rounded-xl text-xs text-green-400 font-mono overflow-x-auto whitespace-pre-wrap border border-white/10">
                  <code>{`import { MediaPipeObject3DPoseDetector } from 'rtmlib-ts';

// Initialize MediaPipe + RTMW3D
const detector = new MediaPipeObject3DPoseDetector({
  mpScoreThreshold: 0.5,
  poseConfidence: 0.3,
  backend: 'webgpu',
  personsOnly: true,
});
await detector.init();

const result = await detector.detectFromCanvas(canvas);
console.log(result.keypoints[0][0]); // [x, y, z] in meters`}</code>
                </pre>
                <button
                  onClick={() => copyCode(`import { MediaPipeObject3DPoseDetector } from 'rtmlib-ts';

// Initialize MediaPipe + RTMW3D
const detector = new MediaPipeObject3DPoseDetector({
  mpScoreThreshold: 0.5,
  poseConfidence: 0.3,
  backend: 'webgpu',
  personsOnly: true,
});
await detector.init();

const result = await detector.detectFromCanvas(canvas);
console.log(result.keypoints[0][0]); // [x, y, z] in meters`, 'mp-pose3d')}
                  className="absolute top-3 right-3 p-2 rounded-lg bg-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-700/80 transition-all"
                  title="Copy code"
                >
                  {copiedCode === 'mp-pose3d' ? (
                    <CheckCircle2 className="w-4 h-4 text-green-400" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-6 p-6 glass-card rounded-3xl">
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2">
              <Target className="w-4 h-4" /> Mode
            </label>
            <CustomSelect
              value={mode}
              onChange={(v) => setMode(v as any)}
              options={[
                { value: 'object', label: 'Object Detection', icon: <Search className="w-5 h-5" /> },
                { value: 'pose', label: 'Pose Estimation (2D)', icon: <User className="w-5 h-5" /> },
                { value: 'pose3d', label: 'Pose Estimation (3D)', icon: <Box className="w-5 h-5" /> },
                { value: 'animal', label: 'Animal Detection', icon: <PawPrint className="w-5 h-5" /> },
              ]}
            />
          </div>

          {(mode === 'object' || mode === 'pose' || mode === 'pose3d') && (
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                <Layers className="w-4 h-4" /> Detector Type
              </label>
              <CustomSelect
                value={detectorType}
                onChange={(v) => setDetectorType(v as any)}
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

          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2">
              <Gauge className="w-4 h-4" /> Performance
            </label>
            <CustomSelect
              value={perfMode}
              onChange={(v) => setPerfMode(v as any)}
              options={[
                { value: 'performance', label: 'Performance (640×640)', icon: <Zap className="w-5 h-5" /> },
                { value: 'balanced', label: 'Balanced (416×416)', icon: <BoxSelect className="w-5 h-5" /> },
                { value: 'lightweight', label: 'Lightweight (320×320)', icon: <Gauge className="w-5 h-5" /> },
              ]}
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2">
              <Cpu className="w-4 h-4" /> Backend
            </label>
            <CustomSelect
              value={backend}
              onChange={(v) => setBackend(v as any)}
              options={backendOptions}
            />
          </div>

          {(useCamera || videoSrc) && (
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Frame Skip</label>
              <CustomSelect
                value={String(processEveryNFrames)}
                onChange={(v) => setProcessEveryNFrames(Number(v))}
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

          {mode === 'animal' && (
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Animal Model</label>
              <CustomSelect
                value={animalPoseModel}
                onChange={(v) => setAnimalPoseModel(v as any)}
                options={(Object.keys(VITPOSE_MODELS) as Array<keyof typeof VITPOSE_MODELS>).map(key => ({
                  value: key,
                  label: `${VITPOSE_MODELS[key].name} - ${VITPOSE_MODELS[key].ap} AP`,
                }))}
              />
            </div>
          )}

          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2">
              <Video className="w-4 h-4" /> Input Source
            </label>
            <div className="flex gap-2 flex-wrap">
              <button onClick={() => { setUseCamera(!useCamera); setVideoSrc(null); stopDetectionLoop(); }} className={`flex items-center gap-2 px-4 py-3 rounded-xl font-semibold transition-all ${useCamera ? 'bg-gradient-to-r from-cyan-400 to-green-400 text-slate-900' : 'bg-blue-500/20 text-slate-100 border border-white/15'}`}>
                <Camera className="w-4 h-4" /> {useCamera ? 'On' : 'Camera'}
              </button>
              {videoSrc && (
                <button onClick={isPlaying ? stopDetectionLoop : startVideoDetection} className={`flex items-center gap-2 px-4 py-3 rounded-xl font-semibold transition-all ${isPlaying ? 'bg-gradient-to-r from-green-400 to-cyan-400 text-slate-900' : 'bg-gradient-to-r from-cyan-400 to-green-400 text-slate-900'}`}>
                  {isPlaying ? <Square className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  {isPlaying ? 'Stop' : 'Play'}
                </button>
              )}
            </div>
            <label className="inline-flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-blue-500 to-purple-500 text-white font-semibold rounded-xl text-center cursor-pointer hover:shadow-lg hover:shadow-blue-500/25 transition-all text-sm">
              <Upload className="w-4 h-4" /> Upload
              <input type="file" accept="image/*,video/*" onChange={handleFileUpload} className="hidden" />
            </label>
          </div>

          {mode === 'object' && (
            <div className="flex flex-col gap-2 sm:col-span-2 lg:col-span-3 xl:col-span-4">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                  <Filter className="w-4 h-4" /> Classes ({selectedClasses.length} selected)
                </label>
                <button
                  onClick={() => setShowClassSelector(!showClassSelector)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-all ${showClassSelector ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : 'bg-slate-900/50 text-slate-400 border border-white/10 hover:bg-slate-800/50'}`}
                >
                  {showClassSelector ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  {showClassSelector ? 'Hide Selector' : 'Show All 80 Classes'}
                </button>
              </div>
              {showClassSelector ? (
                <ClassSelector
                  selectedClasses={selectedClasses}
                  onToggleClass={toggleClass}
                  onSelectAll={selectAllClasses}
                  onDeselectAll={deselectAllClasses}
                />
              ) : (
                <div className="flex flex-wrap gap-2">
                  {selectedClasses.slice(0, 10).map(cls => (
                    <span key={cls} className="px-3 py-1.5 rounded-lg bg-blue-500/20 text-blue-400 text-sm border border-blue-500/30">{cls}</span>
                  ))}
                  {selectedClasses.length > 10 && (
                    <span className="px-3 py-1.5 rounded-lg bg-slate-900/50 text-slate-400 text-sm border border-white/10">+{selectedClasses.length - 10} more</span>
                  )}
                  {selectedClasses.length === 0 && (
                    <span className="text-slate-500 text-sm">No classes selected</span>
                  )}
                </div>
              )}
            </div>
          )}

          {mode === 'animal' && (
            <div className="flex flex-col gap-2 sm:col-span-2 lg:col-span-3 xl:col-span-4">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Animal Classes</label>
              <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                {['dog', 'cat', 'horse', 'zebra', 'elephant', 'tiger', 'lion', 'panda'].map(cls => (
                  <label key={cls} className="flex items-center gap-2 text-sm p-3 bg-blue-500/10 rounded-xl cursor-pointer hover:bg-blue-500/20 transition-all text-slate-100">
                    <input type="checkbox" checked={selectedAnimalClasses.includes(cls)} onChange={() => toggleAnimalClass(cls)} className="w-4 h-4 accent-blue-500" />{cls}
                  </label>
                ))}
              </div>
            </div>
          )}

          <button 
            onClick={processDetection} 
            disabled={isDetecting || !modelStatus[mode].loaded}
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

        {/* Canvas Container */}
        <div className="relative rounded-3xl overflow-hidden glass-card mb-6 shadow-2xl canvas-container">
          {imageSrc && (
            <img ref={imageRef} src={imageSrc} alt="Uploaded" className="media-element" onLoad={(e) => { const img = e.target as HTMLImageElement; if (canvasRef.current && overlayRef.current) { canvasRef.current.width = img.naturalWidth; canvasRef.current.height = img.naturalHeight; overlayRef.current.width = img.naturalWidth; overlayRef.current.height = img.naturalHeight; } }} />
          )}
          {videoSrc && !useCamera && (
            <video ref={videoRef} muted loop playsInline className="media-element" onLoadedMetadata={() => { if (canvasRef.current && videoRef.current && overlayRef.current) { canvasRef.current.width = videoRef.current.videoWidth; canvasRef.current.height = videoRef.current.videoHeight; overlayRef.current.width = videoRef.current.videoWidth; overlayRef.current.height = videoRef.current.videoHeight; } }} />
          )}
          {useCamera && (
            <video ref={videoRef} muted playsInline autoPlay className="media-element" onLoadedMetadata={() => { if (canvasRef.current && videoRef.current && overlayRef.current) { canvasRef.current.width = videoRef.current.videoWidth; canvasRef.current.height = videoRef.current.videoHeight; overlayRef.current.width = videoRef.current.videoWidth; overlayRef.current.height = videoRef.current.videoHeight; } }} />
          )}
          <canvas ref={canvasRef} className="canvas-overlay opacity-0 pointer-events-none" width={640} height={480} />
          <canvas ref={overlayRef} className="canvas-overlay pointer-events-none" width={640} height={480} />
          
          {!modelStatus[mode].loaded && !modelStatus[mode].loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-40">
              <div className="text-center p-6 glass-card rounded-2xl">
                <AlertCircle className="w-12 h-12 mx-auto mb-4 text-yellow-400" />
                <p className="text-slate-300 font-semibold">Model not loaded</p>
                <p className="text-slate-400 text-sm mt-2">Select a mode and wait for initialization</p>
              </div>
            </div>
          )}
        </div>

        {/* Status badges */}
        <div className="flex flex-wrap gap-3 mb-6">
          {videoSrc && (
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
              <PawPrint className="w-4 h-4" /> {VITPOSE_MODELS[animalPoseModel].name} ({VITPOSE_MODELS[animalPoseModel].ap} AP)
            </div>
          )}
          {modelStatus[mode].loaded && (
            <div className="badge badge-green">
              <CheckCircle2 className="w-4 h-4" /> Ready
            </div>
          )}
        </div>

        {/* Stats */}
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

        {/* Cache */}
        {cacheInfo && (
          <div className="flex justify-between items-center p-5 glass-card rounded-2xl mb-6">
            <div className="flex items-center gap-3 text-slate-400">
              <Layers className="w-5 h-5" />
              <span>Cache:</span>
              <span className="text-green-400 font-bold">{cacheInfo.size}</span>
              <span className="text-slate-500 text-sm">({cacheInfo.cached} models)</span>
            </div>
            <button onClick={async () => { await clearModelCache(); setCacheInfo({ size: '0 B', cached: 0 }); setModelStatus({ object: { loaded: false, loading: false }, pose: { loaded: false, loading: false }, pose3d: { loaded: false, loading: false }, animal: { loaded: false, loading: false } }); setDetectorKey(k => k + 1); }} className="flex items-center gap-2 px-5 py-2 rounded-xl border border-red-500/30 bg-red-500/20 text-red-400 font-semibold hover:bg-red-500/30 transition-all">
              <Trash2 className="w-4 h-4" /> Clear
            </button>
          </div>
        )}

        {/* Results */}
        {detections.length > 0 && (
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
                  <div className="text-slate-500 font-mono text-sm">[{getBboxValue(det, 'x1')}, {getBboxValue(det, 'y1')}, {getBboxValue(det, 'x2')}, {getBboxValue(det, 'y2')}]</div>
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
        )}
      </div>
    </div>
  );
}
