import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

// Note: With Resend's free tier using onboarding@resend.dev,
// you can only send to the email address you signed up with.
// To send to any email, you need to verify your own domain in Resend.

interface SendInviteEmailParams {
    to: string;
    inviterName: string;
    teamName: string;
    role: string;
    inviteLink: string;
}

export async function sendInviteEmail({
    to,
    inviterName,
    teamName,
    role,
    inviteLink,
}: SendInviteEmailParams): Promise<{ success: boolean; error?: string }> {
    try {
        console.log(`Sending invite email to: ${to}`);

        const { data, error } = await resend.emails.send({
            from: 'CloseSync <onboarding@resend.dev>',
            to: [to],
            subject: `You're invited to join ${teamName} on CloseSync`,
            html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="utf-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>Team Invitation</title>
                </head>
                <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
                    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
                        <tr>
                            <td align="center">
                                <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                                    <!-- Header -->
                                    <tr>
                                        <td style="background: linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%); padding: 40px 40px 30px; text-align: center;">
                                            <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700;">
                                                You're Invited!
                                            </h1>
                                        </td>
                                    </tr>

                                    <!-- Content -->
                                    <tr>
                                        <td style="padding: 40px;">
                                            <p style="margin: 0 0 20px; color: #374151; font-size: 16px; line-height: 1.6;">
                                                Hi there,
                                            </p>
                                            <p style="margin: 0 0 20px; color: #374151; font-size: 16px; line-height: 1.6;">
                                                <strong>${inviterName}</strong> has invited you to join <strong>${teamName}</strong> on CloseSync as a <strong style="color: #6366F1;">${role}</strong>.
                                            </p>
                                            <p style="margin: 0 0 30px; color: #374151; font-size: 16px; line-height: 1.6;">
                                                CloseSync helps teams stay in sync with real-time availability updates and smart meeting scheduling.
                                            </p>

                                            <!-- CTA Button -->
                                            <table width="100%" cellpadding="0" cellspacing="0">
                                                <tr>
                                                    <td align="center" style="padding: 20px 0;">
                                                        <a href="${inviteLink}" style="display: inline-block; background: linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 12px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 14px rgba(99, 102, 241, 0.4);">
                                                            Accept Invitation
                                                        </a>
                                                    </td>
                                                </tr>
                                            </table>

                                            <!-- Link fallback -->
                                            <p style="margin: 30px 0 0; color: #6B7280; font-size: 14px; line-height: 1.6;">
                                                Or copy and paste this link into your browser:
                                            </p>
                                            <p style="margin: 10px 0 0; word-break: break-all;">
                                                <a href="${inviteLink}" style="color: #6366F1; text-decoration: none; font-size: 14px;">${inviteLink}</a>
                                            </p>

                                            <!-- Expiry notice -->
                                            <div style="margin-top: 30px; padding: 16px; background-color: #FEF3C7; border-radius: 8px; border-left: 4px solid #F59E0B;">
                                                <p style="margin: 0; color: #92400E; font-size: 14px;">
                                                    <strong>Note:</strong> This invitation will expire in 7 days.
                                                </p>
                                            </div>
                                        </td>
                                    </tr>

                                    <!-- Footer -->
                                    <tr>
                                        <td style="padding: 30px 40px; background-color: #F9FAFB; border-top: 1px solid #E5E7EB;">
                                            <p style="margin: 0; color: #6B7280; font-size: 14px; text-align: center;">
                                                If you didn't expect this invitation, you can safely ignore this email.
                                            </p>
                                            <p style="margin: 15px 0 0; color: #9CA3AF; font-size: 12px; text-align: center;">
                                                © ${new Date().getFullYear()} CloseSync. All rights reserved.
                                            </p>
                                        </td>
                                    </tr>
                                </table>
                            </td>
                        </tr>
                    </table>
                </body>
                </html>
            `,
        });

        if (error) {
            console.error('Failed to send invite email:', error);
            return { success: false, error: error.message };
        }

        console.log('Email sent successfully:', data);
        return { success: true };
    } catch (error) {
        console.error('Error sending invite email:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to send email',
        };
    }
}
