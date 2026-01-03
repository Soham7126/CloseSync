'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/components/AuthProvider';
import StatusCard from '@/components/StatusCard';
import QuickSyncModal from '@/components/QuickSyncModal';
import { createSupabaseBrowserClient } from '@/lib/supabase';
import { subscribeToTeamStatuses, ConnectionStatus } from '@/lib/realtime';
import type { User, UserStatus } from '@/lib/supabase';
import { Search, Filter, LayoutGrid, List, Users } from 'lucide-react';

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
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [statusFilter, setStatusFilter] = useState<'all' | 'green' | 'yellow' | 'red'>('all');

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

    const filteredMembers = teamMembers.filter(member => {
        const matchesSearch = member.user.name.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesStatus = statusFilter === 'all' || member.status?.status_color === statusFilter;
        return matchesSearch && matchesStatus;
    });

    return (
        <div className="font-[Inter,system-ui,-apple-system,BlinkMacSystemFont,sans-serif]">
            {/* Header Zone - Separated from content */}
            <div className="pb-8 mb-8 border-b border-[#F1F5F9]">
               

                {/* Search Bar - 16px below subtitle */}
                <div className="relative max-w-md">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF]" />
                    <input
                        type="text"
                        placeholder="Search team members..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 bg-white border border-[#E5E7EB] rounded-lg text-sm text-[#374151] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-400 transition-all"
                    />
                </div>
            </div>

            {/* Toolbar - 24px below header zone */}
            <div className="flex items-center justify-end gap-4 mb-6">
                <div className="flex items-center gap-1.5 bg-[#F9FAFB] border border-[#E5E7EB] rounded-lg p-1">
                    <button
                        onClick={() => setViewMode('grid')}
                        className={`p-2 rounded-md transition-all ${viewMode === 'grid' ? 'bg-white shadow-sm text-[#F97316]' : 'text-[#6B7280] hover:text-[#374151]'}`}
                    >
                        <LayoutGrid className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => setViewMode('list')}
                        className={`p-2 rounded-md transition-all ${viewMode === 'list' ? 'bg-white shadow-sm text-[#F97316]' : 'text-[#6B7280] hover:text-[#374151]'}`}
                    >
                        <List className="w-4 h-4" />
                    </button>
                </div>

                <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as any)}
                    className="bg-white border border-[#E5E7EB] rounded-lg px-4 py-2.5 text-sm text-[#374151] focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-400 cursor-pointer"
                >
                    <option value="all">All Statuses</option>
                    <option value="green">Available</option>
                    <option value="yellow">Busy</option>
                    <option value="red">Away</option>
                </select>
            </div>

            {/* Content Area - 24px below toolbar */}
            {isLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))' }}>
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                        <div key={i} className="bg-white border border-[#E5E7EB] rounded-2xl p-5 space-y-4 animate-pulse shadow-sm">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-full bg-[#F3F4F6]" />
                                <div className="space-y-2">
                                    <div className="h-4 bg-[#F3F4F6] rounded w-24" />
                                    <div className="h-3 bg-[#F3F4F6] rounded w-16" />
                                </div>
                            </div>
                            <div className="h-16 bg-[#F9FAFB] rounded-xl" />
                            <div className="h-4 bg-[#F3F4F6] rounded w-full" />
                        </div>
                    ))}
                </div>
            ) : !team ? (
                <div className="flex flex-col items-center justify-center py-24 bg-white rounded-2xl border border-dashed border-[#D1D5DB] shadow-sm">
                    <div className="w-14 h-14 bg-[#FFF7ED] rounded-full flex items-center justify-center mb-5">
                        <Users className="w-7 h-7 text-[#F97316]" />
                    </div>
                    <h3 className="text-base font-semibold text-[#1F2937]">No team found</h3>
                    <p className="text-[13px] text-[#9CA3AF] mt-1">Join or create a team to see member availability.</p>
                </div>
            ) : filteredMembers.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 bg-white rounded-2xl border border-[#E5E7EB] shadow-sm">
                    <div className="w-14 h-14 bg-[#F9FAFB] rounded-full flex items-center justify-center mb-5">
                        <Search className="w-7 h-7 text-[#D1D5DB]" />
                    </div>
                    <h3 className="text-base font-semibold text-[#1F2937]">No members found</h3>
                    <p className="text-[13px] text-[#9CA3AF] mt-1">Try adjusting your search or filters.</p>
                </div>
            ) : (
                <div
                    className={`grid gap-6 ${viewMode === 'list' ? 'grid-cols-1 max-w-2xl' : ''}`}
                    style={viewMode === 'grid' ? { gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))' } : undefined}
                >
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
