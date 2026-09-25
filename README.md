# rtmlib-ts Playground

Interactive Next.js playground for **rtmlib-ts 0.1.0** — object detection, 2D/3D pose estimation, and animal pose in the browser on all four ONNX Runtime Web backends (WASM, WebGL, WebGPU, WebNN).

The UI is a faithful port of the standalone Vite demo (`demo/main.ts` from the rtmlib-ts repo): the whole page is built by `components/playground/demo-app.ts`, mounted from a small React wrapper.

## Quick Start

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Open in browser
http://localhost:3000
```

> Fixture photos/videos live in the top-level `examples/` directory and are served at `/examples/*` by `app/examples/[...path]/route.ts` (with HTTP range support for video seeking). No media is copied into `public/`.

## Tabs

| Tab | Pipeline | Models |
| --- | --- | --- |
| **Object** | YOLO (`ObjectDetector`) and MediaPipe EfficientDet-Lite0 | yolov8n / yolov12n / yolo26n, TFLite |
| **Pose 2D** | YOLO → RTMW | 17 COCO keypoints, 2D skeleton |
| **Pose 3D** | `objectModel` × `pose3dModel` (8 combos) | yolov8n / yolov12n / yolo26n / mediapipe × rtmw3d / instanthmr |
| **Animal** | YOLO12 → ViTPose++ | 30 species, `vitpose-s` / `-b` / `-l` |

Each card has its own model + backend selectors and an **Initialize & run** button. Nothing is downloaded until you pick a model and click it. Tabs are mounted lazily; the Object tab stays warm, the others dispose their detectors when you switch away.

### Pose 3D extras

- **Photo card** — single-frame detection with per-stage profiling (`Det`, `Infer`, `Post`).
- **Video card** — continuous `requestVideoFrameCallback` loop after the photo card is ready, live FPS, and a **three.js picture-in-picture** that renders the same 3D skeleton (COCO17 or MHR70 mesh) with OrbitControls.

### Fixtures

- Photos: `photo_detect_pose_3d.png`, `pose_soccer.png` (3 players)
- Videos: `dance_detect_pose_3d.mp4`, `dance_multiply.mp4` (multi-person)
- **Drag & drop** any image/video anywhere on the page to add it as a fixture for the current session.

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Library**: `rtmlib-ts@^0.1.0`
- **Runtime**: ONNX Runtime Web (transitive via rtmlib-ts); COOP/COEP headers enable threaded WASM
- **3D view**: three.js
- **Styling**: plain CSS (`app/globals.css`, ported 1:1 from the demo's tokens)

## Project Layout

```
app/
  layout.tsx                  # metadata + telemetry block script
  globals.css                 # demo styles (light/dark theme tokens)
  page.tsx                    # client-only mount
  examples/[...path]/route.ts # streams fixtures from ../../examples
components/playground/
  demo-app.ts                 # ported demo: panels, drag & drop, 3D viewer
  PlaygroundContent.tsx       # static shell (header/hintbar/footer) + mount effect
demo/                         # original standalone Vite demo (reference)
examples/                     # fixture images/videos
```

## Notes

- The `demo/` folder is the original reference implementation and is excluded from `tsconfig` / ESLint; it is not bundled.
- `node_modules/rtmlib-ts/dist/core/instanthmrGeometry` is imported directly for the MHR70 skeleton edges used by the three.js viewer.
- Model weights load from HuggingFace on first use and are cached via the library's Cache API support.

## License

Apache 2.0
