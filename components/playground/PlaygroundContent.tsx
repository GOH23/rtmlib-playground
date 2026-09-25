'use client';

import { useEffect, useRef } from 'react';
import { mountDemo } from './demo-app';

export default function PlaygroundContent() {
  const appRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const root = appRef.current;
    if (!root) return;
    const demo = mountDemo(root);
    return () => demo.destroy();
  }, []);

  return (
    <>
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            RT
          </span>
          <div>
            <h1>
              rtmlib-ts <span className="version">v0.1.0</span>
            </h1>
            <p className="tagline">
              Object detection and 2D/3D pose estimation in the browser
            </p>
          </div>
        </div>
        <nav className="topbar-links">
          <a href="https://github.com/GOH23/rtmlib-ts" target="_blank" rel="noreferrer noopener">
            GitHub
          </a>
          <a href="https://github.com/GOH23/rtmlib-ts#readme" target="_blank" rel="noreferrer noopener">
            README
          </a>
          <a href="https://www.npmjs.com/package/rtmlib-ts" target="_blank" rel="noreferrer noopener">
            npm
          </a>
        </nav>
      </header>

      <div className="hintbar">
        <span>
          <strong>Drag &amp; drop</strong> a photo or video anywhere to test it
        </span>
        <span className="sep">|</span>
        <span>
          Fixtures: <code>photo_detect_pose_3d.png</code>, <code>pose_soccer.png</code>,{' '}
          <code>dance_detect_pose_3d.mp4</code>
        </span>
      </div>

      <main id="app" ref={appRef}>
        Loading…
      </main>

      <div className="footer">
        <span>
          Source: <code>components/playground/demo-app.ts</code>
        </span>
        <span>
          Dev server: <code>npm run dev</code>
        </span>
        <span>
          Library: <code>rtmlib-ts</code>
        </span>
        <span>
          <a href="https://github.com/GOH23/rtmlib-ts" target="_blank" rel="noreferrer noopener">
            github.com/GOH23/rtmlib-ts
          </a>
        </span>
      </div>
    </>
  );
}
