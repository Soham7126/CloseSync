'use client';

import { useRouter } from 'next/navigation';

interface QuickActionsCardProps {
    onScheduleGroupMeeting?: () => void;
}

export default function QuickActionsCard({ onScheduleGroupMeeting }: QuickActionsCardProps) {
    const router = useRouter();

    return (
        <div className="space-y-3">
            {/* Find Time With Team */}
            <button
                onClick={() => router.push('/dashboard/availability')}
                className="w-full flex items-center gap-3 p-3 rounded-xl text-left hover:bg-[#FFF8F0] transition-all group"
            >
                <div className="w-9 h-9 rounded-lg bg-[#FFF7ED] flex items-center justify-center flex-shrink-0">
                    <svg className="w-4 h-4 text-[#FF8C42]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-gray-900 font-medium text-sm">Find Time With Team</p>
                    <p className="text-xs text-gray-500">View everyone&apos;s availability</p>
                </div>
                <svg className="w-4 h-4 text-gray-400 group-hover:text-[#FF8C42] group-hover:translate-x-1 transition-all" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
            </button>

            {/* Schedule Group Meeting */}
            <button
                onClick={onScheduleGroupMeeting}
                className="w-full flex items-center gap-3 p-3 rounded-xl text-left hover:bg-[#FFF8F0] transition-all group"
            >
                <div className="w-9 h-9 rounded-lg bg-[#FFF7ED] flex items-center justify-center flex-shrink-0">
                    <svg className="w-4 h-4 text-[#FF8C42]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-gray-900 font-medium text-sm">Schedule Meeting</p>
                    <p className="text-xs text-gray-500">Book time with your team</p>
                </div>
                <svg className="w-4 h-4 text-gray-400 group-hover:text-[#FF8C42] group-hover:translate-x-1 transition-all" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
            </button>
        </div>
    );
}
