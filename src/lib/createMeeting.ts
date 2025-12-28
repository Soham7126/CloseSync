import { createClient } from '@supabase/supabase-js';
import { refreshGoogleToken } from './refreshGoogleToken';
import { BusyBlock } from './fetchGoogleCalendarEvents';

export interface CreateMeetingInput {
  organizerId: string;
  participantId: string;
  title: string;
  startTime: Date;
  duration: number; // in minutes
  notes?: string;
}

export interface Meeting {
  id: string;
  title: string;
  description: string | null;
  organizer_id: string;
  participant_id: string;
  start_time: string;
  end_time: string;
  duration: number;
  status: 'scheduled' | 'completed' | 'cancelled';
  google_event_id_organizer: string | null;
  google_event_id_participant: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface GoogleCalendarEventResponse {
  id: string;
  htmlLink: string;
  status: string;
}

interface GoogleErrorResponse {
  error: {
    code: number;
    message: string;
  };
}

/**
 * Creates a meeting between two users
 * - Saves to database
 * - Adds to both users' Google Calendars (if connected)
 * - Updates both users' busy blocks
 * - Sends email notification
 */
export async function createMeeting(input: CreateMeetingInput): Promise<Meeting> {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ========================================`);
  console.log(`[${timestamp}] Creating meeting`);
  console.log(`[${timestamp}] Organizer: ${input.organizerId}`);
  console.log(`[${timestamp}] Participant: ${input.participantId}`);
  console.log(`[${timestamp}] Title: ${input.title}`);
  console.log(`[${timestamp}] Start: ${input.startTime.toISOString()}`);
  console.log(`[${timestamp}] Duration: ${input.duration} minutes`);
  console.log(`[${timestamp}] ========================================`);

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Calculate end time
  const endTime = new Date(input.startTime.getTime() + input.duration * 60 * 1000);

  // Step 1: Get user details
  console.log(`[${timestamp}] Step 1: Fetching user details...`);
  const { data: users, error: usersError } = await supabase
    .from('users')
    .select('id, name, email')
    .in('id', [input.organizerId, input.participantId]);

  if (usersError || !users || users.length !== 2) {
    console.error(`[${timestamp}] ERROR: Failed to fetch users`);
    throw new Error('Failed to fetch user details');
  }

  const organizer = users.find(u => u.id === input.organizerId)!;
  const participant = users.find(u => u.id === input.participantId)!;

  console.log(`[${timestamp}] Organizer: ${organizer.name} (${organizer.email})`);
  console.log(`[${timestamp}] Participant: ${participant.name} (${participant.email})`);

  // Step 2: Create meeting in database
  console.log(`[${timestamp}] Step 2: Creating meeting in database...`);
  const meetingData = {
    title: input.title,
    description: input.notes || null,
    organizer_id: input.organizerId,
    participant_id: input.participantId,
    start_time: input.startTime.toISOString(),
    end_time: endTime.toISOString(),
    duration: input.duration,
    status: 'scheduled',
    notes: input.notes || null,
  };

  const { data: meeting, error: meetingError } = await supabase
    .from('meetings')
    .insert(meetingData)
    .select()
    .single();

  if (meetingError || !meeting) {
    console.error(`[${timestamp}] ERROR: Failed to create meeting`);
    console.error(`[${timestamp}] Error: ${meetingError?.message}`);
    throw new Error(`Failed to create meeting: ${meetingError?.message}`);
  }

  console.log(`[${timestamp}] ✓ Meeting created with ID: ${meeting.id}`);

  // Step 3: Add to Google Calendars (if connected)
  console.log(`[${timestamp}] Step 3: Adding to Google Calendars...`);
  
  let organizerEventId: string | null = null;
  let participantEventId: string | null = null;

  // Check calendar connections
  const { data: calendarConnections } = await supabase
    .from('calendar_connections')
    .select('user_id, calendar_email')
    .in('user_id', [input.organizerId, input.participantId])
    .eq('provider', 'google');

  const organizerCalendar = calendarConnections?.find(c => c.user_id === input.organizerId);
  const participantCalendar = calendarConnections?.find(c => c.user_id === input.participantId);

  // Create Google Calendar event for organizer
  if (organizerCalendar) {
    try {
      console.log(`[${timestamp}] Creating event for organizer...`);
      organizerEventId = await createGoogleCalendarEvent(
        input.organizerId,
        {
          summary: input.title,
          description: `Quick sync with ${participant.name}\n\n${input.notes || ''}`,
          start: input.startTime,
          end: endTime,
          attendees: [participant.email],
        }
      );
      console.log(`[${timestamp}] ✓ Organizer event created: ${organizerEventId}`);
    } catch (error) {
      console.error(`[${timestamp}] Failed to create organizer calendar event:`, error);
    }
  } else {
    console.log(`[${timestamp}] Organizer has no Google Calendar connected`);
  }

  // Create Google Calendar event for participant
  if (participantCalendar) {
    try {
      console.log(`[${timestamp}] Creating event for participant...`);
      participantEventId = await createGoogleCalendarEvent(
        input.participantId,
        {
          summary: input.title,
          description: `Quick sync with ${organizer.name}\n\n${input.notes || ''}`,
          start: input.startTime,
          end: endTime,
          attendees: [organizer.email],
        }
      );
      console.log(`[${timestamp}] ✓ Participant event created: ${participantEventId}`);
    } catch (error) {
      console.error(`[${timestamp}] Failed to create participant calendar event:`, error);
    }
  } else {
    console.log(`[${timestamp}] Participant has no Google Calendar connected`);
  }

  // Update meeting with Google Calendar event IDs
  if (organizerEventId || participantEventId) {
    await supabase
      .from('meetings')
      .update({
        google_event_id_organizer: organizerEventId,
        google_event_id_participant: participantEventId,
      })
      .eq('id', meeting.id);
  }

  // Step 4: Update busy blocks for both users
  console.log(`[${timestamp}] Step 4: Updating busy blocks...`);
  
  const newBusyBlock: BusyBlock = {
    start: formatTimeString(input.startTime),
    end: formatTimeString(endTime),
    label: input.title,
    source: 'calendar',
  };

  await updateUserBusyBlock(supabase, input.organizerId, newBusyBlock);
  await updateUserBusyBlock(supabase, input.participantId, newBusyBlock);

  console.log(`[${timestamp}] ✓ Busy blocks updated`);

  // Step 5: Send email notification
  console.log(`[${timestamp}] Step 5: Sending email notification...`);
  
  try {
    await sendMeetingNotification({
      recipientEmail: participant.email,
      recipientName: participant.name,
      organizerName: organizer.name,
      meetingTitle: input.title,
      startTime: input.startTime,
      endTime,
      duration: input.duration,
      notes: input.notes,
    });
    console.log(`[${timestamp}] ✓ Email notification sent`);
  } catch (error) {
    console.error(`[${timestamp}] Failed to send email notification:`, error);
    // Don't throw - meeting is still created successfully
  }

  console.log(`[${timestamp}] ========================================`);
  console.log(`[${timestamp}] ✓ Meeting created successfully!`);
  console.log(`[${timestamp}] ========================================`);

  return meeting as Meeting;
}

/**
 * Create a Google Calendar event for a user
 */
async function createGoogleCalendarEvent(
  userId: string,
  eventData: {
    summary: string;
    description: string;
    start: Date;
    end: Date;
    attendees: string[];
  }
): Promise<string> {
  // Get valid access token
  const accessToken = await refreshGoogleToken(userId);

  const event = {
    summary: eventData.summary,
    description: eventData.description,
    start: {
      dateTime: eventData.start.toISOString(),
      timeZone: 'UTC',
    },
    end: {
      dateTime: eventData.end.toISOString(),
      timeZone: 'UTC',
    },
    attendees: eventData.attendees.map(email => ({ email })),
    reminders: {
      useDefault: false,
      overrides: [
        { method: 'popup', minutes: 10 },
        { method: 'email', minutes: 30 },
      ],
    },
  };

  const response = await fetch(
    'https://www.googleapis.com/calendar/v3/calendars/primary/events?sendUpdates=all',
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(event),
    }
  );

  if (!response.ok) {
    const errorData = await response.json() as GoogleErrorResponse;
    throw new Error(`Google Calendar API error: ${errorData.error?.message || 'Unknown error'}`);
  }

  const data = await response.json() as GoogleCalendarEventResponse;
  return data.id;
}

/**
 * Update a user's busy blocks with a new block
 */
async function updateUserBusyBlock(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  userId: string,
  newBlock: BusyBlock
): Promise<void> {
  // Get existing status
  const { data: existingStatus } = await supabase
    .from('user_status')
    .select('busy_blocks')
    .eq('user_id', userId)
    .single();

  const existingBlocks: BusyBlock[] = existingStatus?.busy_blocks || [];
  const updatedBlocks = [...existingBlocks, newBlock];

  // Sort by start time
  updatedBlocks.sort((a, b) => a.start.localeCompare(b.start));

  if (existingStatus) {
    await supabase
      .from('user_status')
      .update({ busy_blocks: updatedBlocks })
      .eq('user_id', userId);
  } else {
    await supabase
      .from('user_status')
      .insert({
        user_id: userId,
        busy_blocks: updatedBlocks,
      });
  }
}

/**
 * Send email notification about new meeting
 */
async function sendMeetingNotification(data: {
  recipientEmail: string;
  recipientName: string;
  organizerName: string;
  meetingTitle: string;
  startTime: Date;
  endTime: Date;
  duration: number;
  notes?: string;
}): Promise<void> {
  // For now, log the notification
  // In production, integrate with email service (SendGrid, Resend, etc.)
  console.log(`[Email] Sending meeting notification:`);
  console.log(`  To: ${data.recipientEmail}`);
  console.log(`  Subject: New meeting: ${data.meetingTitle}`);
  console.log(`  Body: ${data.organizerName} has scheduled a ${data.duration}-minute meeting with you`);
  console.log(`  Time: ${data.startTime.toLocaleString()} - ${data.endTime.toLocaleString()}`);

  // TODO: Implement actual email sending
  // Example with Resend:
  // const resend = new Resend(process.env.RESEND_API_KEY);
  // await resend.emails.send({
  //   from: 'Sync <meetings@sync.app>',
  //   to: data.recipientEmail,
  //   subject: `New meeting: ${data.meetingTitle}`,
  //   html: `...`,
  // });
}

/**
 * Format a Date to "HH:MM" string
 */
function formatTimeString(date: Date): string {
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

/**
 * Get upcoming meetings for a user
 */
export async function getUserMeetings(
  userId: string,
  options?: {
    limit?: number;
    status?: 'scheduled' | 'completed' | 'cancelled';
  }
): Promise<Meeting[]> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  let query = supabase
    .from('meetings')
    .select('*')
    .or(`organizer_id.eq.${userId},participant_id.eq.${userId}`)
    .gte('start_time', new Date().toISOString())
    .order('start_time', { ascending: true });

  if (options?.status) {
    query = query.eq('status', options.status);
  }

  if (options?.limit) {
    query = query.limit(options.limit);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch meetings: ${error.message}`);
  }

  return (data || []) as Meeting[];
}

