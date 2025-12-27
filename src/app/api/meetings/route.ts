import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getUserMeetings } from '@/lib/createMeeting';

/**
 * GET /api/meetings
 * Get user's upcoming meetings
 */
export async function GET(request: NextRequest) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ========================================`);
  console.log(`[${timestamp}] GET /api/meetings`);
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

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 10;
    const status = searchParams.get('status') as 'scheduled' | 'completed' | 'cancelled' | undefined;

    console.log(`[${timestamp}] Limit: ${limit}, Status: ${status || 'all'}`);

    // Get meetings
    const meetings = await getUserMeetings(user.id, { limit, status });

    // Get user details for each meeting
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Collect unique user IDs
    const userIds = new Set<string>();
    meetings.forEach(m => {
      userIds.add(m.organizer_id);
      userIds.add(m.participant_id);
    });

    // Fetch user details
    const { data: users } = await supabaseAdmin
      .from('users')
      .select('id, name, email, avatar_url')
      .in('id', Array.from(userIds));

    const userMap = new Map(users?.map(u => [u.id, u]) || []);

    // Enrich meetings with user details
    const enrichedMeetings = meetings.map(meeting => ({
      ...meeting,
      organizer: userMap.get(meeting.organizer_id),
      participant: userMap.get(meeting.participant_id),
      isOrganizer: meeting.organizer_id === user.id,
    }));

    console.log(`[${timestamp}] ✓ Found ${meetings.length} meetings`);
    return NextResponse.json({ meetings: enrichedMeetings });

  } catch (error) {
    console.error(`[${timestamp}] ERROR:`, error);
    const message = error instanceof Error ? error.message : 'Failed to fetch meetings';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
