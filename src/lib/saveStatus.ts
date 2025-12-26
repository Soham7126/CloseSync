import { createSupabaseBrowserClient } from './supabase';
import type { BusyBlock } from './supabase';

export interface ParsedStatusData {
    tasks: string[];
    busy_blocks: BusyBlock[];
    free_after: string | null;
    free_until: string | null;
    blockers: string[];
    raw_transcript: string;
    confidence_score?: number;
}

export interface SaveStatusResult {
    success: boolean;
    error?: string;
    statusId?: string;
}

/**
 * Calculate status color based on current time and busy blocks
 * - Green: available now
 * - Yellow: busy now but free later today
 * - Red: busy all day or has blockers
 */
function calculateStatusColor(
    busyBlocks: BusyBlock[],
    blockers: string[],
    freeAfter: string | null
): 'green' | 'yellow' | 'red' {
    // If there are blockers, status is red
    if (blockers.length > 0) {
        return 'red';
    }

    // If no busy blocks, status is green
    if (!busyBlocks || busyBlocks.length === 0) {
        return 'green';
    }

    // Get current time in HH:MM format
    const now = new Date();
    const currentHours = now.getHours().toString().padStart(2, '0');
    const currentMinutes = now.getMinutes().toString().padStart(2, '0');
    const currentTime = `${currentHours}:${currentMinutes}`;

    // Check if currently in a busy block
    let isCurrentlyBusy = false;
    let hasFutureAvailability = false;

    for (const block of busyBlocks) {
        const start = block.start;
        const end = block.end;

        // Check if current time falls within this block
        if (currentTime >= start && currentTime < end) {
            isCurrentlyBusy = true;
        }

        // Check if block ends later today (meaning we'll be free after)
        if (end > currentTime) {
            hasFutureAvailability = true;
        }
    }

    // Find the last busy block end time
    const sortedBlocks = [...busyBlocks].sort((a, b) => a.end.localeCompare(b.end));
    const lastBlockEnd = sortedBlocks[sortedBlocks.length - 1]?.end;

    // If currently busy
    if (isCurrentlyBusy) {
        // Check if there's free time after the current block
        if (freeAfter || (lastBlockEnd && lastBlockEnd < '18:00')) {
            return 'yellow'; // Busy now but free later
        }
        return 'red'; // Busy all day
    }

    // Not currently busy
    // Check if all busy blocks are in the past
    const allBlocksInPast = busyBlocks.every(block => block.end <= currentTime);
    if (allBlocksInPast) {
        return 'green';
    }

    // Check if next busy block is coming up soon (within 30 min)
    const upcomingBlock = busyBlocks.find(block =>
        block.start > currentTime &&
        timeDiffMinutes(currentTime, block.start) <= 30
    );

    if (upcomingBlock) {
        return 'yellow'; // Meeting coming up soon
    }

    return 'green';
}

/**
 * Calculate minutes between two HH:MM times
 */
function timeDiffMinutes(time1: string, time2: string): number {
    const [h1, m1] = time1.split(':').map(Number);
    const [h2, m2] = time2.split(':').map(Number);
    return (h2 * 60 + m2) - (h1 * 60 + m1);
}

/**
 * Save or update user status in Supabase
 */
export async function saveStatus(
    userId: string,
    data: ParsedStatusData
): Promise<SaveStatusResult> {
    try {
        const supabase = createSupabaseBrowserClient();

        // Calculate status color
        const statusColor = calculateStatusColor(
            data.busy_blocks,
            data.blockers,
            data.free_after
        );

        // Prepare the status record
        const statusRecord = {
            user_id: userId,
            tasks: data.tasks,
            busy_blocks: data.busy_blocks,
            free_after: data.free_after,
            free_until: data.free_until,
            blockers: data.blockers,
            status_color: statusColor,
            raw_transcript: data.raw_transcript,
            confidence_score: data.confidence_score ?? 1.0,
            last_updated: new Date().toISOString(),
        };

        // Check if status exists for this user
        const { data: existingStatus } = await supabase
            .from('user_status')
            .select('id')
            .eq('user_id', userId)
            .single();

        let result;

        if (existingStatus) {
            // Update existing status
            result = await supabase
                .from('user_status')
                .update(statusRecord)
                .eq('user_id', userId)
                .select()
                .single();
        } else {
            // Insert new status
            result = await supabase
                .from('user_status')
                .insert(statusRecord)
                .select()
                .single();
        }

        if (result.error) {
            console.error('Save status error:', result.error);
            return {
                success: false,
                error: result.error.message,
            };
        }

        return {
            success: true,
            statusId: result.data?.id,
        };
    } catch (error) {
        console.error('Save status error:', error);
        return {
            success: false,
            error: 'Failed to save status. Please try again.',
        };
    }
}

/**
 * Fetch all team members' statuses
 */
export async function fetchTeamStatuses(teamId: string) {
    try {
        const supabase = createSupabaseBrowserClient();

        const { data, error } = await supabase
            .from('team_members_status')
            .select('*')
            .eq('team_id', teamId);

        if (error) {
            console.error('Fetch team statuses error:', error);
            return { success: false, error: error.message, data: null };
        }

        return { success: true, data, error: null };
    } catch (error) {
        console.error('Fetch team statuses error:', error);
        return { success: false, error: 'Failed to fetch team statuses', data: null };
    }
}
