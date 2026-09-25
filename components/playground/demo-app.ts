/**
 * rtmlib-ts playground. Tabbed single-page app covering the five
 * public detector families:
 *
 *   - ObjectDetector   (YOLO12 / YOLOv8n / YOLO26 + MediaPipe EfficientDet)
 *   - PoseDetector     (YOLO12 → RTMW, 17 COCO keypoints)
 *   - Pose3DDetector   (orthogonal `objectModel` × `pose3dModel` —
 *                       8 combinations: yolov{8,12,26}n / mediapipe
 *                       × {rtmw3d, instanthmr})
 *   - AnimalDetector   (YOLO12 → ViTPose++, 30 species)
 *
 * Tabs:
 *   Object · Pose 2D · Pose 3D · Animal
 *
 * Each tab is a `Panel` with a `mount()` and `dispose()`. Tabs are
 * mounted lazily on first activation so the page doesn't pull down
 * ~120 MB of model weights on load. The Object tab is in
 * `keepWarmIds` — revisiting it doesn't re-init. Other tabs dispose
 * the detector on switch so memory releases.
 *
 * This is a framework-agnostic port of the standalone Vite demo
 * (`demo/main.ts` in the rtmlib-ts repo) so the Next.js playground
 * behaves exactly like the reference demo. `mountDemo()` builds the
 * whole UI inside a host element and returns a handle whose
 * `destroy()` tears the panels + listeners down again.
 */

import {
  ObjectDetector,
  PoseDetector,
  Pose3DDetector,
  AnimalDetector,
  drawResultsOnCanvas,
  drawMhr70OnCanvas,
  initOnnxRuntimeWeb,
  type DetectedObject,
  type Pose3DObjectModel,
  type Pose3DModel,
  type Pose3DDetectorResult,
  type Pose3DProfile,
  type VitPoseModelType,
} from 'rtmlib-ts';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { SKELETON_EDGES as MHR70_EDGES } from 'rtmlib-ts/dist/core/instanthmrGeometry';

// =========================================================================
// Paths — fixtures are served by the Next.js app from the top-level
// `examples/` directory under `/examples/*` (see
// `app/examples/[...path]/route.ts`). Model URLs are intentionally NOT
// specified below: the library ships sensible defaults (`YOLO_VERSIONS.yolov12n`
// for person detection, `INSTANTHMR_MODEL_URL` for InstantHMR,
// `MEDIAPIPE_EFFICIENTDET_URL` for MediaPipe, etc.) and picks them up under
// the hood so the playground never has to thread HF URLs through every
// constructor call.
// =========================================================================

// Fixture registry. The user can switch between photos and videos at runtime
// via the per-card fixture selector or by dropping a file anywhere on the
// page; the rest of the playground reads `currentPhotoSrc` / `currentVideoSrc`
// so the swap is transparent.
interface Fixture { value: string; src: string; label: string }

const PHOTO_FIXTURES: Fixture[] = [
  { value: 'photo_detect_pose_3d', src: '/examples/photo_detect_pose_3d.png', label: 'photo_detect_pose_3d.png' },
  { value: 'pose_soccer',          src: '/examples/pose_soccer.png',          label: 'pose_soccer.png (3 players)' },
];
const VIDEO_FIXTURES: Fixture[] = [
  { value: 'dance_detect_pose_3d', src: '/examples/dance_detect_pose_3d.mp4', label: 'dance_detect_pose_3d.mp4' },
  { value: 'dance_multiply',       src: '/examples/dance_multiply.mp4',       label: 'dance_multiply.mp4 (multi-person)' },
];
let currentPhotoSrc = PHOTO_FIXTURES[0]!.src;
let currentVideoSrc = VIDEO_FIXTURES[0]!.src;
// Keep `PHOTO_SRC` and `VIDEO_SRC` as callable aliases for any code path
// that hasn't been migrated to the registry yet. They always reflect the
// active fixture.
const PHOTO_SRC = () => currentPhotoSrc;
const VIDEO_SRC = () => currentVideoSrc;

// Every fixture `<select>` registers itself here so a dropped file can be
// appended to all of them at once, whichever panels are mounted.
const fixtureSelects: Record<'photo' | 'video', HTMLSelectElement[]> = { photo: [], video: [] };

/**
 * Build a `<select>` for picking a fixture. Returns the `<select>` element
 * plus an `onChange(handler)` registration helper that fires after the DOM
 * event with the updated `src` string.
 */
function createFixtureSelect(
  kind: 'photo' | 'video',
  initialValue: string,
  fixtures: Fixture[],
): { select: HTMLSelectElement; setValue: (v: string) => void; onChange: (cb: (src: string, value: string) => void) => void } {
  const select = el('select', { title: 'Fixture', 'data-testid': 'fixture-select', 'data-kind': kind }) as HTMLSelectElement;
  for (const f of fixtures) select.appendChild(el('option', { value: f.value, text: f.label }));
  select.value = initialValue;
  fixtureSelects[kind].push(select);
  return {
    select,
    setValue: (v) => { select.value = v; },
    onChange: (cb) => {
      select.addEventListener('change', () => {
        const f = fixtures.find((x) => x.value === select.value);
        if (f) cb(f.src, f.value);
      });
    },
  };
}

// =========================================================================
// Drag & drop — drop a file anywhere to swap the active fixture
// =========================================================================

const droppedObjectUrls: Record<'photo' | 'video', string | null> = { photo: null, video: null };
let droppedFixtureCounter = 0;

function addDroppedFixture(kind: 'photo' | 'video', file: File): void {
  if (droppedObjectUrls[kind]) URL.revokeObjectURL(droppedObjectUrls[kind]!);
  const url = URL.createObjectURL(file);
  droppedObjectUrls[kind] = url;

  const fixture: Fixture = {
    value: `dropped-${++droppedFixtureCounter}`,
    src: url,
    label: `${file.name} (dropped)`,
  };
  (kind === 'photo' ? PHOTO_FIXTURES : VIDEO_FIXTURES).push(fixture);
  if (kind === 'photo') currentPhotoSrc = url;
  else currentVideoSrc = url;

  // Append + select the option in every fixture select of that kind and let
  // the existing change handlers invalidate the detectors / stop the loops.
  for (const select of fixtureSelects[kind]) {
    select.appendChild(el('option', { value: fixture.value, text: fixture.label }));
    select.value = fixture.value;
    select.dispatchEvent(new Event('change'));
  }
}

function installDragAndDrop(): () => void {
  const title = el('strong', { text: 'Drop file to test' });
  const sub = el('span', { text: 'Image feeds the photo panels · video feeds the 3D video card' });
  const card = el('div', { class: 'drop-card' }, [title, sub]);
  const overlay = el('div', { class: 'drop-overlay', hidden: true }, [card]);
  document.body.appendChild(overlay);

  let depth = 0;
  let disposed = false;
  const carriesFiles = (e: DragEvent): boolean =>
    !!e.dataTransfer && Array.from(e.dataTransfer.types).includes('Files');
  const hide = (): void => { depth = 0; overlay.hidden = true; };

  const onDragEnter = (e: DragEvent): void => {
    if (!carriesFiles(e)) return;
    e.preventDefault();
    depth += 1;
    overlay.hidden = false;
  };
  const onDragOver = (e: DragEvent): void => {
    if (carriesFiles(e)) e.preventDefault();
  };
  const onDragLeave = (e: DragEvent): void => {
    if (!carriesFiles(e)) return;
    depth = Math.max(0, depth - 1);
    if (depth === 0) hide();
  };
  const onDrop = (e: DragEvent): void => {
    if (!carriesFiles(e)) return;
    e.preventDefault();
    hide();

    const file = e.dataTransfer?.files?.[0];
    if (!file) return;

    if (file.type.startsWith('image/')) {
      addDroppedFixture('photo', file);
    } else if (file.type.startsWith('video/')) {
      addDroppedFixture('video', file);
    } else {
      card.classList.add('is-error');
      title.textContent = 'Unsupported file';
      sub.textContent = `${file.name} — drop a PNG/JPEG image or an MP4/WebM video`;
      overlay.hidden = false;
      setTimeout(() => {
        if (disposed) return;
        card.classList.remove('is-error');
        title.textContent = 'Drop file to test';
        sub.textContent = 'Image feeds the photo panels · video feeds the 3D video card';
        hide();
      }, 2200);
    }
  };

  window.addEventListener('dragenter', onDragEnter);
  window.addEventListener('dragover', onDragOver);
  window.addEventListener('dragleave', onDragLeave);
  window.addEventListener('drop', onDrop);

  return () => {
    disposed = true;
    window.removeEventListener('dragenter', onDragEnter);
    window.removeEventListener('dragover', onDragOver);
    window.removeEventListener('dragleave', onDragLeave);
    window.removeEventListener('drop', onDrop);
    overlay.remove();
  };
}

const YOLO_VERSIONS: Array<'yolov8n' | 'yolov12n' | 'yolo26n'> = [
  'yolov8n',
  'yolov12n',
  'yolo26n',
];

/**
 * The hosted YOLO26n export is fixed at 640×640, while `ObjectDetector` and
 * `PoseDetector` default to 416 (speed preset). Passing an explicit input
 * size for that version keeps both panels working without library changes.
 */
function yoloInputSize(version: 'yolov8n' | 'yolov12n' | 'yolo26n'): [number, number] | undefined {
  return version === 'yolo26n' ? [640, 640] : undefined;
}

// Pose3DDetector's pipeline is composed from two orthogonal selectors —
// `objectModel` (which person detector) and `pose3dModel` (which 3D pose
// model). All 8 combinations (4 objectModels × 2 pose3dModels) are valid.
const POSE3D_OBJECT_MODELS: Pose3DObjectModel[] = ['yolov8n', 'yolov12n', 'yolo26n', 'mediapipe'];
const POSE3D_MODELS: Pose3DModel[] = ['rtmw3d', 'instanthmr'];
const VITPOSE_MODELS: VitPoseModelType[] = ['vitpose-s', 'vitpose-b', 'vitpose-l'];
type Pose3DBackend = 'wasm' | 'webgl' | 'webgpu' | 'webnn';
const POSE3D_BACKENDS: Pose3DBackend[] = ['wasm', 'webgpu', 'webgl', 'webnn'];

// Object panel backend selector — same shape as POSE3D_BACKENDS. The user
// picks per-card; the backend flows into the constructor's `backend` field.
// Both Object cards (YOLO / MediaPipe) accept any of these; each backend
// is forwarded as-is to the underlying wrapper.
type ObjectBackend = Pose3DBackend;
const OBJECT_BACKENDS: ObjectBackend[] = ['wasm', 'webgpu', 'webgl', 'webnn'];

