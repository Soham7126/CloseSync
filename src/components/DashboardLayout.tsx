'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import DashboardHeader from '@/components/DashboardHeader';
import InviteModal from '@/components/InviteModal';
import { createSupabaseBrowserClient } from '@/lib/supabase';

interface DashboardLayoutProps {
    children: React.ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
    const router = useRouter();
    const pathname = usePathname();
    const { user, profile, team, isLoading: authLoading } = useAuth();
    const [showInviteModal, setShowInviteModal] = useState(false);
    const [teamMemberCount, setTeamMemberCount] = useState(0);

    // Redirect to landing page if not authenticated
    useEffect(() => {
        if (!authLoading && !user) {
            router.replace('/');
        }
    }, [authLoading, user, router]);

    // Fetch team member count
    useEffect(() => {
        async function fetchTeamCount() {
            if (!team?.id) return;

            const supabase = createSupabaseBrowserClient();
            const { count } = await supabase
                .from('users')
                .select('*', { count: 'exact', head: true })
                .eq('team_id', team.id);

            if (count !== null) {
                setTeamMemberCount(count);
            }
        }
        fetchTeamCount();
    }, [team?.id]);

    // Close mobile menu on route change
    useEffect(() => {
    }, [pathname]);

    // Show loading screen while checking auth
    if (authLoading) {
        return (
            <div className="min-h-screen bg-[#FFF8F0] flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-[#FF8C42] flex items-center justify-center text-white font-bold text-xl animate-pulse">
                        C
                    </div>
                    <p className="text-gray-500 text-sm">Loading...</p>
                </div>
            </div>
        );
    }

    // Don't render if not authenticated (will redirect)
    if (!user) {
        return null;
    }

    return (
        <div className="min-h-screen bg-[#FFF8F0] flex flex-col">
            {/* Header */}
            <DashboardHeader
                onOpenInvite={() => setShowInviteModal(true)}
                teamMemberCount={teamMemberCount}
            />

            {/* Main Content Area */}
            <main className="flex-1 px-6 pt-8 pb-8 lg:px-16 xl:px-24 lg:pt-10 lg:pb-12">
                <div className="max-w-[1400px] w-full mx-auto">
                    {children}
                </div>
            </main>

            {/* Invite Modal */}
            {team && (
                <InviteModal
                    isOpen={showInviteModal}
                    onClose={() => setShowInviteModal(false)}
                    teamName={team.name}
                    inviteCode={team.invite_code}
                />
            )}
        </div>
    );
}
