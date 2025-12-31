'use client';

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

    return (
        <div>
            {/* Status Indicator */}
            <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full ${getStatusBgColor()} mb-8`}>
                <div className={`w-2.5 h-2.5 rounded-full ${getStatusDotColor()}`} />
                <span className="text-gray-800 font-medium text-sm">{getStatusText()}</span>
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
