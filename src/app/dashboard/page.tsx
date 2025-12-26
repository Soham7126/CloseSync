'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import StatusCard from '@/components/StatusCard';
import VoiceInputFlow from '@/components/VoiceInputFlow';
import InviteModal from '@/components/InviteModal';

import useSaveStatus, { ToastContainer } from '@/hooks/useSaveStatus';
import { createSupabaseBrowserClient } from '@/lib/supabase';
import { subscribeToTeamStatuses, ConnectionStatus } from '@/lib/realtime';
import type { User, UserStatus } from '@/lib/supabase';

interface TeamMember {
    user: User;
    status: UserStatus | null;
}

export default function DashboardPage() {
    const router = useRouter();
    const { user, profile, team, signOut, isLoading: authLoading } = useAuth();
    const { save, saveState, optimisticStatus, toasts, dismissToast } = useSaveStatus();

    const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showVoiceModal, setShowVoiceModal] = useState(false);
    const [showInviteModal, setShowInviteModal] = useState(false);
    const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connecting');
    const [updatingUserIds, setUpdatingUserIds] = useState<Set<string>>(new Set());
    const [searchQuery, setSearchQuery] = useState('');
    const [showUserMenu, setShowUserMenu] = useState(false);
    const [isSigningOut, setIsSigningOut] = useState(false);
    const [showSettingsModal, setShowSettingsModal] = useState(false);

    // Redirect to landing page if not authenticated
    useEffect(() => {
        if (!authLoading && !user) {
            router.replace('/');
        }
    }, [authLoading, user, router]);

    const currentDate = new Date().toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric'
    });

    const filteredMembers = teamMembers.filter(member =>
        member.user.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

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
                const oldStatus = payload.old as UserStatus;

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
                } else if (eventType === 'DELETE') {
                    setTeamMembers(prev =>
                        prev.map(member => {
                            if (member.user.id === (oldStatus as UserStatus).user_id) {
                                return { ...member, status: null };
                            }
                            return member;
                        })
                    );
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

    const handleVoiceComplete = async (data: {
        tasks: string[];
        busy_blocks: { start: string; end: string; label: string }[];
        free_after: string | null;
        free_until: string | null;
        blockers: string[];
        raw_transcript: string;
        confidence: { overall: number };
    }) => {
        const success = await save({
            tasks: data.tasks,
            busy_blocks: data.busy_blocks,
            free_after: data.free_after,
            free_until: data.free_until,
            blockers: data.blockers,
            raw_transcript: data.raw_transcript,
            confidence_score: data.confidence.overall,
        });

        if (success) {
            setShowVoiceModal(false);
            const members = await fetchTeamData();
            setTeamMembers(members);
        }
    };

    const handleQuickSync = (userId: string) => {
        console.log('Quick sync with user:', userId);
    };

    const getInitials = (name: string) => {
        return name
            .split(' ')
            .map(n => n[0])
            .join('')
            .toUpperCase()
            .slice(0, 2);
    };

    // Show loading screen while checking auth (AFTER all hooks)
    if (authLoading) {
        return (
            <div className="min-h-screen bg-[#13141C] flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white font-bold text-xl animate-pulse">
                        S
                    </div>
                    <p className="text-slate-400 text-sm">Loading...</p>
                </div>
            </div>
        );
    }

    // Don't render dashboard if not authenticated (will redirect)
    if (!user) {
        return null;
    }

    return (
        <div className="min-h-screen bg-[#13141C]"> {/* Slightly darker background */}
            {/* Header */}
            <header className="border-b border-[#232436] bg-[#1a1b26]">
                <div className="max-w-7xl mx-auto px-6 py-4">
                    <div className="flex items-center justify-between gap-6">
                        {/* Logo */}
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-purple-500/20">
                                S
                            </div>
                            <span className="text-xl font-bold text-white tracking-tight">Sync</span>
                        </div>

                        {/* Search Bar - styled to match Image */}
                        <div className="flex-1 max-w-lg">
                            <div className="relative group">
                                <svg
                                    className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 group-focus-within:text-purple-400 transition-colors"
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
                                    className="w-full pl-11 pr-4 py-2.5 rounded-xl bg-[#232436] border border-transparent focus:border-[#3d3e54] text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-purple-500/50 transition-all font-medium"
                                />
                            </div>
                        </div>

                        {/* Right Actions */}
                        <div className="flex items-center gap-3">
                            {/* Update My Day Button */}
                            <button
                                onClick={() => setShowVoiceModal(true)}
                                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold transition-all shadow-lg shadow-purple-600/20 active:scale-[0.98]"
                            >
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                                </svg>
                                Update My Day
                            </button>

                            <div className="w-px h-8 bg-[#232436] mx-1" />

                            {/* Invite Button */}
                            {team && (
                                <button
                                    onClick={() => setShowInviteModal(true)}
                                    className="p-2.5 rounded-xl text-slate-400 hover:bg-[#232436] hover:text-white transition-colors"
                                    title="Invite Team"
                                >
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                                    </svg>
                                </button>
                            )}

                            {/* Settings */}
                            <button
                                onClick={() => setShowSettingsModal(true)}
                                className="p-2.5 rounded-xl text-slate-400 hover:bg-[#232436] hover:text-white transition-colors"
                                title="Settings"
                            >
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                            </button>

                            {/* User Avatar with Dropdown */}
                            {user && (
                                <div className="relative">
                                    <button
                                        onClick={() => setShowUserMenu(!showUserMenu)}
                                        className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-xs border-2 border-[#1a1b26] ring-2 ring-[#232436] hover:ring-purple-500/50 transition-all cursor-pointer"
                                    >
                                        {getInitials(profile?.name || user.email?.split('@')[0] || 'U')}
                                    </button>

                                    {/* Dropdown Menu */}
                                    {showUserMenu && (
                                        <>
                                            {/* Backdrop to close menu */}
                                            <div
                                                className="fixed inset-0 z-40"
                                                onClick={() => setShowUserMenu(false)}
                                            />
                                            <div className="absolute right-0 mt-2 w-56 rounded-xl bg-[#1E1F2E] border border-[#232436] shadow-xl z-50 overflow-hidden">
                                                {/* User Info */}
                                                <div className="p-4 border-b border-[#232436]">
                                                    <p className="text-sm font-medium text-white truncate">{profile?.name || user.email?.split('@')[0] || 'User'}</p>
                                                    <p className="text-xs text-slate-400 truncate">{profile?.email || user.email}</p>
                                                </div>

                                                {/* Menu Items */}
                                                <div className="p-2">
                                                    <button
                                                        onClick={async () => {
                                                            setIsSigningOut(true);
                                                            await signOut();
                                                            router.push('/');
                                                        }}
                                                        disabled={isSigningOut}
                                                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left text-sm text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                                                    >
                                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                                                        </svg>
                                                        {isSigningOut ? 'Signing out...' : 'Sign Out'}
                                                    </button>
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-7xl mx-auto px-6 py-8">
                {/* Date */}
                <h2 className="text-slate-500 text-sm font-medium mb-6 uppercase tracking-wider pl-1">{currentDate}</h2>

                {/* Loading State */}
                {isLoading && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="h-64 rounded-xl border border-[#232436] bg-[#1E1F2E] p-5 animate-pulse">
                                <div className="flex items-center gap-3 mb-6">
                                    <div className="w-10 h-10 rounded-full bg-[#2a2b3d]" />
                                    <div className="flex-1">
                                        <div className="h-4 bg-[#2a2b3d] rounded w-24 mb-2" />
                                        <div className="h-3 bg-[#2a2b3d] rounded w-20" />
                                    </div>
                                </div>
                                <div className="h-3 bg-[#2a2b3d] rounded w-3/4 mb-3" />
                                <div className="h-3 bg-[#2a2b3d] rounded w-1/2 mb-6" />
                                <div className="h-12 bg-[#2a2b3d] rounded-lg w-full" />
                            </div>
                        ))}
                    </div>
                )}

                {/* Empty State - No Team */}
                {!isLoading && !team && (
                    <div className="rounded-2xl border border-dashed border-[#232436] bg-[#1E1F2E]/50 p-20 text-center max-w-2xl mx-auto mt-10">
                        <div className="w-20 h-20 mx-auto rounded-full bg-[#232436] flex items-center justify-center mb-6">
                            <svg className="w-10 h-10 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                            </svg>
                        </div>
                        <h3 className="text-xl font-semibold text-white mb-2">No team yet</h3>
                        <p className="text-slate-400 mb-8 max-w-sm mx-auto">
                            Create or join a team to start sharing status updates with your teammates.
                        </p>
                    </div>
                )}

                {/* Team Members Grid */}
                {!isLoading && filteredMembers.length >= 1 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredMembers.map((member) => {
                            const isCurrentUser = member.user.id === user?.id;
                            const displayStatus = isCurrentUser && optimisticStatus
                                ? optimisticStatus
                                : member.status;

                            return (
                                <div key={member.user.id} className="h-full">
                                    <StatusCard
                                        user={member.user}
                                        status={displayStatus}
                                        onQuickSync={handleQuickSync}
                                        isUpdating={updatingUserIds.has(member.user.id)}
                                        saveState={isCurrentUser ? saveState : 'idle'}
                                    />
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* No Search Results */}
                {!isLoading && teamMembers.length > 0 && filteredMembers.length === 0 && (
                    <div className="text-center py-20">
                        <div className="w-16 h-16 rounded-full bg-[#1E1F2E] flex items-center justify-center mx-auto mb-4">
                            <svg className="w-8 h-8 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                        </div>
                        <p className="text-slate-500 text-lg">No one found matching &quot;{searchQuery}&quot;</p>
                    </div>
                )}
            </main>

            {/* Voice Input Modal */}
            {showVoiceModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div
                        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
                        onClick={() => setShowVoiceModal(false)}
                    />

                    <div className="relative bg-[#1a1b26] rounded-2xl border border-[#232436] shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden">
                        <div className="flex items-center justify-between p-5 border-b border-[#232436]">
                            <div>
                                <h2 className="text-lg font-semibold text-white">Update Your Status</h2>
                                <p className="text-sm text-slate-400 mt-0.5">Tell your team what you&apos;re working on</p>
                            </div>
                            <button
                                onClick={() => setShowVoiceModal(false)}
                                className="p-2 rounded-lg hover:bg-[#232436] text-slate-400 hover:text-white transition-colors"
                            >
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                        <div className="p-5 overflow-y-auto max-h-[calc(90vh-80px)]">
                            <VoiceInputFlow
                                onComplete={handleVoiceComplete}
                                onCancel={() => setShowVoiceModal(false)}
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* Invite Modal */}
            {team && (
                <InviteModal
                    isOpen={showInviteModal}
                    onClose={() => setShowInviteModal(false)}
                    teamName={team.name}
                    inviteCode={team.invite_code}
                />
            )}



            <ToastContainer toasts={toasts} onDismiss={dismissToast} />
        </div>
    );
}
