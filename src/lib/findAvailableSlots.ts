import { createClient } from '@supabase/supabase-js';

export interface BusyBlock {
  start: string; // "HH:MM" or ISO datetime
  end: string;
  label?: string;
  source?: 'voice' | 'calendar';
}

export interface AvailableSlot {
  start: string; // ISO datetime
  end: string;   // ISO datetime
  duration: number; // minutes
  participants_free: string[]; // user IDs
}

export interface FindSlotsOptions {
  userIds: string[];
  minDuration?: number; // minutes, default 15
  startDate?: Date;     // default: today
  endDate?: Date;       // default: tomorrow
  workingHoursStart?: number; // default: 9 (9am)
  workingHoursEnd?: number;   // default: 18 (6pm)
  timezone?: string;    // default: 'UTC'
}

interface UserBusyBlocks {
  userId: string;
  blocks: TimeBlock[];
}

interface TimeBlock {
  start: Date;
  end: Date;
  userId?: string;
}

/**
 * Find available time slots when all specified users are free
 * 
 * @param options - Configuration options for finding slots
 * @returns Array of available time slots sorted by start time
 */
export async function findAvailableSlots(options: FindSlotsOptions): Promise<AvailableSlot[]> {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ========================================`);
  console.log(`[${timestamp}] Finding available slots`);
  console.log(`[${timestamp}] Users: ${options.userIds.join(', ')}`);
  console.log(`[${timestamp}] ========================================`);

  const {
    userIds,
    minDuration = 15,
    startDate = getStartOfDay(new Date()),
    endDate = getEndOfDay(addDays(new Date(), 1)),
    workingHoursStart = 9,
    workingHoursEnd = 18,
    timezone = 'UTC',
  } = options;

  // Validate inputs
  if (!userIds || userIds.length === 0) {
    console.log(`[${timestamp}] No users specified, returning empty array`);
    return [];
  }

  if (minDuration < 1) {
    throw new Error('Minimum duration must be at least 1 minute');
  }

  if (workingHoursStart >= workingHoursEnd) {
    throw new Error('Working hours start must be before end');
  }

  console.log(`[${timestamp}] Options:`);
  console.log(`[${timestamp}]   - Min duration: ${minDuration} minutes`);
  console.log(`[${timestamp}]   - Start date: ${startDate.toISOString()}`);
  console.log(`[${timestamp}]   - End date: ${endDate.toISOString()}`);
  console.log(`[${timestamp}]   - Working hours: ${workingHoursStart}:00 - ${workingHoursEnd}:00`);
  console.log(`[${timestamp}]   - Timezone: ${timezone}`);

  try {
    // Step 1: Fetch busy blocks for all users
    console.log(`[${timestamp}] Step 1: Fetching busy blocks for ${userIds.length} users...`);
    const userBusyBlocks = await fetchUserBusyBlocks(userIds, startDate, endDate);
    console.log(`[${timestamp}] Fetched busy blocks for ${userBusyBlocks.length} users`);

    // Step 2: Merge all busy blocks into a single timeline
    console.log(`[${timestamp}] Step 2: Merging busy blocks...`);
    const mergedBlocks = mergeAllBusyBlocks(userBusyBlocks);
    console.log(`[${timestamp}] Merged into ${mergedBlocks.length} blocks`);

    // Step 3: Generate working hours slots for the date range
    console.log(`[${timestamp}] Step 3: Generating working hours slots...`);
    const workingSlots = generateWorkingHoursSlots(
      startDate,
      endDate,
      workingHoursStart,
      workingHoursEnd,
      timezone
    );
    console.log(`[${timestamp}] Generated ${workingSlots.length} working hour slots`);

    // Step 4: Find gaps in the merged busy blocks within working hours
    console.log(`[${timestamp}] Step 4: Finding gaps...`);
    const gaps = findGapsInSchedule(workingSlots, mergedBlocks);
    console.log(`[${timestamp}] Found ${gaps.length} potential gaps`);

    // Step 5: Filter gaps by minimum duration
    console.log(`[${timestamp}] Step 5: Filtering by minimum duration (${minDuration} min)...`);
    const validSlots = gaps.filter(gap => {
      const duration = (gap.end.getTime() - gap.start.getTime()) / (1000 * 60);
      return duration >= minDuration;
    });
    console.log(`[${timestamp}] ${validSlots.length} slots meet minimum duration`);

    // Step 6: Format output
    console.log(`[${timestamp}] Step 6: Formatting output...`);
    const result: AvailableSlot[] = validSlots.map(slot => ({
      start: slot.start.toISOString(),
      end: slot.end.toISOString(),
      duration: Math.round((slot.end.getTime() - slot.start.getTime()) / (1000 * 60)),
      participants_free: userIds, // All participants are free during these slots
    }));

    // Sort by start time
    result.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

    console.log(`[${timestamp}] ========================================`);
    console.log(`[${timestamp}] ✓ Found ${result.length} available slots`);
    console.log(`[${timestamp}] ========================================`);

    return result;

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[${timestamp}] ERROR: ${errorMessage}`);
    throw error;
  }
}

