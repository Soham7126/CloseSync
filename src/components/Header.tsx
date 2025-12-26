'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from './AuthProvider';

export default function Header() {
    const { user, profile, signOut, isLoading } = useAuth();
    const [showConfirm, setShowConfirm] = useState(false);
    const [isSigningOut, setIsSigningOut] = useState(false);
    const router = useRouter();

    const handleSignOut = async () => {
        setIsSigningOut(true);
        try {
            await signOut();
            setShowConfirm(false);
            router.push('/');
            router.refresh();
        } catch (error) {
            console.error('Sign out error:', error);
        } finally {
            setIsSigningOut(false);
        }
    };

    return (
        <>
            <header className="border-b border-border bg-background">
                <nav className="container mx-auto flex h-16 items-center justify-between px-4">
                    <Link href={user ? "/dashboard" : "/"} className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-purple-600 flex items-center justify-center text-white font-bold text-xs">
                            S
                        </div>
                        <span className="text-xl font-semibold tracking-tight">Sync</span>
                    </Link>

                    <div className="flex items-center gap-6">
                        {isLoading ? (
                            <div className="w-20 h-4 bg-muted rounded animate-pulse" />
                        ) : user ? (
                            <>
                                <span className="text-sm text-muted-foreground">
                                    {profile?.name || user.email}
                                </span>
                                <button
                                    onClick={() => setShowConfirm(true)}
                                    className="text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                                    type="button"
                                >
                                    Sign Out
                                </button>
                            </>
                        ) : (
                            <>
                                <Link
                                    href="/login"
                                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                                >
                                    Login
                                </Link>
                                <Link
                                    href="/signup"
                                    className="text-sm px-4 py-2 rounded-lg bg-purple-600 text-white hover:bg-purple-700 transition-colors"
                                >
                                    Start Free Trial
                                </Link>
                            </>
                        )}
                    </div>
                </nav>
            </header>

            {/* Sign Out Confirmation Modal */}
            {showConfirm && (
                <div
                    className="fixed inset-0 flex items-center justify-center p-4"
                    style={{ zIndex: 9999 }}
                >
                    {/* Backdrop */}
                    <div
                        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                        onClick={() => !isSigningOut && setShowConfirm(false)}
                    />

                    {/* Modal */}
                    <div className="relative bg-background rounded-xl border border-border shadow-xl w-full max-w-sm p-6">
                        <h3 className="text-lg font-semibold">Sign Out</h3>
                        <p className="text-sm text-muted-foreground mt-2">
                            Are you sure you want to sign out? You&apos;ll need to sign in again to access your dashboard.
                        </p>

                        <div className="flex gap-3 mt-6">
                            <button
                                onClick={() => setShowConfirm(false)}
                                disabled={isSigningOut}
                                className="flex-1 py-2.5 rounded-lg border border-border bg-background hover:bg-muted transition-colors text-sm font-medium disabled:opacity-50"
                                type="button"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSignOut}
                                disabled={isSigningOut}
                                className="flex-1 py-2.5 rounded-lg bg-red-600 hover:bg-red-700 text-white transition-colors text-sm font-medium disabled:opacity-50"
                                type="button"
                            >
                                {isSigningOut ? 'Signing out...' : 'Sign Out'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
