import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

// Types for the parsed status
interface BusyBlock {
    start: string;
    end: string;
    label: string;
}

interface ParsedStatus {
    tasks: string[];
    busy_blocks: BusyBlock[];
    free_after: string | null;
    free_until: string | null;
    blockers: string[];
    raw_transcript: string;
    confidence: {
        overall: number;
        tasks: number;
        schedule: number;
    };
    parsing_notes: string[];
}

// Rate limiting (shared with transcribe route in production, use Redis)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_MAX = 20;
const RATE_LIMIT_WINDOW = 60 * 1000;

function getRateLimitKey(request: NextRequest): string {
    const forwarded = request.headers.get('x-forwarded-for');
    const ip = forwarded ? forwarded.split(',')[0].trim() : 'unknown';
    return `parse-status:${ip}`;
}

function checkRateLimit(key: string): { allowed: boolean; remaining: number; resetIn: number } {
    const now = Date.now();
    const record = rateLimitStore.get(key);

    if (!record || now > record.resetTime) {
        rateLimitStore.set(key, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
        return { allowed: true, remaining: RATE_LIMIT_MAX - 1, resetIn: RATE_LIMIT_WINDOW };
    }

    if (record.count >= RATE_LIMIT_MAX) {
        return { allowed: false, remaining: 0, resetIn: record.resetTime - now };
    }

    record.count += 1;
    return { allowed: true, remaining: RATE_LIMIT_MAX - record.count, resetIn: record.resetTime - now };
}

const SYSTEM_PROMPT = `You are a precise status update parser. Extract structured data from informal voice transcripts about someone's work status, schedule, and availability.

IMPORTANT RULES:
1. Convert ALL times to 24-hour format (HH:MM)
2. If only start time is given for a meeting/event, assume 1 hour duration
3. Handle informal time expressions:
   - "3pm" → "15:00"  
   - "three o'clock" → "15:00" (assume PM during work hours 9-17, AM otherwise)
   - "afternoon" → approximately "14:00"
   - "morning" → approximately "09:00"
   - "lunch" → approximately "12:00" to "13:00"
   - "end of day" / "EOD" → "17:00"
   - "in an hour" → current time + 1 hour (you'll be given current time)
4. Tasks are action items the person is working on or plans to work on
5. Busy blocks are times when the person is unavailable (meetings, calls, focused work)
6. Blockers are things preventing progress (waiting on someone, stuck on issue, dependencies)
7. Free times indicate when the person becomes available

OUTPUT FORMAT (JSON only, no markdown):
{
  "tasks": ["task 1", "task 2"],
  "busy_blocks": [
    { "start": "HH:MM", "end": "HH:MM", "label": "description" }
  ],
  "free_after": "HH:MM" or null,
  "free_until": "HH:MM" or null,
  "blockers": ["blocker 1"],
  "confidence": {
    "overall": 0.0-1.0,
    "tasks": 0.0-1.0,
    "schedule": 0.0-1.0
  },
  "parsing_notes": ["any ambiguities or assumptions made"]
}

CONFIDENCE SCORING:
- 1.0: Clear, explicit information
- 0.7-0.9: Minor assumptions needed
- 0.5-0.7: Significant assumptions or ambiguity
- <0.5: Very unclear, mostly guessing

If the transcript contains no relevant status information, return empty arrays and null values with low confidence.`;

export async function POST(request: NextRequest) {
    try {
        // Rate limiting
        const rateLimitKey = getRateLimitKey(request);
        const rateLimit = checkRateLimit(rateLimitKey);

        if (!rateLimit.allowed) {
            return NextResponse.json(
                {
                    error: 'Too many requests',
                    message: 'Rate limit exceeded. Please try again later.',
                    resetIn: Math.ceil(rateLimit.resetIn / 1000),
                },
                { status: 429 }
            );
        }

        // Check API key
        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) {
            console.error('OPENAI_API_KEY not configured');
            return NextResponse.json(
                {
                    error: 'Configuration error',
                    message: 'Server is not properly configured.',
                },
                { status: 500 }
            );
        }

        // Parse request
        const body = await request.json();
        const { transcript, timezone } = body;

        if (!transcript || typeof transcript !== 'string') {
            return NextResponse.json(
                {
                    error: 'Invalid request',
                    message: 'Transcript text is required.',
                },
                { status: 400 }
            );
        }

        if (transcript.length > 10000) {
            return NextResponse.json(
                {
                    error: 'Transcript too long',
                    message: 'Transcript must be less than 10,000 characters.',
                },
                { status: 400 }
            );
        }

        // Get current time for context
        const now = new Date();
        const currentTime = now.toLocaleTimeString('en-US', {
            hour12: false,
            hour: '2-digit',
            minute: '2-digit',
            timeZone: timezone || 'UTC',
        });
        const currentDay = now.toLocaleDateString('en-US', {
            weekday: 'long',
            timeZone: timezone || 'UTC',
        });

        // Initialize OpenAI
        const openai = new OpenAI({ apiKey });

        // Call GPT-4o-mini
        const completion = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                { role: 'system', content: SYSTEM_PROMPT },
                {
                    role: 'user',
                    content: `Current time: ${currentTime} on ${currentDay}

Parse this status update transcript:
"${transcript}"`
                },
            ],
            temperature: 0.1, // Low temperature for consistent parsing
            max_tokens: 1000,
            response_format: { type: 'json_object' },
        });

        const responseText = completion.choices[0]?.message?.content;

        if (!responseText) {
            return NextResponse.json(
                {
                    error: 'Parsing failed',
                    message: 'No response from AI model.',
                },
                { status: 500 }
            );
        }

        // Parse the JSON response
        let parsedData: Omit<ParsedStatus, 'raw_transcript'>;
        try {
            parsedData = JSON.parse(responseText);
        } catch {
            console.error('Failed to parse AI response:', responseText);
            return NextResponse.json(
                {
                    error: 'Parsing failed',
                    message: 'Failed to parse AI response.',
                },
                { status: 500 }
            );
        }

        // Validate and sanitize the response
        const result: ParsedStatus = {
            tasks: Array.isArray(parsedData.tasks) ? parsedData.tasks.filter(t => typeof t === 'string') : [],
            busy_blocks: Array.isArray(parsedData.busy_blocks)
                ? parsedData.busy_blocks.filter(b => b.start && b.end && b.label).map(b => ({
                    start: String(b.start),
                    end: String(b.end),
                    label: String(b.label),
                }))
                : [],
            free_after: typeof parsedData.free_after === 'string' ? parsedData.free_after : null,
            free_until: typeof parsedData.free_until === 'string' ? parsedData.free_until : null,
            blockers: Array.isArray(parsedData.blockers) ? parsedData.blockers.filter(b => typeof b === 'string') : [],
            raw_transcript: transcript,
            confidence: {
                overall: typeof parsedData.confidence?.overall === 'number' ? parsedData.confidence.overall : 0.5,
                tasks: typeof parsedData.confidence?.tasks === 'number' ? parsedData.confidence.tasks : 0.5,
                schedule: typeof parsedData.confidence?.schedule === 'number' ? parsedData.confidence.schedule : 0.5,
            },
            parsing_notes: Array.isArray(parsedData.parsing_notes)
                ? parsedData.parsing_notes.filter(n => typeof n === 'string')
                : [],
        };

        return NextResponse.json(
            {
                success: true,
                data: result,
            },
            {
                headers: {
                    'X-RateLimit-Remaining': rateLimit.remaining.toString(),
                },
            }
        );

    } catch (error) {
        console.error('Parse status error:', error);

        if (error instanceof OpenAI.APIError) {
            const status = error.status || 500;

            if (status === 401) {
                return NextResponse.json(
                    { error: 'Authentication failed', message: 'Invalid API key.' },
                    { status: 500 }
                );
            }

            if (status === 429) {
                return NextResponse.json(
                    { error: 'API rate limit', message: 'OpenAI rate limit reached. Please try again later.' },
                    { status: 429 }
                );
            }

            return NextResponse.json(
                { error: 'AI processing failed', message: 'Failed to process transcript.' },
                { status }
            );
        }

        if (error instanceof SyntaxError) {
            return NextResponse.json(
                { error: 'Invalid request', message: 'Invalid JSON in request body.' },
                { status: 400 }
            );
        }

        return NextResponse.json(
            { error: 'Server error', message: 'An unexpected error occurred.' },
            { status: 500 }
        );
    }
}
