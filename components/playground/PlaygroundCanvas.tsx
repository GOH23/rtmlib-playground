'use client';

import { useEffect, useRef, useState } from 'react';
import { AlertCircle } from 'lucide-react';

export interface PlaygroundCanvasProps {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  overlayRef: React.RefObject<HTMLCanvasElement | null>;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  imageRef: React.RefObject<HTMLImageElement | null>;
  imageSrc: string | null;
  videoSrc: string | null;
  useCamera: boolean;
  modelLoaded: boolean;
  modelLoading: boolean;
  mode: string;
  onImageLoad: (e: React.SyntheticEvent<HTMLImageElement>) => void;
  onVideoMetadata: (e: React.SyntheticEvent<HTMLVideoElement>) => void;
}

export function PlaygroundCanvas({
  canvasRef, overlayRef, videoRef, imageRef,
  imageSrc, videoSrc, useCamera,
  modelLoaded, modelLoading, mode,
  onImageLoad, onVideoMetadata,
}: PlaygroundCanvasProps) {
  return (
    <div className="relative rounded-3xl overflow-hidden glass-card mb-6 shadow-2xl canvas-container">
      {/* Image */}
      {imageSrc && (
        <img
          ref={imageRef}
          src={imageSrc}
          alt="Uploaded"
          className="media-element"
          onLoad={onImageLoad}
        />
      )}

      {/* Video file */}
      {videoSrc && !useCamera && (
        <video
          key={`video-${videoSrc}`}
          ref={videoRef}
          src={videoSrc}
          muted
          loop
          playsInline
          className="media-element"
          onLoadedMetadata={onVideoMetadata}
        />
      )}

      {/* Camera */}
      {useCamera && (
        <video
          ref={videoRef}
          muted
          playsInline
          autoPlay
          className="media-element"
          onLoadedMetadata={onVideoMetadata}
        />
      )}

      {/* Canvases */}
      <canvas ref={canvasRef} className="canvas-overlay opacity-0 pointer-events-none" width={640} height={480} />
      <canvas ref={overlayRef} className="canvas-overlay pointer-events-none" width={640} height={480} />

      {/* Not loaded overlay */}
      {!modelLoaded && !modelLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-40">
          <div className="text-center p-6 glass-card rounded-2xl">
            <AlertCircle className="w-12 h-12 mx-auto mb-4 text-yellow-400" />
            <p className="text-slate-300 font-semibold">Model not loaded</p>
            <p className="text-slate-400 text-sm mt-2">Select a mode and wait for initialization</p>
          </div>
        </div>
      )}
    </div>
  );
}
