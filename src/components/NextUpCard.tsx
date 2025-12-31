'use client';

import { useState, useEffect } from 'react';

interface Meeting {
    id: string;
    title: string;
    start_time: string;
    end_time: string;
    meeting_link?: string | null;
}

interface NextUpCardProps {
    meeting?: Meeting | null;
    isLoading?: boolean;
}

export default function NextUpCard({ meeting, isLoading }: NextUpCardProps) {
    const [countdown, setCountdown] = useState<string | null>(null);

    useEffect(() => {
        if (!meeting) return;

        const updateCountdown = () => {
            const now = new Date();
            const start = new Date(meeting.start_time);
            const diff = start.getTime() - now.getTime();

            if (diff <= 0) {
                setCountdown(null);
                return;
            }

            const minutes = Math.floor(diff / (1000 * 60));
            if (minutes < 60) {
                setCountdown(`Starting in ${minutes} minute${minutes !== 1 ? 's' : ''}`);
            } else {
                const hours = Math.floor(minutes / 60);
                setCountdown(`Starting in ${hours} hour${hours !== 1 ? 's' : ''}`);
            }
        };

        updateCountdown();
        const interval = setInterval(updateCountdown, 60000);
        return () => clearInterval(interval);
    }, [meeting]);

    const formatMeetingTime = (startTime: string, endTime: string) => {
        const start = new Date(startTime);
        const end = new Date(endTime);
        const today = new Date();

        const isToday = start.toDateString() === today.toDateString();
        const isTomorrow = new Date(today.getTime() + 86400000).toDateString() === start.toDateString();

        const formatTime = (date: Date) => {
            return date.toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: '2-digit',
                hour12: true,
            });
        };

        const prefix = isToday ? 'Today' : isTomorrow ? 'Tomorrow' : start.toLocaleDateString('en-US', { weekday: 'short' });

        return `${prefix} · ${formatTime(start)}–${formatTime(end)}`;
    };

    const handleJoin = () => {
        if (meeting?.meeting_link) {
            window.open(meeting.meeting_link, '_blank');
        }
    };

    if (isLoading) {
        return (
            <div className="animate-pulse space-y-3">
                <div className="h-4 bg-gray-100 rounded w-24" />
                <div className="h-5 bg-gray-100 rounded w-32" />
                <div className="h-4 bg-gray-100 rounded w-40" />
            </div>
        );
    }

    if (!meeting) {
        return (
            <div className="flex flex-col items-center py-4 text-center">
                <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mb-3">
                    <svg className="w-6 h-6 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                </div>
                <p className="text-gray-500 text-sm">No upcoming meetings</p>
            </div>
        );
    }

    return (
        <div>
            {/* Label */}
            <div className="flex items-center gap-2 text-gray-400 text-xs font-medium uppercase tracking-wide mb-3">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
                <span>Next Meeting</span>
            </div>

            {/* Meeting Title */}
            <h3 className="text-lg font-semibold text-gray-900 mb-2">{meeting.title}</h3>

            {/* Time */}
            <p className="text-sm text-gray-500 mb-4">
                {formatMeetingTime(meeting.start_time, meeting.end_time)}
            </p>

            {/* Countdown */}
            {countdown && (
                <div className="inline-flex items-center px-3 py-1.5 bg-[#FFF7ED] text-[#F97316] rounded-full text-xs font-medium mb-5">
                    <svg className="w-3.5 h-3.5 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {countdown}
                </div>
            )}

            {/* Join Button */}
            <div className="pt-2">
                <button
                    onClick={handleJoin}
                    disabled={!meeting.meeting_link}
                    className={`btn w-full ${meeting.meeting_link ? 'btn-primary' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}
                >
                    {meeting.meeting_link ? 'Join Meeting' : 'No link available'}
                </button>
            </div>
        </div>
    );
}
