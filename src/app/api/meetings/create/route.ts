import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createMeeting } from '@/lib/createMeeting';

interface CreateMeetingRequest {
  participantId: string;
  title: string;
  startTime: string; // ISO string
  duration: number; // minutes
  notes?: string;
}

export async function POST(request: NextRequest) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ========================================`);
  console.log(`[${timestamp}] POST /api/meetings/create`);
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
    const body = await request.json() as CreateMeetingRequest;
    console.log(`[${timestamp}] Request body:`, JSON.stringify(body, null, 2));

    // Validate required fields
    if (!body.participantId) {
      return NextResponse.json(
        { error: 'Participant ID is required' },
        { status: 400 }
      );
    }

    if (!body.title || body.title.trim() === '') {
      return NextResponse.json(
        { error: 'Meeting title is required' },
        { status: 400 }
      );
    }

    if (!body.startTime) {
      return NextResponse.json(
        { error: 'Start time is required' },
        { status: 400 }
      );
    }

    if (!body.duration || body.duration < 5 || body.duration > 480) {
      return NextResponse.json(
        { error: 'Duration must be between 5 and 480 minutes' },
        { status: 400 }
      );
    }

    // Validate start time is in the future
    const startTime = new Date(body.startTime);
    if (startTime <= new Date()) {
      return NextResponse.json(
        { error: 'Start time must be in the future' },
        { status: 400 }
      );
    }

    // Prevent booking with yourself
    if (body.participantId === user.id) {
      return NextResponse.json(
        { error: 'Cannot book a meeting with yourself' },
        { status: 400 }
      );
    }

    // Create the meeting
    console.log(`[${timestamp}] Creating meeting...`);
    const meeting = await createMeeting({
      organizerId: user.id,
      participantId: body.participantId,
      title: body.title.trim(),
      startTime,
      duration: body.duration,
      notes: body.notes?.trim(),
    });

    console.log(`[${timestamp}] ✓ Meeting created: ${meeting.id}`);

    return NextResponse.json({
      success: true,
      meeting,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : '';
    
    console.error(`[${timestamp}] ========================================`);
    console.error(`[${timestamp}] ERROR creating meeting`);
    console.error(`[${timestamp}] Error: ${errorMessage}`);
    console.error(`[${timestamp}] Stack:`);
    console.error(errorStack);
    console.error(`[${timestamp}] ========================================`);

    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
