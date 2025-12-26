'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';

export default function LandingPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();

  // Redirect authenticated users to dashboard (silently in background)
  useEffect(() => {
    if (!isLoading && user) {
      router.replace('/dashboard');
    }
  }, [isLoading, user, router]);

  // Always show landing page content immediately - no loading state
  // If user is authenticated, they'll be redirected by the useEffect above
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

            {/* Nav Links - Only show for logged out users (logged in users are redirected) */}
            <div className="flex items-center gap-5">
              <Link
                href="/login"
                className="text-sm text-gray-400 hover:text-white transition-colors"
              >
                Login
              </Link>
              <Link
                href="/signup"
                className="text-sm bg-purple-600 hover:bg-purple-500 px-5 py-2.5 rounded-lg font-medium text-white transition-colors"
              >
                Start Free Trial
              </Link>
            </div>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="max-w-6xl mx-auto px-6">
        <div className="flex flex-col items-center justify-center text-center py-28">
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold text-white tracking-tight leading-[1.1]">
            Your team&apos;s day, in seconds
          </h1>
          <p className="text-lg sm:text-xl text-gray-400 mt-6 max-w-lg">
            Speak your status. See who&apos;s free. Schedule instantly.
          </p>

          <Link
            href="/signup"
            className="mt-12 px-10 py-4 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold text-lg transition-all shadow-2xl shadow-purple-600/30 hover:shadow-purple-500/40"
          >
            Start Free Trial
          </Link>
        </div>
      </section>

      {/* Features Section */}
      <section className="max-w-6xl mx-auto px-6 py-20 border-t border-white/5">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-16">
          {/* Feature 1 */}
          <div className="flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-2xl bg-[#1a1625] border border-purple-500/20 flex items-center justify-center mb-5">
              <svg className="w-7 h-7 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">Update in 10 seconds</h3>
            <p className="text-gray-500 text-sm leading-relaxed">
              Just speak your day. We&apos;ll parse your tasks, meetings, and availability.
            </p>
          </div>

          {/* Feature 2 */}
          <div className="flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-2xl bg-[#1a1625] border border-purple-500/20 flex items-center justify-center mb-5">
              <svg className="w-7 h-7 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">See everyone&apos;s availability</h3>
            <p className="text-gray-500 text-sm leading-relaxed">
              At-a-glance status cards show who&apos;s free, busy, or available later.
            </p>
          </div>

          {/* Feature 3 */}
          <div className="flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-2xl bg-[#1a1625] border border-purple-500/20 flex items-center justify-center mb-5">
              <svg className="w-7 h-7 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">Schedule with one click</h3>
            <p className="text-gray-500 text-sm leading-relaxed">
              Click any teammate to see their next free slots and book instantly.
            </p>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="max-w-6xl mx-auto px-6 py-20">
        <div className="text-center mb-14">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-3">Simple, transparent pricing</h2>
          <p className="text-gray-500">Choose the plan that works for your team</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
          {/* Free Plan */}
          <div className="rounded-2xl border border-[#252035] bg-[#15121f] p-7">
            <h3 className="text-lg font-semibold text-white mb-1">Free</h3>
            <div className="mb-6">
              <span className="text-4xl font-bold text-white">$0</span>
              <span className="text-gray-500 text-sm">/month</span>
            </div>
            <ul className="space-y-3 mb-8">
              <li className="flex items-center gap-3 text-sm text-gray-300">
                <svg className="w-4 h-4 text-emerald-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                Up to 5 team members
              </li>
              <li className="flex items-center gap-3 text-sm text-gray-300">
                <svg className="w-4 h-4 text-emerald-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                Voice updates
              </li>
              <li className="flex items-center gap-3 text-sm text-gray-300">
                <svg className="w-4 h-4 text-emerald-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                Basic scheduling
              </li>
            </ul>
            <Link
              href="/signup"
              className="block w-full py-3 rounded-lg border border-[#353045] text-center text-sm font-medium text-white hover:bg-[#1f1a2e] transition-colors"
            >
              Get Started
            </Link>
          </div>

          {/* Pro Plan - Highlighted */}
          <div className="rounded-2xl bg-purple-600 p-7 relative">
            <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-emerald-500 text-white text-xs font-semibold rounded-full">
              Popular
            </span>
            <h3 className="text-lg font-semibold text-white mb-1">Pro</h3>
            <div className="mb-6">
              <span className="text-4xl font-bold text-white">$12</span>
              <span className="text-purple-200 text-sm">/month</span>
            </div>
            <ul className="space-y-3 mb-8">
              <li className="flex items-center gap-3 text-sm text-white">
                <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                Unlimited team members
              </li>
              <li className="flex items-center gap-3 text-sm text-white">
                <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                Calendar integration
              </li>
              <li className="flex items-center gap-3 text-sm text-white">
                <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                Group scheduling
              </li>
              <li className="flex items-center gap-3 text-sm text-white">
                <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                Analytics
              </li>
            </ul>
            <Link
              href="/signup"
              className="block w-full py-3 rounded-lg bg-[#0c0a15] text-center text-sm font-medium text-white hover:bg-[#1a1625] transition-colors"
            >
              Start Free Trial
            </Link>
          </div>

          {/* Business Plan */}
          <div className="rounded-2xl border border-[#252035] bg-[#15121f] p-7">
            <h3 className="text-lg font-semibold text-white mb-1">Business</h3>
            <div className="mb-6">
              <span className="text-4xl font-bold text-white">$39</span>
              <span className="text-gray-500 text-sm">/month</span>
            </div>
            <ul className="space-y-3 mb-8">
              <li className="flex items-center gap-3 text-sm text-gray-300">
                <svg className="w-4 h-4 text-emerald-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                Everything in Pro
              </li>
              <li className="flex items-center gap-3 text-sm text-gray-300">
                <svg className="w-4 h-4 text-emerald-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                Priority support
              </li>
              <li className="flex items-center gap-3 text-sm text-gray-300">
                <svg className="w-4 h-4 text-emerald-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                Custom integrations
              </li>
              <li className="flex items-center gap-3 text-sm text-gray-300">
                <svg className="w-4 h-4 text-emerald-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                Advanced permissions
              </li>
            </ul>
            <Link
              href="/signup"
              className="block w-full py-3 rounded-lg border border-[#353045] text-center text-sm font-medium text-white hover:bg-[#1f1a2e] transition-colors"
            >
              Contact Sales
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 py-8 mt-10">
        <div className="max-w-6xl mx-auto px-6 text-center text-gray-600 text-sm">
          © 2024 Sync. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
