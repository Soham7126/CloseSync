import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { fetchGoogleCalendarEvents, mergeBlocks, BusyBlock } from '@/lib/fetchGoogleCalendarEvents';

export async function POST(request: NextRequest) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ========================================`);
  console.log(`[${timestamp}] Manual calendar sync requested`);
  console.log(`[${timestamp}] ========================================`);

  try {
    // Get authenticated user
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) => {
                cookieStore.set(name, value, options);
              });
            } catch {
              // Ignore errors in Server Components
            }
          },
        },
      }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error(`[${timestamp}] ERROR: User not authenticated`);
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    console.log(`[${timestamp}] User authenticated: ${user.id}`);

    // Fetch calendar events
    console.log(`[${timestamp}] Fetching calendar events...`);
    const calendarBlocks = await fetchGoogleCalendarEvents(user.id, 1);
    console.log(`[${timestamp}] Fetched ${calendarBlocks.length} calendar events`);

    // Get existing user status
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: existingStatus } = await supabaseAdmin
      .from('user_status')
      .select('busy_blocks')
      .eq('user_id', user.id)
      .single();

    const existingBlocks: BusyBlock[] = existingStatus?.busy_blocks || [];
    console.log(`[${timestamp}] Existing blocks: ${existingBlocks.length}`);

    // Merge blocks (keep voice, replace calendar)
    const mergedBlocks = mergeBlocks(existingBlocks, calendarBlocks);
    console.log(`[${timestamp}] Merged blocks: ${mergedBlocks.length}`);

    // Update user status with new blocks - use update if exists, insert if not
    let updateStatusError;
    
    if (existingStatus) {
      // Update existing status
      const { error } = await supabaseAdmin
        .from('user_status')
        .update({ busy_blocks: mergedBlocks })
        .eq('user_id', user.id);
      updateStatusError = error;
    } else {
      // Insert new status
      const { error } = await supabaseAdmin
        .from('user_status')
        .insert({
          user_id: user.id,
          busy_blocks: mergedBlocks,
        });
      updateStatusError = error;
    }

    if (updateStatusError) {
      console.error(`[${timestamp}] ERROR: Failed to update user status`);
      console.error(`[${timestamp}] Error: ${updateStatusError.message}`);
      throw new Error(`Failed to update status: ${updateStatusError.message}`);
    }

    // Update last_synced timestamp
    const { error: updateSyncError } = await supabaseAdmin
      .from('calendar_connections')
      .update({ last_synced: new Date().toISOString() })
      .eq('user_id', user.id)
      .eq('provider', 'google');

    if (updateSyncError) {
      console.warn(`[${timestamp}] Warning: Failed to update last_synced: ${updateSyncError.message}`);
    }

    console.log(`[${timestamp}] ========================================`);
    console.log(`[${timestamp}] ✓ Manual sync completed successfully`);
    console.log(`[${timestamp}] Events synced: ${calendarBlocks.length}`);
    console.log(`[${timestamp}] ========================================`);

    return NextResponse.json({
      success: true,
      message: 'Calendar synced successfully',
      eventsCount: calendarBlocks.length,
      totalBlocks: mergedBlocks.length,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : '';
    
    console.error(`[${timestamp}] ========================================`);
    console.error(`[${timestamp}] FATAL ERROR in manual sync`);
    console.error(`[${timestamp}] Error: ${errorMessage}`);
    console.error(`[${timestamp}] Stack trace:`);
    console.error(errorStack);
    console.error(`[${timestamp}] ========================================`);

    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
