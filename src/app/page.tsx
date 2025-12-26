'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';

export default function LandingPage() {
    const router = useRouter();
    const { user, isLoading } = useAuth();

    // Redirect authenticated users to dashboard
    useEffect(() => {
        if (!isLoading && user) {
            router.replace('/dashboard');
        }
    }, [isLoading, user, router]);

    return (
        <div className="min-h-screen bg-[#0c0a15]">
            {/* Header */}
            <header className="border-b border-white/5">
                <div className="max-w-6xl mx-auto px-6 py-4">
                    <nav className="flex items-center justify-between">
                        {/* Logo */}
                        <div className="flex items-center gap-2.5">
                            <div className="w-9 h-9 rounded-lg bg-purple-600 flex items-center justify-center text-white font-bold">
                                S
                            </div>
                            <span className="text-xl font-semibold text-white">Sync</span>
                        </div>

                        {/* Nav Links */}
                        <div className="flex items-center gap-4">
                            <Link
                                href="/login"
                                className="text-sm text-white border border-white/20 hover:border-white/40 hover:bg-white/5 transition-all px-5 py-2.5 rounded-lg"
                            >
                                Login
                            </Link>
                            <Link
                                href="/signup"
                                className="text-sm bg-purple-600 hover:bg-purple-500 px-5 py-2.5 rounded-lg font-medium text-white transition-colors"
                            >
                                Get Started
                            </Link>
                        </div>
                    </nav>
                </div>
            </header>

            {/* Hero Section */}
            <section className="max-w-6xl mx-auto px-6">
                <div className="flex flex-col items-center justify-center text-center py-32 md:py-40">
                    <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold text-white tracking-tight leading-[1.1]">
                        Your team&apos;s day,
                        <br />
                        <span className="text-purple-400">in seconds</span>
                    </h1>
                    <p className="text-lg sm:text-xl text-gray-400 mt-6 max-w-lg">
                        Speak your status. See who&apos;s free. Schedule instantly.
                    </p>

                    <Link
                        href="/signup"
                        className="mt-12 px-10 py-4 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold text-lg transition-all shadow-2xl shadow-purple-600/30 hover:shadow-purple-500/40"
                    >
                        Get Started Free
                    </Link>
                </div>
            </section>

            {/* Footer */}
            <footer className="absolute bottom-0 left-0 right-0 border-t border-white/5 py-6">
                <div className="max-w-6xl mx-auto px-6 text-center text-gray-600 text-sm">
                    © 2024 Sync. All rights reserved.
                </div>
            </footer>
        </div>
    );
}
