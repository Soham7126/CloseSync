import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createGroupMeeting } from '@/lib/createMeeting';

/**
 * POST /api/meetings/group/create
 * Create a group meeting with multiple participants
 */
export async function POST(request: NextRequest) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ========================================`);
  console.log(`[${timestamp}] POST /api/meetings/group/create`);
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
    const { title, participantIds, startTime, duration, notes } = body;

    // Validate required fields
    if (!participantIds || !Array.isArray(participantIds) || participantIds.length === 0) {
      return NextResponse.json(
        { error: 'At least one participant is required' },
        { status: 400 }
      );
    }

    if (!startTime) {
      return NextResponse.json(
        { error: 'Start time is required' },
        { status: 400 }
      );
    }

    if (!duration || duration < 1) {
      return NextResponse.json(
        { error: 'Duration must be at least 1 minute' },
        { status: 400 }
      );
    }

    // Validate start time is in the future
    const meetingStart = new Date(startTime);
    if (meetingStart <= new Date()) {
      return NextResponse.json(
        { error: 'Meeting must be scheduled in the future' },
        { status: 400 }
      );
    }

    // Create the group meeting
    const meeting = await createGroupMeeting({
      organizerId: user.id,
      participantIds,
      title: title || 'Group sync',
      startTime: meetingStart,
      duration,
      notes,
    });

    console.log(`[${timestamp}] ✓ Group meeting created: ${meeting.id}`);
    return NextResponse.json({ success: true, meeting });

  } catch (error) {
    console.error(`[${timestamp}] ERROR:`, error);
    const message = error instanceof Error ? error.message : 'Failed to create meeting';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
