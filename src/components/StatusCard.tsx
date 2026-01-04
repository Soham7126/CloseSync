'use client';

import { useState, useEffect } from 'react';
import type { User, UserStatus, BusyBlock } from '@/lib/supabase';
import type { SaveState } from '@/hooks/useSaveStatus';
import { Clock, Calendar, Zap } from 'lucide-react';

interface StatusCardProps {
    user: User;
    status: UserStatus | null;
    onQuickSync?: (userId: string) => void;
    isUpdating?: boolean;
    saveState?: SaveState;
}

const avatarGradients = [
    'from-orange-400 to-rose-400',
    'from-blue-400 to-indigo-500',
    'from-violet-400 to-purple-500',
    'from-pink-400 to-rose-500',
    'from-emerald-400 to-teal-500',
    'from-cyan-400 to-blue-500',
    'from-amber-400 to-orange-500',
    'from-fuchsia-400 to-pink-500',
];

function getAvatarGradient(name: string): string {
    const hash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return avatarGradients[hash % avatarGradients.length];
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

    const getStatusConfig = () => {
        if (!status?.status_color) {
            return {
                dot: 'bg-slate-300',
                badge: 'bg-slate-100 text-slate-600',
                text: 'No status',
                border: 'border-slate-200',
            };
        }
        switch (status.status_color) {
            case 'green':
                return {
                    dot: 'bg-emerald-500',
                    badge: 'bg-emerald-50 text-emerald-700',
                    text: 'Available now',
                    border: 'border-emerald-200',
                };
            case 'yellow':
                return {
                    dot: 'bg-orange-500',
                    badge: 'bg-orange-50 text-orange-700',
                    text: status.blockers?.length ? 'Blocked' : 'Busy now',
                    border: 'border-orange-200',
                };
            case 'red':
                return {
                    dot: 'bg-red-500',
                    badge: 'bg-red-50 text-red-700',
                    text: 'Away',
                    border: 'border-red-200',
                };
            default:
                return {
                    dot: 'bg-slate-300',
                    badge: 'bg-slate-100 text-slate-600',
                    text: 'Unknown',
                    border: 'border-slate-200',
                };
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
        const hour = parseInt(hours);
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
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
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

    const statusConfig = getStatusConfig();
    const avatarGradient = getAvatarGradient(user.name);
    const mainTask = getMainTask();
    const freeTimeMessage = getFreeTimeMessage();

    const handleCardClick = () => {
        if (onQuickSync) {
            onQuickSync(user.id);
        }
    };

    return (
        <div
            onClick={handleCardClick}
            className={`
                group relative bg-white rounded-2xl border transition-all duration-300
                ${statusConfig.border}
                ${onQuickSync ? 'cursor-pointer' : ''}
                ${showPulse ? 'ring-2 ring-orange-400/40 ring-offset-2' : ''}
                ${saveState === 'saving' ? 'ring-2 ring-orange-400/40' : ''}
                ${saveState === 'success' ? 'ring-2 ring-emerald-400/40' : ''}
                ${saveState === 'error' ? 'ring-2 ring-red-400/40' : ''}
                hover:shadow-xl hover:shadow-slate-200/50 hover:border-orange-300 hover:-translate-y-1
            `}
        >
            {/* Card Content */}
            <div className="p-7">
                {/* Header: Avatar + Info */}
                <div className="flex items-start gap-5 mb-6">
                    {/* Avatar with gradient */}
                    <div className={`
                        relative w-16 h-16 rounded-2xl bg-gradient-to-br ${avatarGradient}
                        flex items-center justify-center text-white font-bold text-lg
                        shadow-lg shadow-slate-200/50 flex-shrink-0
                    `}>
                        {getInitials(user.name)}
                        {/* Status indicator dot */}
                        <div className={`
                            absolute -bottom-1 -right-1 w-5 h-5 rounded-full ${statusConfig.dot}
                            border-[3px] border-white shadow-sm
                        `} />
                    </div>

                    {/* Name + Status Badge */}
                    <div className="flex-1 min-w-0 pt-1">
                        <h3 className="text-lg font-semibold text-slate-900 truncate mb-2">
                            {user.name}
                        </h3>
                        <div className={`
                            inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold
                            ${statusConfig.badge}
                        `}>
                            <div className={`w-2 h-2 rounded-full ${statusConfig.dot}`} />
                            {statusConfig.text}
                        </div>
                    </div>

                    {/* Quick Sync Button (visible on hover) */}
                    {onQuickSync && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onQuickSync(user.id);
                            }}
                            className="opacity-0 group-hover:opacity-100 flex items-center gap-1.5 px-3 py-1.5 bg-orange-500 text-white text-xs font-semibold rounded-lg shadow-sm hover:bg-orange-600 transition-all"
                        >
                            <Zap className="w-3.5 h-3.5" />
                            Sync
                        </button>
                    )}
                </div>

                {/* Task / Status Message */}
                <div className="mb-6 min-h-[3rem]">
                    {mainTask ? (
                        <p className="text-sm leading-relaxed text-slate-600 line-clamp-2">
                            {mainTask}
                        </p>
                    ) : (
                        <p className="text-sm text-slate-400 italic">
                            No current task set
                        </p>
                    )}
                </div>

                {/* Busy Blocks */}
                {status?.busy_blocks && status.busy_blocks.length > 0 && (
                    <div className="space-y-3 mb-6">
                        {status.busy_blocks.slice(0, 2).map((block: BusyBlock, index: number) => (
                            <div
                                key={index}
                                className="flex items-center gap-4 px-4 py-3.5 rounded-xl bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-100"
                            >
                                <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-white border border-orange-100 shadow-sm">
                                    <Calendar className="w-5 h-5 text-orange-500" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-slate-800 truncate">
                                        {block.label}
                                    </p>
                                    <p className="text-xs text-orange-600 mt-0.5">
                                        {formatTime(block.start)}
                                        {block.end && ` - ${formatTime(block.end)}`}
                                    </p>
                                </div>
                            </div>
                        ))}
                        {status.busy_blocks.length > 2 && (
                            <p className="text-xs text-slate-400 text-center">
                                +{status.busy_blocks.length - 2} more events
                            </p>
                        )}
                    </div>
                )}

                {/* Footer */}
                <div className="pt-5 border-t border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-2.5 text-slate-500">
                        <Clock className="w-4 h-4" />
                        <span className="text-sm font-medium">
                            {freeTimeMessage || 'Busy'}
                        </span>
                    </div>
                    {status?.last_updated && (
                        <span className="text-xs text-slate-400">
                            Updated {formatLastUpdated(status.last_updated)}
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
}
