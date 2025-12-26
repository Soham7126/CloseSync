import { useState, useCallback } from 'react';

interface TranscribeResult {
    success: boolean;
    transcript?: string;
    error?: string;
    message?: string;
}

interface UseTranscribeOptions {
    onSuccess?: (transcript: string) => void;
    onError?: (error: string) => void;
}

interface UseTranscribeReturn {
    transcribe: (audio: string, mimeType: string) => Promise<string | null>;
    isLoading: boolean;
    error: string | null;
    transcript: string | null;
    reset: () => void;
}

export function useTranscribe(options?: UseTranscribeOptions): UseTranscribeReturn {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [transcript, setTranscript] = useState<string | null>(null);

    const reset = useCallback(() => {
        setError(null);
        setTranscript(null);
    }, []);

    const transcribe = useCallback(async (audio: string, mimeType: string): Promise<string | null> => {
        setIsLoading(true);
        setError(null);
        setTranscript(null);

        try {
            const response = await fetch('/api/transcribe', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ audio, mimeType }),
            });

            const data: TranscribeResult = await response.json();

            if (!response.ok) {
                const errorMessage = data.message || data.error || 'Transcription failed';
                setError(errorMessage);
                options?.onError?.(errorMessage);
                return null;
            }

            if (data.success && data.transcript) {
                setTranscript(data.transcript);
                options?.onSuccess?.(data.transcript);
                return data.transcript;
            }

            const errorMessage = 'No transcript returned';
            setError(errorMessage);
            options?.onError?.(errorMessage);
            return null;

        } catch (err) {
            let errorMessage = 'Failed to transcribe audio';

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
        transcribe,
        isLoading,
        error,
        transcript,
        reset,
    };
}

export default useTranscribe;
