'use client';

import { useState, useRef, useEffect } from 'react';

interface SpeakYourDayCardProps {
    onRecordingComplete: (audioBlob: Blob) => void;
    transcript?: string;
    isTranscribing?: boolean;
    onConfirmTranscript?: (editedTranscript: string) => void;
    onCancelTranscript?: () => void;
}

export default function SpeakYourDayCard({
    onRecordingComplete,
    transcript,
    isTranscribing,
    onConfirmTranscript,
    onCancelTranscript
}: SpeakYourDayCardProps) {
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const [waveformBars, setWaveformBars] = useState<number[]>(Array(30).fill(20));
    const [editableTranscript, setEditableTranscript] = useState('');
    const [isEditing, setIsEditing] = useState(false);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const animationRef = useRef<NodeJS.Timeout | null>(null);

    // Update editable transcript when transcript prop changes
    useEffect(() => {
        if (transcript) {
            setEditableTranscript(transcript);
            setIsEditing(true);
        }
    }, [transcript]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
            if (animationRef.current) clearInterval(animationRef.current);
        };
    }, []);

    // Animate waveform when recording
    useEffect(() => {
        if (isRecording) {
            animationRef.current = setInterval(() => {
                setWaveformBars(prev =>
                    prev.map(() => Math.random() * 60 + 10)
                );
            }, 100);
        } else {
            if (animationRef.current) clearInterval(animationRef.current);
            setWaveformBars(Array(30).fill(20));
        }
    }, [isRecording]);

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                    sampleRate: 16000,
                }
            });
            const mediaRecorder = new MediaRecorder(stream, {
                mimeType: 'audio/webm;codecs=opus'
            });
            mediaRecorderRef.current = mediaRecorder;
            chunksRef.current = [];

            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) {
                    chunksRef.current.push(e.data);
                }
            };

            mediaRecorder.onstop = () => {
                const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
                onRecordingComplete(audioBlob);
                stream.getTracks().forEach(track => track.stop());
            };

            mediaRecorder.start(1000); // Collect data every second
            setIsRecording(true);
            setRecordingTime(0);
            setIsEditing(false);
            setEditableTranscript('');

            timerRef.current = setInterval(() => {
                setRecordingTime(prev => prev + 1);
            }, 1000);
        } catch (error) {
            console.error('Error accessing microphone:', error);
            alert('Could not access microphone. Please check your browser permissions.');
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
            if (timerRef.current) {
                clearInterval(timerRef.current);
            }
        }
    };

    const handleMicClick = () => {
        if (isRecording) {
            stopRecording();
        } else {
            startRecording();
        }
    };

    const handleConfirm = () => {
        if (editableTranscript.trim() && onConfirmTranscript) {
            onConfirmTranscript(editableTranscript.trim());
            setIsEditing(false);
            setEditableTranscript('');
        }
    };

    const handleCancel = () => {
        setIsEditing(false);
        setEditableTranscript('');
        if (onCancelTranscript) {
            onCancelTranscript();
        }
    };

    return (
        <div>
            {/* Microphone Button */}
            <div className="flex justify-center mb-6">
                <button
                    onClick={handleMicClick}
                    disabled={isTranscribing || isEditing}
                    className={`w-20 h-20 rounded-full flex items-center justify-center transition-all ${isRecording
                        ? 'bg-red-500 animate-pulse shadow-lg shadow-red-500/30'
                        : isTranscribing || isEditing
                            ? 'bg-gray-200 cursor-not-allowed'
                            : 'bg-gray-100 hover:bg-gray-200'
                        }`}
                    aria-label={isRecording ? 'Stop recording' : 'Start recording'}
                    aria-live="polite"
                >
                    <svg
                        className={`w-8 h-8 ${isRecording ? 'text-white' : 'text-gray-500'}`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                        />
                    </svg>
                </button>
            </div>

            {/* Instruction Text */}
            {!isRecording && !isTranscribing && !isEditing && (
                <p className="text-sm text-gray-400 text-center mb-4">
                    Click the microphone to start speaking...
                </p>
            )}

            {/* Recording Indicator */}
            {isRecording && (
                <div className="text-center mb-4">
                    <p className="text-sm text-red-500 font-medium mb-2">
                        🔴 Recording... Click mic to stop
                    </p>
                    <span className="text-sm font-medium text-gray-500">{formatTime(recordingTime)}</span>
                </div>
            )}

            {/* Transcribing State */}
            {isTranscribing && (
                <div className="bg-gray-50 rounded-xl p-4 mb-4">
                    <div className="flex items-center justify-center gap-2 text-gray-500">
                        <div className="w-4 h-4 border-2 border-[#6366F1] border-t-transparent rounded-full animate-spin" />
                        <span className="text-sm">Transcribing your speech...</span>
                    </div>
                </div>
            )}

            {/* Editable Transcript with Confirm/Cancel */}
            {isEditing && !isTranscribing && (
                <div className="bg-gray-50 rounded-xl p-4 mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Review & Edit Your Transcript
                    </label>
                    <textarea
                        value={editableTranscript}
                        onChange={(e) => setEditableTranscript(e.target.value)}
                        className="w-full p-3 border border-gray-200 rounded-lg text-sm text-gray-900 bg-white resize-none focus:outline-none focus:ring-2 focus:ring-[#6366F1]/20 focus:border-[#6366F1]"
                        rows={3}
                        placeholder="Edit your transcript if needed..."
                    />
                    <div className="flex gap-3 mt-3">
                        <button
                            onClick={handleConfirm}
                            disabled={!editableTranscript.trim()}
                            className="flex-1 px-4 py-2 bg-[#6366F1] text-white rounded-lg text-sm font-medium hover:bg-[#5558E3] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            ✓ Confirm & Save
                        </button>
                        <button
                            onClick={handleCancel}
                            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            {/* Waveform Visualization */}
            <div className="flex items-center gap-1 justify-center h-10">
                {waveformBars.map((height, i) => (
                    <div
                        key={i}
                        className={`w-1 rounded-full transition-all duration-100 ${isRecording ? 'bg-red-400' : 'bg-gray-200'
                            }`}
                        style={{ height: `${height}%` }}
                    />
                ))}
            </div>
        </div>
    );
}
