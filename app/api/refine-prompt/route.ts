import { NextRequest, NextResponse } from 'next/server';

const MAX_DESCRIPTION_LENGTH = 500;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { description } = body;

    if (!description || typeof description !== 'string') {
      return NextResponse.json(
        { error: 'Description is required and must be a string' },
        { status: 400 }
      );
    }

    const trimmed = description.trim();

    if (trimmed.length === 0) {
      return NextResponse.json(
        { error: 'Description cannot be empty' },
        { status: 400 }
      );
    }

    if (trimmed.length > MAX_DESCRIPTION_LENGTH) {
      return NextResponse.json(
        { error: `Description must be ${MAX_DESCRIPTION_LENGTH} characters or less` },
        { status: 400 }
      );
    }

    // Pass the user's input directly to SD — no Ollama refinement.
    // Per professor feedback: keep it simple, let the model work from
    // the raw text input rather than over-engineering the prompt.
    return NextResponse.json({
      original: trimmed,
      refined: trimmed,
      negative: "photograph, photo, realistic, 3D render, CGI, intricate, detailed, ornate, decorative, mandala, complex, pattern, busy, shadows, gradients, shading, glow, photorealistic, noise, film grain, dark background",
    });

  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}