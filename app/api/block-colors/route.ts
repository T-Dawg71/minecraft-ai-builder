import { NextResponse } from 'next/server';
import { readFileSync } from 'fs';
import { join } from 'path';

let cachedColors: unknown[] | null = null;

export async function GET() {
  try {
    if (!cachedColors) {
      const filePath = join(process.cwd(), 'python', 'data', 'block_colors.json');
      const raw = readFileSync(filePath, 'utf-8');
      cachedColors = JSON.parse(raw);
    }
    return NextResponse.json(cachedColors);
  } catch {
    return NextResponse.json(
      { error: 'Failed to load block colors' },
      { status: 500 }
    );
  }
}