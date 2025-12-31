'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { createSupabaseBrowserClient } from '@/lib/supabase';
import type { UserStatus } from '@/lib/supabase';

interface Meeting {
    id: string;
    title: string;
    description?: string;
    organizer_id: string;
    participant_id: string;
    start_time: string;
    end_time: string;
    duration: number;
    status: 'scheduled' | 'completed' | 'cancelled';
    organizer?: { name: string; email: string };
    participant?: { name: string; email: string };
}

interface BusyBlock {
    start: string;
    end: string;
    label?: string;
}

export default function SchedulePage() {
    const { user } = useAuth();
    const [meetings, setMeetings] = useState<Meeting[]>([]);
    const [busyBlocks, setBusyBlocks] = useState<BusyBlock[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [view, setView] = useState<'day' | 'week'>('week');

    const fetchMeetings = useCallback(async () => {
        if (!user?.id) return;

        const supabase = createSupabaseBrowserClient();

        // Get start and end of current week or day
        const start = new Date(selectedDate);
        start.setHours(0, 0, 0, 0);
        if (view === 'week') {
            start.setDate(start.getDate() - start.getDay());
        }

        const end = new Date(start);
        if (view === 'week') {
            end.setDate(end.getDate() + 7);
        } else {
            end.setDate(end.getDate() + 1);
        }

        const { data } = await supabase
            .from('meetings')
            .select('*')
            .or(`organizer_id.eq.${user.id},participant_id.eq.${user.id}`)
            .gte('start_time', start.toISOString())
            .lt('start_time', end.toISOString())
            .order('start_time', { ascending: true });

        setMeetings(data || []);
        setIsLoading(false);
    }, [user?.id, selectedDate, view]);

    const fetchStatus = useCallback(async () => {
        if (!user?.id) return;

        const supabase = createSupabaseBrowserClient();
        const result = await supabase
            .from('user_status')
            .select('*')
            .eq('user_id', user.id)
            .maybeSingle();

        const data = result.data as UserStatus | null;
        if (data && data.busy_blocks) {
            setBusyBlocks(data.busy_blocks as BusyBlock[]);
        }
    }, [user?.id]);

    useEffect(() => {
        fetchMeetings();
        fetchStatus();
    }, [fetchMeetings, fetchStatus]);

    const formatTime = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
        });
    };

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
        });
    };

    const getWeekDays = () => {
        const days = [];
        const start = new Date(selectedDate);
        start.setDate(start.getDate() - start.getDay());

        for (let i = 0; i < 7; i++) {
            const day = new Date(start);
            day.setDate(day.getDate() + i);
            days.push(day);
        }
        return days;
    };

    const goToPreviousWeek = () => {
        const prev = new Date(selectedDate);
        prev.setDate(prev.getDate() - 7);
        setSelectedDate(prev);
    };

    const goToNextWeek = () => {
        const next = new Date(selectedDate);
        next.setDate(next.getDate() + 7);
        setSelectedDate(next);
    };

    const goToToday = () => {
        setSelectedDate(new Date());
    };

    return (
        <div className="max-w-6xl mx-auto">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-[#1F2937]">Schedule</h1>
                    <p className="text-[#6B7280]">View and manage your meetings</p>
                </div>

                {/* View Toggle & Navigation */}
                <div className="flex items-center gap-3">
                    <button
                        onClick={goToToday}
                        className="px-3 py-2 rounded-lg border border-gray-300 text-[#1F2937] text-sm font-medium hover:bg-gray-50 transition-colors"
                    >
                        Today
                    </button>
                    <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden">
                        <button
                            onClick={goToPreviousWeek}
                            className="p-2 hover:bg-gray-50 transition-colors"
                        >
                            <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                        </button>
                        <button
                            onClick={goToNextWeek}
                            className="p-2 hover:bg-gray-50 transition-colors"
                        >
                            <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                        </button>
                    </div>
                    <div className="flex border border-gray-300 rounded-lg overflow-hidden">
                        <button
                            onClick={() => setView('day')}
                            className={`px-3 py-2 text-sm font-medium transition-colors ${view === 'day' ? 'bg-[#6366F1] text-white' : 'text-gray-600 hover:bg-gray-50'
                                }`}
                        >
                            Day
                        </button>
                        <button
                            onClick={() => setView('week')}
                            className={`px-3 py-2 text-sm font-medium transition-colors ${view === 'week' ? 'bg-[#6366F1] text-white' : 'text-gray-600 hover:bg-gray-50'
                                }`}
                        >
                            Week
                        </button>
                    </div>
                </div>
            </div>

            {/* Week Header */}
            {view === 'week' && (
                <div className="grid grid-cols-7 gap-2 mb-4">
                    {getWeekDays().map((day, i) => {
                        const isToday = day.toDateString() === new Date().toDateString();
                        return (
                            <div
                                key={i}
                                className={`text-center p-3 rounded-lg ${isToday ? 'bg-[#6366F1] text-white' : 'bg-white border border-gray-200'
                                    }`}
                            >
                                <p className={`text-xs font-medium ${isToday ? 'text-white/80' : 'text-gray-500'}`}>
                                    {day.toLocaleDateString('en-US', { weekday: 'short' })}
                                </p>
                                <p className={`text-lg font-bold ${isToday ? 'text-white' : 'text-[#1F2937]'}`}>
                                    {day.getDate()}
                                </p>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Loading */}
            {isLoading && (
                <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center">
                    <div className="w-8 h-8 border-2 border-[#6366F1] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-gray-500">Loading schedule...</p>
                </div>
            )}

            {/* Meetings List */}
            {!isLoading && (
                <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                    {meetings.length === 0 ? (
                        <div className="p-12 text-center">
                            <div className="w-16 h-16 mx-auto rounded-full bg-gray-100 flex items-center justify-center mb-4">
                                <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                            </div>
                            <h3 className="text-lg font-semibold text-[#1F2937] mb-2">No meetings scheduled</h3>
                            <p className="text-[#6B7280]">Your schedule is clear for this {view}.</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-gray-100">
                            {meetings.map((meeting) => (
                                <div key={meeting.id} className="p-4 hover:bg-gray-50 transition-colors">
                                    <div className="flex items-start justify-between">
                                        <div className="flex items-start gap-4">
                                            <div className="w-1 h-12 rounded-full bg-[#6366F1]" />
                                            <div>
                                                <h3 className="font-semibold text-[#1F2937]">{meeting.title}</h3>
                                                <p className="text-sm text-[#6B7280]">
                                                    {formatDate(meeting.start_time)} · {formatTime(meeting.start_time)} - {formatTime(meeting.end_time)}
                                                </p>
                                                {meeting.description && (
                                                    <p className="text-sm text-[#6B7280] mt-1">{meeting.description}</p>
                                                )}
                                            </div>
                                        </div>
                                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${meeting.status === 'scheduled' ? 'bg-green-100 text-green-700' :
                                            meeting.status === 'completed' ? 'bg-gray-100 text-gray-700' :
                                                'bg-red-100 text-red-700'
                                            }`}>
                                            {meeting.status}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Busy Blocks Section */}
            {busyBlocks.length > 0 && (
                <div className="mt-6">
                    <h2 className="text-lg font-semibold text-[#1F2937] mb-3">Your Busy Blocks Today</h2>
                    <div className="bg-white rounded-2xl border border-gray-200 p-4">
                        <div className="space-y-2">
                            {busyBlocks.map((block, i) => (
                                <div key={i} className="flex items-center gap-3 text-sm">
                                    <div className="w-2 h-2 rounded-full bg-[#EF4444]" />
                                    <span className="text-[#1F2937]">
                                        {block.start} - {block.end}
                                    </span>
                                    {block.label && (
                                        <span className="text-[#6B7280]">({block.label})</span>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