// =========================================================================
// Bootstrap — `mountDemo()` is the single entry point used by the React
// wrapper. It builds the tabbed UI inside `root` and returns a teardown
// handle so React can unmount cleanly (and StrictMode's double-mount in
// development doesn't leak panels / listeners).
// =========================================================================

export interface DemoHandle {
  destroy(): void;
}

export function mountDemo(root: HTMLElement): DemoHandle {
  // Reset the per-mount registries. Module-level state (fixture lists,
  // active sources) intentionally survives a remount so dropped files and
  // the selected fixture persist across React dev refreshes.
  fixtureSelects.photo.length = 0;
  fixtureSelects.video.length = 0;

  initOnnxRuntimeWeb();
  root.textContent = '';

  const panels: Panel[] = [
    createObjectPanel(),
    createPose2DPanel(),
    createPose3DPanel(),
    createAnimalPanel(),
  ];
  const tabs = createTabs(root, panels, { initialId: 'object', keepWarmIds: ['object'] });
  const uninstallDragAndDrop = installDragAndDrop();

  return {
    destroy() {
      uninstallDragAndDrop();
      tabs.dispose();
      for (const p of panels) {
        try {
          p.dispose();
        } catch {
          // dispose() is best-effort — a failed teardown must not block unmount
        }
      }
      root.textContent = '';
    },
  };
}

// =========================================================================
// Tiny DOM helpers — local to this file so the demo stays a single page.
// =========================================================================

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Record<string, unknown> = {},
  children: Array<Node | string> = [],
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') node.className = String(v);
    else if (k === 'text') node.textContent = String(v);
    else if (k === 'html') node.innerHTML = String(v);
    else if (k.startsWith('data-') || k.startsWith('aria-')) node.setAttribute(k, String(v));
    else if (k.startsWith('on') && typeof v === 'function') {
      node.addEventListener(k.slice(2).toLowerCase(), v as EventListener);
    } else {
      (node as unknown as Record<string, unknown>)[k] = v;
    }
  }
  for (const c of children) {
    node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  }
  return node;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    img.src = src;
  });
}

function fmt(ms: number): string {
  return `${ms.toFixed(0)} ms`;
}

function stat(
  label: string,
  value: string,
  variant: 'ms' | 'count' | 'plain' | '' = 'plain',
  tone: 'ok' | '' = '',
): HTMLElement {
  const cls = [variant === 'plain' ? '' : variant, tone].filter(Boolean).join(' ');
  const code = el('code', { class: cls, text: value });
  return el('span', {}, [`${label} `, code]);
}

function setBadge(badge: HTMLElement, state: BadgeState, label: string): void {
  badge.dataset.state = state;
  // Strip the legacy "● "/"⚠ " prefixes — the colour dot is drawn by CSS.
  badge.textContent = label.replace(/^[●⚠]\s*/, '');
}

type BadgeState = 'initializing' | 'ready' | 'running' | 'error' | 'idle' | 'uninitialized' | 'outdated';

// =========================================================================
// Panel + tab framework
// =========================================================================

interface Panel {
  id: 'object' | 'pose2d' | 'pose3d' | 'animal';
  label: string;
  tabEl: HTMLButtonElement;
  panelEl: HTMLElement;
  tabBadge: HTMLElement;
  mounted: boolean;
  /** Build the panel's DOM (runs once, after createTabs has assigned panelEl). */
  build(): void;
  mount(): Promise<void>;
  dispose(): void;
  setState(state: BadgeState, label?: string): void;
}

interface TabOptions {
  initialId: Panel['id'];
  keepWarmIds?: Panel['id'][];
}

function createTabs(
  appEl: HTMLElement,
  panels: Panel[],
  opts: TabOptions,
): { activate(id: Panel['id']): void; dispose(): void } {
  const keepWarm = new Set(opts.keepWarmIds ?? []);
  const nav = el('nav', { class: 'tabs', role: 'tablist', 'aria-label': 'Detector families' });
  let disposed = false;

  // Build tabs first, panels get appended after.
  for (const p of panels) {
    const badge = el('span', { class: 'badge', 'data-state': 'idle', text: '● idle' });
    const tab = el(
      'button',
      {
        class: 'tab',
        role: 'tab',
        id: `tab-${p.id}`,
        'aria-selected': 'false',
        'aria-controls': `panel-${p.id}`,
        tabindex: '-1',
      },
      [p.label, badge],
    );
    p.tabEl = tab;
    p.tabBadge = badge;
    nav.appendChild(tab);
  }
  appEl.appendChild(nav);

  // Build panels.
  for (const p of panels) {
    const panel = el('section', {
      class: 'panel',
      role: 'tabpanel',
      id: `panel-${p.id}`,
      'aria-labelledby': `tab-${p.id}`,
      hidden: true,
    });
    p.panelEl = panel;
    appEl.appendChild(panel);
  }

  let activeId: Panel['id'] | null = null;

  async function activate(id: Panel['id']): Promise<void> {
    if (disposed) return;
    if (id === activeId) {
      // already active — noop
      return;
    }
    const incoming = panels.find((p) => p.id === id);
    if (!incoming) return;

    // 1. update aria + hidden
    for (const p of panels) {
      const selected = p.id === id;
      p.tabEl.setAttribute('aria-selected', selected ? 'true' : 'false');
      p.tabEl.setAttribute('tabindex', selected ? '0' : '-1');
      p.panelEl.hidden = !selected;
    }

    // 2. dispose outgoing unless keepWarm or same
    const outgoing = activeId ? panels.find((p) => p.id === activeId) : null;
    if (outgoing && outgoing !== incoming && !keepWarm.has(outgoing.id)) {
      try {
        outgoing.dispose();
      } catch (e) {
        console.error(`dispose(${outgoing.id}) failed`, e);
      }
    }

    activeId = id;

    // 3. mount incoming if not yet mounted
    if (!incoming.mounted) {
      // first time: build the DOM inside the now-attached panelEl
      incoming.build();
      incoming.setState('initializing', '● initializing…');
      try {
        await incoming.mount();
      } catch (e) {
        incoming.setState('error', `⚠ ${(e as Error).message}`);
        console.error(`mount(${incoming.id}) failed`, e);
      }
    }
  }

  for (const p of panels) {
    p.tabEl.addEventListener('click', () => void activate(p.id));
    p.tabEl.addEventListener('keydown', (e) => {
      const idx = panels.findIndex((q) => q.id === p.id);
      let next: number | null = null;
      if (e.key === 'ArrowRight') next = (idx + 1) % panels.length;
      else if (e.key === 'ArrowLeft') next = (idx - 1 + panels.length) % panels.length;
      else if (e.key === 'Home') next = 0;
      else if (e.key === 'End') next = panels.length - 1;
      if (next !== null) {
        e.preventDefault();
        const target = panels[next];
        target.tabEl.focus();
        void activate(target.id);
      }
    });
  }

  void activate(opts.initialId);

  const onBeforeUnload = (): void => {
    for (const p of panels) {
      try {
        p.dispose();
      } catch {}
    }
  };
  window.addEventListener('beforeunload', onBeforeUnload);

  return {
    activate: (id) => void activate(id),
    dispose() {
      disposed = true;
      window.removeEventListener('beforeunload', onBeforeUnload);
    },
  };
}

// =========================================================================
// Section shell — the standard panel-sub-section block.
// =========================================================================

interface SectionShell {
  headerEl: HTMLElement;
  titleEl: HTMLElement;
  subEl: HTMLElement;
  controlsEl: HTMLElement;
  statusBadge: HTMLElement;
  backendPill: HTMLElement;
  rerunBtn: HTMLButtonElement;
  alertEl: HTMLElement;
  warnEl: HTMLElement;
  stageEl: HTMLElement;
  statsEl: HTMLElement;
  detailsEl: HTMLDetailsElement;
  preEl: HTMLElement;
}

function createSectionShell(opts: {
  title: string;
  sub?: string;
  primary?: boolean; // primary Re-run button vs secondary
}): SectionShell {
  const headerEl = el('div', { class: 'panel-head' });
  const titleEl = el('h3', { class: 'panel-title', text: opts.title });
  const subEl = opts.sub
    ? el('p', { class: 'panel-sub', text: opts.sub })
    : (el('p', { class: 'panel-sub' }) as HTMLElement);
  headerEl.append(titleEl, subEl);

  const statusBadge = el('span', { class: 'badge', 'data-state': 'idle', text: '● idle' });
  const backendPill = el('span', { class: 'pill backend', text: 'backend', title: 'ONNX runtime backend' });
  const rerunBtn = el('button', {
    class: opts.primary === false ? 'secondary' : 'primary',
    text: 'Re-run',
    disabled: true,
    type: 'button',
  });
  const controlsEl = el('div', { class: 'row controls' }, [statusBadge, backendPill, rerunBtn]);

  const alertEl = el('div', { class: 'alert', hidden: true });
  const warnEl = el('div', { class: 'warn', hidden: true });
  const stageEl = el('div', { class: 'stage', hidden: true });
  const statsEl = el('div', { class: 'stats mono', hidden: true });

  const preEl = el('pre', {});
  const summaryEl = el('summary', { text: 'Details' });
  const detailsEl = el('details', { hidden: true }, [summaryEl, preEl]) as HTMLDetailsElement;

  return {
    headerEl, titleEl, subEl,
    controlsEl, statusBadge, backendPill, rerunBtn,
    alertEl, warnEl, stageEl, statsEl,
    detailsEl, preEl,
  };
}

function showAlert(alertEl: HTMLElement, message: string): void {
  alertEl.textContent = `⚠ ${message}`;
  alertEl.hidden = false;
}
function clearAlert(alertEl: HTMLElement): void {
  alertEl.textContent = '';
  alertEl.hidden = true;
}

// =========================================================================
// Object panel (YOLO + MediaPipe cards)
// =========================================================================

