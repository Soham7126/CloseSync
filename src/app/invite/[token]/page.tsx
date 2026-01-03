'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';

interface InvitationDetails {
    email: string;
    role: string;
    teamName: string;
    teamId: string;
    expiresAt: string;
}

export default function InviteAcceptPage({ params }: { params: Promise<{ token: string }> }) {
    const { token } = use(params);
    const router = useRouter();
    const { user, profile } = useAuth();

    const [loading, setLoading] = useState(true);
    const [accepting, setAccepting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [invitation, setInvitation] = useState<InvitationDetails | null>(null);
    const [success, setSuccess] = useState(false);

    useEffect(() => {
        validateInvitation();
    }, [token]);

    const validateInvitation = async () => {
        try {
            const response = await fetch(`/api/team/invite/accept?token=${token}`);
            const data = await response.json();

            if (!response.ok) {
                setError(data.error || 'Invalid invitation');
                return;
            }

            setInvitation(data.invitation);
        } catch {
            setError('Failed to validate invitation');
        } finally {
            setLoading(false);
        }
    };

    const handleAccept = async () => {
        setAccepting(true);
        setError(null);

        try {
            const response = await fetch('/api/team/invite/accept', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token }),
            });

            const data = await response.json();

            if (!response.ok) {
                if (data.requiresAuth) {
                    // Redirect to signup/signin with the invitation context
                    router.push(`/signup?invite=${token}&email=${encodeURIComponent(data.invitation.email)}`);
                    return;
                }
                throw new Error(data.error || 'Failed to accept invitation');
            }

            setSuccess(true);

            // Redirect to dashboard after a short delay
            setTimeout(() => {
                router.push('/dashboard');
            }, 2000);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to accept invitation');
        } finally {
            setAccepting(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-[#0f0f23] flex items-center justify-center">
                <div className="text-center">
                    <div className="w-12 h-12 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-gray-400">Validating invitation...</p>
                </div>
            </div>
        );
    }

    if (error && !invitation) {
        return (
            <div className="min-h-screen bg-[#0f0f23] flex items-center justify-center p-4">
                <div className="bg-[#1a1a2e] rounded-2xl border border-[#2a2a3e] p-8 max-w-md w-full text-center">
                    <div className="w-16 h-16 bg-red-600/20 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </div>
                    <h1 className="text-xl font-semibold text-white mb-2">Invalid Invitation</h1>
                    <p className="text-gray-400 mb-6">{error}</p>
                    <Link
                        href="/"
                        className="inline-block px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors"
                    >
                        Go to Homepage
                    </Link>
                </div>
            </div>
        );
    }

    if (success) {
        return (
            <div className="min-h-screen bg-[#0f0f23] flex items-center justify-center p-4">
                <div className="bg-[#1a1a2e] rounded-2xl border border-[#2a2a3e] p-8 max-w-md w-full text-center">
                    <div className="w-16 h-16 bg-green-600/20 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                    </div>
                    <h1 className="text-xl font-semibold text-white mb-2">Welcome to the Team!</h1>
                    <p className="text-gray-400 mb-4">
                        You&apos;ve successfully joined <span className="text-white font-medium">{invitation?.teamName}</span>
                    </p>
                    <p className="text-sm text-gray-500">Redirecting to dashboard...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#0f0f23] flex items-center justify-center p-4">
            <div className="bg-[#1a1a2e] rounded-2xl border border-[#2a2a3e] p-8 max-w-md w-full">
                {/* Header */}
                <div className="text-center mb-8">
                    <div className="w-16 h-16 bg-purple-600/20 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                        </svg>
                    </div>
                    <h1 className="text-2xl font-bold text-white mb-2">You&apos;re Invited!</h1>
                    <p className="text-gray-400">
                        You&apos;ve been invited to join <span className="text-white font-medium">{invitation?.teamName}</span>
                    </p>
                </div>

                {/* Invitation Details */}
                <div className="space-y-4 mb-8">
                    <div className="p-4 bg-[#0f0f23] rounded-xl border border-[#2a2a3e]">
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-gray-400 text-sm">Team</span>
                            <span className="text-white font-medium">{invitation?.teamName}</span>
                        </div>
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-gray-400 text-sm">Role</span>
                            <span className="px-2 py-1 bg-purple-600/20 text-purple-400 rounded text-sm capitalize">
                                {invitation?.role}
                            </span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-gray-400 text-sm">Invited as</span>
                            <span className="text-white text-sm">{invitation?.email}</span>
                        </div>
                    </div>

                    {/* Expiry info */}
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>
                            Expires {invitation?.expiresAt ? new Date(invitation.expiresAt).toLocaleDateString() : 'soon'}
                        </span>
                    </div>
                </div>

                {/* Error message */}
                {error && (
                    <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                        {error}
                    </div>
                )}

                {/* Actions */}
                {user ? (
                    // User is logged in
                    <div className="space-y-3">
                        {profile?.email?.toLowerCase() === invitation?.email.toLowerCase() ? (
                            // Email matches
                            <button
                                onClick={handleAccept}
                                disabled={accepting}
                                className="w-full py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-600/50 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                            >
                                {accepting ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                        Joining...
                                    </>
                                ) : (
                                    <>
                                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                        </svg>
                                        Accept & Join Team
                                    </>
                                )}
                            </button>
                        ) : (
                            // Email doesn't match
                            <div className="text-center">
                                <p className="text-amber-400 text-sm mb-4">
                                    This invitation was sent to {invitation?.email}. You&apos;re signed in as {profile?.email}.
                                </p>
                                <p className="text-gray-400 text-sm">
                                    Please sign in with the correct email or ask for a new invitation.
                                </p>
                            </div>
                        )}
                    </div>
                ) : (
                    // User not logged in
                    <div className="space-y-3">
                        <Link
                            href={`/signup?invite=${token}&email=${encodeURIComponent(invitation?.email || '')}`}
                            className="block w-full py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors text-center"
                        >
                            Create Account & Join
                        </Link>
                        <Link
                            href={`/login?redirect=/invite/${token}`}
                            className="block w-full py-3 border border-[#2a2a3e] hover:border-[#3a3a4e] text-white rounded-lg font-medium transition-colors text-center"
                        >
                            Sign In & Join
                        </Link>
                    </div>
                )}

                {/* Footer */}
                <div className="mt-6 pt-6 border-t border-[#2a2a3e] text-center">
                    <Link href="/" className="text-gray-400 hover:text-white text-sm transition-colors">
                        Not interested? Go to homepage
                    </Link>
                </div>
            </div>
        </div>
    );
}