/**
 * Fetch busy blocks for multiple users from the database
 */
async function fetchUserBusyBlocks(
  userIds: string[],
  startDate: Date,
  endDate: Date
): Promise<UserBusyBlocks[]> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: statuses, error } = await supabase
    .from('user_status')
    .select('user_id, busy_blocks')
    .in('user_id', userIds);

  if (error) {
    throw new Error(`Failed to fetch user statuses: ${error.message}`);
  }

  const result: UserBusyBlocks[] = [];

  for (const status of statuses || []) {
    const blocks: TimeBlock[] = [];
    const busyBlocks = status.busy_blocks as BusyBlock[] || [];

    for (const block of busyBlocks) {
      const timeBlock = parseBusyBlock(block, startDate, endDate);
      if (timeBlock) {
        blocks.push({ ...timeBlock, userId: status.user_id });
      }
    }

    result.push({
      userId: status.user_id,
      blocks,
    });
  }

  return result;
}

/**
 * Parse a busy block into a TimeBlock with actual dates
 * Handles both "HH:MM" format and ISO datetime format
 */
function parseBusyBlock(
  block: BusyBlock,
  referenceDate: Date,
  endDate: Date
): TimeBlock | null {
  let start: Date;
  let end: Date;

  // Check if it's a time-only format (HH:MM) or ISO datetime
  if (block.start.includes('T') || block.start.includes('-')) {
    // ISO datetime format
    start = new Date(block.start);
    end = new Date(block.end);
  } else {
    // Time-only format (HH:MM) - use reference date
    const [startHour, startMin] = block.start.split(':').map(Number);
    const [endHour, endMin] = block.end.split(':').map(Number);

    start = new Date(referenceDate);
    start.setHours(startHour, startMin, 0, 0);

    end = new Date(referenceDate);
    end.setHours(endHour, endMin, 0, 0);

    // Handle overnight blocks
    if (end <= start) {
      end.setDate(end.getDate() + 1);
    }
  }

  // Skip blocks outside the date range
  if (end <= referenceDate || start >= endDate) {
    return null;
  }

  return { start, end };
}

/**
 * Merge all busy blocks from all users into a single sorted, non-overlapping timeline
 */
function mergeAllBusyBlocks(userBusyBlocks: UserBusyBlocks[]): TimeBlock[] {
  // Collect all blocks
  const allBlocks: TimeBlock[] = [];
  for (const userBlocks of userBusyBlocks) {
    allBlocks.push(...userBlocks.blocks);
  }

  if (allBlocks.length === 0) {
    return [];
  }

  // Sort by start time
  allBlocks.sort((a, b) => a.start.getTime() - b.start.getTime());

  // Merge overlapping blocks
  const merged: TimeBlock[] = [allBlocks[0]];

  for (let i = 1; i < allBlocks.length; i++) {
    const current = allBlocks[i];
    const last = merged[merged.length - 1];

    if (current.start <= last.end) {
      // Overlapping - extend the last block if necessary
      if (current.end > last.end) {
        last.end = current.end;
      }
    } else {
      // Non-overlapping - add as new block
      merged.push(current);
    }
  }

  return merged;
}

/**
 * Generate working hours slots for each day in the date range
 */