function createObjectPanel(): Panel {
  // ---- shared DOM refs (declared up here so build() and mount() both close over them)
  let yoloShell: SectionShell;
  let mpShell: SectionShell;
  let yoloModelSelect: HTMLSelectElement;
  let yoloBackendSelect: HTMLSelectElement;
  let mpBackendSelect: HTMLSelectElement;
  let yoloDetector: ObjectDetector | null = null;
  let yoloDirty = true; // selector changed or never initialized
  let yoloRunning = false;
  let mpDetector: ObjectDetector | null = null;
  let mpDirty = true;
  let mpRunning = false;

  const panel: Panel = {
    id: 'object',
    label: 'Object',
    tabEl: undefined as unknown as HTMLButtonElement,
    panelEl: undefined as unknown as HTMLElement,
    tabBadge: undefined as unknown as HTMLElement,
    mounted: false,
    build() {
      panel.panelEl.appendChild(
        el('h2', { text: 'Object detection' }),
      );
      panel.panelEl.appendChild(
        el('p', { class: 'panel-sub', text: 'Two backends over the same ONNX Runtime — YOLO (multi-class ONNX) and MediaPipe EfficientDet-Lite0 (TFLite). Pick the backend per card.' }),
      );

      // Photo fixture for both cards — detection reads the current source at
      // run time, so switching just invalidates the cached detectors.
      const photoFixture = createFixtureSelect('photo', PHOTO_FIXTURES[0]!.value, PHOTO_FIXTURES);
      photoFixture.onChange((src) => {
        currentPhotoSrc = src;
        armYolo();
        armMp();
      });
      panel.panelEl.appendChild(
        el('div', { class: 'row fixture-row' }, [
          el('span', { class: 'field-label', text: 'Photo fixture' }),
          photoFixture.select,
        ]),
      );

      yoloShell = createSectionShell({
        title: 'YOLO',
        sub: 'Person + multi-class. v8 / v12 / v26 ONNX exports.',
        primary: true,
      });
      mpShell = createSectionShell({
        title: 'MediaPipe EfficientDet-Lite0',
        sub: 'TFLite, runs through @mediapipe/tasks-vision.',
        primary: true,
      });
      // Default to an empty selection — the user must pick before the model
      // is downloaded. No auto-init. Initialize button stays disabled until
      // a real value is chosen.
      yoloModelSelect = el('select', {}) as HTMLSelectElement;
      yoloModelSelect.appendChild(el('option', { value: '', text: '— pick a model —' }));
      for (const name of YOLO_VERSIONS) {
        yoloModelSelect.appendChild(el('option', { value: name, text: name }));
      }
      yoloModelSelect.value = '';
      yoloShell.controlsEl.insertBefore(yoloModelSelect, yoloShell.rerunBtn);

      // Per-card backend selectors — every card gets the full set of
      // backends. The user picks freely; if a backend can't run the
      // graph, the underlying `InferenceSession.create()` throws and the
      // demo shows the error on the card. The existing webgpu→wasm
      // fallback in the Pose 3D panel is a separate (panel-level)
      // concern; the Object panel surfaces init errors as-is.
      function appendBackendSelect(parent: HTMLElement, before: HTMLElement): HTMLSelectElement {
        const sel = el('select', { title: 'ONNX execution backend' }) as HTMLSelectElement;
        sel.appendChild(el('option', { value: '', text: '— backend —' }));
        for (const b of OBJECT_BACKENDS) {
          sel.appendChild(el('option', { value: b, text: b }));
        }
        sel.value = '';
        parent.insertBefore(sel, before);
        return sel;
      }
      yoloBackendSelect = appendBackendSelect(yoloShell.controlsEl, yoloShell.rerunBtn);
      mpBackendSelect = appendBackendSelect(mpShell.controlsEl, mpShell.rerunBtn);

      const yoloCard = el('div', { class: 'card' });
      yoloCard.append(
        yoloShell.headerEl, yoloShell.controlsEl,
        yoloShell.alertEl, yoloShell.warnEl,
        yoloShell.stageEl, yoloShell.statsEl, yoloShell.detailsEl,
      );
      const mpCard = el('div', { class: 'card' });
      mpCard.append(
        mpShell.headerEl, mpShell.controlsEl,
        mpShell.alertEl, mpShell.warnEl,
        mpShell.stageEl, mpShell.statsEl, mpShell.detailsEl,
      );
      panel.panelEl.append(yoloCard, mpCard);

      // ---- Per-card lifecycle helpers ----

      function updateYoloControls(): void {
        const modelChosen = yoloModelSelect.value !== '';
        const backendChosen = yoloBackendSelect.value !== '';
        yoloShell.rerunBtn.disabled = !modelChosen || !backendChosen || yoloRunning;
        yoloShell.rerunBtn.textContent =
          yoloDirty && modelChosen ? 'Initialize & run' : 'Re-run';
      }
      function armYolo(): void {
        yoloDirty = true;
        if (yoloDetector) {
          yoloDetector.dispose();
          yoloDetector = null;
        }
        yoloShell.stageEl.hidden = true;
        yoloShell.statsEl.hidden = true;
        yoloShell.detailsEl.hidden = true;
        clearAlert(yoloShell.alertEl);
        setBadge(yoloShell.statusBadge, 'uninitialized', '● pick a model + backend');
        updateYoloControls();
      }

      function updateMpControls(): void {
        const backendChosen = mpBackendSelect.value !== '';
        mpShell.rerunBtn.disabled = !backendChosen || mpRunning;
        mpShell.rerunBtn.textContent = mpDirty ? 'Initialize & run' : 'Re-run';
      }
      function armMp(): void {
        mpDirty = true;
        if (mpDetector) {
          mpDetector.dispose();
          mpDetector = null;
        }
        mpShell.stageEl.hidden = true;
        mpShell.statsEl.hidden = true;
        mpShell.detailsEl.hidden = true;
        clearAlert(mpShell.alertEl);
        setBadge(mpShell.statusBadge, 'uninitialized', '● pick a backend');
        updateMpControls();
      }

      async function clickYolo(): Promise<void> {
        if (yoloRunning) return;
        if (yoloModelSelect.value === '') return;
        if (yoloBackendSelect.value === '') return;
        yoloRunning = true;
        updateYoloControls();
        try {
          if (yoloDirty || !yoloDetector) {
            const version = yoloModelSelect.value as 'yolov8n' | 'yolov12n' | 'yolo26n';
            yoloDetector = new ObjectDetector({
              detectorType: 'yolo',
              classes: null,
              cache: true,
              yoloVersion: version,
              inputSize: yoloInputSize(version),
              backend: yoloBackendSelect.value as 'wasm' | 'webgl' | 'webgpu' | 'webnn',
            });
            setBadge(yoloShell.statusBadge, 'initializing', '● initializing…');
            await yoloDetector.init();
            yoloDirty = false;
            yoloShell.backendPill.textContent = yoloBackendSelect.value;
            setBadge(yoloShell.statusBadge, 'ready', '● ready');
          }
          setBadge(yoloShell.statusBadge, 'running', '● running…');
          const img = await loadImage(PHOTO_SRC());
          const t0 = performance.now();
          const results = await yoloDetector.detectFromImage(img);
          const detectMs = performance.now() - t0;
          drawBoxes(yoloShell.stageEl, img, results);
          yoloShell.statsEl.hidden = false;
          yoloShell.statsEl.innerHTML = '';
          yoloShell.statsEl.append(
            stat('Detect', fmt(detectMs), 'ms'),
            stat('Objects', String(results.length), 'count'),
          );
          yoloShell.preEl.textContent = results
            .map(
              (r, i) =>
                `#${i}  ${r.className}  ${(r.confidence * 100).toFixed(1)}%  ` +
                `[${r.bbox.x1.toFixed(0)}, ${r.bbox.y1.toFixed(0)}, ` +
                `${r.bbox.x2.toFixed(0)}, ${r.bbox.y2.toFixed(0)}]`,
            )
            .join('\n');
          yoloShell.detailsEl.hidden = results.length === 0;
          setBadge(yoloShell.statusBadge, 'ready', `● ready (${yoloModelSelect.value})`);
        } catch (e) {
          showAlert(yoloShell.alertEl, (e as Error).message);
          setBadge(yoloShell.statusBadge, 'error', `⚠ ${(e as Error).message}`);
        } finally {
          yoloRunning = false;
          updateYoloControls();
        }
      }

      async function clickMp(): Promise<void> {
        if (mpRunning) return;
        if (mpBackendSelect.value === '') return;
        mpRunning = true;
        updateMpControls();
        try {
          if (mpDirty || !mpDetector) {
            mpDetector = new ObjectDetector({
              detectorType: 'mediapipe',
              classes: null,
              cache: true,
              // MediaPipe runs its own TFLite runtime, but the field still
              // gates the underlying ONNX EP we ask for; on non-wasm the
              // constructor logs but doesn't fail. Forward the user's pick.
              backend: mpBackendSelect.value as 'wasm' | 'webgl' | 'webgpu' | 'webnn',
            });
            setBadge(mpShell.statusBadge, 'initializing', '● initializing…');
            await mpDetector.init();
            mpDirty = false;
            mpShell.backendPill.textContent = mpBackendSelect.value;
            setBadge(mpShell.statusBadge, 'ready', '● ready');
          }
          setBadge(mpShell.statusBadge, 'running', '● running…');
          const img = await loadImage(PHOTO_SRC());
          const t0 = performance.now();
          const results = await mpDetector.detectFromImage(img);
          const detectMs = performance.now() - t0;
          drawBoxes(mpShell.stageEl, img, results);
          mpShell.statsEl.hidden = false;
          mpShell.statsEl.innerHTML = '';
          mpShell.statsEl.append(
            stat('Detect', fmt(detectMs), 'ms'),
            stat('Objects', String(results.length), 'count'),
          );
          mpShell.preEl.textContent = results
            .map(
              (r, i) =>
                `#${i}  ${r.className}  ${(r.confidence * 100).toFixed(1)}%  ` +
                `[${r.bbox.x1.toFixed(0)}, ${r.bbox.y1.toFixed(0)}, ` +
                `${r.bbox.x2.toFixed(0)}, ${r.bbox.y2.toFixed(0)}]`,
            )
            .join('\n');
          mpShell.detailsEl.hidden = results.length === 0;
          setBadge(mpShell.statusBadge, 'ready', '● ready');
        } catch (e) {
          showAlert(mpShell.alertEl, (e as Error).message);
          setBadge(mpShell.statusBadge, 'error', `⚠ ${(e as Error).message}`);
        } finally {
          mpRunning = false;
          updateMpControls();
        }
      }

      // ---- Wire controls ----
      yoloModelSelect.addEventListener('change', armYolo);
      yoloBackendSelect.addEventListener('change', armYolo);
      mpBackendSelect.addEventListener('change', armMp);
      yoloShell.rerunBtn.addEventListener('click', () => void clickYolo());
      mpShell.rerunBtn.addEventListener('click', () => void clickMp());

      // Initial state — no fetch, no init. arm*() reads the new
      // backend selects and disables Initialize until both picks (model +
      // backend for YOLO; just backend for MP) are made.
      armYolo();
      armMp();
    },
    async mount() {
      // No auto-init — the user picks a model + clicks Initialize on each card.
      setBadge(panel.tabBadge, 'idle', '● idle');
      panel.mounted = true;
    },
    dispose() {
      if (yoloDetector) {
        yoloDetector.dispose();
        yoloDetector = null;
      }
      if (mpDetector) {
        mpDetector.dispose();
        mpDetector = null;
      }
      yoloDirty = true;
      mpDirty = true;
      if (yoloShell) {
        yoloShell.stageEl.hidden = true;
        yoloShell.statsEl.hidden = true;
        yoloShell.detailsEl.hidden = true;
        setBadge(yoloShell.statusBadge, 'uninitialized', '● pick a model + backend');
      }
      if (mpShell) {
        mpShell.stageEl.hidden = true;
        mpShell.statsEl.hidden = true;
        mpShell.detailsEl.hidden = true;
        setBadge(mpShell.statusBadge, 'uninitialized', '● pick a backend');
      }
      yoloModelSelect.value = '';
      if (yoloBackendSelect) yoloBackendSelect.value = '';
      if (mpBackendSelect) mpBackendSelect.value = '';
      yoloShell.rerunBtn.disabled = true;
      yoloShell.rerunBtn.textContent = 'Initialize & run';
      mpShell.rerunBtn.disabled = true;
      mpShell.rerunBtn.textContent = 'Initialize & run';
      if (yoloShell.backendPill) yoloShell.backendPill.textContent = 'backend';
      if (mpShell.backendPill) mpShell.backendPill.textContent = 'backend';
      setBadge(panel.tabBadge, 'idle', '● idle');
    },
    setState(s, l) { setBadge(this.tabBadge, s, l ?? ''); },
  };

  return panel;
}

