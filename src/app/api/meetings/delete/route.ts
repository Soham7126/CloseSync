import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cancelMeeting } from '@/lib/createMeeting';

/**
 * DELETE /api/meetings/delete
 * Delete/cancel a meeting
 */
export async function DELETE(request: NextRequest) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ========================================`);
  console.log(`[${timestamp}] DELETE /api/meetings/delete`);
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

    console.log(`[${timestamp}] Meeting ID: ${meetingId}`);
    console.log(`[${timestamp}] Hard delete: ${hardDelete ?? false}`);

    // Cancel/delete the meeting
    await cancelMeeting(meetingId, user.id, {
      deleteFromCalendar: true,
      hardDelete: hardDelete ?? false,
    });

    console.log(`[${timestamp}] ✓ Meeting deleted successfully`);
    return NextResponse.json({ 
      success: true, 
      message: hardDelete ? 'Meeting deleted' : 'Meeting cancelled' 
    });

  } catch (error) {
    console.error(`[${timestamp}] ERROR:`, error);
    const message = error instanceof Error ? error.message : 'Failed to delete meeting';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
