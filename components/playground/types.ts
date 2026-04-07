export interface Detection {
  bbox: { x1: number; y1: number; x2: number; y2: number; confidence: number };
  className?: string;
  keypoints?: any[];
  keypoints3d?: number[][];
  classId?: number;
}

export interface ModelStatus {
  loaded: boolean;
  loading: boolean;
  error?: string;
}

export interface DetectionStats {
  time: number;
  count: number;
  detTime?: number;
  poseTime?: number;
}

export interface CacheInfo {
  size: string;
  cached: number;
}

export type DetectionMode = 'object' | 'pose' | 'pose3d' | 'animal';
export type DetectorType = 'yolo' | 'mediapipe' | 'yolo-rtmw3d' | 'mediapipe-rtmw3d';
export type PerfMode = 'performance' | 'balanced' | 'lightweight';
export type Backend = 'wasm' | 'webgl' | 'webgpu' | 'webnn';
export type AnimalPoseModel = 'vitpose-s' | 'vitpose-b' | 'vitpose-l';
