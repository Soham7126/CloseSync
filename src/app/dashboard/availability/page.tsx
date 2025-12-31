'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/components/AuthProvider';
import StatusCard from '@/components/StatusCard';
import QuickSyncModal from '@/components/QuickSyncModal';
import { createSupabaseBrowserClient } from '@/lib/supabase';
import { subscribeToTeamStatuses, ConnectionStatus } from '@/lib/realtime';
import type { User, UserStatus } from '@/lib/supabase';

interface TeamMember {
    user: User;
    status: UserStatus | null;
}

interface QuickSyncTarget {
    user: User;
    status: UserStatus | null;
}

export default function AvailabilityPage() {
    const { user, team } = useAuth();
    const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connecting');
    const [updatingUserIds, setUpdatingUserIds] = useState<Set<string>>(new Set());
    const [quickSyncTarget, setQuickSyncTarget] = useState<QuickSyncTarget | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    const fetchTeamData = useCallback(async () => {
        if (!team?.id) {
            setIsLoading(false);
            return [];
        }

        const supabase = createSupabaseBrowserClient();

        try {
            const { data: users, error: usersError } = await supabase
                .from('users')
                .select('*')
                .eq('team_id', team.id);

            if (usersError || !users) {
                console.error('Failed to fetch team members:', usersError);
                return [];
            }

            const userIds = users.map((u: User) => u.id);
            const { data: statuses } = await supabase
                .from('user_status')
                .select('*')
                .in('user_id', userIds);

            const members: TeamMember[] = users.map((u: User) => ({
                user: u,
                status: (statuses as UserStatus[] | null)?.find((s: UserStatus) => s.user_id === u.id) || null,
            }));

            // Sort by status: green first, then yellow, then red
            const statusOrder: Record<string, number> = { green: 0, yellow: 1, red: 2 };
            members.sort((a, b) => {
                const aOrder = a.status?.status_color ? statusOrder[a.status.status_color] : 3;
                const bOrder = b.status?.status_color ? statusOrder[b.status.status_color] : 3;
                return aOrder - bOrder;
            });

            return members;
        } catch (error) {
            console.error('Failed to fetch team data:', error);
            return [];
        }
    }, [team?.id]);

    useEffect(() => {
        async function loadData() {
            setIsLoading(true);
            const members = await fetchTeamData();
            setTeamMembers(members);
            setIsLoading(false);
        }
        loadData();
    }, [fetchTeamData]);

    // Real-time subscription
    useEffect(() => {
        if (!team?.id || teamMembers.length === 0) return;

        const userIds = teamMembers.map(m => m.user.id);

        const { unsubscribe } = subscribeToTeamStatuses(userIds, {
            onStatusChange: (payload) => {
                const eventType = payload.eventType;
                const newStatus = payload.new as UserStatus;

                if (eventType === 'INSERT' || eventType === 'UPDATE') {
                    setUpdatingUserIds(prev => new Set(prev).add(newStatus.user_id));

                    setTeamMembers(prev => {
                        const updated = prev.map(member => {
                            if (member.user.id === newStatus.user_id) {
                                return { ...member, status: newStatus };
                            }
                            return member;
                        });

                        const statusOrder: Record<string, number> = { green: 0, yellow: 1, red: 2 };
                        updated.sort((a, b) => {
                            const aOrder = a.status?.status_color ? statusOrder[a.status.status_color] : 3;
                            const bOrder = b.status?.status_color ? statusOrder[b.status.status_color] : 3;
                            return aOrder - bOrder;
                        });

                        return updated;
                    });

                    setTimeout(() => {
                        setUpdatingUserIds(prev => {
                            const next = new Set(prev);
                            next.delete(newStatus.user_id);
                            return next;
                        });
                    }, 1500);
                }
            },
            onConnectionChange: (status) => {
                setConnectionStatus(status);
            },
        });

        return () => {
            unsubscribe();
        };
    }, [team?.id, teamMembers.length > 0]);

    const handleQuickSync = (userId: string) => {
        if (userId === user?.id) return;

        const targetMember = teamMembers.find(m => m.user.id === userId);
        if (targetMember) {
            setQuickSyncTarget({
                user: targetMember.user,
                status: targetMember.status,
            });
        }
    };

    const handleMeetingCreated = async () => {
        const members = await fetchTeamData();
        setTeamMembers(members);
    };

    const filteredMembers = teamMembers.filter(member =>
        member.user.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="max-w-6xl mx-auto">
            <h1 className="text-2xl font-bold text-[#1F2937] mb-2">Team Availability</h1>
            <p className="text-[#6B7280] mb-6">View your team&apos;s availability and schedule meetings</p>

            {/* Connection Status */}
            {connectionStatus !== 'connected' && (
                <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800 flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
                    {connectionStatus === 'connecting' ? 'Connecting to real-time updates...' : 'Connection lost. Reconnecting...'}
                </div>
            )}

            {/* Search */}
            <div className="mb-6">
                <div className="relative max-w-md">
                    <svg
                        className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                    >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <input
                        type="text"
                        placeholder="Search team members..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-white border border-gray-200 text-[#1F2937] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#6366F1]/20 focus:border-[#6366F1] transition-all"
                    />
                </div>
            </div>

            {/* Loading State */}
            {isLoading && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="h-64 rounded-xl border border-gray-200 bg-white p-5 animate-pulse">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="w-10 h-10 rounded-full bg-gray-200" />
                                <div className="flex-1">
                                    <div className="h-4 bg-gray-200 rounded w-24 mb-2" />
                                    <div className="h-3 bg-gray-200 rounded w-20" />
                                </div>
                            </div>
                            <div className="h-3 bg-gray-200 rounded w-3/4 mb-3" />
                            <div className="h-3 bg-gray-200 rounded w-1/2 mb-6" />
                            <div className="h-12 bg-gray-200 rounded-lg w-full" />
                        </div>
                    ))}
                </div>
            )}

            {/* No Team */}
            {!isLoading && !team && (
                <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
                    <div className="w-16 h-16 mx-auto rounded-full bg-gray-100 flex items-center justify-center mb-4">
                        <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                    </div>
                    <h3 className="text-lg font-semibold text-[#1F2937] mb-2">No team yet</h3>
                    <p className="text-[#6B7280]">Create or join a team to see availability.</p>
                </div>
            )}

            {/* Team Members Grid */}
            {!isLoading && filteredMembers.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredMembers.map((member) => (
                        <StatusCard
                            key={member.user.id}
                            user={member.user}
                            status={member.status}
                            onQuickSync={handleQuickSync}
                            isUpdating={updatingUserIds.has(member.user.id)}
                            saveState="idle"
                        />
                    ))}
                </div>
            )}

            {/* No Search Results */}
            {!isLoading && teamMembers.length > 0 && filteredMembers.length === 0 && (
                <div className="text-center py-12">
                    <p className="text-[#6B7280]">No one found matching &quot;{searchQuery}&quot;</p>
                </div>
            )}

            {/* Quick Sync Modal */}
            {quickSyncTarget && user && (
                <QuickSyncModal
                    isOpen={!!quickSyncTarget}
                    onClose={() => setQuickSyncTarget(null)}
                    currentUserId={user.id}
                    targetUser={quickSyncTarget.user}
                    targetUserStatus={quickSyncTarget.status}
                    onMeetingCreated={handleMeetingCreated}
                />
            )}
        </div>
    );
}
