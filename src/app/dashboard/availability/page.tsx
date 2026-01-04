'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/components/AuthProvider';
import StatusCard from '@/components/StatusCard';
import QuickSyncModal from '@/components/QuickSyncModal';
import { createSupabaseBrowserClient } from '@/lib/supabase';
import { subscribeToTeamStatuses, ConnectionStatus } from '@/lib/realtime';
import type { User, UserStatus } from '@/lib/supabase';
import { Search, LayoutGrid, List, Users, ChevronDown, Wifi, WifiOff } from 'lucide-react';

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

    const availableCount = teamMembers.filter(m => m.status?.status_color === 'green').length;
    const busyCount = teamMembers.filter(m => m.status?.status_color === 'yellow').length;
    const awayCount = teamMembers.filter(m => m.status?.status_color === 'red').length;

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-orange-50/30">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 py-8 lg:py-12">

                {/* Page Header */}
                <header className="mb-10">
                    <div className="flex items-start justify-between gap-6 mb-8">
                        <div>
                            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">
                                Team Availability
                            </h1>
                            <p className="mt-3 text-base text-slate-500 max-w-xl">
                                See who's available and quickly sync with your team members in real-time.
                            </p>
                        </div>

                        {/* Connection Status */}
                        <div className={`
                            flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium
                            ${connectionStatus === 'connected'
                                ? 'bg-emerald-50 text-emerald-700'
                                : connectionStatus === 'connecting'
                                ? 'bg-amber-50 text-amber-700'
                                : 'bg-red-50 text-red-700'
                            }
                        `}>
                            {connectionStatus === 'connected' ? (
                                <Wifi className="w-4 h-4" />
                            ) : (
                                <WifiOff className="w-4 h-4" />
                            )}
                            <span className="hidden sm:inline">
                                {connectionStatus === 'connected' ? 'Live' : connectionStatus === 'connecting' ? 'Connecting...' : 'Offline'}
                            </span>
                        </div>
                    </div>

                    {/* Stats Summary */}
                    {!isLoading && team && teamMembers.length > 0 && (
                        <div className="flex flex-wrap items-center gap-3 mb-8">
                            <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-full border border-slate-200 shadow-sm">
                                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                                <span className="text-sm font-medium text-slate-700">{availableCount} Available</span>
                            </div>
                            <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-full border border-slate-200 shadow-sm">
                                <div className="w-2.5 h-2.5 rounded-full bg-orange-500" />
                                <span className="text-sm font-medium text-slate-700">{busyCount} Busy</span>
                            </div>
                            <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-full border border-slate-200 shadow-sm">
                                <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
                                <span className="text-sm font-medium text-slate-700">{awayCount} Away</span>
                            </div>
                        </div>
                    )}

                    {/* Search and Filters Bar */}
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
                        {/* Search Input */}
                        <div className="relative flex-1 max-w-md">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Search team members..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full h-12 pl-12 pr-4 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-400 transition-all"
                            />
                        </div>

                        {/* Filter and View Controls */}
                        <div className="flex items-center gap-3">
                            {/* Status Filter */}
                            <div className="relative">
                                <select
                                    value={statusFilter}
                                    onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
                                    className="h-12 pl-4 pr-10 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 shadow-sm appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-400 transition-all"
                                >
                                    <option value="all">All Statuses</option>
                                    <option value="green">Available</option>
                                    <option value="yellow">Busy</option>
                                    <option value="red">Away</option>
                                </select>
                                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
                            </div>

                            {/* View Mode Toggle */}
                            <div className="flex items-center h-12 p-1.5 bg-white border border-slate-200 rounded-xl shadow-sm">
                                <button
                                    onClick={() => setViewMode('grid')}
                                    className={`flex items-center justify-center w-9 h-9 rounded-lg transition-all ${
                                        viewMode === 'grid'
                                            ? 'bg-orange-500 text-white shadow-sm'
                                            : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                                    }`}
                                    aria-label="Grid view"
                                >
                                    <LayoutGrid className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={() => setViewMode('list')}
                                    className={`flex items-center justify-center w-9 h-9 rounded-lg transition-all ${
                                        viewMode === 'list'
                                            ? 'bg-orange-500 text-white shadow-sm'
                                            : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                                    }`}
                                    aria-label="List view"
                                >
                                    <List className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    </div>
                </header>

                {/* Content Area */}
                <main>
                    {isLoading ? (
                        /* Loading Skeleton */
                        <div
                            className="grid gap-8"
                            style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))' }}
                        >
                            {[1, 2, 3, 4, 5, 6].map((i) => (
                                <div
                                    key={i}
                                    className="bg-white rounded-2xl border border-slate-200 p-8 animate-pulse"
                                >
                                    <div className="flex items-start gap-5">
                                        <div className="w-16 h-16 rounded-full bg-slate-100" />
                                        <div className="flex-1 space-y-3 pt-1">
                                            <div className="h-5 bg-slate-100 rounded-lg w-32" />
                                            <div className="h-7 bg-slate-100 rounded-full w-24" />
                                        </div>
                                    </div>
                                    <div className="mt-6 space-y-3">
                                        <div className="h-4 bg-slate-50 rounded w-full" />
                                        <div className="h-4 bg-slate-50 rounded w-2/3" />
                                    </div>
                                    <div className="mt-6 h-14 bg-slate-50 rounded-xl" />
                                    <div className="mt-6 pt-5 border-t border-slate-100 flex justify-between">
                                        <div className="h-4 bg-slate-100 rounded w-28" />
                                        <div className="h-4 bg-slate-100 rounded w-16" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : !team ? (
                        /* No Team State */
                        <div className="flex flex-col items-center justify-center py-24 px-8 bg-white rounded-3xl border-2 border-dashed border-slate-200">
                            <div className="w-20 h-20 bg-gradient-to-br from-orange-100 to-orange-50 rounded-2xl flex items-center justify-center mb-6 shadow-sm">
                                <Users className="w-10 h-10 text-orange-500" />
                            </div>
                            <h3 className="text-xl font-semibold text-slate-900 mb-2">No team found</h3>
                            <p className="text-base text-slate-500 text-center max-w-sm">
                                Join or create a team to see member availability and start syncing.
                            </p>
                        </div>
                    ) : filteredMembers.length === 0 ? (
                        /* Empty Search Results */
                        <div className="flex flex-col items-center justify-center py-24 px-8 bg-white rounded-3xl border border-slate-200">
                            <div className="w-20 h-20 bg-slate-100 rounded-2xl flex items-center justify-center mb-6">
                                <Search className="w-10 h-10 text-slate-300" />
                            </div>
                            <h3 className="text-xl font-semibold text-slate-900 mb-2">No members found</h3>
                            <p className="text-base text-slate-500 text-center max-w-sm">
                                Try adjusting your search query or filters to find team members.
                            </p>
                            {(searchQuery || statusFilter !== 'all') && (
                                <button
                                    onClick={() => {
                                        setSearchQuery('');
                                        setStatusFilter('all');
                                    }}
                                    className="mt-6 px-6 py-2.5 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 transition-colors"
                                >
                                    Clear filters
                                </button>
                            )}
                        </div>
                    ) : (
                        /* Team Members Grid/List */
                        <div
                            className={`grid ${
                                viewMode === 'list'
                                    ? 'grid-cols-1 max-w-3xl gap-6'
                                    : 'gap-8'
                            }`}
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
                </main>
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
