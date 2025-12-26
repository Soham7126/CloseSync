'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { createSupabaseBrowserClient } from '@/lib/supabase';
import { useAuth } from '@/components/AuthProvider';
import type { Team } from '@/lib/supabase';

export default function JoinTeamPage() {
    const params = useParams();
    const router = useRouter();
    const { user, profile, refreshProfile } = useAuth();

    const [team, setTeam] = useState<Team | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isJoining, setIsJoining] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    const inviteCode = params.code as string;

    // Fetch team by invite code
    useEffect(() => {
        async function fetchTeam() {
            if (!inviteCode) {
                setError('Invalid invite code');
                setIsLoading(false);
                return;
            }

            const supabase = createSupabaseBrowserClient();

            const { data, error: fetchError } = await supabase
                .from('teams')
                .select('*')
                .eq('invite_code', inviteCode.toUpperCase())
                .single();

            if (fetchError || !data) {
                setError('Invalid or expired invite code');
                setIsLoading(false);
                return;
            }

            setTeam(data);
            setIsLoading(false);
        }

        fetchTeam();
    }, [inviteCode]);

    // Check if user is already in this team
    const isAlreadyMember = profile?.team_id === team?.id;

    // Handle join team
    const handleJoinTeam = async () => {
        if (!user?.id || !team?.id) return;

        setIsJoining(true);
        setError(null);

        try {
            const response = await fetch('/api/team/join', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: user.id,
                    inviteCode: inviteCode.toUpperCase(),
                }),
            });

            const result = await response.json();

            if (!response.ok) {
                setError(result.error || 'Failed to join team');
                setIsJoining(false);
                return;
            }

            setSuccess(true);

            // Refresh profile to get new team
            await refreshProfile();

            // Redirect to dashboard after brief delay
            setTimeout(() => {
                router.push('/dashboard');
            }, 1500);
        } catch (err) {
            setError('An unexpected error occurred');
            setIsJoining(false);
        }
    };

    // Loading state
    if (isLoading) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center p-4">
                <div className="text-center">
                    <div className="w-12 h-12 rounded-full border-4 border-purple-600 border-t-transparent animate-spin mx-auto mb-4" />
                    <p className="text-muted-foreground">Verifying invite code...</p>
                </div>
            </div>
        );
    }

    // Error state - invalid code
    if (error && !team) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center p-4">
                <div className="max-w-md w-full text-center">
                    <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </div>
                    <h1 className="text-2xl font-bold mb-2">Invalid Invite</h1>
                    <p className="text-muted-foreground mb-6">{error}</p>
                    <Link
                        href="/"
                        className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-medium transition-colors"
                    >
                        Go to Home
                    </Link>
                </div>
            </div>
        );
    }

    // Success state
    if (success) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center p-4">
                <div className="max-w-md w-full text-center">
                    <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                    </div>
                    <h1 className="text-2xl font-bold mb-2">Welcome to {team?.name}!</h1>
                    <p className="text-muted-foreground">Redirecting to dashboard...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
            <div className="max-w-md w-full">
                {/* Card */}
                <div className="bg-background rounded-2xl border border-border shadow-xl p-8 text-center">
                    {/* Team Avatar */}
                    <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-purple-600 to-purple-700 flex items-center justify-center mx-auto mb-6 shadow-lg">
                        <span className="text-3xl font-bold text-white">
                            {team?.name?.charAt(0).toUpperCase()}
                        </span>
                    </div>

                    <h1 className="text-2xl font-bold mb-2">Join {team?.name}</h1>
                    <p className="text-muted-foreground mb-6">
                        You&apos;ve been invited to join this team on Sync.
                    </p>

                    {/* Already a member */}
                    {isAlreadyMember && (
                        <div className="mb-6 p-4 rounded-xl bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-900">
                            <p className="text-sm text-green-700 dark:text-green-300">
                                You&apos;re already a member of this team!
                            </p>
                        </div>
                    )}

                    {/* Error message */}
                    {error && (
                        <div className="mb-6 p-4 rounded-xl bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-900">
                            <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
                        </div>
                    )}

                    {/* Not logged in */}
                    {!user && (
                        <>
                            <p className="text-sm text-muted-foreground mb-6">
                                Create an account or sign in to join this team.
                            </p>
                            <div className="flex flex-col gap-3">
                                <Link
                                    href={`/signup?team=${inviteCode}`}
                                    className="w-full py-3 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-medium transition-colors"
                                >
                                    Create Account & Join
                                </Link>
                                <Link
                                    href={`/login?redirect=/join/${inviteCode}`}
                                    className="w-full py-3 rounded-lg border border-border bg-background hover:bg-muted text-foreground font-medium transition-colors"
                                >
                                    Sign In & Join
                                </Link>
                            </div>
                        </>
                    )}

                    {/* Logged in - can join */}
                    {user && !isAlreadyMember && (
                        <button
                            onClick={handleJoinTeam}
                            disabled={isJoining}
                            className="w-full py-3 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {isJoining ? (
                                <>
                                    <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                                    Joining...
                                </>
                            ) : (
                                <>
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                                    </svg>
                                    Join {team?.name}
                                </>
                            )}
                        </button>
                    )}

                    {/* Already a member */}
                    {user && isAlreadyMember && (
                        <Link
                            href="/dashboard"
                            className="w-full py-3 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-medium transition-colors inline-block"
                        >
                            Go to Dashboard
                        </Link>
                    )}
                </div>

                {/* Footer */}
                <p className="text-center text-sm text-muted-foreground mt-6">
                    <Link href="/" className="hover:underline">
                        ← Back to Sync
                    </Link>
                </p>
            </div>
        </div>
    );
}
