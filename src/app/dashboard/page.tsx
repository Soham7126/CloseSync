'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/components/AuthProvider';
import SpeakYourDayCard from '@/components/SpeakYourDayCard';
import StatusTodayCard from '@/components/StatusTodayCard';
import NextUpCard from '@/components/NextUpCard';
import QuickActionsCard from '@/components/QuickActionsCard';
import VoiceInputFlow from '@/components/VoiceInputFlow';
import GroupSchedulingModal from '@/components/GroupSchedulingModal';
import CalendarConnection from '@/components/CalendarConnection';
import useSaveStatus, { ToastContainer } from '@/hooks/useSaveStatus';
import { createSupabaseBrowserClient } from '@/lib/supabase';
import type { UserStatus, User } from '@/lib/supabase';

interface Meeting {
    id: string;
    title: string;
    start_time: string;
    end_time: string;
    meeting_link?: string | null;
    organizer_id: string;
    participant_id: string;
}

interface TeamMember {
    user: User;
    status: UserStatus | null;
}

export default function DashboardPage() {
    const { user, profile, team } = useAuth();
    const { save, toasts, dismissToast } = useSaveStatus();

    const [currentStatus, setCurrentStatus] = useState<UserStatus | null>(null);
    const [nextMeeting, setNextMeeting] = useState<Meeting | null>(null);
    const [isLoadingStatus, setIsLoadingStatus] = useState(true);
    const [isLoadingMeeting, setIsLoadingMeeting] = useState(true);
    const [calendarConnected, setCalendarConnected] = useState<boolean | null>(null);

    const [showVoiceModal, setShowVoiceModal] = useState(false);
    const [showGroupModal, setShowGroupModal] = useState(false);
    const [transcript, setTranscript] = useState('');
    const [isTranscribing, setIsTranscribing] = useState(false);

    const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);

    // Fetch current user's status
    const fetchStatus = useCallback(async () => {
        if (!user?.id) return;

        const supabase = createSupabaseBrowserClient();
        const { data } = await supabase
            .from('user_status')
            .select('*')
            .eq('user_id', user.id)
            .single();

        setCurrentStatus(data);
        setIsLoadingStatus(false);
    }, [user?.id]);

    // Fetch next meeting
    const fetchNextMeeting = useCallback(async () => {
        if (!user?.id) return;

        const supabase = createSupabaseBrowserClient();
        const now = new Date().toISOString();

        const { data } = await supabase
            .from('meetings')
            .select('*')
            .or(`organizer_id.eq.${user.id},participant_id.eq.${user.id}`)
            .gte('start_time', now)
            .order('start_time', { ascending: true })
            .limit(1)
            .single();

        setNextMeeting(data);
        setIsLoadingMeeting(false);
    }, [user?.id]);

    // Check calendar connection
    const checkCalendarConnection = useCallback(async () => {
        if (!user?.id) return;

        const supabase = createSupabaseBrowserClient();
        const { data } = await supabase
            .from('calendar_connections')
            .select('id')
            .eq('user_id', user.id)
            .single();

        setCalendarConnected(!!data);
    }, [user?.id]);

    // Fetch team members for group modal
    const fetchTeamMembers = useCallback(async () => {
        if (!team?.id) return;

        const supabase = createSupabaseBrowserClient();
        const { data: users } = await supabase
            .from('users')
            .select('*')
            .eq('team_id', team.id);

        if (users) {
            const userIds = users.map((u: User) => u.id);
            const { data: statuses } = await supabase
                .from('user_status')
                .select('*')
                .in('user_id', userIds);

            const members: TeamMember[] = users.map((u: User) => ({
                user: u,
                status: (statuses as UserStatus[] | null)?.find((s: UserStatus) => s.user_id === u.id) || null,
            }));

            setTeamMembers(members);
        }
    }, [team?.id]);

    // Initial data fetch
    useEffect(() => {
        fetchStatus();
        fetchNextMeeting();
        checkCalendarConnection();
        fetchTeamMembers();
    }, [fetchStatus, fetchNextMeeting, checkCalendarConnection, fetchTeamMembers]);

    // Auto-refresh status every 30s
    useEffect(() => {
        const interval = setInterval(fetchStatus, 30000);
        return () => clearInterval(interval);
    }, [fetchStatus]);

    // Auto-refresh meetings every 60s
    useEffect(() => {
        const interval = setInterval(fetchNextMeeting, 60000);
        return () => clearInterval(interval);
    }, [fetchNextMeeting]);

    // Handle voice recording complete - only transcribe, don't save yet
    const handleRecordingComplete = async (audioBlob: Blob) => {
        setIsTranscribing(true);

        try {
            // Convert blob to base64
            const reader = new FileReader();
            const base64Promise = new Promise<string>((resolve) => {
                reader.onloadend = () => {
                    const base64 = (reader.result as string).split(',')[1];
                    resolve(base64);
                };
            });
            reader.readAsDataURL(audioBlob);
            const base64Audio = await base64Promise;

            // Send to transcription API
            const transcribeResponse = await fetch('/api/transcribe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    audio: base64Audio,
                    mimeType: 'audio/webm;codecs=opus'
                }),
            });

            const transcribeData = await transcribeResponse.json();

            if (transcribeData.transcript) {
                // Just set the transcript - user will confirm before saving
                setTranscript(transcribeData.transcript);
            } else if (transcribeData.error) {
                console.error('Transcription error:', transcribeData.error);
                alert('Could not transcribe audio: ' + (transcribeData.message || 'Unknown error'));
            }
        } catch (error) {
            console.error('Error transcribing:', error);
            alert('Error transcribing audio. Please try again.');
        } finally {
            setIsTranscribing(false);
        }
    };

    // Handle user confirming the transcript
    const handleConfirmTranscript = async (editedTranscript: string) => {
        setIsTranscribing(true);

        try {
            // Parse the status from the (potentially edited) transcript
            const parseResponse = await fetch('/api/parse-status', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ transcript: editedTranscript }),
            });

            const parseData = await parseResponse.json();

            if (parseData.data) {
                // Save the status
                const success = await save({
                    tasks: parseData.data.tasks || [],
                    busy_blocks: parseData.data.busy_blocks || [],
                    free_after: parseData.data.free_after,
                    free_until: parseData.data.free_until,
                    blockers: parseData.data.blockers || [],
                    raw_transcript: editedTranscript,
                    confidence_score: parseData.data.confidence?.overall || 1,
                });

                if (success) {
                    setTranscript(''); // Clear after successful save
                    await fetchStatus();
                }
            }
        } catch (error) {
            console.error('Error saving status:', error);
            alert('Error saving status. Please try again.');
        } finally {
            setIsTranscribing(false);
        }
    };

    // Handle user canceling the transcript
    const handleCancelTranscript = () => {
        setTranscript('');
    };

    // Handle voice flow complete (from modal)
    const handleVoiceComplete = async (data: {
        tasks: string[];
        busy_blocks: { start: string; end: string; label: string }[];
        free_after: string | null;
        free_until: string | null;
        blockers: string[];
        raw_transcript: string;
        confidence: { overall: number };
    }) => {
        const success = await save({
            tasks: data.tasks,
            busy_blocks: data.busy_blocks,
            free_after: data.free_after,
            free_until: data.free_until,
            blockers: data.blockers,
            raw_transcript: data.raw_transcript,
            confidence_score: data.confidence.overall,
        });

        if (success) {
            setShowVoiceModal(false);
            setTranscript(data.raw_transcript);
            await fetchStatus();
        }
    };

    // Handle meeting created
    const handleMeetingCreated = async () => {
        await fetchNextMeeting();
        await fetchTeamMembers();
    };

    // Calculate status color
    const getStatusColor = (): 'green' | 'yellow' | 'red' => {
        if (!currentStatus) return 'green';
        return currentStatus.status_color || 'green';
    };

    // Get busy blocks from status
    const getBusyBlocks = () => {
        if (!currentStatus?.busy_blocks) return [];
        return currentStatus.busy_blocks as { start: string; end: string; label?: string }[];
    };

    return (
        <div>
            {/* Calendar Connection Banner */}
            {calendarConnected === false && (
                <div className="mb-8 p-5 bg-[#FFF7ED] border border-[#FDBA74] rounded-2xl flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <span className="text-xl">📅</span>
                        <span className="text-gray-700">
                            Connect your calendar to auto-sync meetings
                        </span>
                    </div>
                    <button
                        onClick={() => setShowVoiceModal(true)}
                        className="btn btn-primary"
                    >
                        Connect Calendar
                    </button>
                </div>
            )}

            {/* 12-Column Grid Layout */}
            <div className="grid grid-cols-12 gap-8 lg:gap-12">
                {/* Left Column - 8 columns */}
                <div className="col-span-12 lg:col-span-8 flex flex-col gap-8">
                    {/* Speak Your Day Card - Hero Card */}
                    <div className="card-hero">
                        <div className="flex items-center gap-2 mb-6">
                            <div className="w-2 h-2 rounded-full bg-[#F97316]" />
                            <h2 className="text-lg font-semibold text-gray-900">Your Day</h2>
                        </div>
                        <SpeakYourDayCard
                            onRecordingComplete={handleRecordingComplete}
                            transcript={transcript}
                            isTranscribing={isTranscribing}
                            onConfirmTranscript={handleConfirmTranscript}
                            onCancelTranscript={handleCancelTranscript}
                        />
                    </div>

                    {/* Your Status Today Card - With tint */}
                    <div className="card-status">
                        <div className="flex items-center gap-2 mb-6">
                            <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 24 24">
                                <circle cx="12" cy="12" r="10" />
                            </svg>
                            <h2 className="text-lg font-semibold text-gray-900">Status Today</h2>
                        </div>
                        <StatusTodayCard
                            statusColor={getStatusColor()}
                            busyBlocks={getBusyBlocks()}
                            freeAfter={currentStatus?.free_after?.toString() || null}
                            timezone="IST"
                        />
                    </div>
                </div>

                {/* Right Column - 4 columns */}
                <div className="col-span-12 lg:col-span-4 flex flex-col gap-6">
                    {/* Next Up Card - Calendar accent */}
                    <div className="card-widget border-l-4 border-l-[#F97316]">
                        <div className="flex items-center gap-2 mb-5">
                            <svg className="w-4 h-4 text-[#F97316]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Next Up</h2>
                        </div>
                        <NextUpCard meeting={nextMeeting} isLoading={isLoadingMeeting} />
                    </div>

                    {/* Quick Actions Card - Arrow accent */}
                    <div className="card-widget">
                        <div className="flex items-center gap-2 mb-5">
                            <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                            <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Shortcuts</h2>
                        </div>
                        <QuickActionsCard onScheduleGroupMeeting={() => setShowGroupModal(true)} />
                    </div>

                    {/* Team Summary - Simple inline */}
                    <div className="card-widget bg-gray-50/50">
                        <div className="flex items-center gap-2 mb-5">
                            <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Team</h2>
                        </div>
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <span className="text-gray-500 text-sm">Members</span>
                                <span className="font-semibold text-gray-900">{teamMembers.length}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-gray-500 text-sm flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-green-500" />
                                    Available
                                </span>
                                <span className="font-semibold text-green-600">
                                    {teamMembers.filter(m => m.status?.status_color === 'green').length}
                                </span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-gray-500 text-sm flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                                    Busy
                                </span>
                                <span className="font-semibold text-amber-500">
                                    {teamMembers.filter(m => m.status?.status_color === 'yellow' || m.status?.status_color === 'red').length}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Voice Input Modal */}
            {showVoiceModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div
                        className="absolute inset-0 bg-black/50"
                        onClick={() => setShowVoiceModal(false)}
                    />
                    <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-hidden">
                        <div className="flex items-center justify-between p-5 border-b border-gray-200">
                            <div>
                                <h2 className="text-lg font-semibold text-[#1F2937]">
                                    Update Your Status
                                </h2>
                                <p className="text-sm text-[#6B7280] mt-0.5">
                                    Tell your team what you&apos;re working on
                                </p>
                            </div>
                            <button
                                onClick={() => setShowVoiceModal(false)}
                                className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
                            >
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                        <div className="p-5 overflow-y-auto max-h-[calc(90vh-80px)]">
                            <VoiceInputFlow
                                onComplete={handleVoiceComplete}
                                onCancel={() => setShowVoiceModal(false)}
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* Group Scheduling Modal */}
            {showGroupModal && user && (
                <GroupSchedulingModal
                    isOpen={showGroupModal}
                    onClose={() => setShowGroupModal(false)}
                    currentUserId={user.id}
                    teamMembers={teamMembers}
                    onMeetingCreated={handleMeetingCreated}
                />
            )}

            <ToastContainer toasts={toasts} onDismiss={dismissToast} />
        </div>
    );
}