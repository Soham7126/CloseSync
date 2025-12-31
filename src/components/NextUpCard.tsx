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
            <div className="animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-24 mb-3" />
                <div className="h-5 bg-gray-200 rounded w-32 mb-2" />
                <div className="h-4 bg-gray-200 rounded w-40" />
            </div>
        );
    }

    if (!meeting) {
        return (
            <p className="text-[#6B7280] text-sm">No upcoming meetings</p>
        );
    }

    return (
        <div>
            {/* Label */}
            <div className="flex items-center gap-2 text-[#6B7280] text-sm mb-3">
                <span>→</span>
                <span>Next Meeting</span>
            </div>

            {/* Meeting Title */}
            <h3 className="text-lg font-bold text-[#1F2937] mb-1">{meeting.title}</h3>

            {/* Time */}
            <p className="text-sm text-[#6B7280] mb-4">
                {formatMeetingTime(meeting.start_time, meeting.end_time)}
            </p>

            {/* Countdown */}
            {countdown && (
                <p className="text-xs text-[#6366F1] mb-4">{countdown}</p>
            )}

            {/* Join Button */}
            <button
                onClick={handleJoin}
                disabled={!meeting.meeting_link}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${meeting.meeting_link
                    ? 'bg-[#6366F1] text-white hover:bg-[#5558E3]'
                    : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    }`}
            >
                Join
            </button>

            {!meeting.meeting_link && (
                <p className="text-xs text-gray-400 mt-2">No meeting link available</p>
            )}
        </div>
    );
}
