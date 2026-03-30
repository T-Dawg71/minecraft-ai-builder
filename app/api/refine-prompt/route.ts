import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8000';
const MAX_DESCRIPTION_LENGTH = 500;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { description } = body;

    // Input validation
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

    // Call Python backend
    const response = await fetch(`${BACKEND_URL}/refine-prompt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description: trimmed }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return NextResponse.json(
        { error: errorData.detail || 'Failed to refine prompt' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);

  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error. Is the backend running?' },
      { status: 500 }
    );
  }
}