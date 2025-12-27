import { refreshGoogleToken } from './refreshGoogleToken';

export interface BusyBlock {
  start: string;
  end: string;
  label: string;
  source: 'voice' | 'calendar';
}

interface GoogleCalendarEvent {
  id: string;
  summary?: string;
  description?: string;
  status: string;
  start: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  end: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  transparency?: string; // 'opaque' means busy, 'transparent' means free
}

interface GoogleCalendarEventsResponse {
  kind: string;
  summary: string;
  items: GoogleCalendarEvent[];
  nextPageToken?: string;
}

interface GoogleErrorResponse {
  error: {
    code: number;
    message: string;
    errors?: Array<{
      domain: string;
      reason: string;
      message: string;
    }>;
  };
}

/**
 * Fetches Google Calendar events for a user and converts them to busy blocks
 * 
 * @param userId - The user's UUID
 * @param daysAhead - Number of days to look ahead (default: 7)
 * @returns Array of busy blocks from calendar
 */
export async function fetchGoogleCalendarEvents(
  userId: string,
  daysAhead: number = 7
): Promise<BusyBlock[]> {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ========================================`);
  console.log(`[${timestamp}] Fetching Google Calendar events`);
  console.log(`[${timestamp}] User ID: ${userId}`);
  console.log(`[${timestamp}] Days ahead: ${daysAhead}`);
  console.log(`[${timestamp}] ========================================`);

  try {
    // Get valid access token (refreshes if needed)
    console.log(`[${timestamp}] Getting valid access token...`);
    const accessToken = await refreshGoogleToken(userId);
    console.log(`[${timestamp}] ✓ Got valid access token`);

    // Calculate time range
    const now = new Date();
    const timeMin = now.toISOString();
    const timeMax = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000).toISOString();

    console.log(`[${timestamp}] Time range:`);
    console.log(`[${timestamp}]   - From: ${timeMin}`);
    console.log(`[${timestamp}]   - To: ${timeMax}`);

    // Build API URL
    const calendarUrl = new URL('https://www.googleapis.com/calendar/v3/calendars/primary/events');
    calendarUrl.searchParams.set('timeMin', timeMin);
    calendarUrl.searchParams.set('timeMax', timeMax);
    calendarUrl.searchParams.set('singleEvents', 'true');
    calendarUrl.searchParams.set('orderBy', 'startTime');
    calendarUrl.searchParams.set('maxResults', '100');

    console.log(`[${timestamp}] Fetching events from Google Calendar API...`);
    console.log(`[${timestamp}] URL: ${calendarUrl.toString()}`);

    const response = await fetch(calendarUrl.toString(), {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json() as GoogleErrorResponse;
      console.error(`[${timestamp}] ========================================`);
      console.error(`[${timestamp}] Google Calendar API error`);
      console.error(`[${timestamp}] Status: ${response.status}`);
      console.error(`[${timestamp}] Error code: ${errorData.error?.code}`);
      console.error(`[${timestamp}] Error message: ${errorData.error?.message}`);
      
      if (errorData.error?.errors) {
        errorData.error.errors.forEach((err, i) => {
          console.error(`[${timestamp}] Error ${i + 1}:`);
          console.error(`[${timestamp}]   - Domain: ${err.domain}`);
          console.error(`[${timestamp}]   - Reason: ${err.reason}`);
          console.error(`[${timestamp}]   - Message: ${err.message}`);
        });
      }
      console.error(`[${timestamp}] ========================================`);

      // Handle specific errors
      if (response.status === 401) {
        throw new Error('Google Calendar access token is invalid. Please reconnect.');
      }
      if (response.status === 403) {
        throw new Error('Google Calendar API quota exceeded or access denied.');
      }
      if (response.status === 404) {
        throw new Error('Primary calendar not found.');
      }

      throw new Error(`Google Calendar API error: ${errorData.error?.message || 'Unknown error'}`);
    }

    const data = await response.json() as GoogleCalendarEventsResponse;
    console.log(`[${timestamp}] ✓ Events fetched successfully`);
    console.log(`[${timestamp}] Calendar summary: ${data.summary}`);
    console.log(`[${timestamp}] Total events found: ${data.items?.length || 0}`);

    if (!data.items || data.items.length === 0) {
      console.log(`[${timestamp}] No events in the specified time range`);
      return [];
    }

    // Convert events to busy blocks
    const busyBlocks: BusyBlock[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayEnd = new Date(today);
    todayEnd.setHours(23, 59, 59, 999);

    console.log(`[${timestamp}] Converting events to busy blocks...`);
    console.log(`[${timestamp}] Today: ${today.toISOString()}`);

    for (const event of data.items) {
      // Skip cancelled events
      if (event.status === 'cancelled') {
        console.log(`[${timestamp}]   - Skipping cancelled event: ${event.summary || 'No title'}`);
        continue;
      }

      // Skip transparent (free/show as available) events
      if (event.transparency === 'transparent') {
        console.log(`[${timestamp}]   - Skipping transparent event: ${event.summary || 'No title'}`);
        continue;
      }

      let startDate: Date;
      let endDate: Date;
      let isAllDay = false;

      // Handle all-day events (have date, not dateTime)
      if (event.start.date && !event.start.dateTime) {
        isAllDay = true;
        startDate = new Date(event.start.date);
        endDate = new Date(event.end.date || event.start.date);
        console.log(`[${timestamp}]   - All-day event: ${event.summary || 'No title'} (${event.start.date})`);
      } else if (event.start.dateTime) {
        startDate = new Date(event.start.dateTime);
        endDate = new Date(event.end.dateTime || event.start.dateTime);
      } else {
        console.log(`[${timestamp}]   - Skipping event with no valid start time: ${event.id}`);
        continue;
      }

      // Format times for busy blocks
      const formatTime = (date: Date): string => {
        return date.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        });
      };

      // For all-day events, set as busy for the whole day
      if (isAllDay) {
        // Only include if it overlaps with today
        const eventDate = new Date(event.start.date!);
        if (eventDate >= today && eventDate <= todayEnd) {
          busyBlocks.push({
            start: '00:00',
            end: '23:59',
            label: event.summary || 'All-day event',
            source: 'calendar',
          });
          console.log(`[${timestamp}]     Added all-day block: ${event.summary || 'All-day event'}`);
        }
      } else {
        // Only include events that are today
        if (startDate >= today && startDate <= todayEnd) {
          const busyBlock: BusyBlock = {
            start: formatTime(startDate),
            end: formatTime(endDate),
            label: event.summary || 'Busy',
            source: 'calendar',
          };
          busyBlocks.push(busyBlock);
          console.log(`[${timestamp}]     Added block: ${busyBlock.start}-${busyBlock.end} "${busyBlock.label}"`);
        }
      }
    }

    console.log(`[${timestamp}] ========================================`);
    console.log(`[${timestamp}] ✓ Conversion complete`);
    console.log(`[${timestamp}] Total busy blocks created: ${busyBlocks.length}`);
    console.log(`[${timestamp}] ========================================`);

    // Sort by start time
    busyBlocks.sort((a, b) => a.start.localeCompare(b.start));

    return busyBlocks;

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : '';
    
    console.error(`[${timestamp}] ========================================`);
    console.error(`[${timestamp}] FATAL ERROR fetching calendar events`);
    console.error(`[${timestamp}] User ID: ${userId}`);
    console.error(`[${timestamp}] Error: ${errorMessage}`);
    console.error(`[${timestamp}] Stack trace:`);
    console.error(errorStack);
    console.error(`[${timestamp}] ========================================`);

    throw error;
  }
}

/**
 * Merges calendar blocks with existing voice blocks
 * Keeps voice blocks, replaces calendar blocks
 */
export function mergeBlocks(
  existingBlocks: BusyBlock[],
  calendarBlocks: BusyBlock[]
): BusyBlock[] {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] Merging blocks...`);
  console.log(`[${timestamp}]   - Existing blocks: ${existingBlocks.length}`);
  console.log(`[${timestamp}]   - Calendar blocks: ${calendarBlocks.length}`);

  // Keep only voice blocks from existing
  const voiceBlocks = existingBlocks.filter(block => block.source === 'voice');
  console.log(`[${timestamp}]   - Voice blocks kept: ${voiceBlocks.length}`);

  // Merge and sort
  const merged = [...voiceBlocks, ...calendarBlocks];
  merged.sort((a, b) => a.start.localeCompare(b.start));

  console.log(`[${timestamp}]   - Total merged blocks: ${merged.length}`);
  
  return merged;
}