/**
 * Cancel/Delete a meeting
 * - Removes from both users' Google Calendars
 * - Updates busy blocks
 * - Sends cancellation notification
 */
export async function cancelMeeting(
  meetingId: string, 
  cancelledBy: string,
  options?: { deleteFromCalendar?: boolean; hardDelete?: boolean }
): Promise<void> {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ========================================`);
  console.log(`[${timestamp}] Cancelling meeting: ${meetingId}`);
  console.log(`[${timestamp}] Cancelled by: ${cancelledBy}`);
  console.log(`[${timestamp}] ========================================`);

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Get meeting details
  const { data: meeting, error: fetchError } = await supabase
    .from('meetings')
    .select('*')
    .eq('id', meetingId)
    .single();

  if (fetchError || !meeting) {
    console.error(`[${timestamp}] ERROR: Meeting not found`);
    throw new Error('Meeting not found');
  }

  // Verify user is part of the meeting
  if (meeting.organizer_id !== cancelledBy && meeting.participant_id !== cancelledBy) {
    console.error(`[${timestamp}] ERROR: User not authorized to cancel this meeting`);
    throw new Error('Not authorized to cancel this meeting');
  }

  // Delete from Google Calendars if requested
  if (options?.deleteFromCalendar !== false) {
    console.log(`[${timestamp}] Removing from Google Calendars...`);
    
    // Delete organizer's calendar event
    if (meeting.google_event_id_organizer) {
      try {
        await deleteGoogleCalendarEvent(supabase, meeting.organizer_id, meeting.google_event_id_organizer);
        console.log(`[${timestamp}] ✓ Removed from organizer's calendar`);
      } catch (err) {
        console.error(`[${timestamp}] Failed to delete from organizer's calendar:`, err);
      }
    }

    // Delete participant's calendar event
    if (meeting.google_event_id_participant) {
      try {
        await deleteGoogleCalendarEvent(supabase, meeting.participant_id, meeting.google_event_id_participant);
        console.log(`[${timestamp}] ✓ Removed from participant's calendar`);
      } catch (err) {
        console.error(`[${timestamp}] Failed to delete from participant's calendar:`, err);
      }
    }
  }

  // Remove busy blocks for both users
  console.log(`[${timestamp}] Removing busy blocks...`);
  await removeBusyBlock(supabase, meeting.organizer_id, meeting.start_time, meeting.end_time, meeting.title);
  await removeBusyBlock(supabase, meeting.participant_id, meeting.start_time, meeting.end_time, meeting.title);

  // Either hard delete or soft delete
  if (options?.hardDelete) {
    console.log(`[${timestamp}] Hard deleting meeting from database...`);
    const { error: deleteError } = await supabase
      .from('meetings')
      .delete()
      .eq('id', meetingId);

    if (deleteError) {
      throw new Error(`Failed to delete meeting: ${deleteError.message}`);
    }
  } else {
    console.log(`[${timestamp}] Soft deleting (marking as cancelled)...`);
    const { error: updateError } = await supabase
      .from('meetings')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('id', meetingId);

    if (updateError) {
      throw new Error(`Failed to cancel meeting: ${updateError.message}`);
    }
  }

  // Get user details for notification
  const { data: users } = await supabase
    .from('users')
    .select('id, name, email')
    .in('id', [meeting.organizer_id, meeting.participant_id]);

  if (users && users.length === 2) {
    const canceller = users.find(u => u.id === cancelledBy);
    const otherUser = users.find(u => u.id !== cancelledBy);

    if (canceller && otherUser) {
      console.log(`[${timestamp}] Sending cancellation notification to ${otherUser.email}...`);
      // TODO: Send actual email
      console.log(`[Email] Meeting "${meeting.title}" cancelled by ${canceller.name}`);
    }
  }

  console.log(`[${timestamp}] ✓ Meeting cancelled successfully`);
}

