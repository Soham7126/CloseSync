import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(request: NextRequest) {
    try {
        const { email, password, name, teamName, inviteCode } = await request.json();

        // Validation
        if (!email || !password || !name) {
            return NextResponse.json(
                { error: 'Email, password, and name are required' },
                { status: 400 }
            );
        }

        if (password.length < 6) {
            return NextResponse.json(
                { error: 'Password must be at least 6 characters' },
                { status: 400 }
            );
        }

        // Create admin client (bypasses RLS)
        const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
            auth: {
                autoRefreshToken: false,
                persistSession: false,
            },
        });

        // Create auth user
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true, // Auto-confirm for dev
        });

        if (authError) {
            console.error('Auth error:', authError);
            return NextResponse.json(
                { error: authError.message },
                { status: 400 }
            );
        }

        if (!authData.user) {
            return NextResponse.json(
                { error: 'Failed to create user' },
                { status: 500 }
            );
        }

        let teamId: string | null = null;
        let userRole: 'super_admin' | 'admin' | 'member' = 'member';

        // Handle team creation or joining
        if (teamName) {
            // Generate invite code
            const generatedCode = Math.random().toString(36).substring(2, 10).toUpperCase();

            const { data: newTeam, error: teamError } = await supabaseAdmin
                .from('teams')
                .insert({
                    name: teamName,
                    invite_code: generatedCode,
                })
                .select()
                .single();

            if (teamError) {
                console.error('Team creation error:', teamError);
                // Don't fail signup, just log the error
            } else {
                teamId = newTeam.id;
                // Team creator becomes super_admin
                userRole = 'super_admin';
            }
        } else if (inviteCode) {
            // Find team by invite code
            const { data: existingTeam, error: teamError } = await supabaseAdmin
                .from('teams')
                .select('id')
                .eq('invite_code', inviteCode.toUpperCase())
                .single();

            if (teamError || !existingTeam) {
                return NextResponse.json(
                    { error: 'Invalid invite code' },
                    { status: 400 }
                );
            }

            teamId = existingTeam.id;
            // Users joining via invite code become members
            userRole = 'member';
        }

        // Create user profile with role
        const { error: profileError } = await supabaseAdmin.from('users').insert({
            id: authData.user.id,
            email,
            name,
            team_id: teamId,
            role: userRole,
        });

        if (profileError) {
            console.error('Profile creation error:', profileError);
            return NextResponse.json(
                { error: 'Failed to create user profile' },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            user: {
                id: authData.user.id,
                email: authData.user.email,
            },
        });

    } catch (error) {
        console.error('Signup error:', error);
        return NextResponse.json(
            { error: 'An unexpected error occurred' },
            { status: 500 }
        );
    }
}