// =========================================================================
// Pose 2D panel
// =========================================================================

interface Person2D {
  keypoints: Array<{ x: number; y: number; score: number; visible: boolean; name: string }>;
}

function createPose2DPanel(): Panel {
  let shell: SectionShell;
  let detector: PoseDetector | null = null;
  let yoloModelSelect: HTMLSelectElement;
  let dirty = true;
  let running = false;
  let activeYoloVersion: 'yolov8n' | 'yolov12n' | 'yolo26n' = 'yolov12n';

  const panel: Panel = {
    id: 'pose2d',
    label: 'Pose 2D',
    tabEl: undefined as unknown as HTMLButtonElement,
    panelEl: undefined as unknown as HTMLElement,
    tabBadge: undefined as unknown as HTMLElement,
    mounted: false,
    build() {
      shell = createSectionShell({
        title: 'Pose 2D',
        sub: 'YOLO12 person detect → RTMW (17 COCO keypoints, 2D skeleton).',
        primary: true,
      });
      shell.detailsEl.querySelector('summary')!.textContent = 'Keypoints (first person)';

      // YOLO version picker — model swap requires detector rebuild so it
      // just routes through `arm()`. Mirrors the Object panel.
      yoloModelSelect = el('select', { title: 'Person detector (YOLO version)' }) as HTMLSelectElement;
      yoloModelSelect.appendChild(el('option', { value: '', text: '— pick a YOLO —' }));
      for (const name of YOLO_VERSIONS) {
        yoloModelSelect.appendChild(el('option', { value: name, text: name }));
      }
      yoloModelSelect.value = '';
      shell.controlsEl.insertBefore(yoloModelSelect, shell.rerunBtn);

      // Photo fixture selector. Pose2D has only one card, so the
      // fixture swap is global. Mirrors the Pose3D photo card's logic.
      const photoFixture = createFixtureSelect('photo', PHOTO_FIXTURES[0]!.value, PHOTO_FIXTURES);
      photoFixture.onChange((src) => {
        currentPhotoSrc = src;
        if (detector) { detector.dispose(); detector = null; }
        dirty = true;
        shell.stageEl.hidden = true;
        shell.statsEl.hidden = true;
        shell.detailsEl.hidden = true;
        setBadge(shell.statusBadge, 'uninitialized', '● fixture changed — re-initialize');
        shell.rerunBtn.textContent = 'Initialize & run';
        updateControls();
      });
      shell.controlsEl.insertBefore(photoFixture.select, shell.rerunBtn);

      const card = el('div', { class: 'card' });
      card.append(
        shell.headerEl, shell.controlsEl,
        shell.alertEl, shell.warnEl,
        shell.stageEl, shell.statsEl, shell.detailsEl,
      );
      panel.panelEl.append(
        el('h2', { text: '2D pose estimation' }),
        el('p', { class: 'panel-sub', text: 'YOLO12 person detector feeds RTMW to produce 17 COCO keypoints per person.' }),
        card,
      );

      function updateControls(): void {
        shell.rerunBtn.disabled = running || yoloModelSelect.value === '';
        shell.rerunBtn.textContent = dirty ? 'Initialize & run' : 'Re-run';
      }

      async function click(): Promise<void> {
        if (running) return;
        if (yoloModelSelect.value === '') return;
        running = true;
        updateControls();
        try {
          if (dirty || !detector) {
            activeYoloVersion = yoloModelSelect.value as 'yolov8n' | 'yolov12n' | 'yolo26n';
            detector = new PoseDetector({
              cache: true,
              yoloVersion: activeYoloVersion,
              detInputSize: yoloInputSize(activeYoloVersion),
            });
            setBadge(shell.statusBadge, 'initializing', `● initializing (${activeYoloVersion})…`);
            await detector.init();
            dirty = false;
            setBadge(shell.statusBadge, 'ready', `● ready (${activeYoloVersion})`);
          }
          setBadge(shell.statusBadge, 'running', '● running…');
          const img = await loadImage(PHOTO_SRC());
          const t0 = performance.now();
          const poses = await detector.detectFromImage(img);
          const detectMs = performance.now() - t0;
          shell.stageEl.innerHTML = '';
          shell.stageEl.hidden = false;
          const wrap = el('div', { style: 'position:relative; display:inline-block' });
          wrap.append(
            el('img', { src: PHOTO_SRC(), alt: 'fixture' }),
            el('canvas', { class: 'overlay' }),
          );
          shell.stageEl.appendChild(wrap);
          const overlay = wrap.querySelector('canvas')! as HTMLCanvasElement;
          overlay.width = img.naturalWidth;
          overlay.height = img.naturalHeight;
          drawResultsOnCanvas(overlay.getContext('2d')!, poses, 'pose');
          shell.statsEl.hidden = false;
          shell.statsEl.innerHTML = '';
          shell.statsEl.append(
            stat('Detect', fmt(detectMs), 'ms'),
            stat('People', String(poses.length), 'count'),
          );
          if (poses.length) {
            shell.preEl.textContent = (poses[0].keypoints as Person2D['keypoints'])
              .map(
                (k, i) =>
                  `${i.toString().padStart(2)}  (${k.x.toFixed(0)}, ${k.y.toFixed(0)})  ` +
                  `score ${k.score.toFixed(2)}  ${k.name}`,
              )
              .join('\n');
            shell.detailsEl.hidden = false;
          } else {
            shell.detailsEl.hidden = true;
          }
          setBadge(shell.statusBadge, 'ready', '● ready');
        } catch (e) {
          showAlert(shell.alertEl, (e as Error).message);
          setBadge(shell.statusBadge, 'error', `⚠ ${(e as Error).message}`);
        } finally {
          running = false;
          updateControls();
        }
      }

      shell.rerunBtn.addEventListener('click', () => void click());
      yoloModelSelect.addEventListener('change', () => {
        // YOLO version swap means a new ONNX file → must rebuild the detector.
        dirty = true;
        if (detector) {
          detector.dispose();
          detector = null;
        }
        clearAlert(shell.alertEl);
        setBadge(shell.statusBadge, 'uninitialized', '● pick a YOLO + click Initialize');
        shell.stageEl.hidden = true;
        shell.statsEl.hidden = true;
        shell.detailsEl.hidden = true;
        updateControls();
      });
      shell.backendPill.textContent = 'webgl';
      setBadge(shell.statusBadge, 'uninitialized', '● pick a YOLO');
      updateControls();
    },
    async mount() {
      // No auto-init — user must click Initialize.
      setBadge(panel.tabBadge, 'idle', '● idle');
      panel.mounted = true;
    },
    dispose() {
      if (detector) {
        detector.dispose();
        detector = null;
      }
      dirty = true;
      activeYoloVersion = 'yolov12n';
      if (shell) {
        shell.stageEl.hidden = true;
        shell.statsEl.hidden = true;
        shell.detailsEl.hidden = true;
        setBadge(shell.statusBadge, 'uninitialized', '● uninitialized');
        shell.rerunBtn.textContent = 'Initialize & run';
        shell.rerunBtn.disabled = false;
      }
      if (yoloModelSelect) yoloModelSelect.value = '';
      setBadge(panel.tabBadge, 'idle', '● idle');
    },
    setState(s, l) { setBadge(this.tabBadge, s, l ?? ''); },
  };

  return panel;
}

// =========================================================================
// Pose 3D panel (photo + video)
// =========================================================================

