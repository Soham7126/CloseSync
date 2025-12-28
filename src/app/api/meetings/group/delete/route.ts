import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cancelGroupMeeting } from '@/lib/createMeeting';

/**
 * POST /api/meetings/group/delete
 * Delete/cancel a group meeting
 */
export async function POST(request: NextRequest) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ========================================`);
  console.log(`[${timestamp}] POST /api/meetings/group/delete`);
  console.log(`[${timestamp}] ========================================`);

  try {
    // Get user from auth header
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      console.log(`[${timestamp}] ERROR: Missing authorization header`);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');

    // Verify the user
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      console.log(`[${timestamp}] ERROR: Invalid token`);
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    console.log(`[${timestamp}] User: ${user.id}`);

    // Parse request body
    const body = await request.json();
    const { meetingId, hardDelete } = body;

    if (!meetingId) {
      console.log(`[${timestamp}] ERROR: Missing meetingId`);
      return NextResponse.json({ error: 'Meeting ID is required' }, { status: 400 });
    }

    console.log(`[${timestamp}] Group Meeting ID: ${meetingId}`);
    console.log(`[${timestamp}] Hard delete: ${hardDelete ?? false}`);

    // Cancel/delete the group meeting
    await cancelGroupMeeting(meetingId, user.id, {
      hardDelete: hardDelete ?? false,
    });

    console.log(`[${timestamp}] ✓ Group meeting deleted successfully`);
    return NextResponse.json({ 
      success: true, 
      message: 'Group meeting cancelled successfully' 
    });
  } catch (error) {
    const timestamp = new Date().toISOString();
    console.error(`[${timestamp}] ERROR:`, error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to cancel group meeting' },
      { status: 500 }
    );
  }
}
