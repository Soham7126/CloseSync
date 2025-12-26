'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';

type TeamOption = 'create' | 'join' | 'skip';

export default function SignupPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [teamOption, setTeamOption] = useState<TeamOption>('create');
    const [teamName, setTeamName] = useState('');
    const [inviteCode, setInviteCode] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const { signUp } = useAuth();
    const router = useRouter();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        // Validation
        if (password.length < 6) {
            setError('Password must be at least 6 characters');
            return;
        }

        if (teamOption === 'create' && !teamName.trim()) {
            setError('Please enter a team name');
            return;
        }

        if (teamOption === 'join' && !inviteCode.trim()) {
            setError('Please enter an invite code');
            return;
        }

        setIsLoading(true);

        const { error } = await signUp(
            email,
            password,
            name,
            teamOption === 'create' ? teamName : undefined,
            teamOption === 'join' ? inviteCode : undefined
        );

        if (error) {
            setError(error);
            setIsLoading(false);
        } else {
            router.push('/');
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center px-4 py-12">
            <div className="w-full max-w-sm">
                {/* Header */}
                <div className="text-center mb-8">
                    <h1 className="text-2xl font-bold tracking-tight">Create an account</h1>
                    <p className="text-sm text-muted-foreground mt-2">
                        Get started with your team
                    </p>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Error Message */}
                    {error && (
                        <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                        </div>
                    )}

                    {/* Name */}
                    <div>
                        <label htmlFor="name" className="block text-sm font-medium mb-2">
                            Full Name
                        </label>
                        <input
                            id="name"
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            required
                            className="w-full h-11 px-4 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
                            placeholder="John Doe"
                        />
                    </div>

                    {/* Email */}
                    <div>
                        <label htmlFor="email" className="block text-sm font-medium mb-2">
                            Email
                        </label>
                        <input
                            id="email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            className="w-full h-11 px-4 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
                            placeholder="you@example.com"
                        />
                    </div>

                    {/* Password */}
                    <div>
                        <label htmlFor="password" className="block text-sm font-medium mb-2">
                            Password
                        </label>
                        <input
                            id="password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            minLength={6}
                            className="w-full h-11 px-4 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
                            placeholder="••••••••"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                            At least 6 characters
                        </p>
                    </div>

                    {/* Team Options */}
                    <div className="pt-2">
                        <label className="block text-sm font-medium mb-3">Team</label>
                        <div className="space-y-2">
                            {/* Create Team */}
                            <label className="flex items-center gap-3 p-3 rounded-lg border border-border cursor-pointer hover:bg-muted/50 transition-colors">
                                <input
                                    type="radio"
                                    name="teamOption"
                                    value="create"
                                    checked={teamOption === 'create'}
                                    onChange={() => setTeamOption('create')}
                                    className="w-4 h-4"
                                />
                                <div>
                                    <p className="text-sm font-medium">Create a new team</p>
                                    <p className="text-xs text-muted-foreground">Start fresh with your own team</p>
                                </div>
                            </label>

                            {/* Join Team */}
                            <label className="flex items-center gap-3 p-3 rounded-lg border border-border cursor-pointer hover:bg-muted/50 transition-colors">
                                <input
                                    type="radio"
                                    name="teamOption"
                                    value="join"
                                    checked={teamOption === 'join'}
                                    onChange={() => setTeamOption('join')}
                                    className="w-4 h-4"
                                />
                                <div>
                                    <p className="text-sm font-medium">Join existing team</p>
                                    <p className="text-xs text-muted-foreground">Use an invite code from your team</p>
                                </div>
                            </label>

                            {/* Skip */}
                            <label className="flex items-center gap-3 p-3 rounded-lg border border-border cursor-pointer hover:bg-muted/50 transition-colors">
                                <input
                                    type="radio"
                                    name="teamOption"
                                    value="skip"
                                    checked={teamOption === 'skip'}
                                    onChange={() => setTeamOption('skip')}
                                    className="w-4 h-4"
                                />
                                <div>
                                    <p className="text-sm font-medium">Skip for now</p>
                                    <p className="text-xs text-muted-foreground">You can join a team later</p>
                                </div>
                            </label>
                        </div>
                    </div>

                    {/* Team Name Input */}
                    {teamOption === 'create' && (
                        <div>
                            <label htmlFor="teamName" className="block text-sm font-medium mb-2">
                                Team Name
                            </label>
                            <input
                                id="teamName"
                                type="text"
                                value={teamName}
                                onChange={(e) => setTeamName(e.target.value)}
                                className="w-full h-11 px-4 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
                                placeholder="Acme Inc."
                            />
                        </div>
                    )}

                    {/* Invite Code Input */}
                    {teamOption === 'join' && (
                        <div>
                            <label htmlFor="inviteCode" className="block text-sm font-medium mb-2">
                                Invite Code
                            </label>
                            <input
                                id="inviteCode"
                                type="text"
                                value={inviteCode}
                                onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                                className="w-full h-11 px-4 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors font-mono tracking-wider"
                                placeholder="ABCD1234"
                                maxLength={8}
                            />
                        </div>
                    )}

                    {/* Submit Button */}
                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full h-11 rounded-lg bg-primary text-primary-foreground font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed mt-6"
                    >
                        {isLoading ? 'Creating account...' : 'Create Account'}
                    </button>
                </form>

                {/* Footer */}
                <p className="text-center text-sm text-muted-foreground mt-6">
                    Already have an account?{' '}
                    <Link href="/login" className="text-foreground font-medium hover:underline">
                        Sign in
                    </Link>
                </p>
            </div>
        </div>
    );
}
