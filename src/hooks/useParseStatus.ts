import { useState, useCallback } from 'react';

interface BusyBlock {
    start: string;
    end: string;
    label: string;
}

interface Confidence {
    overall: number;
    tasks: number;
    schedule: number;
}

export interface ParsedStatus {
    tasks: string[];
    busy_blocks: BusyBlock[];
    free_after: string | null;
    free_until: string | null;
    blockers: string[];
    raw_transcript: string;
    confidence: Confidence;
    parsing_notes: string[];
}

interface ParseStatusResponse {
    success?: boolean;
    data?: ParsedStatus;
    error?: string;
    message?: string;
}

interface UseParseStatusOptions {
    timezone?: string;
    onSuccess?: (data: ParsedStatus) => void;
    onError?: (error: string) => void;
}

interface UseParseStatusReturn {
    parseStatus: (transcript: string) => Promise<ParsedStatus | null>;
    isLoading: boolean;
    error: string | null;
    data: ParsedStatus | null;
    reset: () => void;
}

export function useParseStatus(options?: UseParseStatusOptions): UseParseStatusReturn {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [data, setData] = useState<ParsedStatus | null>(null);

    const reset = useCallback(() => {
        setError(null);
        setData(null);
    }, []);

    const parseStatus = useCallback(async (transcript: string): Promise<ParsedStatus | null> => {
        if (!transcript.trim()) {
            const errorMsg = 'Transcript cannot be empty';
            setError(errorMsg);
            options?.onError?.(errorMsg);
            return null;
        }

        setIsLoading(true);
        setError(null);

        try {
            const response = await fetch('/api/parse-status', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    transcript,
                    timezone: options?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
                }),
            });

            const result: ParseStatusResponse = await response.json();

            if (!response.ok) {
                const errorMessage = result.message || result.error || 'Failed to parse status';
                setError(errorMessage);
                options?.onError?.(errorMessage);
                return null;
            }

            if (result.success && result.data) {
                setData(result.data);
                options?.onSuccess?.(result.data);
                return result.data;
            }

            const errorMessage = 'No data returned';
            setError(errorMessage);
            options?.onError?.(errorMessage);
            return null;

        } catch (err) {
            let errorMessage = 'Failed to parse status update';

            if (err instanceof TypeError && err.message.includes('fetch')) {
                errorMessage = 'Network error. Please check your internet connection.';
            } else if (err instanceof SyntaxError) {
                errorMessage = 'Invalid response from server.';
            }

            setError(errorMessage);
            options?.onError?.(errorMessage);
            return null;

        } finally {
            setIsLoading(false);
        }
    }, [options]);

    return {
        parseStatus,
        isLoading,
        error,
        data,
        reset,
    };
}

export default useParseStatus;
