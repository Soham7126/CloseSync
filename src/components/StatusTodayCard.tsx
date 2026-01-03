'use client';

import { useState, useEffect } from 'react';

interface BusyBlock {
    start: string;
    end: string;
    label?: string;
}

interface StatusTodayCardProps {
    statusColor: 'green' | 'yellow' | 'red';
    busyBlocks?: BusyBlock[];
    freeAfter?: string | null;
    timezone?: string;
}

export default function StatusTodayCard({
    statusColor = 'green',
    busyBlocks = [],
    freeAfter,
    timezone = 'IST',
}: StatusTodayCardProps) {
    const [currentTime, setCurrentTime] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentTime(new Date());
        }, 60000); // Update every minute

        return () => clearInterval(timer);
    }, []);
    const getStatusText = () => {
        switch (statusColor) {
            case 'green':
                return 'Available now';
            case 'yellow':
                return 'Busy now';
            case 'red':
                return 'Busy all day';
            default:
                return 'Available now';
        }
    };

    const getStatusDotColor = () => {
        switch (statusColor) {
            case 'green':
                return 'bg-green-500';
            case 'yellow':
                return 'bg-amber-500';
            case 'red':
                return 'bg-red-500';
            default:
                return 'bg-green-500';
        }
    };

    const getStatusBgColor = () => {
        switch (statusColor) {
            case 'green':
                return 'bg-green-50';
            case 'yellow':
                return 'bg-amber-50';
            case 'red':
                return 'bg-red-50';
            default:
                return 'bg-green-50';
        }
    };

    const formatTimeRange = (start: string, end: string) => {
        const formatTime = (time: string) => {
            const [hours, minutes] = time.split(':');
            const h = parseInt(hours);
            const ampm = h >= 12 ? 'PM' : 'AM';
            const h12 = h % 12 || 12;
            return `${h12}:${minutes} ${ampm}`;
        };
        return `${formatTime(start)}–${formatTime(end)}`;
    };

    const formatFreeAfter = (time: string | null) => {
        if (!time) return null;
        const [hours, minutes] = time.split(':');
        const h = parseInt(hours);
        const ampm = h >= 12 ? 'PM' : 'AM';
        const h12 = h % 12 || 12;
        return `${h12}:${minutes} ${ampm}`;
    };

    // Calculate current time position as percentage of 24 hours
    const getCurrentTimePosition = () => {
        const hours = currentTime.getHours();
        const minutes = currentTime.getMinutes();
        return ((hours * 60 + minutes) / (24 * 60)) * 100;
    };

    // Convert time string (HH:MM) to percentage position
    const timeToPosition = (time: string) => {
        const [hours, minutes] = time.split(':').map(Number);
        return ((hours * 60 + minutes) / (24 * 60)) * 100;
    };

    // Format current time for display
    const formatCurrentTime = () => {
        const hours = currentTime.getHours();
        const minutes = currentTime.getMinutes();
        const ampm = hours >= 12 ? 'PM' : 'AM';
        const h12 = hours % 12 || 12;
        return `${h12}:${minutes.toString().padStart(2, '0')} ${ampm}`;
    };

    return (
        <div>
            {/* Status Indicator */}
            <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full ${getStatusBgColor()} mb-6`}>
                <div className={`w-2.5 h-2.5 rounded-full ${getStatusDotColor()}`} />
                <span className="text-gray-800 font-medium text-sm">{getStatusText()}</span>
            </div>

            {/* 24-Hour Timeline Calendar */}
            <div className="mb-6">
                {/* Current time label */}
                <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-medium text-blue-600">{formatCurrentTime()}</span>
                </div>

                {/* Timeline bar */}
                <div className="relative">
                    {/* Time labels */}
                    <div className="flex justify-between text-[10px] text-gray-400 mb-1">
                        <span>12 AM</span>
                        <span>6 AM</span>
                        <span>12 PM</span>
                        <span>6 PM</span>
                        <span>12 AM</span>
                    </div>

                    {/* Timeline track */}
                    <div className="relative h-8 bg-gray-100 rounded-lg overflow-hidden">
                        {/* Busy blocks on timeline */}
                        {busyBlocks.map((block, index) => {
                            const startPos = timeToPosition(block.start);
                            const endPos = timeToPosition(block.end);
                            const width = endPos - startPos;
                            return (
                                <div
                                    key={index}
                                    className="absolute top-0 h-full bg-blue-400 opacity-80"
                                    style={{
                                        left: `${startPos}%`,
                                        width: `${width}%`,
                                    }}
                                    title={`Busy: ${formatTimeRange(block.start, block.end)}`}
                                />
                            );
                        })}

                        {/* Current time indicator line */}
                        <div
                            className="absolute top-0 h-full w-0.5 bg-blue-600 z-10"
                            style={{ left: `${getCurrentTimePosition()}%` }}
                        >
                            {/* Indicator dot at top */}
                            <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-blue-600 rounded-full" />
                        </div>
                    </div>

                    {/* Hour markers */}
                    <div className="absolute top-6 left-0 right-0 h-8 flex">
                        {[...Array(24)].map((_, i) => (
                            <div
                                key={i}
                                className="flex-1 border-l border-gray-200 first:border-l-0"
                                style={{ opacity: i % 6 === 0 ? 1 : 0.3 }}
                            />
                        ))}
                    </div>
                </div>
            </div>

            {/* Busy Blocks */}
            {busyBlocks.length > 0 && (
                <div className="space-y-3 mb-4">
                    {busyBlocks.map((block, index) => (
                        <div key={index} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                            <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                                <svg className="w-4 h-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                                    />
                                </svg>
                            </div>
                            <div>
                                <p className="text-sm font-medium text-gray-900">Busy</p>
                                <p className="text-sm text-gray-500">{formatTimeRange(block.start, block.end)}</p>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Free After */}
            {freeAfter && (
                <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg mb-4">
                    <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                        <svg className="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M5 13l4 4L19 7"
                            />
                        </svg>
                    </div>
                    <div>
                        <p className="text-sm font-medium text-gray-900">Free after</p>
                        <p className="text-sm text-gray-500">{formatFreeAfter(freeAfter)}</p>
                    </div>
                </div>
            )}

            {/* Timezone */}
            <div className="flex items-center gap-2 text-xs text-gray-400">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064" />
                </svg>
                <span>Timezone: {timezone}</span>
            </div>
        </div>
    );
}
