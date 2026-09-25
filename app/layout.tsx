import type { Metadata, Viewport } from "next";
import Script from "next/script";

import "./globals.css";

export const metadata: Metadata = {
  title: "rtmlib-ts playground",
  description:
    "Interactive playground for rtmlib-ts: object detection and 2D/3D pose estimation in the browser.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f4f1" },
    { media: "(prefers-color-scheme: dark)", color: "#141311" },
  ],
};

/**
 * Block telemetry endpoints before any detector module loads. Runs ahead of
 * the app bundle (`beforeInteractive`) so MediaPipe / ONNX Runtime can never
 * phone home. Same blocklist as the standalone demo (`demo/index.html`).
 */
const NO_TELEMETRY = `(() => {
  if (window.__noTelemetryInstalled) return;
  window.__noTelemetryInstalled = true;
  const BAD = (u) =>
    typeof u === 'string' &&
    (u.includes('odml.pa.googleapis.com') ||
      u.includes('graphban.sandbox.googleapis.com') ||
      u.includes('play.google.com/log') ||
      u.includes('clients3.google.com'));
  const f = window.fetch && window.fetch.bind(window);
  if (f) {
    window.fetch = function (input, init) {
      let url;
      try {
        url = typeof input === 'string' ? input : input && input.url;
      } catch (_) {}
      if (url && BAD(url)) return Promise.resolve(new Response('', { status: 204 }));
      return f(input, init);
    };
  }
  if (window.XMLHttpRequest) {
    const Orig = window.XMLHttpRequest;
    const Wrapped = function () {
      const xhr = new Orig();
      const open = xhr.open.bind(xhr);
      xhr.open = function (m, u, ...rest) {
        if (u && BAD(u)) return open(m, 'data:text/plain,', ...rest);
        return open(m, u, ...rest);
      };
      return xhr;
    };
    Wrapped.prototype = Orig.prototype;
    window.XMLHttpRequest = Wrapped;
  }
  if (navigator && navigator.sendBeacon) {
    const sb = navigator.sendBeacon.bind(navigator);
    navigator.sendBeacon = function (url, data) {
      if (url && BAD(url)) return true;
      return sb(url, data);
    };
  }
})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <Script id="no-telemetry" strategy="beforeInteractive">
          {NO_TELEMETRY}
        </Script>
        {children}
      </body>
    </html>
  );
}
