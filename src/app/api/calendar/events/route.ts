import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface CalendarEventResponse {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  category: 'work' | 'personal' | 'break' | 'activities' | 'essentials';
  attendees: {
    id: string;
    name: string;
    avatar: string;
  }[];
  isGroupMeeting: boolean;
  hasZoomLink?: boolean;
  notes?: string;
}

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
    const startDateParam = searchParams.get('startDate');
    const endDateParam = searchParams.get('endDate');
    const includeTeam = searchParams.get('includeTeam') === 'true';

    const startDate = startDateParam ? new Date(startDateParam) : getStartOfWeek(new Date());
    const endDate = endDateParam ? new Date(endDateParam) : getEndOfWeek(new Date());

    // Fetch the user's info to get team_id
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, name, team_id, avatar_url')
      .eq('id', user.id)
      .single();

    if (userError) {
      console.error('Error fetching user:', userError);
      return NextResponse.json({ error: 'Failed to fetch user' }, { status: 500 });
    }

    // Fetch 1:1 meetings for the user
    const { data: meetings, error: meetingsError } = await supabase
      .from('meetings')
      .select(`
        id,
        title,
        start_time,
        end_time,
        status,
        notes,
        organizer:organizer_id(id, name, email, avatar_url),
        participant:participant_id(id, name, email, avatar_url)
      `)
      .or(`organizer_id.eq.${user.id},participant_id.eq.${user.id}`)
      .gte('start_time', startDate.toISOString())
      .lte('start_time', endDate.toISOString())
      .eq('status', 'scheduled')
      .order('start_time', { ascending: true });

    if (meetingsError) {
      console.error('Error fetching meetings:', meetingsError);
      return NextResponse.json({ error: 'Failed to fetch meetings' }, { status: 500 });
    }

    // Fetch group meetings where user is organizer
    const { data: groupMeetingsAsOrganizer, error: groupOrgError } = await supabase
      .from('group_meetings')
      .select(`
        id,
        title,
        start_time,
        end_time,
        status,
        notes,
        organizer:organizer_id(id, name, email, avatar_url)
      `)
      .eq('organizer_id', user.id)
      .gte('start_time', startDate.toISOString())
      .lte('start_time', endDate.toISOString())
      .eq('status', 'scheduled');

    if (groupOrgError) {
      console.error('Error fetching group meetings as organizer:', groupOrgError);
    }

    // Fetch group meetings where user is a participant
    const { data: participantMeetings, error: participantError } = await supabase
      .from('group_meeting_participants')
      .select('meeting_id')
      .eq('user_id', user.id);

    if (participantError) {
      console.error('Error fetching participant meetings:', participantError);
    }

    const participantMeetingIds = participantMeetings?.map(p => p.meeting_id) || [];

    let groupMeetingsAsParticipant: any[] = [];
    if (participantMeetingIds.length > 0) {
      const { data: groupMeetings, error: groupPartError } = await supabase
        .from('group_meetings')
        .select(`
          id,
          title,
          start_time,
          end_time,
          status,
          notes,
          organizer:organizer_id(id, name, email, avatar_url)
        `)
        .in('id', participantMeetingIds)
        .gte('start_time', startDate.toISOString())
        .lte('start_time', endDate.toISOString())
        .eq('status', 'scheduled');

      if (groupPartError) {
        console.error('Error fetching group meetings as participant:', groupPartError);
      } else {
        groupMeetingsAsParticipant = groupMeetings || [];
      }
    }

    // Combine group meetings and remove duplicates
    const allGroupMeetings = [...(groupMeetingsAsOrganizer || []), ...groupMeetingsAsParticipant];
    const uniqueGroupMeetings = Array.from(
      new Map(allGroupMeetings.map(m => [m.id, m])).values()
    );

    // Fetch participants for group meetings
    const groupMeetingsWithParticipants = await Promise.all(
      uniqueGroupMeetings.map(async (meeting) => {
        const { data: participants } = await supabase
          .from('group_meeting_participants')
          .select('user:user_id(id, name, email, avatar_url)')
          .eq('meeting_id', meeting.id);

        return {
          ...meeting,
          participants: participants?.map(p => p.user) || [],
        };
      })
    );

    // Fetch user's busy blocks from user_status
    const { data: userStatus, error: statusError } = await supabase
      .from('user_status')
      .select('busy_blocks')
      .eq('user_id', user.id)
      .single();

    if (statusError && statusError.code !== 'PGRST116') {
      console.error('Error fetching user status:', statusError);
    }

    // Format 1:1 meetings as calendar events
    const formattedMeetings: CalendarEventResponse[] = (meetings || []).map(m => ({
      id: m.id,
      title: m.title,
      startTime: m.start_time,
      endTime: m.end_time,
      category: 'work' as const,
      attendees: [m.organizer, m.participant]
        .filter(Boolean)
        .map((p: any) => ({
          id: p.id,
          name: p.name || p.email,
          avatar: p.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(p.name || p.email)}&background=random`,
        })),
      isGroupMeeting: false,
      notes: m.notes,
    }));

    // Format group meetings as calendar events
    const formattedGroupMeetings: CalendarEventResponse[] = groupMeetingsWithParticipants.map(m => ({
      id: m.id,
      title: m.title,
      startTime: m.start_time,
      endTime: m.end_time,
      category: 'work' as const,
      attendees: [m.organizer, ...m.participants]
        .filter(Boolean)
        .map((p: any) => ({
          id: p.id,
          name: p.name || p.email,
          avatar: p.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(p.name || p.email)}&background=random`,
        })),
      isGroupMeeting: true,
      notes: m.notes,
    }));

    // Format busy blocks as calendar events
    const busyBlocks = userStatus?.busy_blocks || [];
    const formattedBusyBlocks: CalendarEventResponse[] = busyBlocks
      .filter((block: any) => {
        // Only include blocks with ISO datetime format that fall within the date range
        if (block.start?.includes('T') || block.start?.includes('-')) {
          const blockStart = new Date(block.start);
          const blockEnd = new Date(block.end);
          return blockStart >= startDate && blockStart <= endDate;
        }
        return false;
      })
      .map((block: any, index: number) => ({
        id: `busy-${index}-${block.start}`,
        title: block.label || 'Busy',
        startTime: block.start,
        endTime: block.end,
        category: categorizeBlock(block) as CalendarEventResponse['category'],
        attendees: [],
        isGroupMeeting: false,
      }));

    // Combine all events
    const allEvents = [...formattedMeetings, ...formattedGroupMeetings, ...formattedBusyBlocks]
      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

    return NextResponse.json({
      events: allEvents,
      dateRange: {
        start: startDate.toISOString(),
        end: endDate.toISOString(),
      },
    });
  } catch (error) {
    console.error('Error in calendar events:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Helper functions
function getStartOfWeek(date: Date): Date {
  const result = new Date(date);
  const day = result.getDay();
  const diff = result.getDate() - day + (day === 0 ? -6 : 1); // Adjust for Sunday
  result.setDate(diff);
  result.setHours(0, 0, 0, 0);
  return result;
}

function getEndOfWeek(date: Date): Date {
  const result = getStartOfWeek(date);
  result.setDate(result.getDate() + 6);
  result.setHours(23, 59, 59, 999);
  return result;
}

function categorizeBlock(block: any): string {
  const label = (block.label || '').toLowerCase();

  if (label.includes('lunch') || label.includes('break') || label.includes('rest')) {
    return 'break';
  }
  if (label.includes('meeting') || label.includes('call') || label.includes('sync') || label.includes('standup')) {
    return 'work';
  }
  if (label.includes('personal') || label.includes('appointment') || label.includes('doctor')) {
    return 'personal';
  }
  if (label.includes('gym') || label.includes('sport') || label.includes('workout') || label.includes('fun')) {
    return 'activities';
  }
  if (block.source === 'calendar') {
    return 'work';
  }

  return 'essentials';
}
