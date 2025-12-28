import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    // Get auth token
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get date range from query params
    const { searchParams } = new URL(request.url);
    const range = searchParams.get('range') || 'upcoming'; // 'upcoming' | 'past' | 'all'
    
    const now = new Date();
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const sevenDaysFromNow = new Date(now);
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

    // Fetch 1:1 meetings
    let meetingsQuery = supabase
      .from('meetings')
      .select(`
        id,
        title,
        start_time,
        end_time,
        duration,
        status,
        notes,
        organizer:organizer_id(id, name, email, avatar_url),
        participant:participant_id(id, name, email, avatar_url)
      `)
      .or(`organizer_id.eq.${user.id},participant_id.eq.${user.id}`);

    if (range === 'upcoming') {
      meetingsQuery = meetingsQuery
        .gte('start_time', now.toISOString())
        .lte('start_time', sevenDaysFromNow.toISOString())
        .order('start_time', { ascending: true });
    } else if (range === 'past') {
      meetingsQuery = meetingsQuery
        .lt('end_time', now.toISOString())
        .gte('start_time', sevenDaysAgo.toISOString())
        .order('start_time', { ascending: false });
    } else {
      meetingsQuery = meetingsQuery
        .gte('start_time', sevenDaysAgo.toISOString())
        .lte('start_time', sevenDaysFromNow.toISOString())
        .order('start_time', { ascending: true });
    }

    const { data: meetings, error: meetingsError } = await meetingsQuery;

    if (meetingsError) {
      console.error('Error fetching meetings:', meetingsError);
      return NextResponse.json({ error: 'Failed to fetch meetings' }, { status: 500 });
    }

    // Fetch group meetings
    let groupMeetingsQuery = supabase
      .from('group_meetings')
      .select(`
        id,
        title,
        start_time,
        end_time,
        duration,
        status,
        notes,
        organizer:organizer_id(id, name, email, avatar_url)
      `)
      .or(`organizer_id.eq.${user.id}`);

    if (range === 'upcoming') {
      groupMeetingsQuery = groupMeetingsQuery
        .gte('start_time', now.toISOString())
        .lte('start_time', sevenDaysFromNow.toISOString())
        .order('start_time', { ascending: true });
    } else if (range === 'past') {
      groupMeetingsQuery = groupMeetingsQuery
        .lt('end_time', now.toISOString())
        .gte('start_time', sevenDaysAgo.toISOString())
        .order('start_time', { ascending: false });
    } else {
      groupMeetingsQuery = groupMeetingsQuery
        .gte('start_time', sevenDaysAgo.toISOString())
        .lte('start_time', sevenDaysFromNow.toISOString())
        .order('start_time', { ascending: true });
    }

    // Also get group meetings where user is a participant
    const { data: participantMeetings, error: participantError } = await supabase
      .from('group_meeting_participants')
      .select('meeting_id')
      .eq('user_id', user.id);

    if (participantError) {
      console.error('Error fetching participant meetings:', participantError);
    }

    const participantMeetingIds = participantMeetings?.map(p => p.meeting_id) || [];

    if (participantMeetingIds.length > 0) {
      groupMeetingsQuery = groupMeetingsQuery.or(`id.in.(${participantMeetingIds.join(',')})`);
    }

    const { data: groupMeetings, error: groupMeetingsError } = await groupMeetingsQuery;

    if (groupMeetingsError) {
      console.error('Error fetching group meetings:', groupMeetingsError);
      return NextResponse.json({ error: 'Failed to fetch group meetings' }, { status: 500 });
    }

    // For each group meeting, fetch participants
    const groupMeetingsWithParticipants = await Promise.all(
      (groupMeetings || []).map(async (meeting) => {
        const { data: participants } = await supabase
          .from('group_meeting_participants')
          .select('user:user_id(id, name, email, avatar_url)')
          .eq('meeting_id', meeting.id);

        return {
          ...meeting,
          participants: participants?.map(p => p.user) || [],
          isGroupMeeting: true,
        };
      })
    );

    // Format 1:1 meetings
    const formattedMeetings = (meetings || []).map(m => ({
      id: m.id,
      title: m.title,
      startTime: m.start_time,
      endTime: m.end_time,
      duration: m.duration,
      status: m.status,
      notes: m.notes,
      organizer: m.organizer,
      participants: [m.participant].filter(Boolean),
      isOrganizer: (m.organizer as any)?.id === user.id,
      isGroupMeeting: false,
    }));

    // Format group meetings
    const formattedGroupMeetings = groupMeetingsWithParticipants.map(m => ({
      id: m.id,
      title: m.title,
      startTime: m.start_time,
      endTime: m.end_time,
      duration: m.duration,
      status: m.status,
      notes: m.notes,
      organizer: m.organizer,
      participants: m.participants,
      isOrganizer: (m.organizer as any)?.id === user.id,
      isGroupMeeting: true,
    }));

    // Combine and sort
    const allMeetings = [...formattedMeetings, ...formattedGroupMeetings].sort((a, b) => {
      const dateA = new Date(a.startTime).getTime();
      const dateB = new Date(b.startTime).getTime();
      return range === 'past' ? dateB - dateA : dateA - dateB;
    });

    return NextResponse.json({ meetings: allMeetings });
  } catch (error) {
    console.error('Error in meetings list:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
