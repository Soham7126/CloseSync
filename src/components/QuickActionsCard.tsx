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
                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left hover:bg-gray-50 transition-colors group border border-gray-100"
            >
                <span className="text-[#6366F1] group-hover:translate-x-1 transition-transform">→</span>
                <span className="text-[#1F2937] font-medium">Find Time With Team</span>
            </button>

            {/* Schedule Group Meeting - Changed outer element to div to avoid nested buttons */}
            <div
                className="w-full flex items-start gap-3 px-4 py-3 rounded-lg text-left hover:bg-gray-50 transition-colors border border-gray-100 cursor-pointer"
                onClick={onScheduleGroupMeeting}
            >
                <svg className="w-5 h-5 text-[#6B7280] mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                </svg>
                <div className="flex-1">
                    <p className="text-[#1F2937] font-medium">Schedule Group Meeting</p>
                    <p className="text-sm text-[#6B7280]">Today · 3:00–3:30 PM</p>
                </div>
                <button
                    className="px-3 py-1.5 rounded-xl bg-[#6366F1] text-white text-sm font-medium hover:bg-[#5558E3] transition-colors"
                    onClick={(e) => {
                        e.stopPropagation();
                        onScheduleGroupMeeting?.();
                    }}
                >
                    Join
                </button>
            </div>
        </div>
    );
}
