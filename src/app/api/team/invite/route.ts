import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient, createSupabaseServerClient } from '@/lib/supabase';
import type { User, Team, TeamInvitation } from '@/lib/supabase';
import { sendInviteEmail } from '@/lib/email';

// Generate a secure random token
function generateToken(length: number = 64): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    const randomValues = new Uint8Array(length);
    crypto.getRandomValues(randomValues);
    for (let i = 0; i < length; i++) {
        result += chars[randomValues[i] % chars.length];
    }
    return result;
}

export async function POST(request: NextRequest) {
    try {
        const { invitations } = await request.json();

        // Validate input
        if (!invitations || !Array.isArray(invitations) || invitations.length === 0) {
            return NextResponse.json(
                { error: 'At least one invitation is required' },
                { status: 400 }
            );
        }

        // Validate each invitation
        for (const inv of invitations) {
            if (!inv.email || !inv.email.includes('@')) {
                return NextResponse.json(
                    { error: `Invalid email: ${inv.email}` },
                    { status: 400 }
                );
            }
            if (inv.role && !['admin', 'member'].includes(inv.role)) {
                return NextResponse.json(
                    { error: `Invalid role: ${inv.role}` },
                    { status: 400 }
                );
            }
        }

        // Get authenticated user
        const supabase = await createSupabaseServerClient();
        const { data: { user: authUser } } = await supabase.auth.getUser();

        if (!authUser) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        // Get user profile with role and team
        const supabaseAdmin = createSupabaseAdminClient();
        const { data: userProfile, error: profileError } = await supabaseAdmin
            .from('users')
            .select('id, team_id, role')
            .eq('id', authUser.id)
            .single() as { data: Pick<User, 'id' | 'team_id' | 'role'> | null; error: unknown };

        if (profileError || !userProfile) {
            return NextResponse.json(
                { error: 'User profile not found' },
                { status: 404 }
            );
        }

        // Check if user is super_admin
        if (userProfile.role !== 'super_admin') {
            return NextResponse.json(
                { error: 'Only super admins can send invitations' },
                { status: 403 }
            );
        }

        if (!userProfile.team_id) {
            return NextResponse.json(
                { error: 'You must be part of a team to send invitations' },
                { status: 400 }
            );
        }

        // Get team details
        const { data: team, error: teamError } = await supabaseAdmin
            .from('teams')
            .select('id, name')
            .eq('id', userProfile.team_id)
            .single() as { data: Pick<Team, 'id' | 'name'> | null; error: unknown };

        if (teamError || !team) {
            return NextResponse.json(
                { error: 'Team not found' },
                { status: 404 }
            );
        }

        // Check for existing pending invitations or team members
        const emails = invitations.map((inv: { email: string }) => inv.email.toLowerCase());

        // Check if any emails are already team members
        const { data: existingMembers } = await supabaseAdmin
            .from('users')
            .select('email')
            .eq('team_id', team.id)
            .in('email', emails) as { data: { email: string }[] | null; error: unknown };

        if (existingMembers && existingMembers.length > 0) {
            const existingEmails = existingMembers.map(m => m.email);
            return NextResponse.json(
                { error: `These users are already team members: ${existingEmails.join(', ')}` },
                { status: 400 }
            );
        }

        // Check for pending invitations
        const { data: pendingInvitations } = await supabaseAdmin
            .from('team_invitations')
            .select('email')
            .eq('team_id', team.id)
            .eq('status', 'pending')
            .in('email', emails) as { data: { email: string }[] | null; error: unknown };

        if (pendingInvitations && pendingInvitations.length > 0) {
            const pendingEmails = pendingInvitations.map(p => p.email);
            return NextResponse.json(
                { error: `Pending invitations already exist for: ${pendingEmails.join(', ')}` },
                { status: 400 }
            );
        }

        // Create invitations
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiry

        const invitationsToCreate = invitations.map((inv: { email: string; role?: string }) => ({
            team_id: team.id,
            email: inv.email.toLowerCase(),
            role: inv.role || 'member',
            token: generateToken(),
            invited_by: userProfile.id,
            status: 'pending',
            expires_at: expiresAt.toISOString(),
        }));

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: createdInvitations, error: createError } = await (supabaseAdmin as any)
            .from('team_invitations')
            .insert(invitationsToCreate)
            .select() as { data: TeamInvitation[] | null; error: unknown };

        if (createError) {
            console.error('Error creating invitations:', createError);
            return NextResponse.json(
                { error: 'Failed to create invitations' },
                { status: 500 }
            );
        }

        // Generate invite links and send emails
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

        // Get inviter's name for the email
        const { data: inviterProfile } = await supabaseAdmin
            .from('users')
            .select('name')
            .eq('id', userProfile.id)
            .single() as { data: { name: string } | null; error: unknown };

        const inviterName = inviterProfile?.name || 'A team member';

        const inviteLinks: Array<{ email: string; link: string; role: string; emailSent: boolean }> = [];
        const emailErrors: string[] = [];

        // Send emails for each invitation
        for (const inv of createdInvitations || []) {
            const inviteLink = `${appUrl}/invite/${inv.token}`;
            const roleDisplay = inv.role === 'admin' ? 'Admin' : 'Member';

            // Try to send email
            const emailResult = await sendInviteEmail({
                to: inv.email,
                inviterName,
                teamName: team.name,
                role: roleDisplay,
                inviteLink,
            });

            inviteLinks.push({
                email: inv.email,
                link: inviteLink,
                role: inv.role,
                emailSent: emailResult.success,
            });

            if (!emailResult.success) {
                emailErrors.push(`${inv.email}: ${emailResult.error}`);
            }
        }

        const allEmailsSent = emailErrors.length === 0;

        return NextResponse.json({
            success: true,
            message: allEmailsSent
                ? `${createdInvitations?.length} invitation(s) sent successfully`
                : `${createdInvitations?.length} invitation(s) created. Some emails could not be sent.`,
            invitations: inviteLinks,
            teamName: team.name,
            emailErrors: emailErrors.length > 0 ? emailErrors : undefined,
        });

    } catch (error) {
        console.error('Invite error:', error);
        return NextResponse.json(
            { error: 'An unexpected error occurred' },
            { status: 500 }
        );
    }
}

