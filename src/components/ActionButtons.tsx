'use client';

import { useRouter } from 'next/navigation';

interface ActionButtonsProps {
    onScheduleGroupMeeting?: () => void;
}

export default function ActionButtons({ onScheduleGroupMeeting }: ActionButtonsProps) {
    const router = useRouter();

    return (
        <div className="flex flex-wrap gap-3">
            <button
                onClick={() => router.push('/dashboard/availability')}
                className="px-4 py-2.5 rounded-lg border border-gray-300 text-[#1F2937] font-medium text-sm hover:bg-gray-50 transition-colors"
            >
                Find Time With Team
            </button>
            <button
                onClick={onScheduleGroupMeeting}
                className="px-4 py-2.5 rounded-lg border border-gray-300 text-[#1F2937] font-medium text-sm hover:bg-gray-50 transition-colors"
            >
                Schedule Group Meeting
            </button>
            <button
                onClick={() => router.push('/dashboard/schedule')}
                className="px-4 py-2.5 rounded-lg border border-gray-300 text-[#1F2937] font-medium text-sm hover:bg-gray-50 transition-colors flex items-center gap-1"
            >
                View Full Schedule
                <span>→</span>
            </button>
        </div>
    );
}
