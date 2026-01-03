import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient, createSupabaseServerClient } from '@/lib/supabase';
import type { TeamInvitation, User, Team } from '@/lib/supabase';

interface InvitationWithTeam extends TeamInvitation {
    teams: Pick<Team, 'name'> | null;
}

export async function POST(request: NextRequest) {
    try {
        const { token } = await request.json();

        if (!token) {
            return NextResponse.json(
                { error: 'Invitation token is required' },
                { status: 400 }
            );
        }

        const supabaseAdmin = createSupabaseAdminClient();

        // Find the invitation
        const { data: invitation, error: inviteError } = await supabaseAdmin
            .from('team_invitations')
            .select('*, teams(name)')
            .eq('token', token)
            .single() as { data: InvitationWithTeam | null; error: unknown };

        if (inviteError || !invitation) {
            return NextResponse.json(
                { error: 'Invalid or expired invitation' },
                { status: 404 }
            );
        }

        // Check if invitation is still valid
        if (invitation.status !== 'pending') {
            return NextResponse.json(
                { error: `This invitation has already been ${invitation.status}` },
                { status: 400 }
            );
        }

        // Check if expired
        if (new Date(invitation.expires_at) < new Date()) {
            // Mark as expired
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (supabaseAdmin as any)
                .from('team_invitations')
                .update({ status: 'expired' })
                .eq('id', invitation.id);

            return NextResponse.json(
                { error: 'This invitation has expired' },
                { status: 400 }
            );
        }

        // Get authenticated user
        const supabase = await createSupabaseServerClient();
        const { data: { user: authUser } } = await supabase.auth.getUser();

        if (!authUser) {
            // User not logged in - return invitation details for signup flow
            return NextResponse.json({
                requiresAuth: true,
                invitation: {
                    email: invitation.email,
                    teamName: invitation.teams?.name || 'Team',
                    role: invitation.role,
                },
            });
        }

        // Check if the authenticated user's email matches the invitation
        if (authUser.email?.toLowerCase() !== invitation.email.toLowerCase()) {
            return NextResponse.json(
                { error: `This invitation was sent to ${invitation.email}. Please sign in with that email.` },
                { status: 403 }
            );
        }

        // Get user profile
        const { data: userProfile, error: profileError } = await supabaseAdmin
            .from('users')
            .select('id, team_id')
            .eq('id', authUser.id)
            .single() as { data: Pick<User, 'id' | 'team_id'> | null; error: unknown };

        if (profileError || !userProfile) {
            return NextResponse.json(
                { error: 'User profile not found' },
                { status: 404 }
            );
        }

        // Check if user is already in a team
        if (userProfile.team_id) {
            if (userProfile.team_id === invitation.team_id) {
                return NextResponse.json(
                    { error: 'You are already a member of this team' },
                    { status: 400 }
                );
            }
            return NextResponse.json(
                { error: 'You are already a member of another team. Leave your current team first.' },
                { status: 400 }
            );
        }

        // Add user to team with the specified role
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: updateError } = await (supabaseAdmin as any)
            .from('users')
            .update({
                team_id: invitation.team_id,
                role: invitation.role,
            })
            .eq('id', authUser.id);

        if (updateError) {
            console.error('Error updating user:', updateError);
            return NextResponse.json(
                { error: 'Failed to join team' },
                { status: 500 }
            );
        }

        // Mark invitation as accepted
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabaseAdmin as any)
            .from('team_invitations')
            .update({
                status: 'accepted',
                accepted_at: new Date().toISOString(),
            })
            .eq('id', invitation.id);

        return NextResponse.json({
            success: true,
            message: `Successfully joined ${invitation.teams?.name || 'the team'}`,
            teamId: invitation.team_id,
            role: invitation.role,
        });

    } catch (error) {
        console.error('Accept invitation error:', error);
        return NextResponse.json(
            { error: 'An unexpected error occurred' },
            { status: 500 }
        );
    }
}

// GET - Validate invitation token and get details
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const token = searchParams.get('token');

        if (!token) {
            return NextResponse.json(
                { error: 'Token is required' },
                { status: 400 }
            );
        }

        const supabaseAdmin = createSupabaseAdminClient();

        // Find the invitation
        const { data: invitation, error } = await supabaseAdmin
            .from('team_invitations')
            .select('id, email, role, status, expires_at, team_id, teams(name)')
            .eq('token', token)
            .single() as { data: InvitationWithTeam | null; error: unknown };

        if (error || !invitation) {
            return NextResponse.json(
                { error: 'Invalid invitation' },
                { status: 404 }
            );
        }

        // Check status
        if (invitation.status !== 'pending') {
            return NextResponse.json(
                { error: `This invitation has been ${invitation.status}` },
                { status: 400 }
            );
        }

        // Check expiry
        if (new Date(invitation.expires_at) < new Date()) {
            return NextResponse.json(
                { error: 'This invitation has expired' },
                { status: 400 }
            );
        }

        return NextResponse.json({
            valid: true,
            invitation: {
                email: invitation.email,
                role: invitation.role,
                teamName: invitation.teams?.name || 'Team',
                teamId: invitation.team_id,
                expiresAt: invitation.expires_at,
            },
        });

    } catch (error) {
        console.error('Validate invitation error:', error);
        return NextResponse.json(
            { error: 'An unexpected error occurred' },
            { status: 500 }
        );
    }
}
