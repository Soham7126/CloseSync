import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ========================================`);
  console.log(`[${timestamp}] Calendar disconnect requested`);
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

    // Delete the calendar connection using service role
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    console.log(`[${timestamp}] Deleting calendar connection...`);
    
    const { error: deleteError } = await supabaseAdmin
      .from('calendar_connections')
      .delete()
      .eq('user_id', user.id)
      .eq('provider', 'google');

    if (deleteError) {
      console.error(`[${timestamp}] ERROR: Failed to delete calendar connection`);
      console.error(`[${timestamp}] Error: ${deleteError.message}`);
      throw new Error(`Failed to disconnect: ${deleteError.message}`);
    }

    console.log(`[${timestamp}] ✓ Calendar connection deleted`);

    // Optionally, clear calendar blocks from user status
    console.log(`[${timestamp}] Clearing calendar blocks from user status...`);
    
    const { data: existingStatus } = await supabaseAdmin
      .from('user_status')
      .select('busy_blocks')
      .eq('user_id', user.id)
      .single();

    if (existingStatus?.busy_blocks) {
      // Keep only voice blocks
      const voiceBlocks = existingStatus.busy_blocks.filter(
        (block: { source?: string }) => block.source !== 'calendar'
      );

      await supabaseAdmin
        .from('user_status')
        .update({ busy_blocks: voiceBlocks })
        .eq('user_id', user.id);

      console.log(`[${timestamp}] ✓ Calendar blocks cleared from user status`);
    }

    // Optionally revoke Google access (recommended for security)
    // Note: This would require the access token, which we just deleted
    // For full revocation, user should visit: https://myaccount.google.com/permissions

    console.log(`[${timestamp}] ========================================`);
    console.log(`[${timestamp}] ✓ Calendar disconnected successfully`);
    console.log(`[${timestamp}] User should also revoke access at:`);
    console.log(`[${timestamp}] https://myaccount.google.com/permissions`);
    console.log(`[${timestamp}] ========================================`);

    return NextResponse.json({
      success: true,
      message: 'Google Calendar disconnected',
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : '';
    
    console.error(`[${timestamp}] ========================================`);
    console.error(`[${timestamp}] FATAL ERROR in disconnect`);
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