/**
 * Delete an event from Google Calendar
 */
async function deleteGoogleCalendarEvent(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  userId: string,
  eventId: string
): Promise<void> {
  // Get user's calendar connection
  const { data: connection } = await supabase
    .from('calendar_connections')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (!connection) {
    throw new Error('No calendar connection found');
  }

  // Refresh token if needed
  let accessToken = connection.access_token;
  const tokenExpiry = new Date(connection.token_expiry);
  
  if (tokenExpiry <= new Date()) {
    accessToken = await refreshGoogleToken(userId);
  }

  // Delete the event
  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`,
    {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok && response.status !== 404) {
    const errorText = await response.text();
    throw new Error(`Failed to delete calendar event: ${errorText}`);
  }
}

/**
 * Remove a busy block for a specific time range
 */
async function removeBusyBlock(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  userId: string,
  startTime: string,
  endTime: string,
  label?: string
): Promise<void> {
  console.log(`[removeBusyBlock] User: ${userId}`);
  console.log(`[removeBusyBlock] Looking for start: ${startTime}, end: ${endTime}, label: ${label}`);

  const { data: status } = await supabase
    .from('user_status')
    .select('busy_blocks')
    .eq('user_id', userId)
    .single();

  if (!status?.busy_blocks || status.busy_blocks.length === 0) {
    console.log(`[removeBusyBlock] No busy blocks found for user`);
    return;
  }

  console.log(`[removeBusyBlock] Current busy blocks:`, JSON.stringify(status.busy_blocks));

  // Convert ISO timestamps to HH:MM format for comparison
  const startDate = new Date(startTime);
  const endDate = new Date(endTime);
  const startTimeFormatted = formatTimeString(startDate);
  const endTimeFormatted = formatTimeString(endDate);

  console.log(`[removeBusyBlock] Formatted times - start: ${startTimeFormatted}, end: ${endTimeFormatted}`);

  // Filter out the matching busy block
  const updatedBlocks = status.busy_blocks.filter((block: BusyBlock) => {
    // Match by time (formatted) OR by label
    const timeMatch = block.start === startTimeFormatted && block.end === endTimeFormatted;
    const labelMatch = label && block.label === label;
    
    // Remove if both time and label match, or just time matches for calendar source
    const shouldRemove = timeMatch || (labelMatch && block.source === 'calendar');
    
    if (shouldRemove) {
      console.log(`[removeBusyBlock] Removing block:`, JSON.stringify(block));
    }
    
    return !shouldRemove;
  });

  console.log(`[removeBusyBlock] Updated busy blocks:`, JSON.stringify(updatedBlocks));

  const { error } = await supabase
    .from('user_status')
    .update({ busy_blocks: updatedBlocks })
    .eq('user_id', userId);

  if (error) {
    console.error(`[removeBusyBlock] Error updating:`, error);
  } else {
    console.log(`[removeBusyBlock] ✓ Successfully updated busy blocks`);
  }
}

// =============================================
// GROUP MEETING FUNCTIONS
// =============================================

export interface CreateGroupMeetingInput {
  organizerId: string;
  participantIds: string[];
  title: string;
  startTime: Date;
  duration: number; // in minutes
  notes?: string;
}

export interface GroupMeeting {
  id: string;
  title: string;
  description: string | null;
  organizer_id: string;
  start_time: string;
  end_time: string;
  duration: number;
  status: 'scheduled' | 'completed' | 'cancelled';
  notes: string | null;
  created_at: string;
  updated_at: string;
  participants?: GroupMeetingParticipant[];
}

export interface GroupMeetingParticipant {
  id: string;
  meeting_id: string;
  user_id: string;
  google_event_id: string | null;
  response_status: 'pending' | 'accepted' | 'declined' | 'tentative';
}

/**
 * Creates a group meeting with multiple participants
 */
export async function createGroupMeeting(input: CreateGroupMeetingInput): Promise<GroupMeeting> {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ========================================`);
  console.log(`[${timestamp}] Creating group meeting`);
  console.log(`[${timestamp}] Organizer: ${input.organizerId}`);
  console.log(`[${timestamp}] Participants: ${input.participantIds.join(', ')}`);
  console.log(`[${timestamp}] Title: ${input.title}`);
  console.log(`[${timestamp}] Start: ${input.startTime.toISOString()}`);
  console.log(`[${timestamp}] Duration: ${input.duration} minutes`);
  console.log(`[${timestamp}] ========================================`);

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const endTime = new Date(input.startTime.getTime() + input.duration * 60 * 1000);
  const allUserIds = [input.organizerId, ...input.participantIds];

  // Step 1: Get all user details
  console.log(`[${timestamp}] Step 1: Fetching user details...`);
  const { data: users, error: usersError } = await supabase
    .from('users')
    .select('id, name, email')
    .in('id', allUserIds);

  if (usersError || !users || users.length === 0) {
    console.error(`[${timestamp}] ERROR: Failed to fetch users`);
    throw new Error('Failed to fetch user details');
  }

  const organizer = users.find(u => u.id === input.organizerId);
  if (!organizer) {
    throw new Error('Organizer not found');
  }

  console.log(`[${timestamp}] Found ${users.length} users`);

  // Step 2: Create group meeting in database
  console.log(`[${timestamp}] Step 2: Creating group meeting in database...`);
  const meetingData = {
    title: input.title,
    description: input.notes || null,
    organizer_id: input.organizerId,
    start_time: input.startTime.toISOString(),
    end_time: endTime.toISOString(),
    duration: input.duration,
    status: 'scheduled',
    notes: input.notes || null,
  };

  const { data: meeting, error: meetingError } = await supabase
    .from('group_meetings')
    .insert(meetingData)
    .select()
    .single();

  if (meetingError || !meeting) {
    console.error(`[${timestamp}] ERROR: Failed to create meeting:`, meetingError);
    throw new Error('Failed to create group meeting');
  }

  console.log(`[${timestamp}] ✓ Meeting created: ${meeting.id}`);

  // Step 3: Add all participants (including organizer)
  console.log(`[${timestamp}] Step 3: Adding participants...`);
  const participantRecords = allUserIds.map(userId => ({
    meeting_id: meeting.id,
    user_id: userId,
    response_status: userId === input.organizerId ? 'accepted' : 'pending',
  }));

  const { error: participantsError } = await supabase
    .from('group_meeting_participants')
    .insert(participantRecords);

  if (participantsError) {
    console.error(`[${timestamp}] ERROR: Failed to add participants:`, participantsError);
    // Don't throw - meeting is created, just log the error
  } else {
    console.log(`[${timestamp}] ✓ Added ${allUserIds.length} participants`);
  }

  // Step 4: Add to Google Calendars for all users with connected calendars
  console.log(`[${timestamp}] Step 4: Adding to Google Calendars...`);
  const attendeeEmails = users.map(u => ({ email: u.email }));

  for (const userId of allUserIds) {
    try {
      const eventId = await createGoogleCalendarEventForGroup(
        supabase,
        userId,
        {
          title: input.title,
          description: input.notes || '',
          startTime: input.startTime,
          endTime,
          attendees: attendeeEmails,
          organizerName: organizer.name,
        }
      );

      if (eventId) {
        // Update participant record with Google event ID
        await supabase
          .from('group_meeting_participants')
          .update({ google_event_id: eventId })
          .eq('meeting_id', meeting.id)
          .eq('user_id', userId);

        console.log(`[${timestamp}] ✓ Added to calendar for user ${userId}`);
      }
    } catch (err) {
      console.error(`[${timestamp}] Failed to add to calendar for user ${userId}:`, err);
    }
  }

  // Step 5: Update busy blocks for all users
  console.log(`[${timestamp}] Step 5: Updating busy blocks...`);
  const newBusyBlock: BusyBlock = {
    start: formatTimeString(input.startTime),
    end: formatTimeString(endTime),
    label: input.title,
    source: 'calendar',
  };

  for (const userId of allUserIds) {
    await updateUserBusyBlock(supabase, userId, newBusyBlock);
  }
  console.log(`[${timestamp}] ✓ Busy blocks updated for ${allUserIds.length} users`);

  console.log(`[${timestamp}] ========================================`);
  console.log(`[${timestamp}] ✓ Group meeting created successfully`);
  console.log(`[${timestamp}] ========================================`);

  return meeting as GroupMeeting;
}

