import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Use admin client to bypass RLS
const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
    try {
        const { userId, inviteCode } = await request.json();

        if (!userId || !inviteCode) {
            return NextResponse.json(
                { error: 'User ID and invite code are required' },
                { status: 400 }
            );
        }

        // Find team by invite code
        const { data: team, error: teamError } = await supabaseAdmin
            .from('teams')
            .select('*')
            .eq('invite_code', inviteCode.toUpperCase())
            .single();

        if (teamError || !team) {
            return NextResponse.json(
                { error: 'Invalid invite code' },
                { status: 404 }
            );
        }

        // Check if user exists
        const { data: existingUser, error: userError } = await supabaseAdmin
            .from('users')
            .select('*')
            .eq('id', userId)
            .single();

        if (userError || !existingUser) {
            return NextResponse.json(
                { error: 'User not found' },
                { status: 404 }
            );
        }

        // Check if user is already in this team
        if (existingUser.team_id === team.id) {
            return NextResponse.json(
                { error: 'You are already a member of this team' },
                { status: 400 }
            );
        }

        // Update user's team
        const { error: updateError } = await supabaseAdmin
            .from('users')
            .update({ team_id: team.id })
            .eq('id', userId);

        if (updateError) {
            console.error('Failed to update user team:', updateError);
            return NextResponse.json(
                { error: 'Failed to join team' },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            team: {
                id: team.id,
                name: team.name,
                invite_code: team.invite_code,
            },
        });
    } catch (error) {
        console.error('Join team error:', error);
        return NextResponse.json(
            { error: 'An unexpected error occurred' },
            { status: 500 }
        );
    }
}
