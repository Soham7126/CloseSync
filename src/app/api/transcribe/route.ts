import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

// Simple in-memory rate limiting store
// In production, use Redis or a database
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

const RATE_LIMIT_MAX = 10; // Max requests per window
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute in milliseconds

function getRateLimitKey(request: NextRequest): string {
    // Use IP address or a custom header for user identification
    const forwarded = request.headers.get('x-forwarded-for');
    const ip = forwarded ? forwarded.split(',')[0].trim() : 'unknown';
    return `transcribe:${ip}`;
}

function checkRateLimit(key: string): { allowed: boolean; remaining: number; resetIn: number } {
    const now = Date.now();
    const record = rateLimitStore.get(key);

    if (!record || now > record.resetTime) {
        // Create new record
        rateLimitStore.set(key, {
            count: 1,
            resetTime: now + RATE_LIMIT_WINDOW,
        });
        return { allowed: true, remaining: RATE_LIMIT_MAX - 1, resetIn: RATE_LIMIT_WINDOW };
    }

    if (record.count >= RATE_LIMIT_MAX) {
        return {
            allowed: false,
            remaining: 0,
            resetIn: record.resetTime - now
        };
    }

    // Increment count
    record.count += 1;
    rateLimitStore.set(key, record);

    return {
        allowed: true,
        remaining: RATE_LIMIT_MAX - record.count,
        resetIn: record.resetTime - now
    };
}

// Cleanup old entries periodically
setInterval(() => {
    const now = Date.now();
    for (const [key, record] of rateLimitStore.entries()) {
        if (now > record.resetTime) {
            rateLimitStore.delete(key);
        }
    }
}, RATE_LIMIT_WINDOW);

export async function POST(request: NextRequest) {
    try {
        // Check rate limit
        const rateLimitKey = getRateLimitKey(request);
        const rateLimit = checkRateLimit(rateLimitKey);

        if (!rateLimit.allowed) {
            return NextResponse.json(
                {
                    error: 'Too many requests',
                    message: 'Rate limit exceeded. Please try again later.',
                    resetIn: Math.ceil(rateLimit.resetIn / 1000),
                },
                {
                    status: 429,
                    headers: {
                        'X-RateLimit-Limit': RATE_LIMIT_MAX.toString(),
                        'X-RateLimit-Remaining': '0',
                        'X-RateLimit-Reset': Math.ceil(rateLimit.resetIn / 1000).toString(),
                    },
                }
            );
        }

        // Check for OpenAI API key
        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) {
            console.error('OPENAI_API_KEY environment variable is not set');
            return NextResponse.json(
                {
                    error: 'Configuration error',
                    message: 'The server is not properly configured for transcription.',
                },
                { status: 500 }
            );
        }

        // Parse request body
        const body = await request.json();
        const { audio, mimeType } = body;

        if (!audio) {
            return NextResponse.json(
                {
                    error: 'Invalid request',
                    message: 'Audio data is required.',
                },
                { status: 400 }
            );
        }

        // Convert base64 to buffer
        const audioBuffer = Buffer.from(audio, 'base64');

        // Validate audio size (max 25MB for Whisper)
        const maxSize = 25 * 1024 * 1024; // 25MB
        if (audioBuffer.length > maxSize) {
            return NextResponse.json(
                {
                    error: 'File too large',
                    message: 'Audio file must be less than 25MB.',
                },
                { status: 400 }
            );
        }

        // Determine file extension from mime type
        const extensionMap: Record<string, string> = {
            'audio/webm': 'webm',
            'audio/webm;codecs=opus': 'webm',
            'audio/mp4': 'm4a',
            'audio/mpeg': 'mp3',
            'audio/mp3': 'mp3',
            'audio/wav': 'wav',
            'audio/ogg': 'ogg',
            'audio/ogg;codecs=opus': 'ogg',
            'audio/flac': 'flac',
        };

        const extension = extensionMap[mimeType] || 'webm';
        const filename = `audio.${extension}`;

        // Create a File object for OpenAI
        const file = new File([audioBuffer], filename, { type: mimeType || 'audio/webm' });

        // Initialize OpenAI client
        const openai = new OpenAI({ apiKey });

        // Send to Whisper API
        const transcription = await openai.audio.transcriptions.create({
            file,
            model: 'whisper-1',
            response_format: 'json',
        });

        return NextResponse.json(
            {
                success: true,
                transcript: transcription.text,
            },
            {
                headers: {
                    'X-RateLimit-Limit': RATE_LIMIT_MAX.toString(),
                    'X-RateLimit-Remaining': rateLimit.remaining.toString(),
                    'X-RateLimit-Reset': Math.ceil(rateLimit.resetIn / 1000).toString(),
                },
            }
        );

    } catch (error) {
        console.error('Transcription error:', error);

        // Handle specific OpenAI errors
        if (error instanceof OpenAI.APIError) {
            const status = error.status || 500;

            if (status === 401) {
                return NextResponse.json(
                    {
                        error: 'Authentication failed',
                        message: 'Invalid API key. Please check your configuration.',
                    },
                    { status: 500 }
                );
            }

            if (status === 429) {
                return NextResponse.json(
                    {
                        error: 'API rate limit',
                        message: 'OpenAI rate limit reached. Please try again later.',
                    },
                    { status: 429 }
                );
            }

            if (status === 400) {
                return NextResponse.json(
                    {
                        error: 'Invalid audio',
                        message: 'The audio format is not supported or the file is corrupted.',
                    },
                    { status: 400 }
                );
            }

            return NextResponse.json(
                {
                    error: 'Transcription failed',
                    message: 'Failed to transcribe audio. Please try again.',
                },
                { status }
            );
        }

        // Handle network errors
        if (error instanceof TypeError && error.message.includes('fetch')) {
            return NextResponse.json(
                {
                    error: 'Network error',
                    message: 'Unable to connect to the transcription service. Please check your internet connection.',
                },
                { status: 503 }
            );
        }

        // Generic error
        return NextResponse.json(
            {
                error: 'Server error',
                message: 'An unexpected error occurred. Please try again.',
            },
            { status: 500 }
        );
    }
}
