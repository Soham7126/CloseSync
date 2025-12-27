import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { findAvailableSlots } from '@/lib/findAvailableSlots';

interface SlotsRequest {
  userIds: string[];
  minDuration?: number;
  daysAhead?: number;
}

export async function POST(request: NextRequest) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ========================================`);
  console.log(`[${timestamp}] POST /api/availability/slots`);
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

    // Parse request body
    const body = await request.json() as SlotsRequest;
    console.log(`[${timestamp}] Request:`, JSON.stringify(body, null, 2));

    // Validate
    if (!body.userIds || !Array.isArray(body.userIds) || body.userIds.length === 0) {
      return NextResponse.json(
        { error: 'userIds array is required' },
        { status: 400 }
      );
    }

    // Ensure current user is included
    if (!body.userIds.includes(user.id)) {
      body.userIds.push(user.id);
    }

    // Calculate date range
    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + (body.daysAhead || 2));

    // Find available slots
    console.log(`[${timestamp}] Finding slots for users: ${body.userIds.join(', ')}`);
    
    const slots = await findAvailableSlots({
      userIds: body.userIds,
      minDuration: body.minDuration || 15,
      startDate,
      endDate,
      workingHoursStart: 9,
      workingHoursEnd: 18,
    });

    console.log(`[${timestamp}] ✓ Found ${slots.length} available slots`);

    return NextResponse.json({
      success: true,
      slots,
      count: slots.length,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[${timestamp}] ERROR: ${errorMessage}`);

    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