/**
 * Create Google Calendar event for group meeting
 */
async function createGoogleCalendarEventForGroup(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  userId: string,
  eventData: {
    title: string;
    description: string;
    startTime: Date;
    endTime: Date;
    attendees: { email: string }[];
    organizerName: string;
  }
): Promise<string | null> {
  // Get user's calendar connection
  const { data: connection } = await supabase
    .from('calendar_connections')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (!connection) {
    return null;
  }

  // Refresh token if needed
  let accessToken = connection.access_token;
  const tokenExpiry = new Date(connection.token_expiry);
  
  if (tokenExpiry <= new Date()) {
    accessToken = await refreshGoogleToken(userId);
  }

  // Create event
  const event = {
    summary: eventData.title,
    description: `Group meeting organized by ${eventData.organizerName}\n\n${eventData.description}`,
    start: {
      dateTime: eventData.startTime.toISOString(),
      timeZone: 'UTC',
    },
    end: {
      dateTime: eventData.endTime.toISOString(),
      timeZone: 'UTC',
    },
    attendees: eventData.attendees,
    reminders: {
      useDefault: false,
      overrides: [
        { method: 'popup', minutes: 10 },
      ],
    },
  };

  const response = await fetch(
    'https://www.googleapis.com/calendar/v3/calendars/primary/events?sendUpdates=all',
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(event),
    }
  );

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(`Google Calendar API error: ${errorData.error?.message || 'Unknown error'}`);
  }

  const data = await response.json() as GoogleCalendarEventResponse;
  return data.id;
}

