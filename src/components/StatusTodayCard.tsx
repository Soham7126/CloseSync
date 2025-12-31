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
                return 'bg-[#10B981]';
            case 'yellow':
                return 'bg-[#F59E0B]';
            case 'red':
                return 'bg-[#EF4444]';
            default:
                return 'bg-[#10B981]';
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
            <div className="flex items-center gap-2 mb-4">
                <div className={`w-3 h-3 rounded-full ${getStatusDotColor()}`} />
                <span className="text-[#1F2937] font-medium">{getStatusText()}</span>
            </div>

            {/* Busy Blocks */}
            {busyBlocks.length > 0 && (
                <div className="space-y-2 mb-3">
                    {busyBlocks.map((block, index) => (
                        <div key={index} className="flex items-center gap-2 text-[#6B7280]">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                                />
                            </svg>
                            <span className="text-sm">
                                <span className="font-medium text-[#1F2937]">Busy:</span>{' '}
                                {formatTimeRange(block.start, block.end)}
                            </span>
                        </div>
                    ))}
                </div>
            )}

            {/* Free After */}
            {freeAfter && (
                <div className="flex items-center gap-2 text-[#6B7280] mb-3">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                    </svg>
                    <span className="text-sm">
                        <span className="font-medium text-[#1F2937]">Free after:</span>{' '}
                        {formatFreeAfter(freeAfter)}
                    </span>
                </div>
            )}

            {/* Timezone */}
            <div className="text-sm text-[#6B7280]">
                Timezone: {timezone}
            </div>
        </div>
    );
}