function createPose3DPanel(): Panel {
  let photoShell: SectionShell;
  let videoShell: SectionShell;
  let objectModelSelect: HTMLSelectElement;
  let pose3dModelSelect: HTMLSelectElement;
  let backendSelect: HTMLSelectElement;
  let playBtn: HTMLButtonElement;
  // `any` keeps the runtime union (`rtmw3d` | `instanthmr` results) visible
  // to TS — the conditional `Pose3DDetectorResult<T>` collapses to the
  // rtmw3d branch for the union `pose3dModel` type, which would hide the
  // InstantHMR `persons`/`keypoints3d` fields this panel reads.
  let detector: Pose3DDetector<any> | null = null;
  let dirty = true; // selectors changed (or never initialized)
  let running = false;
  let activeObjectModel: Pose3DObjectModel | '' = '';
  let activePose3dModel: Pose3DModel | '' = '';
  let activeBackend: Pose3DBackend | '' = '';

  let videoEl: HTMLVideoElement | null = null;
  let videoOverlay: HTMLCanvasElement | null = null;
  let rvfcRunning = false;
  // Reused across frames — detectFromVideo() would otherwise allocate a
  // fresh <canvas> + ctx2d every call. For 1920x1080 frames that's 8 MB
  // of pixel data + a new backing store per detect (~200 GB/s of churn
  // at 24 fps).
  let videoWorkCanvas: HTMLCanvasElement | null = null;
  let smoothedFps = 0;
  // Three.js scene that mirrors the detected skeleton in 3D inside the
  // small picture-in-picture overlay. Created on Play, disposed on
  // Pause / tab switch.
  let pose3dScene: Pose3DScene | null = null;
  const panel: Panel = {
    id: 'pose3d',
    label: 'Pose 3D',
    tabEl: undefined as unknown as HTMLButtonElement,
    panelEl: undefined as unknown as HTMLElement,
    tabBadge: undefined as unknown as HTMLElement,
    mounted: false,
    build() {
      photoShell = createSectionShell({
        title: 'Photo (single frame)',
        sub: 'Pick objectModel + pose3dModel + backend, then click Initialize & run. profile=true populates lastProfile.',
        primary: true,
      });
      videoShell = createSectionShell({
        title: 'Video (continuous detection)',
        sub: '1920×1080 WebM/MP4. Press Play to start the requestVideoFrameCallback loop (only after the photo card is ready).',
        primary: false,
      });

      // All three selectors start with a placeholder option. The Initialize
      // button stays disabled until the user picks real values for all
      // three — no model fetch fires until that point. `objectModel` and
      // `pose3dModel` are orthogonal: every combination is valid.
      objectModelSelect = el('select', { title: 'Person detector' }) as HTMLSelectElement;
      objectModelSelect.appendChild(el('option', { value: '', text: '— object —' }));
      for (const m of POSE3D_OBJECT_MODELS) {
        objectModelSelect.appendChild(el('option', { value: m, text: m }));
      }
      objectModelSelect.value = '';
      photoShell.controlsEl.insertBefore(objectModelSelect, photoShell.rerunBtn);

      pose3dModelSelect = el('select', { title: '3D pose model' }) as HTMLSelectElement;
      pose3dModelSelect.appendChild(el('option', { value: '', text: '— pose3d —' }));
      for (const m of POSE3D_MODELS) {
        pose3dModelSelect.appendChild(el('option', { value: m, text: m }));
      }
      pose3dModelSelect.value = '';
      photoShell.controlsEl.insertBefore(pose3dModelSelect, photoShell.rerunBtn);

      backendSelect = el('select', { title: 'ONNX execution backend' }) as HTMLSelectElement;
      backendSelect.appendChild(el('option', { value: '', text: '— backend —' }));
      for (const b of POSE3D_BACKENDS) {
        backendSelect.appendChild(el('option', { value: b, text: b }));
      }
      backendSelect.value = '';
      photoShell.controlsEl.insertBefore(backendSelect, photoShell.rerunBtn);

      // Photo fixture selector — picks between the bundled `photo_detect_pose_3d.png`
      // and the multi-person `pose_soccer.png`. Switching the fixture forces a
      // re-initialisation: the detector has no per-fixture state, but the
      // user's prior detector + last result are stale the moment the canvas
      // swaps underneath them.
      const photoFixture = createFixtureSelect('photo', PHOTO_FIXTURES[0]!.value, PHOTO_FIXTURES);
      photoFixture.onChange((src) => {
        currentPhotoSrc = src;
        // Bust the cached detector — the user must click Initialize & run
        // again so the new fixture's pixels feed through the pipeline once.
        if (detector) { detector.dispose(); detector = null; }
        dirty = true;
        // Clear visual state — both the rendered stage + the stats panel —
        // so the user sees the fixture swap immediately, not on next click.
        photoShell.stageEl.hidden = true;
        photoShell.statsEl.hidden = true;
        photoShell.detailsEl.hidden = true;
        setBadge(photoShell.statusBadge, 'uninitialized', '● fixture changed — click Initialize');
        photoShell.rerunBtn.textContent = 'Initialize & run';
        photoShell.backendPill.textContent = 'backend';
        updatePhotoControls();
      });
      photoShell.controlsEl.insertBefore(photoFixture.select, photoShell.rerunBtn);

      // Video fixture selector — picks between `dance_detect_pose_3d` and
      // `dance_multiply`. The video card's Play button is bound to the
      // currently-selected source. Switching stops the loop and disposes
      // the detector (no image data crosses the boundary, but the rendered
      // bones from a prior run are stale).
      const videoFixture = createFixtureSelect('video', VIDEO_FIXTURES[0]!.value, VIDEO_FIXTURES);
      videoFixture.onChange((src) => {
        currentVideoSrc = src;
        stopVideoLoop();
        if (detector) { detector.dispose(); detector = null; }
        dirty = true;
        videoShell.stageEl.hidden = true;
        videoShell.statsEl.hidden = true;
        videoShell.detailsEl.hidden = true;
        setBadge(videoShell.statusBadge, 'uninitialized', '● fixture changed — re-initialize');
        videoShell.backendPill.textContent = 'backend';
        updateVideoControls();
      });
      videoShell.controlsEl.insertBefore(videoFixture.select, videoShell.rerunBtn);

      videoShell.rerunBtn.remove();
      playBtn = el('button', { class: 'primary', text: 'Play', type: 'button', disabled: true });
      videoShell.controlsEl.appendChild(playBtn);

      photoShell.detailsEl.querySelector('summary')!.textContent = 'Profile breakdown';
      videoShell.detailsEl.querySelector('summary')!.textContent = 'Profile breakdown';

      const photoCard = el('div', { class: 'card' });
      photoCard.append(
        photoShell.headerEl, photoShell.controlsEl,
        photoShell.alertEl, photoShell.warnEl,
        photoShell.stageEl, photoShell.statsEl, photoShell.detailsEl,
      );
      const videoCard = el('div', { class: 'card' });
      videoCard.append(
        videoShell.headerEl, videoShell.controlsEl,
        videoShell.alertEl, videoShell.warnEl,
        videoShell.stageEl, videoShell.statsEl, videoShell.detailsEl,
      );
      panel.panelEl.append(
        el('h2', { text: '3D pose estimation' }),
        el('p', { class: 'panel-sub', text: 'Orthogonal selectors: objectModel (yolov8n / yolov12n / yolo26n / mediapipe) × pose3dModel (rtmw3d / instanthmr) — 8 combinations.' }),
        photoCard,
        videoCard,
      );

      function selectionsReady(): boolean {
        return (
          objectModelSelect.value !== '' &&
          pose3dModelSelect.value !== '' &&
          backendSelect.value !== ''
        );
      }

      function updatePhotoControls(): void {
        const ready = selectionsReady();
        photoShell.rerunBtn.disabled = !ready || running;
        photoShell.rerunBtn.textContent = (dirty && ready) ? 'Initialize & run' : 'Re-run';
      }

      function updateVideoControls(): void {
        playBtn.disabled = !detector || rvfcRunning;
      }

      function arm(): void {
        dirty = true;
        stopVideoLoop();
        if (detector) {
          detector.dispose();
          detector = null;
        }
        photoShell.stageEl.hidden = true;
        photoShell.statsEl.hidden = true;
        videoShell.stageEl.hidden = true;
        videoShell.statsEl.hidden = true;
        photoShell.detailsEl.hidden = true;
        videoShell.detailsEl.hidden = true;
        clearAlert(photoShell.alertEl);
        clearAlert(videoShell.alertEl);
        setBadge(photoShell.statusBadge, 'uninitialized', '● pick object + pose + backend');
        setBadge(videoShell.statusBadge, 'uninitialized', '● waiting on photo card');
        photoShell.backendPill.textContent = 'backend';
        videoShell.backendPill.textContent = 'backend';
        updatePhotoControls();
        updateVideoControls();
      }

      async function clickPhoto(): Promise<void> {
        if (running) return;
        if (!selectionsReady()) return;
        running = true;
        updatePhotoControls();
        try {
          // Resolve the active selectors up front so badge text and the
          // (optional) detector rebuild below see the same values.
          if (dirty || !detector) {
            activeObjectModel = objectModelSelect.value as Pose3DObjectModel;
            activePose3dModel = pose3dModelSelect.value as Pose3DModel;
            activeBackend = backendSelect.value as Pose3DBackend;
          }
          let comboTag = `(${activeObjectModel}+${activePose3dModel})`;
          if (dirty || !detector) {
            // mpInputMaxSize: 384 — MediaPipe's `efficientdet_lite0` is
            // roughly linear in pixel count, so dropping from 640 → 384
            // cuts detection latency to ~36% of the default. Harmless when
            // `objectModel !== 'mediapipe'` (the field is silently
            // ignored).
            detector = new Pose3DDetector({
              objectModel: activeObjectModel as Pose3DObjectModel,
              pose3dModel: activePose3dModel as Pose3DModel,
              backend: activeBackend as Pose3DBackend,
              cache: true,
              profile: true,
              mpInputMaxSize: 384,
            });
            setBadge(photoShell.statusBadge, 'initializing', `● initializing ${comboTag}…`);
            setBadge(videoShell.statusBadge, 'initializing', `● initializing ${comboTag}…`);
            clearAlert(photoShell.alertEl);
            clearAlert(videoShell.alertEl);
            try {
              await detector.init();
            } catch (initErr) {
              // WebGPU has no adapter in headless / sandboxed Chromium and
              // some virtualised setups. If the user picked webgpu and init
              // fails, fall back to wasm so the demo still produces a
              // working video card (with the 3D scene mounted). Surface the
              // fallback so they know which backend actually ran.
              if (activeBackend === 'webgpu') {
                showAlert(
                  photoShell.alertEl,
                  `⚠ WebGPU unavailable (${(initErr as Error).message}). Falling back to wasm.`,
                );
                showAlert(
                  videoShell.alertEl,
                  `⚠ WebGPU unavailable. Falling back to wasm.`,
                );
                detector.dispose?.();
                detector = new Pose3DDetector({
                  objectModel: activeObjectModel as Pose3DObjectModel,
                  pose3dModel: activePose3dModel as Pose3DModel,
                  backend: 'wasm',
                  cache: true,
                  profile: true,
                  mpInputMaxSize: 384,
                });
                activeBackend = 'wasm';
                backendSelect.value = 'wasm';
                comboTag = `(${activeObjectModel}+${activePose3dModel})`;
                await detector.init();
              } else {
                throw initErr;
              }
            }
            dirty = false;
            photoShell.backendPill.textContent = activeBackend;
            videoShell.backendPill.textContent = activeBackend;
            setBadge(photoShell.statusBadge, 'ready', `● ready ${comboTag}`);
            setBadge(videoShell.statusBadge, 'ready', `● ready ${comboTag}`);
          }
          // Run photo detection.
          setBadge(photoShell.statusBadge, 'running', '● running…');
          const img = await loadImage(PHOTO_SRC());
          const t0 = performance.now();
          const result = await detector.detectFromImage(img);
          const detectMs = performance.now() - t0;
          drawResult(photoShell.stageEl, img, result);
          photoShell.statsEl.hidden = false;
          photoShell.statsEl.innerHTML = '';
          const people = 'persons' in result ? result.persons.length : result.keypoints.length;
          photoShell.statsEl.append(
            stat('Detect', fmt(detectMs), 'ms'),
            stat('People', String(people), 'count'),
          );
          const profile: Pose3DProfile | null = detector.lastProfile;
          if (profile) {
            if (profile.mpMs !== undefined) {
              // The profile's "mpMs" field carries whichever person
              // detector ran (YOLO or MediaPipe). Label accordingly so
              // users don't mistake a YOLO detect time for MediaPipe.
              const detLabel = activeObjectModel === 'mediapipe' ? 'MP' : `Det[${activeObjectModel}]`;
              photoShell.statsEl.appendChild(stat(detLabel, fmt(profile.mpMs), 'ms'));
            }
            photoShell.statsEl.appendChild(stat('Infer', fmt(profile.inferMs), 'ms'));
            photoShell.statsEl.appendChild(stat('Post', fmt(profile.postprocessMs), 'ms'));
          }
          photoShell.detailsEl.hidden = false;
          setBadge(photoShell.statusBadge, 'ready', `● ready ${comboTag}`);
          // Now that the detector exists, the video card's Play button is meaningful.
          startVideoLoop();
          updateVideoControls();
        } catch (e) {
          showAlert(photoShell.alertEl, (e as Error).message);
          setBadge(photoShell.statusBadge, 'error', `⚠ ${(e as Error).message}`);
          setBadge(videoShell.statusBadge, 'error', `⚠ ${(e as Error).message}`);
        } finally {
          running = false;
          updatePhotoControls();
        }
      }

      objectModelSelect.addEventListener('change', arm);
      pose3dModelSelect.addEventListener('change', arm);
      backendSelect.addEventListener('change', arm);
      photoShell.rerunBtn.addEventListener('click', () => void clickPhoto());

      // Initial state — no fetch, no init.
      arm();
    },
    async mount() {
      // No auto-init — user must pick pipeline+backend + click Initialize.
      setBadge(panel.tabBadge, 'idle', '● idle');
      panel.mounted = true;
    },
    dispose() {
      stopVideoLoop();
      if (detector) {
        detector.dispose();
        detector = null;
      }
      dirty = true;
      activeObjectModel = '';
      activePose3dModel = '';
      activeBackend = '';
      if (objectModelSelect) objectModelSelect.value = '';
      if (pose3dModelSelect) pose3dModelSelect.value = '';
      if (backendSelect) backendSelect.value = '';
      if (photoShell) {
        photoShell.stageEl.hidden = true;
        photoShell.statsEl.hidden = true;
        photoShell.detailsEl.hidden = true;
        setBadge(photoShell.statusBadge, 'uninitialized', '● pick object + pose + backend');
        photoShell.rerunBtn.textContent = 'Initialize & run';
        photoShell.backendPill.textContent = 'backend';
      }
      if (videoShell) {
        videoShell.stageEl.hidden = true;
        videoShell.statsEl.hidden = true;
        videoShell.detailsEl.hidden = true;
        setBadge(videoShell.statusBadge, 'uninitialized', '● waiting on photo card');
        videoShell.backendPill.textContent = 'backend';
        playBtn.disabled = true;
        playBtn.textContent = 'Play';
      }
      photoShell.rerunBtn.disabled = true;
      setBadge(panel.tabBadge, 'idle', '● idle');
    },
    setState(s, l) { setBadge(this.tabBadge, s, l ?? ''); },
  };

  function onPlay(): void {
    rvfcRunning = true;
    playBtn.textContent = '⏸ Pause';
    step();
  }
  function onPause(): void {
    rvfcRunning = false;
    playBtn.textContent = 'Play';
  }
  function onPlayPauseClick(): void {
    if (!videoEl) return;
    if (videoEl.paused) videoEl.play().catch(() => {});
    else videoEl.pause();
  }

  function startVideoLoop(): void {
    videoShell.stageEl.innerHTML = '';
    videoShell.stageEl.hidden = false;

    // Layout: video (with 2D pose overlay) at full size + small Three.js
    // picture-in-picture overlaid in the bottom-right corner. The 3D scene
    // is created here and reused across frames; dispose() in stopVideoLoop.
    const wrap = el('div', { style: 'position:relative; display:inline-block; max-width:100%' });
    videoEl = el('video', { src: VIDEO_SRC(), muted: true, loop: true, playsInline: true });
    // crossOrigin is intentionally NOT set. The video is served same-origin
    // from Vite's `/examples/*` middleware (no CORS hop). Setting
    // `crossOrigin='anonymous'` here would force a CORS request that the
    // dev middleware doesn't answer with ACAO — the video would either fail
    // to load OR load as opaque, in which case drawing it to the export
    // canvas taints the canvas and drawImage silently produces a black
    // frame. Same-origin video + no crossOrigin = clean canvas draw.
    videoOverlay = el('canvas', { class: 'overlay' });
    wrap.append(videoEl, videoOverlay);

    // 3D scene as an absolute overlay inside the wrap (so it follows the
    // video if the user resizes the window / changes viewport).
    const stage3d = el('div', { class: 'stage-3d' });
    const canvas3d = el('canvas');
    stage3d.appendChild(canvas3d);
    stage3d.appendChild(el('div', { class: 'label', text: '3D' }));
    wrap.appendChild(stage3d);

    videoShell.stageEl.appendChild(wrap);

    try {
      pose3dScene = createPose3DScene(canvas3d);
    } catch (e) {
      // WebGL2 unavailable (very rare in 2026 browsers) — surface a
      // message in the 3D panel rather than crashing the whole card.
      const msg = el('div', { class: 'empty' }, ['WebGL unavailable']);
      stage3d.appendChild(msg);
      pose3dScene = null;
      console.warn('[pose3d] WebGL init failed:', (e as Error).message);
    }

    videoEl.addEventListener('play', onPlay);
    videoEl.addEventListener('pause', onPause);
    playBtn.addEventListener('click', onPlayPauseClick);
  }

  function stopVideoLoop(): void {
    if (videoEl) {
      try { videoEl.pause(); } catch {}
      videoEl.removeEventListener('play', onPlay);
      videoEl.removeEventListener('pause', onPause);
    }
    playBtn.removeEventListener('click', onPlayPauseClick);
    rvfcRunning = false;
    if (videoOverlay) {
      const ctx = videoOverlay.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, videoOverlay.width, videoOverlay.height);
    }
    if (pose3dScene) {
      pose3dScene.dispose();
      pose3dScene = null;
    }
    videoEl = null;
    videoOverlay = null;
    playBtn.textContent = 'Play';
  }

  function step(): void {
    if (!rvfcRunning || !detector || !videoEl || !videoOverlay) return;
    const iw = videoEl.videoWidth;
    const ih = videoEl.videoHeight;
    if (!iw || !ih) {
      requestVideoFrame(step);
      return;
    }
    if (videoOverlay.width !== iw || videoOverlay.height !== ih) {
      videoOverlay.width = iw;
      videoOverlay.height = ih;
    }
    // Lazy-create the work canvas once and reuse it. detectFromVideo()
    // creates a fresh canvas each call otherwise — at 1920x1080 that's
    // 8 MB of pixel allocation per frame.
    if (!videoWorkCanvas) {
      videoWorkCanvas = document.createElement('canvas');
      videoWorkCanvas.width = iw;
      videoWorkCanvas.height = ih;
    }
    // NOTE: do NOT clear the overlay here. Detection takes ~80 ms at this
    // resolution — ~2.5 video frames at 30 fps. If we cleared before
    // kicking off detection the user would see:
    //   t=0   : clear (overlay empty)
    //   t=80  : draw new bbox+skeleton on overlay
    //   t=110 : clear again (overlay empty during cycle 2)
    //   t=190 : draw next bbox+skeleton
    // producing a visible ~5-7 Hz blink even though detection is continuous.
    // Leaving the previous draw in place during detection gives a stable
    // visual: the bbox/skeleton persist for an extra 80 ms, then jump
    // atomically to the new pose when `drawResultOnCanvas` (which DOES
    // clear+redraw) completes below.
    const ctx = videoOverlay.getContext('2d');
    const t0 = performance.now();
    detector
      .detectFromVideo(videoEl, videoWorkCanvas)
      .then((result) => {
        if (ctx && rvfcRunning && videoEl && videoOverlay) {
          // drawResultOnCanvas internally clears + paints atomically —
          // no intermediate-blank state at this draw site.
          drawResultOnCanvas(ctx, result, iw, ih);
        }
        // Feed the same result into the Three.js scene so the user sees
        // the skeleton in 3D inside the small picture-in-picture. updatePose()
        // is a no-op for N=0 detections (skeleton persists) — same behaviour
        // as the 2D overlay's "don't clear mid-detection" choice above.
        if (pose3dScene) {
          try { pose3dScene.updatePose(result); }
          catch { /* swallow per-frame render errors so detection loop keeps going */ }
        }
        const detectMs = performance.now() - t0;
        // Exponential moving average for stable FPS read-out.
        const instantFps = detectMs > 0 ? 1000 / detectMs : 0;
        smoothedFps = smoothedFps === 0 ? instantFps : smoothedFps * 0.85 + instantFps * 0.15;

        // Per-stage breakdown — the Pose3DDetector is constructed with
        // `profile: true`, so detector.lastProfile carries mpMs / inferMs
        // / postprocessMs after every call.
        const profile = detector?.lastProfile;
        videoShell.statsEl.hidden = false;
        videoShell.statsEl.innerHTML = '';
        const people = 'persons' in result ? result.persons.length : result.keypoints.length;
        videoShell.statsEl.append(
          stat('Per-frame', fmt(detectMs), 'ms'),
          stat('FPS', fmt(smoothedFps), '', 'ok'),
          stat('People', String(people), 'count'),
        );
        if (profile) {
          if (profile.mpMs !== undefined && profile.mpMs > 0) {
            videoShell.statsEl.appendChild(stat('MP', fmt(profile.mpMs), 'ms'));
          }
          videoShell.statsEl.appendChild(stat('Infer', fmt(profile.inferMs), 'ms'));
          videoShell.statsEl.appendChild(stat('Post', fmt(profile.postprocessMs), 'ms'));
        }
      })
      .catch((e) => console.error('video detect failed', e))
      .finally(() => {
        if (rvfcRunning) requestVideoFrame(step);
      });
  }

  function requestVideoFrame(cb: () => void): void {
    const v = videoEl as unknown as { requestVideoFrameCallback?: (cb: () => void) => number };
    if (v.requestVideoFrameCallback) v.requestVideoFrameCallback(cb);
    else requestAnimationFrame(cb);
  }

  return panel;
}

