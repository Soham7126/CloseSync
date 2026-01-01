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
    }, [team?.id, teamMembers.length]);

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
        <div className="min-h-screen bg-white">
            {/* Main Content Container - Reserves space for 72px sidebar + 64px gutter */}
            <div className="pl-[136px] pr-12 pt-12">
                
                {/* Centered Content Area */}
                <div className="max-w-7xl">
                    
                    {/* Search Bar Row - Isolated from cards */}
                    <div className="mb-16">
                        <div className="relative w-full max-w-2xl">
                            <input
                                type="text"
                                placeholder="Search team members..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full h-12 pl-12 pr-6 rounded-full bg-white border-2 border-[#E5E7EB] text-[#1F2937] placeholder-[#6B7280] focus:outline-none focus:border-[#F97316] focus:ring-2 focus:ring-[#F97316]/10 transition-all duration-200"
                            />
                        </div>
                    </div>

                    {/* Connection Status Banner */}
                    {connectionStatus !== 'connected' && (
                        <div className="mb-16">
                            <div className="p-4 bg-[#FFF7ED] border border-[#FDBA74] rounded-lg text-sm text-[#92400E] flex items-center gap-3 max-w-2xl">
                                <div className="w-2 h-2 rounded-full bg-[#F97316] animate-pulse flex-shrink-0" />
                                <span>
                                    {connectionStatus === 'connecting' ? 'Connecting to real-time updates...' : 'Connection lost. Reconnecting...'}
                                </span>
                            </div>
                        </div>
                    )}

                    {/* Loading State */}
                    {isLoading && (
                        <div className="grid grid-cols-2 gap-6">
                            {[1, 2, 3, 4].map((i) => (
                                <div key={i} className="bg-white border border-[#E5E7EB] rounded-[18px] p-6 space-y-4 animate-pulse">
                                    <div className="flex items-start gap-4">
                                        <div className="w-14 h-14 rounded-full bg-[#E5E7EB] flex-shrink-0" />
                                        <div className="flex-1">
                                            <div className="h-5 bg-[#E5E7EB] rounded-lg w-32 mb-3" />
                                            <div className="h-4 bg-[#E5E7EB] rounded-lg w-24" />
                                        </div>
                                    </div>
                                    <div className="h-4 bg-[#E5E7EB] rounded-lg w-full" />
                                    <div className="h-4 bg-[#E5E7EB] rounded-lg w-3/4" />
                                    <div className="pt-4 border-t border-[#E5E7EB]">
                                        <div className="h-4 bg-[#E5E7EB] rounded-lg w-1/2" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* No Team State */}
                    {!isLoading && !team && (
                        <div className="bg-white rounded-[18px] border border-[#E5E7EB] p-16 text-center max-w-2xl">
                            <div className="w-20 h-20 mx-auto rounded-full bg-[#FFF7ED] flex items-center justify-center mb-8">
                                <svg className="w-10 h-10 text-[#F97316]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                </svg>
                            </div>
                            <h3 className="text-2xl font-bold text-[#1F2937] mb-3">No team yet</h3>
                            <p className="text-[#6B7280] text-base">Create or join a team to see availability.</p>
                        </div>
                    )}

                    {/* Team Members Grid - 2 Columns with 24px gap, 64px from search */}
                    {!isLoading && filteredMembers.length > 0 && (
                        <div className="grid grid-cols-2 gap-6">
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
                        <div className="text-center py-20">
                            <svg className="w-16 h-16 mx-auto mb-6 text-[#E5E7EB]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                            <p className="text-[#6B7280] text-lg">No one found matching &quot;{searchQuery}&quot;</p>
                        </div>
                    )}
                </div>
            </div>

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
