'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

interface VoiceRecorderProps {
    onRecordingComplete?: (base64Audio: string, mimeType: string) => void;
    onError?: (error: string) => void;
}

export default function VoiceRecorder({
    onRecordingComplete,
    onError
}: VoiceRecorderProps) {
    const [isRecording, setIsRecording] = useState(false);
    const [duration, setDuration] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const [isSupported, setIsSupported] = useState(true);

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const streamRef = useRef<MediaStream | null>(null);
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    // Check browser support on mount
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const hasMediaDevices = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
            const hasMediaRecorder = typeof MediaRecorder !== 'undefined';
            setIsSupported(hasMediaDevices && hasMediaRecorder);
        }
    }, []);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (timerRef.current) {
                clearInterval(timerRef.current);
            }
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop());
            }
        };
    }, []);

    const formatDuration = (seconds: number): string => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const blobToBase64 = (blob: Blob): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64String = reader.result as string;
                // Remove the data URL prefix to get just the base64 data
                const base64Data = base64String.split(',')[1];
                resolve(base64Data);
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    };

    const getSupportedMimeType = (): string => {
        const mimeTypes = [
            'audio/webm;codecs=opus',
            'audio/webm',
            'audio/mp4',
            'audio/ogg;codecs=opus',
            'audio/ogg',
            'audio/wav',
        ];

        for (const mimeType of mimeTypes) {
            if (MediaRecorder.isTypeSupported(mimeType)) {
                return mimeType;
            }
        }

        return 'audio/webm'; // Fallback
    };

    const handleError = useCallback((message: string) => {
        setError(message);
        setIsRecording(false);
        onError?.(message);

        // Clear error after 5 seconds
        setTimeout(() => setError(null), 5000);
    }, [onError]);

    const startRecording = async () => {
        setError(null);
        audioChunksRef.current = [];

        try {
            // Request microphone access
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                    sampleRate: 48000,
                },
            });

            streamRef.current = stream;

            const mimeType = getSupportedMimeType();

            // Create MediaRecorder with high quality settings
            const mediaRecorder = new MediaRecorder(stream, {
                mimeType,
                audioBitsPerSecond: 128000, // 128kbps
            });

            mediaRecorderRef.current = mediaRecorder;

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                }
            };

            mediaRecorder.onstop = async () => {
                const mimeType = mediaRecorder.mimeType;
                const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });

                try {
                    const base64Audio = await blobToBase64(audioBlob);
                    onRecordingComplete?.(base64Audio, mimeType);
                } catch {
                    handleError('Failed to process the recording. Please try again.');
                }

                // Cleanup
                if (streamRef.current) {
                    streamRef.current.getTracks().forEach(track => track.stop());
                    streamRef.current = null;
                }
            };

            mediaRecorder.onerror = () => {
                handleError('Recording failed. Please check your microphone and try again.');
            };

            // Start recording
            mediaRecorder.start(100); // Collect data every 100ms
            setIsRecording(true);
            setDuration(0);

            // Start duration timer
            timerRef.current = setInterval(() => {
                setDuration(prev => prev + 1);
            }, 1000);

        } catch (err) {
            if (err instanceof DOMException) {
                switch (err.name) {
                    case 'NotAllowedError':
                        handleError('Microphone access denied. Please allow microphone access in your browser settings.');
                        break;
                    case 'NotFoundError':
                        handleError('No microphone found. Please connect a microphone and try again.');
                        break;
                    case 'NotReadableError':
                        handleError('Microphone is in use by another application. Please close other apps using the microphone.');
                        break;
                    default:
                        handleError('Failed to access microphone. Please try again.');
                }
            } else {
                handleError('An unexpected error occurred. Please try again.');
            }
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop();
        }

        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }

        setIsRecording(false);
    };

    const toggleRecording = () => {
        if (isRecording) {
            stopRecording();
        } else {
            startRecording();
        }
    };

    if (!isSupported) {
        return (
            <div className="flex flex-col items-center gap-4 p-6">
                <div className="text-center text-red-500">
                    <p className="font-medium">Recording not supported</p>
                    <p className="text-sm text-muted-foreground mt-1">
                        Your browser doesn&apos;t support audio recording. Please use a modern browser like Chrome, Firefox, or Safari.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col items-center gap-6 p-6">
            {/* Error message */}
            {error && (
                <div className="w-full max-w-sm p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                    <p className="text-sm text-red-600 dark:text-red-400 text-center">
                        {error}
                    </p>
                </div>
            )}

            {/* Duration timer */}
            <div className="h-8 flex items-center justify-center">
                {isRecording && (
                    <span className="text-2xl font-mono font-semibold text-foreground">
                        {formatDuration(duration)}
                    </span>
                )}
            </div>

            {/* Microphone button */}
            <button
                onClick={toggleRecording}
                className={`
          relative w-24 h-24 sm:w-28 sm:h-28 rounded-full
          flex items-center justify-center
          transition-all duration-300 ease-in-out
          focus:outline-none focus:ring-4 focus:ring-offset-2
          active:scale-95
          ${isRecording
                        ? 'bg-red-500 hover:bg-red-600 focus:ring-red-300 dark:focus:ring-red-700'
                        : 'bg-primary hover:opacity-90 focus:ring-primary/30'
                    }
        `}
                aria-label={isRecording ? 'Stop recording' : 'Start recording'}
            >
                {/* Pulsing animation ring */}
                {isRecording && (
                    <>
                        <span className="absolute inset-0 rounded-full bg-red-500 animate-ping opacity-25" />
                        <span className="absolute inset-[-8px] rounded-full border-4 border-red-400 animate-pulse opacity-50" />
                    </>
                )}

                {/* Microphone icon */}
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    className={`
            w-10 h-10 sm:w-12 sm:h-12 relative z-10
            ${isRecording ? 'text-white' : 'text-primary-foreground'}
          `}
                >
                    {isRecording ? (
                        // Stop icon (square)
                        <rect x="6" y="6" width="12" height="12" rx="2" />
                    ) : (
                        // Microphone icon
                        <path
                            fillRule="evenodd"
                            d="M12 1a4 4 0 00-4 4v6a4 4 0 008 0V5a4 4 0 00-4-4zm-1 14.93A6.001 6.001 0 016 10V9a1 1 0 112 0v1a4 4 0 008 0V9a1 1 0 112 0v1a6.001 6.001 0 01-5 5.93V19h3a1 1 0 110 2H8a1 1 0 110-2h3v-3.07z"
                            clipRule="evenodd"
                        />
                    )}
                </svg>
            </button>

            {/* Recording status text */}
            <p className="text-sm text-muted-foreground text-center">
                {isRecording ? 'Tap to stop recording' : 'Tap to start recording'}
            </p>
        </div>
    );
}
