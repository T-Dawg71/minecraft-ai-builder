import { NextResponse } from 'next/server';
import { readFileSync, statSync } from 'fs';
import { join } from 'path';
import { createHash } from 'crypto';

let cachedColors: unknown[] | null = null;
let cachedETag: string | null = null;
let cachedLastModified: string | null = null;

export async function GET(request: Request) {
  try {
    if (!cachedColors) {
      const filePath = join(process.cwd(), 'python', 'data', 'block_colors.json');
      const raw = readFileSync(filePath, 'utf-8');
      const stat = statSync(filePath);
      cachedColors = JSON.parse(raw);
      cachedETag = `"${createHash('md5').update(raw).digest('hex')}"`;
      cachedLastModified = stat.mtime.toUTCString();
    }

    const ifNoneMatch = request.headers.get('if-none-match');
    const ifModifiedSince = request.headers.get('if-modified-since');

    if (ifNoneMatch && ifNoneMatch === cachedETag) {
      return new Response(null, { status: 304 });
    }

    if (ifModifiedSince && cachedLastModified && ifModifiedSince === cachedLastModified) {
      return new Response(null, { status: 304 });
    }

    return NextResponse.json(cachedColors, {
      headers: {
        'ETag': cachedETag!,
        'Last-Modified': cachedLastModified!,
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch {
    return NextResponse.json(
      { error: 'Failed to load block colors' },
      { status: 500 }
    );
  }
}