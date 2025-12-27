import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { fetchGoogleCalendarEvents, mergeBlocks, BusyBlock } from '@/lib/fetchGoogleCalendarEvents';

interface CalendarConnection {
  id: string;
  user_id: string;
  provider: string;
  calendar_email: string | null;
  last_synced: string | null;
}

interface SyncResult {
  userId: string;
  email: string | null;
  success: boolean;
  eventsCount?: number;
  error?: string;
}

/**
 * Cron job to sync all users' calendars
 * This should be triggered every 15 minutes by Vercel Cron or similar
 * 
 * For Vercel Cron, add this to vercel.json:
 * {
 *   "crons": [
 *     {
 *       "path": "/api/cron/sync-calendars",
 *       "schedule": "0/15 * * * *"
 *     }
 *   ]
 * }
 */
export async function GET(request: NextRequest) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ========================================`);
  console.log(`[${timestamp}] CRON: Calendar sync job started`);
  console.log(`[${timestamp}] ========================================`);

  try {
    // Verify cron secret for security
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    // Allow Vercel Cron (has special header) or manual trigger with secret
    const isVercelCron = request.headers.get('x-vercel-cron') === '1';
    const hasValidSecret = authHeader === `Bearer ${cronSecret}`;

    if (!isVercelCron && !hasValidSecret && cronSecret) {
      console.error(`[${timestamp}] ERROR: Unauthorized cron request`);
      console.error(`[${timestamp}] Is Vercel Cron: ${isVercelCron}`);
      console.error(`[${timestamp}] Has valid secret: ${hasValidSecret}`);
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log(`[${timestamp}] ✓ Authorization verified`);

    // Initialize Supabase client
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Fetch all users with calendar connections
    console.log(`[${timestamp}] Fetching users with calendar connections...`);
    
    const { data: connections, error: fetchError } = await supabase
      .from('calendar_connections')
      .select('id, user_id, provider, calendar_email, last_synced')
      .eq('provider', 'google');

    if (fetchError) {
      console.error(`[${timestamp}] ERROR: Failed to fetch calendar connections`);
      console.error(`[${timestamp}] Error: ${fetchError.message}`);
      return NextResponse.json(
        { error: 'Failed to fetch calendar connections', details: fetchError.message },
        { status: 500 }
      );
    }

    if (!connections || connections.length === 0) {
      console.log(`[${timestamp}] No calendar connections found, nothing to sync`);
      return NextResponse.json({
        success: true,
        message: 'No calendar connections to sync',
        synced: 0,
        failed: 0,
      });
    }

    console.log(`[${timestamp}] Found ${connections.length} calendar connections to sync`);

    // Process each user
    const results: SyncResult[] = [];
    let successCount = 0;
    let failureCount = 0;

    for (const connection of connections as CalendarConnection[]) {
      const userTimestamp = new Date().toISOString();
      console.log(`[${userTimestamp}] ----------------------------------------`);
      console.log(`[${userTimestamp}] Syncing user: ${connection.user_id}`);
      console.log(`[${userTimestamp}] Email: ${connection.calendar_email}`);
      console.log(`[${userTimestamp}] Last synced: ${connection.last_synced || 'Never'}`);

      try {
        // Fetch calendar events
        const calendarBlocks = await fetchGoogleCalendarEvents(connection.user_id, 1);
        console.log(`[${userTimestamp}] Fetched ${calendarBlocks.length} calendar events`);

        // Get existing user status
        const { data: existingStatus } = await supabase
          .from('user_status')
          .select('busy_blocks')
          .eq('user_id', connection.user_id)
          .single();

        const existingBlocks: BusyBlock[] = existingStatus?.busy_blocks || [];
        
        // Merge blocks (keep voice, replace calendar)
        const mergedBlocks = mergeBlocks(existingBlocks, calendarBlocks);
        console.log(`[${userTimestamp}] Merged blocks: ${mergedBlocks.length} total`);

        // Update user status with new blocks - use update if exists, insert if not
        let updateStatusError;
        
        if (existingStatus) {
          const { error } = await supabase
            .from('user_status')
            .update({ busy_blocks: mergedBlocks })
            .eq('user_id', connection.user_id);
          updateStatusError = error;
        } else {
          const { error } = await supabase
            .from('user_status')
            .insert({
              user_id: connection.user_id,
              busy_blocks: mergedBlocks,
            });
          updateStatusError = error;
        }

        if (updateStatusError) {
          throw new Error(`Failed to update user status: ${updateStatusError.message}`);
        }

        // Update last_synced timestamp
        const { error: updateSyncError } = await supabase
          .from('calendar_connections')
          .update({ last_synced: new Date().toISOString() })
          .eq('id', connection.id);

        if (updateSyncError) {
          console.warn(`[${userTimestamp}] Warning: Failed to update last_synced: ${updateSyncError.message}`);
        }

        console.log(`[${userTimestamp}] ✓ User sync completed successfully`);
        
        results.push({
          userId: connection.user_id,
          email: connection.calendar_email,
          success: true,
          eventsCount: calendarBlocks.length,
        });
        successCount++;

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`[${userTimestamp}] ✗ User sync failed: ${errorMessage}`);
        
        results.push({
          userId: connection.user_id,
          email: connection.calendar_email,
          success: false,
          error: errorMessage,
        });
        failureCount++;
      }
    }

    // Log summary
    console.log(`[${timestamp}] ========================================`);
    console.log(`[${timestamp}] CRON: Calendar sync job completed`);
    console.log(`[${timestamp}] Total connections: ${connections.length}`);
    console.log(`[${timestamp}] Successful: ${successCount}`);
    console.log(`[${timestamp}] Failed: ${failureCount}`);
    console.log(`[${timestamp}] ========================================`);

    // Send notification if too many failures
    if (failureCount > connections.length / 2) {
      console.error(`[${timestamp}] ⚠️ WARNING: More than 50% of syncs failed!`);
      // TODO: Send alert to admin (email, Slack, etc.)
    }

    return NextResponse.json({
      success: true,
      message: `Calendar sync completed: ${successCount} success, ${failureCount} failed`,
      synced: successCount,
      failed: failureCount,
      results,
      timestamp,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : '';
    
    console.error(`[${timestamp}] ========================================`);
    console.error(`[${timestamp}] FATAL ERROR in cron sync job`);
    console.error(`[${timestamp}] Error: ${errorMessage}`);
    console.error(`[${timestamp}] Stack trace:`);
    console.error(errorStack);
    console.error(`[${timestamp}] ========================================`);

    return NextResponse.json(
      { 
        error: 'Cron job failed', 
        message: errorMessage,
        timestamp,
      },
      { status: 500 }
    );
  }
}

// Also allow POST for manual triggering
export async function POST(request: NextRequest) {
  return GET(request);
}
