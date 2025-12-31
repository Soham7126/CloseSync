'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import Sidebar from '@/components/Sidebar';
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
    const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
    const [showInviteModal, setShowInviteModal] = useState(false);
    const [teamMemberCount, setTeamMemberCount] = useState(0);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

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
        setIsMobileMenuOpen(false);
    }, [pathname]);

    // Show loading screen while checking auth
    if (authLoading) {
        return (
            <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-[#6366F1] flex items-center justify-center text-white font-bold text-xl animate-pulse">
                        L
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
        <div className="min-h-screen bg-[#F8F9FA] flex">
            {/* Mobile Menu Button */}
            <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="fixed top-4 left-4 z-50 p-2 rounded-lg bg-white border border-gray-200 shadow-sm lg:hidden"
                aria-label="Toggle menu"
            >
                <svg className="w-6 h-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    {isMobileMenuOpen ? (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    ) : (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                    )}
                </svg>
            </button>

            {/* Mobile Overlay */}
            {isMobileMenuOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-30 lg:hidden"
                    onClick={() => setIsMobileMenuOpen(false)}
                />
            )}

            {/* Sidebar - Desktop */}
            <div className="hidden lg:block">
                <Sidebar
                    isCollapsed={sidebarCollapsed}
                    onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
                />
            </div>

            {/* Sidebar - Mobile */}
            <div
                className={`fixed inset-y-0 left-0 z-40 transform transition-transform duration-300 lg:hidden ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
                    }`}
            >
                <Sidebar
                    isCollapsed={false}
                    onToggle={() => setIsMobileMenuOpen(false)}
                />
            </div>

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col min-w-0">
                {/* Header */}
                <DashboardHeader
                    onOpenInvite={() => setShowInviteModal(true)}
                    teamMemberCount={teamMemberCount}
                />

                {/* Page Content */}
                <main className="flex-1 p-8 lg:p-10">
                    <div className="max-w-[1200px] mx-auto">
                        {children}
                    </div>
                </main>
            </div>

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
