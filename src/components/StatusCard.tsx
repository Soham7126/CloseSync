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

// Fixed colors to match the design closer
const avatarColors = [
    'bg-purple-600',
    'bg-blue-600',
    'bg-orange-500',
    'bg-emerald-500',
    'bg-pink-600',
    'bg-cyan-600',
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
        if (!status?.status_color) return 'bg-slate-500';
        switch (status.status_color) {
            case 'green': return 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]';
            case 'yellow': return 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.4)]';
            case 'red': return 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.4)]';
            default: return 'bg-slate-500';
        }
    };

    const getStatusText = () => {
        if (!status) return 'No status';
        if (status.blockers && status.blockers.length > 0) return 'Blocked';
        // Match the text from the image
        if (status.status_color === 'red') return 'Busy all day';
        if (status.status_color === 'yellow') return 'Busy now';
        if (status.status_color === 'green') return 'Available now';
        return 'Available';
    };

    const getInitials = (name: string) => {
        return name
            .split(' ')
            .slice(0, 2)
            .map(n => n[0])
            .join('')
            .toUpperCase();
    };

    const formatTime = (time: string, isRange = false) => {
        if (!time) return '';

        // Parse "14:00:00" or "14:00"
        const [hours, minutes] = time.split(':');
        let hour = parseInt(hours);
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const displayHour = hour % 12 || 12;

        // If minutes is "00", maybe just show hour? The design shows "2:00 PM"
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
        if (!status) return 'Free all day'; // Default if unknown? Or hide?
        // If explicitly set
        if (status.free_after) {
            if (status.free_after.startsWith('tomorrow')) return `Free ${status.free_after}`;
            return `Free after ${formatTime(status.free_after)}`;
        }
        // If busy blocks exist but no free_after set, usually implies busy for now?
        // But let's verify logic. If busy blocks exist, we might calculate gap.
        // For now, simple fallback.
        if (!status.busy_blocks || status.busy_blocks.length === 0) {
            return 'Free all day';
        }
        return null;
    };

    const avatarColor = getAvatarColor(user.name);

    return (
        <div
            className={`
        relative rounded-xl border border-[#232436] bg-[#1E1F2E] 
        transition-all duration-200 overflow-hidden flex flex-col h-full
        hover:border-[#33344a]
        ${showPulse ? 'ring-1 ring-purple-500/50' : ''}
        ${saveState === 'saving' ? 'opacity-90 ring-1 ring-purple-500/50' : ''}
        ${saveState === 'success' ? 'ring-1 ring-emerald-500/50' : ''}
        ${saveState === 'error' ? 'ring-1 ring-rose-500/50' : ''}
      `}
        >
            {/* Save State Badge */}
            {saveState !== 'idle' && (
                <div className={`
          absolute top-3 right-3 flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-medium z-10 uppercase tracking-wide
          ${saveState === 'saving' ? 'bg-purple-500/10 text-purple-400' : ''}
          ${saveState === 'success' ? 'bg-emerald-500/10 text-emerald-400' : ''}
          ${saveState === 'error' ? 'bg-rose-500/10 text-rose-400' : ''}
        `}>
                    {saveState === 'saving' && 'Saving...'}
                    {saveState === 'success' && 'Saved'}
                    {saveState === 'error' && 'Failed'}
                </div>
            )}

            <div className="p-5 flex-1 flex flex-col">
                {/* Header: Avatar + Name/Status */}
                <div className="flex items-start gap-3 mb-4">
                    <div className={`w-10 h-10 rounded-full ${avatarColor} flex items-center justify-center text-white font-semibold text-sm flex-shrink-0`}>
                        {getInitials(user.name)}
                    </div>

                    <div className="flex-1 min-w-0 pt-0.5">
                        <div className="flex items-center gap-2 mb-0.5">
                            <div className={`w-1.5 h-1.5 rounded-full ${getStatusDot()}`} />
                            <h3 className="text-[15px] font-medium text-white truncate leading-none">{user.name}</h3>
                        </div>
                        <p className="text-xs text-slate-400 ml-3.5">{getStatusText()}</p>
                    </div>
                </div>

                {/* Task Description */}
                <div className="mb-4 min-h-[1.5rem]">
                    {getMainTask() ? (
                        <p className="text-[13px] leading-relaxed text-slate-200 line-clamp-2">
                            {getMainTask()}
                        </p>
                    ) : (
                        <p className="text-[13px] leading-relaxed text-slate-600 italic">
                            No status update provided
                        </p>
                    )}
                </div>

                {/* Schedule Blocks */}
                <div className="space-y-2 mb-auto">
                    {status?.busy_blocks && status.busy_blocks.length > 0 ? (
                        status.busy_blocks.slice(0, 3).map((block: BusyBlock, index: number) => (
                            <div
                                key={index}
                                className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-[#151621] text-[13px] group"
                            >
                                <div className="flex items-center gap-2 text-purple-400 flex-shrink-0">
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                    </svg>
                                    <span className="font-medium whitespace-nowrap">{formatTime(block.start)}</span>
                                </div>
                                <span className="text-slate-300 truncate">{block.label}</span>
                            </div>
                        ))
                    ) : (
                        // Placeholder/Empty block if free all day? Or just nothing?
                        // The image shows cards with no blocks having "Free all day" at bottom.
                        // But if we want to align cards, we might leave empty space.
                        // For now, let's render nothing here and let flex-col handle it.
                        null
                    )}
                </div>

                {/* Footer */}
                <div className="mt-5 pt-4 border-t border-[#2B2C40] flex items-center justify-between text-xs text-slate-500">
                    <div className="flex items-center gap-1.5">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>{getFreeTimeMessage() || 'Busy for now'}</span>
                    </div>
                    <span>
                        {status?.last_updated ? formatLastUpdated(status.last_updated) : ''}
                    </span>
                </div>
            </div>
        </div>
    );
}
