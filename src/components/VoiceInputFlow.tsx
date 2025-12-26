'use client';

import { useState, useCallback } from 'react';
import VoiceRecorder from './VoiceRecorder';
import { useTranscribe } from '@/hooks/useTranscribe';
import { useParseStatus, ParsedStatus } from '@/hooks/useParseStatus';

type FlowState =
    | 'idle'
    | 'recording'
    | 'transcribing'
    | 'showing-transcript'
    | 'parsing'
    | 'complete'
    | 'error';

interface VoiceInputFlowProps {
    onComplete?: (data: ParsedStatus) => void;
    onCancel?: () => void;
}

export default function VoiceInputFlow({ onComplete, onCancel }: VoiceInputFlowProps) {
    const [flowState, setFlowState] = useState<FlowState>('idle');
    const [transcript, setTranscript] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const { transcribe, isLoading: isTranscribing } = useTranscribe();
    const { parseStatus, isLoading: isParsing, data: parsedData } = useParseStatus();

    const handleRecordingComplete = useCallback(async (base64Audio: string, mimeType: string) => {
        setError(null);
        setFlowState('transcribing');

        // Step 1: Transcribe
        const transcriptResult = await transcribe(base64Audio, mimeType);

        if (!transcriptResult) {
            setError('Failed to transcribe audio. Please try again.');
            setFlowState('error');
            return;
        }

        setTranscript(transcriptResult);
        setFlowState('showing-transcript');

        // Show transcript for 2 seconds
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Step 2: Parse
        setFlowState('parsing');
        const parseResult = await parseStatus(transcriptResult);

        if (!parseResult) {
            setError('Failed to parse your status. Please try again.');
            setFlowState('error');
            return;
        }

        setFlowState('complete');
    }, [transcribe, parseStatus]);

    const handleRecordingError = useCallback((errorMessage: string) => {
        setError(errorMessage);
        setFlowState('error');
    }, []);

    const handleConfirm = useCallback(() => {
        if (parsedData) {
            onComplete?.(parsedData);
        }
    }, [parsedData, onComplete]);

    const handleRedo = useCallback(() => {
        setFlowState('idle');
        setTranscript(null);
        setError(null);
    }, []);

    const handleCancel = useCallback(() => {
        handleRedo();
        onCancel?.();
    }, [handleRedo, onCancel]);

    // Format time for display
    const formatTime = (time: string) => {
        const [hours, minutes] = time.split(':');
        const hour = parseInt(hours);
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const displayHour = hour % 12 || 12;
        return `${displayHour}:${minutes} ${ampm}`;
    };

    return (
        <div className="w-full max-w-md mx-auto">
            {/* Idle State - Show Recorder */}
            {flowState === 'idle' && (
                <div className="text-center">
                    <h2 className="text-xl font-semibold mb-2">Record Your Status</h2>
                    <p className="text-sm text-muted-foreground mb-6">
                        Tell us what you&apos;re working on and your availability
                    </p>
                    <VoiceRecorder
                        onRecordingComplete={handleRecordingComplete}
                        onError={handleRecordingError}
                    />
                </div>
            )}

            {/* Transcribing State */}
            {flowState === 'transcribing' && (
                <div className="flex flex-col items-center justify-center py-16 gap-4">
                    <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                    <p className="text-lg font-medium">Transcribing...</p>
                    <p className="text-sm text-muted-foreground">Converting your voice to text</p>
                </div>
            )}

            {/* Showing Transcript State */}
            {flowState === 'showing-transcript' && transcript && (
                <div className="flex flex-col items-center justify-center py-12 gap-4">
                    <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                        <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                    </div>
                    <p className="text-sm text-muted-foreground">Transcribed</p>
                    <div className="w-full p-4 rounded-lg bg-muted/50 border border-border">
                        <p className="text-sm italic">&ldquo;{transcript}&rdquo;</p>
                    </div>
                </div>
            )}

            {/* Parsing State */}
            {flowState === 'parsing' && (
                <div className="flex flex-col items-center justify-center py-16 gap-4">
                    <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                    <p className="text-lg font-medium">Parsing...</p>
                    <p className="text-sm text-muted-foreground">Extracting your tasks and schedule</p>
                </div>
            )}

            {/* Complete State - Show Results */}
            {flowState === 'complete' && parsedData && (
                <div className="space-y-6">
                    {/* Confidence indicator */}
                    {parsedData.confidence.overall < 0.7 && (
                        <div className="p-3 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800">
                            <p className="text-sm text-yellow-700 dark:text-yellow-400">
                                ⚠️ Some details may need verification
                            </p>
                        </div>
                    )}

                    {/* Results Card */}
                    <div className="rounded-xl border border-border bg-background shadow-sm overflow-hidden">
                        {/* Tasks Section */}
                        {parsedData.tasks.length > 0 && (
                            <div className="p-4 border-b border-border">
                                <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
                                    Tasks
                                </h3>
                                <ul className="space-y-2">
                                    {parsedData.tasks.map((task, index) => (
                                        <li key={index} className="flex items-start gap-2">
                                            <span className="w-5 h-5 rounded bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                                                <svg className="w-3 h-3 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                                </svg>
                                            </span>
                                            <span className="text-sm">{task}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {/* Busy Blocks Section */}
                        {parsedData.busy_blocks.length > 0 && (
                            <div className="p-4 border-b border-border">
                                <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
                                    Busy Times
                                </h3>
                                <div className="space-y-2">
                                    {parsedData.busy_blocks.map((block, index) => (
                                        <div key={index} className="flex items-center justify-between">
                                            <span className="text-sm">{block.label}</span>
                                            <span className="text-sm font-mono text-muted-foreground">
                                                {formatTime(block.start)} – {formatTime(block.end)}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Free Time Section */}
                        {(parsedData.free_after || parsedData.free_until) && (
                            <div className="p-4 border-b border-border">
                                <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
                                    Availability
                                </h3>
                                <div className="flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-green-500" />
                                    <span className="text-sm">
                                        {parsedData.free_after && `Free after ${formatTime(parsedData.free_after)}`}
                                        {parsedData.free_after && parsedData.free_until && ' • '}
                                        {parsedData.free_until && `Free until ${formatTime(parsedData.free_until)}`}
                                    </span>
                                </div>
                            </div>
                        )}

                        {/* Blockers Section */}
                        {parsedData.blockers.length > 0 && (
                            <div className="p-4 border-b border-border">
                                <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
                                    Blockers
                                </h3>
                                <ul className="space-y-2">
                                    {parsedData.blockers.map((blocker, index) => (
                                        <li key={index} className="flex items-start gap-2">
                                            <span className="w-5 h-5 rounded bg-red-100 dark:bg-red-900/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                                                <svg className="w-3 h-3 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                                </svg>
                                            </span>
                                            <span className="text-sm">{blocker}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {/* No content fallback */}
                        {parsedData.tasks.length === 0 &&
                            parsedData.busy_blocks.length === 0 &&
                            !parsedData.free_after &&
                            !parsedData.free_until &&
                            parsedData.blockers.length === 0 && (
                                <div className="p-6 text-center">
                                    <p className="text-sm text-muted-foreground">
                                        No specific tasks or schedule detected. Try recording again with more details.
                                    </p>
                                </div>
                            )}
                    </div>

                    {/* Transcript Preview */}
                    <div className="p-3 rounded-lg bg-muted/30 border border-border/50">
                        <p className="text-xs text-muted-foreground">
                            <span className="font-medium">You said:</span> &ldquo;{parsedData.raw_transcript}&rdquo;
                        </p>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-3">
                        <button
                            onClick={handleRedo}
                            className="flex-1 h-12 rounded-lg border border-border bg-background hover:bg-muted transition-colors flex items-center justify-center gap-2 text-sm font-medium"
                        >
                            <span>🎤</span>
                            <span>Redo</span>
                        </button>
                        <button
                            onClick={handleConfirm}
                            className="flex-1 h-12 rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity flex items-center justify-center gap-2 text-sm font-medium"
                        >
                            <span>✓</span>
                            <span>Looks Good</span>
                        </button>
                    </div>
                </div>
            )}

            {/* Error State */}
            {flowState === 'error' && (
                <div className="flex flex-col items-center justify-center py-12 gap-4">
                    <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                        <svg className="w-6 h-6 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </div>
                    <p className="text-lg font-medium">Something went wrong</p>
                    <p className="text-sm text-muted-foreground text-center max-w-xs">
                        {error || 'An unexpected error occurred.'}
                    </p>
                    <div className="flex gap-3 mt-4">
                        <button
                            onClick={handleCancel}
                            className="px-6 py-2 rounded-lg border border-border bg-background hover:bg-muted transition-colors text-sm font-medium"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleRedo}
                            className="px-6 py-2 rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity text-sm font-medium"
                        >
                            Try Again
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
