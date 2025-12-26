'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { createSupabaseBrowserClient } from '@/lib/supabase';
import type { User as DbUser, Team } from '@/lib/supabase';

interface AuthContextType {
    user: User | null;
    profile: DbUser | null;
    team: Team | null;
    session: Session | null;
    isLoading: boolean;
    signUp: (email: string, password: string, name: string, teamName?: string, inviteCode?: string) => Promise<{ error: string | null }>;
    signIn: (email: string, password: string) => Promise<{ error: string | null }>;
    signOut: () => Promise<void>;
    refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [profile, setProfile] = useState<DbUser | null>(null);
    const [team, setTeam] = useState<Team | null>(null);
    const [session, setSession] = useState<Session | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const supabase = createSupabaseBrowserClient();

    // Fetch user profile and team
    const fetchProfile = async (userId: string) => {
        try {
            const { data: profileData } = await supabase
                .from('users')
                .select('*')
                .eq('id', userId)
                .single();

            const typedProfile = profileData as DbUser | null;

            if (typedProfile) {
                setProfile(typedProfile);

                if (typedProfile.team_id) {
                    const { data: teamData } = await supabase
                        .from('teams')
                        .select('*')
                        .eq('id', typedProfile.team_id)
                        .single();

                    setTeam(teamData as Team | null);
                }
            }
        } catch (error) {
            console.error('Error fetching profile:', error);
        }
    };

    const refreshProfile = async () => {
        if (user) {
            await fetchProfile(user.id);
        }
    };

    useEffect(() => {
        // Get initial session - set loading false as soon as we know auth status
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            setUser(session?.user ?? null);
            setIsLoading(false); // Set loading false IMMEDIATELY after getting auth status

            // Fetch profile in background (non-blocking)
            if (session?.user) {
                fetchProfile(session.user.id);
            }
        });

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            (event, session) => {
                setSession(session);
                setUser(session?.user ?? null);
                setIsLoading(false);

                if (session?.user) {
                    // Fetch profile in background (non-blocking)
                    fetchProfile(session.user.id);
                } else {
                    setProfile(null);
                    setTeam(null);
                }
            }
        );

        return () => subscription.unsubscribe();
    }, []);

    const signUp = async (
        email: string,
        password: string,
        name: string,
        teamName?: string,
        inviteCode?: string
    ): Promise<{ error: string | null }> => {
        try {
            // Use server API route for signup (has admin access for team creation)
            const response = await fetch('/api/auth/signup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password, name, teamName, inviteCode }),
            });

            const data = await response.json();

            if (!response.ok) {
                return { error: data.error || 'Signup failed' };
            }

            // Now sign in the user
            const { error: signInError } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (signInError) {
                return { error: signInError.message };
            }

            return { error: null };
        } catch (error) {
            console.error('Signup error:', error);
            return { error: 'An unexpected error occurred' };
        }
    };

    const signIn = async (email: string, password: string): Promise<{ error: string | null }> => {
        try {
            const { error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (error) {
                return { error: error.message };
            }

            return { error: null };
        } catch (error) {
            console.error('Sign in error:', error);
            return { error: 'An unexpected error occurred' };
        }
    };

    const signOut = async () => {
        // Clear state immediately for instant UI feedback
        setUser(null);
        setProfile(null);
        setTeam(null);
        setSession(null);
        // Then sign out from Supabase (don't await to avoid delay)
        supabase.auth.signOut().catch(console.error);
    };

    return (
        <AuthContext.Provider
            value={{
                user,
                profile,
                team,
                session,
                isLoading,
                signUp,
                signIn,
                signOut,
                refreshProfile,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
