'use client';

import { useState } from 'react';
import {
  Search, User, Box, PawPrint, Zap, FileText, Github, ExternalLink,
  Copy, CheckCircle2, Monitor, Aperture, Cpu, Terminal, Target,
  Layers, Brain
} from 'lucide-react';
import { DetectionMode } from './types';

interface DocCard {
  icon: any;
  title: string;
  desc: string;
  code: string;
  id: string;
}

export interface PlaygroundDocsProps {
  copiedCode: string | null;
  onCopyCode: (code: string, id: string) => void;
}

const DOC_CARDS: DocCard[] = [
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
  poseModel: 'https://huggingface.co/Soykaf/RTMW3D-x/resolve/main/onnx/rtmw3d-x_8xb64_cocktail14-384x288-b0a0eab7_20240626.onnx',
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
];

export function PlaygroundDocs({ copiedCode, onCopyCode }: PlaygroundDocsProps) {
  return (
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
        {DOC_CARDS.map((card) => {
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
                  onClick={() => onCopyCode(card.code, card.id)}
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
            onClick={() => onCopyCode(`import { MediaPipeObject3DPoseDetector } from 'rtmlib-ts';

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
  );
}