// =========================================================================
// Drawing helpers (kept as module-local so the demo stays a single file)
// =========================================================================

function drawBoxes(
  stage: HTMLElement,
  img: HTMLImageElement,
  results: DetectedObject[],
): void {
  stage.innerHTML = '';
  stage.hidden = false;
  const wrap = el('div', { style: 'position:relative; display:inline-block' });
  wrap.append(
    el('img', { src: PHOTO_SRC(), alt: 'fixture' }),
    el('canvas', { class: 'overlay' }),
  );
  stage.appendChild(wrap);
  const overlay = wrap.querySelector('canvas')! as HTMLCanvasElement;
  overlay.width = img.naturalWidth;
  overlay.height = img.naturalHeight;

  const ctx = overlay.getContext('2d')!;
  ctx.clearRect(0, 0, overlay.width, overlay.height);
  ctx.font = '12px ui-monospace, monospace';
  for (const r of results) {
    const { x1, y1, x2, y2 } = r.bbox;
    ctx.strokeStyle = '#4cc2ff';
    ctx.lineWidth = 2;
    ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
    const label = `${r.className} ${Math.round(r.confidence * 100)}%`;
    const tw = ctx.measureText(label).width;
    ctx.fillStyle = '#4cc2ff';
    ctx.fillRect(x1, Math.max(0, y1 - 16), tw + 8, 16);
    ctx.fillStyle = '#04202b';
    ctx.fillText(label, x1 + 4, Math.max(12, y1 - 4));
  }
}

