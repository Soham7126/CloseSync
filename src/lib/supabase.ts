import { createClient } from '@supabase/supabase-js';
import { createBrowserClient } from '@supabase/ssr';

// Database types
export interface Team {
    id: string;
    name: string;
    invite_code: string;
    subscription_tier: 'free' | 'pro' | 'enterprise';
    created_at: string;
}

export interface User {
    id: string;
    email: string;
    name: string;
    team_id: string | null;
    avatar_url: string | null;
    created_at: string;
}

export interface BusyBlock {
    start: string;
    end: string;
    label: string;
}

export interface UserStatus {
    id: string;
    user_id: string;
    tasks: string[];
    busy_blocks: BusyBlock[];
    free_after: string | null;
    free_until: string | null;
    blockers: string[];
    status_color: 'green' | 'yellow' | 'red';
    raw_transcript: string | null;
    confidence_score: number;
    last_updated: string;
}

export interface TeamMemberStatus extends User {
    team_name: string | null;
    tasks: string[] | null;
    busy_blocks: BusyBlock[] | null;
    free_after: string | null;
    free_until: string | null;
    blockers: string[] | null;
    status_color: 'green' | 'yellow' | 'red' | null;
    last_updated: string | null;
}

// Database schema type for Supabase client
export interface Database {
    public: {
        Tables: {
            teams: {
                Row: Team;
                Insert: Omit<Team, 'id' | 'created_at'> & { id?: string; created_at?: string };
                Update: Partial<Omit<Team, 'id'>>;
            };
            users: {
                Row: User;
                Insert: Omit<User, 'created_at'> & { created_at?: string };
                Update: Partial<Omit<User, 'id'>>;
            };
            user_status: {
                Row: UserStatus;
                Insert: Omit<UserStatus, 'id' | 'last_updated'> & { id?: string; last_updated?: string };
                Update: Partial<Omit<UserStatus, 'id' | 'user_id'>>;
            };
        };
        Views: {
            team_members_status: {
                Row: TeamMemberStatus;
            };
        };
    };
}

// Get environment variables with fallbacks for build time
const getSupabaseUrl = () => process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const getSupabaseAnonKey = () => process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Browser client (for client components)
export function createSupabaseBrowserClient() {
    const supabaseUrl = getSupabaseUrl();
    const supabaseAnonKey = getSupabaseAnonKey();

    if (!supabaseUrl || !supabaseAnonKey) {
        console.warn('Supabase environment variables not configured');
    }

    return createBrowserClient<Database>(supabaseUrl, supabaseAnonKey);
}

// Server client (for server components, API routes)
export async function createSupabaseServerClient() {
    const supabaseUrl = getSupabaseUrl();
    const supabaseAnonKey = getSupabaseAnonKey();

    // Dynamic import to avoid issues during build
    const { cookies } = await import('next/headers');
    const { createServerClient } = await import('@supabase/ssr');

    const cookieStore = await cookies();

    return createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
        cookies: {
            getAll() {
                return cookieStore.getAll();
            },
            setAll(cookiesToSet) {
                try {
                    cookiesToSet.forEach(({ name, value, options }) => {
                        cookieStore.set(name, value, options);
                    });
                } catch {
                    // The `set` method was called from a Server Component
                    // This can be ignored if you have middleware refreshing sessions
                }
            },
        },
    });
}

// Admin client (for server-side operations that bypass RLS)
export function createSupabaseAdminClient() {
    const supabaseUrl = getSupabaseUrl();
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!serviceRoleKey) {
        throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY environment variable');
    }

    return createClient<Database>(supabaseUrl, serviceRoleKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
    });
}
