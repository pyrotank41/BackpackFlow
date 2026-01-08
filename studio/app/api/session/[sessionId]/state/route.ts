import { NextRequest, NextResponse } from 'next/server';
import { getBackpack } from '@/lib/session';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
    const backpack = getBackpack(sessionId);
    
    // Extract full state
    const keys = backpack.keys();
    const state: Record<string, any> = {};
    
    for (const key of keys) {
      // Use peek to avoid access control checks (Studio gets superuser access)
      state[key] = backpack.peek(key);
    }
    
    return NextResponse.json({
        success: true,
        sessionId,
        itemCount: keys.length,
        state
    });
  } catch (error) {
    return NextResponse.json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch state'
    }, { status: 500 });
  }
}
