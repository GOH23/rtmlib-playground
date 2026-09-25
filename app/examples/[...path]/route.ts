import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';
import { Readable } from 'node:stream';
import type { NextRequest } from 'next/server';

/**
 * Serve the fixture media from the top-level `examples/` directory at
 * `/examples/*`. Next only serves static files from `public/`, so this
 * route streams the same files the standalone Vite demo serves through
 * its dev middleware — without copying ~150 MB of video into the repo.
 *
 * Range requests are supported so `<video>` seeking works.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const EXAMPLES_DIR = join(process.cwd(), 'examples');

const MIME: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.ogg': 'video/ogg',
  '.mov': 'video/quicktime',
};

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ path: string[] }> },
) {
  const { path } = await ctx.params;
  const fullPath = normalize(join(EXAMPLES_DIR, ...path));

  // Path-traversal guard — keep every request inside EXAMPLES_DIR.
  if (!fullPath.startsWith(EXAMPLES_DIR + sep)) {
    return new Response('Forbidden', { status: 403 });
  }

  let fileStat;
  try {
    fileStat = await stat(fullPath);
  } catch {
    return new Response('Not found', { status: 404 });
  }
  if (!fileStat.isFile()) {
    return new Response('Not found', { status: 404 });
  }

  const headers: Record<string, string> = {
    'Content-Type': MIME[extname(fullPath).toLowerCase()] ?? 'application/octet-stream',
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'public, max-age=3600',
  };

  const range = req.headers.get('range');
  const match = range ? /^bytes=(\d*)-(\d*)$/.exec(range.trim()) : null;
  if (match) {
    const start = match[1] ? Number.parseInt(match[1], 10) : 0;
    const requestedEnd = match[2] ? Number.parseInt(match[2], 10) : fileStat.size - 1;
    if (
      Number.isNaN(start) ||
      Number.isNaN(requestedEnd) ||
      start > requestedEnd ||
      start >= fileStat.size
    ) {
      return new Response(null, {
        status: 416,
        headers: { 'Content-Range': `bytes */${fileStat.size}` },
      });
    }
    const end = Math.min(requestedEnd, fileStat.size - 1);
    const stream = Readable.toWeb(
      createReadStream(fullPath, { start, end }),
    ) as unknown as ReadableStream;
    return new Response(stream, {
      status: 206,
      headers: {
        ...headers,
        'Content-Range': `bytes ${start}-${end}/${fileStat.size}`,
        'Content-Length': String(end - start + 1),
      },
    });
  }

  const stream = Readable.toWeb(createReadStream(fullPath)) as unknown as ReadableStream;
  return new Response(stream, {
    status: 200,
    headers: { ...headers, 'Content-Length': String(fileStat.size) },
  });
}