function generateWorkingHoursSlots(
  startDate: Date,
  endDate: Date,
  workingHoursStart: number,
  workingHoursEnd: number,
  timezone: string
): TimeBlock[] {
  const slots: TimeBlock[] = [];
  const current = new Date(startDate);

  // Normalize to start of day
  current.setHours(0, 0, 0, 0);

  while (current < endDate) {
    const dayStart = new Date(current);
    dayStart.setHours(workingHoursStart, 0, 0, 0);

    const dayEnd = new Date(current);
    dayEnd.setHours(workingHoursEnd, 0, 0, 0);

    // Only add if the slot is within the requested range
    if (dayEnd > startDate && dayStart < endDate) {
      slots.push({
        start: dayStart < startDate ? startDate : dayStart,
        end: dayEnd > endDate ? endDate : dayEnd,
      });
    }

    // Move to next day
    current.setDate(current.getDate() + 1);
  }

  return slots;
}

/**
 * Find gaps between busy blocks within the working hours
 */
function findGapsInSchedule(
  workingSlots: TimeBlock[],
  busyBlocks: TimeBlock[]
): TimeBlock[] {
  const gaps: TimeBlock[] = [];

  for (const workSlot of workingSlots) {
    // Find busy blocks that overlap with this working slot
    const relevantBusy = busyBlocks.filter(
      b => b.start < workSlot.end && b.end > workSlot.start
    );

    if (relevantBusy.length === 0) {
      // No busy blocks - entire working slot is free
      gaps.push({ ...workSlot });
      continue;
    }

    // Sort by start time
    relevantBusy.sort((a, b) => a.start.getTime() - b.start.getTime());

    let currentTime = workSlot.start;

    for (const busy of relevantBusy) {
      // Clamp busy block to working slot boundaries
      const busyStart = busy.start < workSlot.start ? workSlot.start : busy.start;
      const busyEnd = busy.end > workSlot.end ? workSlot.end : busy.end;

      // If there's a gap before this busy block
      if (currentTime < busyStart) {
        gaps.push({
          start: new Date(currentTime),
          end: new Date(busyStart),
        });
      }

      // Move current time to end of this busy block
      if (busyEnd > currentTime) {
        currentTime = busyEnd;
      }
    }

    // Check for gap after the last busy block
    if (currentTime < workSlot.end) {
      gaps.push({
        start: new Date(currentTime),
        end: new Date(workSlot.end),
      });
    }
  }

  return gaps;
}

// Helper functions

function getStartOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

function getEndOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(23, 59, 59, 999);
  return result;
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * Convenience function to find a meeting slot for multiple users
 */
export async function findMeetingSlot(
  userIds: string[],
  durationMinutes: number = 30
): Promise<AvailableSlot | null> {
  const slots = await findAvailableSlots({
    userIds,
    minDuration: durationMinutes,
  });

  return slots.length > 0 ? slots[0] : null;
}

/**
 * Check if all users are available at a specific time
 */
export async function checkAvailability(
  userIds: string[],
  startTime: Date,
  endTime: Date
): Promise<{ available: boolean; conflictingUsers: string[] }> {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] Checking availability for ${userIds.length} users`);
  console.log(`[${timestamp}] Time: ${startTime.toISOString()} - ${endTime.toISOString()}`);

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: statuses, error } = await supabase
    .from('user_status')
    .select('user_id, busy_blocks')
    .in('user_id', userIds);

  if (error) {
    throw new Error(`Failed to fetch user statuses: ${error.message}`);
  }

  const conflictingUsers: string[] = [];

  for (const status of statuses || []) {
    const busyBlocks = status.busy_blocks as BusyBlock[] || [];
    
    for (const block of busyBlocks) {
      const timeBlock = parseBusyBlock(block, startTime, endTime);
      if (timeBlock) {
        // Check if this block overlaps with the requested time
        if (timeBlock.start < endTime && timeBlock.end > startTime) {
          conflictingUsers.push(status.user_id);
          break;
        }
      }
    }
  }

  const available = conflictingUsers.length === 0;
  console.log(`[${timestamp}] Available: ${available}`);
  if (!available) {
    console.log(`[${timestamp}] Conflicting users: ${conflictingUsers.join(', ')}`);
  }

  return { available, conflictingUsers };
}