function drawResult(
  stage: HTMLElement,
  img: HTMLImageElement,
  result: Pose3DDetectorResult<any>,
): void {
  stage.innerHTML = '';
  stage.hidden = false;
  const wrap = el('div', { style: 'position:relative; display:inline-block' });
  wrap.append(
    el('img', { src: PHOTO_SRC(), alt: 'fixture' }),
    el('canvas', { class: 'overlay' }),
  );
  stage.appendChild(wrap);
  const overlay = wrap.querySelector('canvas')! as HTMLCanvasElement;
  overlay.width = img.naturalWidth;
  overlay.height = img.naturalHeight;
  drawResultOnCanvas(overlay.getContext('2d')!, result, overlay.width, overlay.height);
}

function drawResultOnCanvas(
  ctx: CanvasRenderingContext2D,
  result: Pose3DDetectorResult<any>,
  iw: number,
  ih: number,
): void {
  ctx.clearRect(0, 0, iw, ih);
  if ('persons' in result) {
    for (const p of result.persons) {
      const { x1, y1, x2, y2 } = p.bbox;
      ctx.strokeStyle = '#fb7185';
      ctx.lineWidth = 2;
      ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
      drawMhr70OnCanvas(ctx, p, 0, iw, ih);
    }
  } else {
    // rtmw3d branch: Pose3DResult has flat keypoints/scores/keypoints2d,
    // not the { bbox, keypoints } shape drawPoseOnCanvas wants. Build a
    // matching person array — bbox from min/max of visible keypoints2d.
    const persons = result.keypoints.map((_, i) => {
      const k2 = result.keypoints2d[i];
      const sc = result.scores[i];
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      const keypoints = k2.map(([x, y], j) => {
        const score = sc[j] ?? 0;
        const visible = score > 0.3;
        if (visible) {
          if (x < minX) minX = x;
          if (y < minY) minY = y;
          if (x > maxX) maxX = x;
          if (y > maxY) maxY = y;
        }
        return { x, y, score, visible, name: '' };
      });
      return {
        bbox: {
          x1: isFinite(minX) ? minX : 0,
          y1: isFinite(minY) ? minY : 0,
          x2: isFinite(maxX) ? maxX : 0,
          y2: isFinite(maxY) ? maxY : 0,
          confidence: sc.length ? Math.max(...sc) : 0,
        },
        keypoints,
      };
    });
    drawResultsOnCanvas(ctx, persons, 'pose');
  }
}

// =========================================================================
// Animal panel
// =========================================================================

function createAnimalPanel(): Panel {
  let shell: SectionShell;
  let modelSelect: HTMLSelectElement;
  let detector: AnimalDetector | null = null;
  let dirty = true;
  let running = false;
  let modelType: VitPoseModelType | '' = '';

  const panel: Panel = {
    id: 'animal',
    label: 'Animal',
    tabEl: undefined as unknown as HTMLButtonElement,
    panelEl: undefined as unknown as HTMLElement,
    tabBadge: undefined as unknown as HTMLElement,
    mounted: false,
    build() {
      shell = createSectionShell({
        title: 'Animal pose (30 COCO-animal species)',
        sub: 'YOLO12 → ViTPose++. The bundled photo has no animals — switch to a cat/dog/horse image to see keypoints.',
        primary: true,
      });
      shell.detailsEl.querySelector('summary')!.textContent = 'Animals detected';

      // No default model — user must pick + click Initialize.
      modelSelect = el('select', {}) as HTMLSelectElement;
      modelSelect.appendChild(el('option', { value: '', text: '— pick a model —' }));
      for (const m of VITPOSE_MODELS) {
        modelSelect.appendChild(el('option', { value: m, text: m }));
      }
      modelSelect.value = '';
      shell.controlsEl.insertBefore(modelSelect, shell.rerunBtn);

      // Photo fixture selector. Mirrors the Pose2D panel — same global
      // `currentPhotoSrc`. Note: the bundled photos are people, not
      // animals, so changing the fixture to a person image will produce
      // "no animals detected" output (intended — the swap is the point).
      const photoFixture = createFixtureSelect('photo', PHOTO_FIXTURES[0]!.value, PHOTO_FIXTURES);
      photoFixture.onChange((src) => {
        currentPhotoSrc = src;
        if (detector) { detector.dispose(); detector = null; }
        dirty = true;
        shell.stageEl.hidden = true;
        shell.statsEl.hidden = true;
        shell.detailsEl.hidden = true;
        setBadge(shell.statusBadge, 'uninitialized', '● fixture changed — re-initialize');
        shell.rerunBtn.textContent = 'Initialize & run';
        updateControls();
      });
      shell.controlsEl.insertBefore(photoFixture.select, shell.rerunBtn);

      const card = el('div', { class: 'card' });
      card.append(
        shell.headerEl, shell.controlsEl,
        shell.alertEl, shell.warnEl,
        shell.stageEl, shell.statsEl, shell.detailsEl,
      );
      panel.panelEl.append(
        el('h2', { text: 'Animal pose estimation' }),
        el('p', { class: 'panel-sub', text: 'YOLO12 detects animals → ViTPose++ produces 30-keypoint skeletons for 30 species.' }),
        card,
      );

      function updateControls(): void {
        const ready = modelSelect.value !== '';
        shell.rerunBtn.disabled = !ready || running;
        shell.rerunBtn.textContent = (dirty && ready) ? 'Initialize & run' : 'Re-run';
      }

      function arm(): void {
        dirty = true;
        if (detector) {
          detector.dispose();
          detector = null;
        }
        shell.stageEl.hidden = true;
        shell.statsEl.hidden = true;
        shell.detailsEl.hidden = true;
        clearAlert(shell.alertEl);
        setBadge(shell.statusBadge, 'uninitialized', '● pick a model');
        updateControls();
      }

      async function click(): Promise<void> {
        if (running) return;
        if (modelSelect.value === '') return;
        running = true;
        updateControls();
        try {
          if (dirty || !detector) {
            modelType = modelSelect.value as VitPoseModelType;
            detector = new AnimalDetector({
              poseModelType: modelType,
              cache: true,
            });
            setBadge(shell.statusBadge, 'initializing', `● initializing (${modelType})…`);
            await detector.init();
            dirty = false;
            setBadge(shell.statusBadge, 'ready', `● ready (${modelType})`);
          }
          setBadge(shell.statusBadge, 'running', '● running…');
          const img = await loadImage(PHOTO_SRC());
          const t0 = performance.now();
          const animals = await detector.detectFromImage(img);
          const detectMs = performance.now() - t0;
          shell.stageEl.innerHTML = '';
          shell.stageEl.hidden = false;
          const wrap = el('div', { style: 'position:relative; display:inline-block' });
          wrap.append(
            el('img', { src: PHOTO_SRC(), alt: 'fixture' }),
            el('canvas', { class: 'overlay' }),
          );
          shell.stageEl.appendChild(wrap);
          const overlay = wrap.querySelector('canvas')! as HTMLCanvasElement;
          overlay.width = img.naturalWidth;
          overlay.height = img.naturalHeight;
          drawResultsOnCanvas(overlay.getContext('2d')!, animals, 'pose');
          shell.statsEl.hidden = false;
          shell.statsEl.innerHTML = '';
          shell.statsEl.append(
            stat('Detect', fmt(detectMs), 'ms'),
            stat('Animals', String(animals.length), 'count'),
          );
          shell.preEl.textContent = animals.length
            ? animals
                .map(
                  (a, i) =>
                    `#${i}  ${a.className ?? ''}  ${((a.bbox.confidence ?? 0) * 100).toFixed(1)}%  ` +
                    `[${a.bbox.x1.toFixed(0)}, ${a.bbox.y1.toFixed(0)}, ` +
                    `${a.bbox.x2.toFixed(0)}, ${a.bbox.y2.toFixed(0)}]`,
                )
                .join('\n')
            : '(no animals detected in the bundled fixture)';
          shell.detailsEl.hidden = false;
          setBadge(shell.statusBadge, 'ready', `● ready (${modelType})`);
        } catch (e) {
          showAlert(shell.alertEl, (e as Error).message);
          setBadge(shell.statusBadge, 'error', `⚠ ${(e as Error).message}`);
        } finally {
          running = false;
          updateControls();
        }
      }

      modelSelect.addEventListener('change', arm);
      shell.rerunBtn.addEventListener('click', () => void click());
      shell.backendPill.textContent = 'webgpu';
      arm();
    },
    async mount() {
      // No auto-init — user must pick a model + click Initialize.
      setBadge(panel.tabBadge, 'idle', '● idle');
      panel.mounted = true;
    },
    dispose() {
      if (detector) {
        detector.dispose();
        detector = null;
      }
      dirty = true;
      modelType = '';
      if (shell) {
        shell.stageEl.hidden = true;
        shell.statsEl.hidden = true;
        shell.detailsEl.hidden = true;
        setBadge(shell.statusBadge, 'uninitialized', '● pick a model');
        shell.rerunBtn.textContent = 'Initialize & run';
        shell.rerunBtn.disabled = true;
      }
      modelSelect.value = '';
      setBadge(panel.tabBadge, 'idle', '● idle');
    },
    setState(s, l) { setBadge(this.tabBadge, s, l ?? ''); },
  };

  return panel;
}

// =========================================================================
// Three.js 3D pose viewer — runs alongside the video stage so the user
// sees the same skeleton in metres, with OrbitControls for free rotation.
//
// Mirrors what `drawResultOnCanvas()` does for the 2D overlay, but feeds
// `result.keypoints` (rtmw3d) or `result.persons[].keypoints3d` (instanthmr)
// into a Three.js scene. Multiple people = multiple skeletons (distinct
// hues per person index).
// =========================================================================

