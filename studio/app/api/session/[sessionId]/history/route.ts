import { NextRequest, NextResponse } from 'next/server';
import { getBackpack } from '@/lib/session';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
    const backpack = getBackpack(sessionId);
    
    // Get full history
    const history = backpack.getHistory();
    
    // Check for optional nodeId filter
    const url = new URL(request.url);
    const nodeId = url.searchParams.get('nodeId');
    
    const filteredHistory = nodeId 
      ? history.filter(commit => commit.nodeId === nodeId)
      : history;
    
    return NextResponse.json({
        success: true,
        sessionId,
        count: filteredHistory.length,
        history: filteredHistory
    });
  } catch (error) {
    return NextResponse.json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch history'
    }, { status: 500 });
  }
}