// GET - Fetch pending invitations for the team
export async function GET() {
    try {
        const supabase = await createSupabaseServerClient();
        const { data: { user: authUser } } = await supabase.auth.getUser();

        if (!authUser) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        const supabaseAdmin = createSupabaseAdminClient();

        // Get user's team
        const { data: userProfile } = await supabaseAdmin
            .from('users')
            .select('team_id, role')
            .eq('id', authUser.id)
            .single() as { data: Pick<User, 'team_id' | 'role'> | null; error: unknown };

        if (!userProfile?.team_id) {
            return NextResponse.json(
                { error: 'Not part of a team' },
                { status: 400 }
            );
        }

        // Only admins can view invitations
        if (!['super_admin', 'admin'].includes(userProfile.role || '')) {
            return NextResponse.json(
                { error: 'Insufficient permissions' },
                { status: 403 }
            );
        }

        // Fetch pending invitations
        const { data: invitations, error } = await supabaseAdmin
            .from('team_invitations')
            .select('*')
            .eq('team_id', userProfile.team_id)
            .eq('status', 'pending')
            .order('created_at', { ascending: false }) as { data: TeamInvitation[] | null; error: unknown };

        if (error) {
            console.error('Error fetching invitations:', error);
            return NextResponse.json(
                { error: 'Failed to fetch invitations' },
                { status: 500 }
            );
        }

        return NextResponse.json({ invitations });

    } catch (error) {
        console.error('Get invitations error:', error);
        return NextResponse.json(
            { error: 'An unexpected error occurred' },
            { status: 500 }
        );
    }
}

// DELETE - Cancel an invitation
export async function DELETE(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const invitationId = searchParams.get('id');

        if (!invitationId) {
            return NextResponse.json(
                { error: 'Invitation ID is required' },
                { status: 400 }
            );
        }

        const supabase = await createSupabaseServerClient();
        const { data: { user: authUser } } = await supabase.auth.getUser();

        if (!authUser) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        const supabaseAdmin = createSupabaseAdminClient();

        // Get user's team and role
        const { data: userProfile } = await supabaseAdmin
            .from('users')
            .select('team_id, role')
            .eq('id', authUser.id)
            .single() as { data: Pick<User, 'team_id' | 'role'> | null; error: unknown };

        if (userProfile?.role !== 'super_admin') {
            return NextResponse.json(
                { error: 'Only super admins can cancel invitations' },
                { status: 403 }
            );
        }

        // Cancel the invitation
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabaseAdmin as any)
            .from('team_invitations')
            .update({ status: 'cancelled' })
            .eq('id', invitationId)
            .eq('team_id', userProfile.team_id!);

        if (error) {
            console.error('Error cancelling invitation:', error);
            return NextResponse.json(
                { error: 'Failed to cancel invitation' },
                { status: 500 }
            );
        }

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error('Cancel invitation error:', error);
        return NextResponse.json(
            { error: 'An unexpected error occurred' },
            { status: 500 }
        );
    }
}