/**
 * Cancel a group meeting
 */
export async function cancelGroupMeeting(
  meetingId: string,
  cancelledBy: string,
  options?: { hardDelete?: boolean }
): Promise<void> {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] Cancelling group meeting: ${meetingId}`);

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Get meeting details
  const { data: meeting, error: fetchError } = await supabase
    .from('group_meetings')
    .select('*')
    .eq('id', meetingId)
    .single();

  if (fetchError || !meeting) {
    throw new Error('Meeting not found');
  }

  // Get all participants
  const { data: participants } = await supabase
    .from('group_meeting_participants')
    .select('*')
    .eq('meeting_id', meetingId);

  // Verify user is the organizer or a participant
  const isOrganizer = meeting.organizer_id === cancelledBy;
  const isParticipant = participants?.some(p => p.user_id === cancelledBy);

  if (!isOrganizer && !isParticipant) {
    throw new Error('Not authorized to cancel this meeting');
  }

  // Delete from Google Calendars for all participants
  if (participants) {
    for (const participant of participants) {
      if (participant.google_event_id) {
        try {
          await deleteGoogleCalendarEvent(supabase, participant.user_id, participant.google_event_id);
        } catch (err) {
          console.error(`Failed to delete calendar event for user ${participant.user_id}:`, err);
        }
      }

      // Remove busy blocks
      await removeBusyBlock(supabase, participant.user_id, meeting.start_time, meeting.end_time, meeting.title);
    }
  }

  // Update or delete meeting
  if (options?.hardDelete) {
    await supabase.from('group_meetings').delete().eq('id', meetingId);
  } else {
    await supabase
      .from('group_meetings')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('id', meetingId);
  }

  console.log(`[${timestamp}] ✓ Group meeting cancelled`);
}

/**
 * Get user's group meetings
 */
export async function getUserGroupMeetings(
  userId: string,
  options?: { limit?: number; status?: string }
): Promise<GroupMeeting[]> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Get meeting IDs where user is a participant
  const { data: participations } = await supabase
    .from('group_meeting_participants')
    .select('meeting_id')
    .eq('user_id', userId);

  if (!participations || participations.length === 0) {
    return [];
  }

  const meetingIds = participations.map(p => p.meeting_id);

  let query = supabase
    .from('group_meetings')
    .select('*')
    .in('id', meetingIds)
    .gte('start_time', new Date().toISOString())
    .order('start_time', { ascending: true });

  if (options?.status) {
    query = query.eq('status', options.status);
  }

  if (options?.limit) {
    query = query.limit(options.limit);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch group meetings: ${error.message}`);
  }

  return (data || []) as GroupMeeting[];
}
