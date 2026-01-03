'use client';

import { useState, useEffect } from 'react';
import type { User, UserStatus, BusyBlock } from '@/lib/supabase';
import type { SaveState } from '@/hooks/useSaveStatus';

interface StatusCardProps {
    user: User;
    status: UserStatus | null;
    onQuickSync?: (userId: string) => void;
    isUpdating?: boolean;
    saveState?: SaveState;
}

// Avatar background colors
const avatarColors = [
    'bg-[#F97316]',
    'bg-[#3B82F6]',
    'bg-[#8B5CF6]',
    'bg-[#EC4899]',
    'bg-[#10B981]',
    'bg-[#06B6D4]',
];

function getAvatarColor(name: string): string {
    const hash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return avatarColors[hash % avatarColors.length];
}

export default function StatusCard({
    user,
    status,
    onQuickSync,
    isUpdating = false,
    saveState = 'idle'
}: StatusCardProps) {
    const [showPulse, setShowPulse] = useState(false);

    useEffect(() => {
        if (isUpdating) {
            setShowPulse(true);
            const timer = setTimeout(() => setShowPulse(false), 1500);
            return () => clearTimeout(timer);
        }
    }, [isUpdating]);

    const getStatusDot = () => {
        if (!status?.status_color) return 'bg-[#D1D5DB]';
        switch (status.status_color) {
            case 'green': return 'bg-[#10B981]';
            case 'yellow': return 'bg-[#F97316]';
            case 'red': return 'bg-[#EF4444]';
            default: return 'bg-[#D1D5DB]';
        }
    };

    const getStatusText = () => {
        if (!status) return 'No status';
        if (status.blockers && status.blockers.length > 0) return 'Blocked';
        if (status.status_color === 'red') return 'Busy all day';
        if (status.status_color === 'yellow') return 'Busy now';
        if (status.status_color === 'green') return 'Available now';
        return 'Available';
    };

    const getStatusBadgeColor = () => {
        if (!status?.status_color) return 'bg-[#E5E7EB]';
        switch (status.status_color) {
            case 'green': return 'bg-[#DCFCE7]';
            case 'yellow': return 'bg-[#FFF7ED]';
            case 'red': return 'bg-[#FEE2E2]';
            default: return 'bg-[#E5E7EB]';
        }
    };

    const getStatusTextColor = () => {
        if (!status?.status_color) return 'text-[#6B7280]';
        switch (status.status_color) {
            case 'green': return 'text-[#047857]';
            case 'yellow': return 'text-[#92400E]';
            case 'red': return 'text-[#7F1D1D]';
            default: return 'text-[#6B7280]';
        }
    };

    const getInitials = (name: string) => {
        return name
            .split(' ')
            .slice(0, 2)
            .map(n => n[0])
            .join('')
            .toUpperCase();
    };

    const formatTime = (time: string) => {
        if (!time) return '';
        const [hours, minutes] = time.split(':');
        let hour = parseInt(hours);
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const displayHour = hour % 12 || 12;
        return `${displayHour}:${minutes} ${ampm}`;
    };

    const formatLastUpdated = (timestamp: string) => {
        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMins / 60);

        if (diffMins < 1) return 'just now';
        if (diffMins < 60) return `${diffMins} min ago`;
        if (diffHours < 24) return `${diffHours} ${diffHours === 1 ? 'hour' : 'hours'} ago`;
        return '1d ago';
    };

    const getMainTask = () => {
        if (!status?.tasks || status.tasks.length === 0) return null;
        return status.tasks[0];
    };

    const getFreeTimeMessage = () => {
        if (!status) return 'Free all day';
        if (status.free_after) {
            if (status.free_after.startsWith('tomorrow')) return `Free ${status.free_after}`;
            return `Free after ${formatTime(status.free_after)}`;
        }
        if (!status.busy_blocks || status.busy_blocks.length === 0) {
            return 'Free all day';
        }
        return null;
    };

    const avatarColor = getAvatarColor(user.name);

    const handleCardClick = () => {
        if (onQuickSync) {
            onQuickSync(user.id);
        }
    };

    return (
        <div
            onClick={handleCardClick}
            className={`
                relative bg-white border border-[#E5E7EB] rounded-2xl
                transition-all duration-300 overflow-hidden flex flex-col h-full
                shadow-[0_1px_3px_rgba(0,0,0,0.06)]
                hover:border-[#F97316] hover:shadow-[0_4px_12px_rgba(249,115,22,0.12)]
                ${onQuickSync ? 'cursor-pointer' : ''}
                ${showPulse ? 'ring-2 ring-[#F97316]/30' : ''}
                ${saveState === 'saving' ? 'ring-2 ring-[#F97316]/30' : ''}
                ${saveState === 'success' ? 'ring-2 ring-[#10B981]/30' : ''}
                ${saveState === 'error' ? 'ring-2 ring-[#EF4444]/30' : ''}
            `}
        >
            <div className="p-5 flex-1 flex flex-col">
                {/* Header: Avatar + Name + Status Badge */}
                <div className="flex items-start gap-4 mb-4">
                    {/* Avatar */}
                    <div className={`w-12 h-12 rounded-full ${avatarColor} flex items-center justify-center text-white font-semibold text-sm flex-shrink-0 shadow-sm`}>
                        {getInitials(user.name)}
                    </div>

                    {/* Name + Status */}
                    <div className="flex-1 min-w-0">
                        <h3 className="text-base font-semibold text-[#1F2937] truncate leading-tight">
                            {user.name}
                        </h3>

                        {/* Status Badge - 4px spacing from name */}
                        <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full mt-1 ${getStatusBadgeColor()}`}>
                            <div className={`w-1.5 h-1.5 rounded-full ${getStatusDot()}`} />
                            <span className={`text-xs font-medium ${getStatusTextColor()}`}>
                                {getStatusText()}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Main Task / Status Message - 16px spacing */}
                <div className="mb-4 min-h-[2rem]">
                    {getMainTask() ? (
                        <p className="text-sm leading-relaxed text-[#374151] line-clamp-2">
                            {getMainTask()}
                        </p>
                    ) : (
                        <p className="text-xs text-[#9CA3AF] italic">
                            No status update provided
                        </p>
                    )}
                </div>

                {/* Busy Blocks - Event rows with better spacing */}
                <div className="space-y-2 mb-auto">
                    {status?.busy_blocks && status.busy_blocks.length > 0 ? (
                        status.busy_blocks.slice(0, 2).map((block: BusyBlock, index: number) => (
                            <div
                                key={index}
                                className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-[#FFF7ED] border border-[#FED7AA] min-h-[44px] transition-all duration-200"
                            >
                                <svg className="w-4 h-4 text-[#F97316] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-[#92400E] truncate">
                                        {block.label}
                                    </p>
                                    <p className="text-[11px] text-[#B45309]">
                                        {formatTime(block.start)}
                                    </p>
                                </div>
                            </div>
                        ))
                    ) : null}
                </div>

                {/* Footer: Free Time + Last Updated */}
                <div className="mt-4 pt-3 border-t border-[#F1F5F9] flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <svg className="w-3.5 h-3.5 text-[#9CA3AF]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="text-xs text-[#6B7280]">
                            {getFreeTimeMessage() || 'Busy for now'}
                        </span>
                    </div>
                    <span className="text-[11px] text-[#9CA3AF]">
                        {status?.last_updated ? formatLastUpdated(status.last_updated) : ''}
                    </span>
                </div>
            </div>
        </div>
    );
}