// COCO17 edges (index pairs). Order matches the per-keypoint color array
// below so we can colour-code body parts: head (white/cyan/red), arms
// (gold), legs (green), wrists + ears (gold).
const COCO17_EDGES: ReadonlyArray<readonly [number, number]> = [
  // legs
  [11, 13], [13, 15],                     // left hip -> knee -> ankle
  [12, 14], [14, 16],                     // right hip -> knee -> ankle
  [11, 12],                              // pelvis
  // arms
  [ 5,  7], [ 7,  9],                     // left shoulder -> elbow -> wrist
  [ 6,  8], [ 8, 10],                     // right shoulder -> elbow -> wrist
  [ 5,  6],                              // shoulders
  // torso
  [ 5, 11], [ 6, 12],                    // shoulder -> hip
  // head
  [ 0,  1], [ 0,  2], [ 1,  3], [ 2,  4],
];

const JOINT_COLOR_COCO17: ReadonlyArray<number> = [
  0xffffff, // 0  nose
  0x88ccff, 0x88ccff, // 1,2 left_eye, right_eye
  0xff8888, 0xff8888, // 3,4 left_ear, right_ear
  0xffd060, 0xffd060, // 5,6 shoulders
  0xffd060, 0xffd060, // 7,8 elbows
  0xffd060, 0xffd060, // 9,10 wrists
  0x60ff60, 0x60ff60, // 11,12 hips
  0x60ff60, 0x60ff60, // 13,14 knees
  0x60ff60, 0x60ff60, // 15,16 ankles
];

interface Pose3DScene {
  updatePose(result: Pose3DDetectorResult<any>): void;
  dispose(): void;
}

function createPose3DScene(canvas: HTMLCanvasElement): Pose3DScene {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x0a0a0a, 1);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.05, 50);
  camera.position.set(2.5, 1.2, 3.0);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.target.set(0, 1.0, 0);

  // Ground grid for spatial reference.
  const grid = new THREE.GridHelper(4, 8, 0x333333, 0x222222);
  scene.add(grid);

  // Soft lighting so the spheres read.
  scene.add(new THREE.HemisphereLight(0xffffff, 0x404040, 0.7));
  const dir = new THREE.DirectionalLight(0xffffff, 0.6);
  dir.position.set(2, 4, 2);
  scene.add(dir);

  // Up to N skeleton groups; reused across frames. Disposed on count shrink.
  const personGroups: THREE.Group[] = [];
  // Flips after the first updatePose so the camera only auto-frames once.
  // Subsequent updates only smooth-follow the target — the user's orbit
  // position is preserved.
  let framedOnce = false;
  // Exponential moving averages for the auto-frame target. The raw bbox
  // centre jitters ~5–15 cm frame-to-frame on the dance video, and the
  // lowest-joint lift jitters similarly — snapping the camera to either
  // of those signals each frame makes the whole scene tremble. Slow EMAs
  // (k=0.06) track the true motion without following the per-frame noise.
  const SMOOTH_K = 0.06;
  let smCx = 0, smCy = 0, smCz = 0;
  let smLift = 0;
  let smoothInitialised = false;

  function buildCoco17Skeleton(personIdx: number): THREE.Group {
    const group = new THREE.Group();
    const hue = (personIdx * 0.27) % 1;
    const baseColor = new THREE.Color().setHSL(hue, 0.7, 0.6).getHex();

    const positions = new Float32Array(COCO17_EDGES.length * 2 * 3);
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    group.add(new THREE.LineSegments(geom, new THREE.LineBasicMaterial({ color: baseColor })));

    const sphereGeom = new THREE.SphereGeometry(0.015, 12, 8);
    for (let i = 0; i < 17; i++) {
      const m = new THREE.Mesh(
        sphereGeom,
        new THREE.MeshLambertMaterial({ color: JOINT_COLOR_COCO17[i] }),
      );
      group.add(m);
    }
    return group;
  }

  function buildMhr70Skeleton(personIdx: number): THREE.Group {
    const group = new THREE.Group();
    const hue = (personIdx * 0.27) % 1;
    const baseColor = new THREE.Color().setHSL(hue, 0.7, 0.6).getHex();

    const positions = new Float32Array(MHR70_EDGES.length * 2 * 3);
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    group.add(new THREE.LineSegments(geom, new THREE.LineBasicMaterial({ color: baseColor })));

    const sphereGeom = new THREE.SphereGeometry(0.010, 10, 6);
    for (let i = 0; i < 70; i++) {
      const m = new THREE.Mesh(sphereGeom, new THREE.MeshLambertMaterial({ color: 0xeeeeee }));
      group.add(m);
    }
    return group;
  }

  function disposeGroup(g: THREE.Group): void {
    scene.remove(g);
    g.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
      const mat = mesh.material;
      if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
      else if (mat) (mat as THREE.Material).dispose();
    });
  }

  function resize(): void {
    const w = canvas.clientWidth || 480;
    const h = canvas.clientHeight || 480;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  resize();
  window.addEventListener('resize', resize);

  function updatePose(result: Pose3DDetectorResult<any>): void {
    // Determine skeleton kind + per-person joint arrays.
    let kind: 'coco17' | 'mhr70';
    let persons: Array<Array<readonly [number, number, number]>>;
    if ('persons' in result && Array.isArray((result as any).persons)) {
      kind = 'mhr70';
      persons = ((result as any).persons as Array<{ keypoints3d: Array<{ x: number; y: number; z: number }> }>)
        .map((p) => p.keypoints3d.map((k) => [k.x, k.y, k.z] as const));
    } else {
      kind = 'coco17';
      persons = ((result as any).keypoints as number[][][]).map(
        (kp) => kp.map(([x, y, z]) => [x, y, z] as const),
      );
    }

    // Resize person groups to match current person count.
    while (personGroups.length < persons.length) {
      const g = kind === 'coco17'
        ? buildCoco17Skeleton(personGroups.length)
        : buildMhr70Skeleton(personGroups.length);
      personGroups.push(g);
      scene.add(g);
    }
    while (personGroups.length > persons.length) {
      disposeGroup(personGroups.pop()!);
    }

    const edges = kind === 'coco17' ? COCO17_EDGES : MHR70_EDGES;

    // First pass: write joint positions (Y-flipped) into the buffers and
    // collect the bbox of all visible joints across all people. We use
    // this for auto-framing — see below.
    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
    let anyVisible = false;

    persons.forEach((joints, pi) => {
      const group = personGroups[pi];
      const lines = group.children.find((c) => c instanceof THREE.LineSegments) as THREE.LineSegments | undefined;
      const spheres = group.children.filter((c) => c instanceof THREE.Mesh) as THREE.Mesh[];

      if (lines) {
        const attr = (lines.geometry.attributes.position as THREE.BufferAttribute).array as Float32Array;
        for (let e = 0; e < edges.length; e++) {
          const [a, b] = edges[e];
          const jA = joints[a];
          const jB = joints[b];
          if (!jA || !jB) continue;
          // Flip Y so 'up' matches Three.js convention (model is Y-down).
          const ax = jA[0], ay = -jA[1], az = jA[2];
          const bx = jB[0], by = -jB[1], bz = jB[2];
          attr[e * 6 + 0] = ax; attr[e * 6 + 1] = ay; attr[e * 6 + 2] = az;
          attr[e * 6 + 3] = bx; attr[e * 6 + 4] = by; attr[e * 6 + 5] = bz;
          if (ax < minX) minX = ax; if (ax > maxX) maxX = ax;
          if (ay < minY) minY = ay; if (ay > maxY) maxY = ay;
          if (az < minZ) minZ = az; if (az > maxZ) maxZ = az;
          if (bx < minX) minX = bx; if (bx > maxX) maxX = bx;
          if (by < minY) minY = by; if (by > maxY) maxY = by;
          if (bz < minZ) minZ = bz; if (bz > maxZ) maxZ = bz;
          anyVisible = true;
        }
        (lines.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
        lines.geometry.computeBoundingSphere();
      }
      for (let i = 0; i < spheres.length; i++) {
        const j = joints[i];
        if (!j) { spheres[i].visible = false; continue; }
        const x = j[0], y = -j[1], z = j[2];
        spheres[i].position.set(x, y, z);
        spheres[i].visible = true;
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
        if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
        anyVisible = true;
      }
    });

    // Auto-frame: keep the model standing on the grid and looking at its
    // centre. The pose models return different reference frames
    // (rtmw3d = pelvis-relative, instanthmr = world-space metres) so the
    // bbox origin drifts frame-to-frame; a fixed target would put the
    // skeleton off-screen for most of the clip.
    if (anyVisible) {
      // 1. Anchor the lowest joint just above the grid. We feed the raw
      //    lift into an EMA so the per-frame noise from joint jitter
      //    doesn't make the whole figure tremble vertically.
      const rawLift = (minY < 0 ? -minY : 0) + 0.02;
      if (!smoothInitialised) {
        smLift = rawLift;
        smCx = (minX + maxX) / 2;
        smCy = (minY + maxY) / 2;
        smCz = (minZ + maxZ) / 2;
        smoothInitialised = true;
      } else {
        smLift += (rawLift - smLift) * SMOOTH_K;
        smCx += ((minX + maxX) / 2 - smCx) * SMOOTH_K;
        smCy += ((minY + maxY) / 2 - smCy) * SMOOTH_K;
        smCz += ((minZ + maxZ) / 2 - smCz) * SMOOTH_K;
      }
      // Apply the smoothed lift (every frame — it's already smooth).
      for (const g of personGroups) {
        g.position.y = smLift;
      }

      // 2. Centre the OrbitControls target on the smoothed bbox centre,
      //    shifted by the lift so we track the model in world space.
      const liftedMinY = minY + smLift;
      const liftedMaxY = maxY + smLift;
      const cy = smCy + smLift;
      const size = Math.max(maxX - minX, liftedMaxY - liftedMinY, maxZ - minZ) || 1;

      // First call after the scene exists: park the camera at a
      // sensible distance so the orbit controls feel natural from the
      // very first frame. After that, the target only follows the
      // smoothed centre — OrbitControls keeps the user's camera
      // position and damping handles the rest.
      if (!framedOnce) {
        const dist = Math.max(2.5, size * 1.8);
        camera.position.set(smCx + dist * 0.6, cy + size * 0.4, smCz + dist * 0.8);
        controls.target.set(smCx, cy, smCz);
        framedOnce = true;
      } else {
        controls.target.set(smCx, cy, smCz);
      }
    }

    controls.update();
    renderer.render(scene, camera);
  }

  function dispose(): void {
    window.removeEventListener('resize', resize);
    while (personGroups.length) disposeGroup(personGroups.pop()!);
    grid.geometry.dispose();
    (grid.material as THREE.Material).dispose();
    renderer.dispose();
    framedOnce = false;
    smoothInitialised = false;
  }

  return { updatePose, dispose };
}
