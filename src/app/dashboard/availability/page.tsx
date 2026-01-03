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
        <div className="space-y-12">
            {/* Header Section */}
            <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
                <div>
                    <h1 className="text-3xl font-semibold text-gray-900">Team Availability</h1>
                    <p className="text-sm text-gray-500 mt-2">Real-time status and schedule of your team members.</p>
                </div>
                
                {connectionStatus !== 'connected' && (
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 border border-amber-100 rounded-full text-xs font-medium text-amber-700">
                        <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                        {connectionStatus === 'connecting' ? 'Connecting...' : 'Reconnecting...'}
                    </div>
                )}
            </div>

            {/* Toolbar */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search team members..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all"
                    />
                </div>

                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg p-1">
                        <button
                            onClick={() => setViewMode('grid')}
                            className={`p-1.5 rounded-md transition-all ${viewMode === 'grid' ? 'bg-white shadow-sm text-orange-600' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            <LayoutGrid className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => setViewMode('list')}
                            className={`p-1.5 rounded-md transition-all ${viewMode === 'list' ? 'bg-white shadow-sm text-orange-600' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            <List className="w-4 h-4" />
                        </button>
                    </div>

                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value as any)}
                        className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                    >
                        <option value="all">All Statuses</option>
                        <option value="green">Available</option>
                        <option value="yellow">Busy</option>
                        <option value="red">Away</option>
                    </select>
                </div>
            </div>

            {/* Content Area */}
            {isLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-7">
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                        <div key={i} className="bg-white border border-gray-200 rounded-2xl p-6 space-y-4 animate-pulse">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-full bg-gray-100" />
                                <div className="space-y-2">
                                    <div className="h-4 bg-gray-100 rounded w-24" />
                                    <div className="h-3 bg-gray-100 rounded w-16" />
                                </div>
                            </div>
                            <div className="h-20 bg-gray-50 rounded-xl" />
                            <div className="h-4 bg-gray-100 rounded w-full" />
                        </div>
                    ))}
                </div>
            ) : !team ? (
                <div className="flex flex-col items-center justify-center py-28 bg-white rounded-2xl border border-dashed border-gray-300">
                    <div className="w-16 h-16 bg-orange-50 rounded-full flex items-center justify-center mb-6">
                        <Users className="w-8 h-8 text-orange-500" />
                    </div>
                    <h3 className="text-lg font-medium text-gray-900">No team found</h3>
                    <p className="text-gray-500 mt-2">Join or create a team to see member availability.</p>
                </div>
            ) : filteredMembers.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-28 bg-white rounded-2xl border border-gray-200">
                    <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-6">
                        <Search className="w-8 h-8 text-gray-300" />
                    </div>
                    <h3 className="text-lg font-medium text-gray-900">No members found</h3>
                    <p className="text-gray-500 mt-2">Try adjusting your search or filters.</p>
                </div>
            ) : (
                <div className={`grid gap-7 ${viewMode === 'grid' ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3' : 'grid-cols-1'}`}>
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
