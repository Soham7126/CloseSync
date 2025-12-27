import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';

// Types for Google OAuth response
interface GoogleTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  scope: string;
  id_token?: string;
}

interface GoogleUserInfo {
  email: string;
  email_verified: boolean;
  name?: string;
  picture?: string;
}

interface GoogleErrorResponse {
  error: string;
  error_description?: string;
}

export async function GET(request: NextRequest) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ========================================`);
  console.log(`[${timestamp}] OAuth callback received`);
  console.log(`[${timestamp}] ========================================`);

  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');

  // Handle OAuth errors from Google
  if (error) {
    console.error(`[${timestamp}] Google OAuth Error: ${error}`);
    console.error(`[${timestamp}] Error Description: ${errorDescription}`);
    return NextResponse.redirect(
      new URL(`/dashboard?error=google_oauth_error&message=${encodeURIComponent(errorDescription || error)}`, request.url)
    );
  }

  // Validate authorization code
  if (!code) {
    console.error(`[${timestamp}] ERROR: No authorization code received`);
    return NextResponse.redirect(
      new URL('/dashboard?error=missing_authorization_code', request.url)
    );
  }

  console.log(`[${timestamp}] Received authorization code: ${code.substring(0, 20)}...`);

  // Validate state parameter
  if (!state) {
    console.error(`[${timestamp}] ERROR: No state parameter received`);
    return NextResponse.redirect(
      new URL('/dashboard?error=missing_state_parameter', request.url)
    );
  }

  try {
    // Get stored state and user ID from cookies
    const cookieStore = await cookies();
    const storedState = cookieStore.get('google_oauth_state')?.value;
    const userId = cookieStore.get('google_oauth_user_id')?.value;

    console.log(`[${timestamp}] Received state: ${state.substring(0, 10)}...`);
    console.log(`[${timestamp}] Stored state: ${storedState?.substring(0, 10)}...`);

    // CSRF verification
    if (!storedState || storedState !== state) {
      console.error(`[${timestamp}] ERROR: State mismatch - possible CSRF attack`);
      console.error(`[${timestamp}] Expected: ${storedState}`);
      console.error(`[${timestamp}] Received: ${state}`);
      return NextResponse.redirect(
        new URL('/dashboard?error=state_mismatch', request.url)
      );
    }

    console.log(`[${timestamp}] ✓ State verified - CSRF check passed`);

    if (!userId) {
      console.error(`[${timestamp}] ERROR: No user ID in cookie`);
      return NextResponse.redirect(
        new URL('/login?error=session_expired', request.url)
      );
    }

    console.log(`[${timestamp}] User ID: ${userId}`);

    // Validate environment variables
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI;

    if (!clientId || !clientSecret || !redirectUri) {
      console.error(`[${timestamp}] ERROR: Missing Google OAuth credentials`);
      console.error(`[${timestamp}] Client ID: ${clientId ? 'SET' : 'MISSING'}`);
      console.error(`[${timestamp}] Client Secret: ${clientSecret ? 'SET' : 'MISSING'}`);
      console.error(`[${timestamp}] Redirect URI: ${redirectUri ? 'SET' : 'MISSING'}`);
      return NextResponse.redirect(
        new URL('/dashboard?error=missing_oauth_credentials', request.url)
      );
    }

    // Exchange authorization code for tokens
    console.log(`[${timestamp}] Exchanging code for tokens...`);
    console.log(`[${timestamp}] Token endpoint: https://oauth2.googleapis.com/token`);
    console.log(`[${timestamp}] Redirect URI: ${redirectUri}`);

    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    const tokenData = await tokenResponse.json() as GoogleTokenResponse | GoogleErrorResponse;

    if (!tokenResponse.ok) {
      const errorData = tokenData as GoogleErrorResponse;
      console.error(`[${timestamp}] ========================================`);
      console.error(`[${timestamp}] Token exchange failed`);
      console.error(`[${timestamp}] Status: ${tokenResponse.status}`);
      console.error(`[${timestamp}] Error: ${errorData.error}`);
      console.error(`[${timestamp}] Description: ${errorData.error_description}`);
      console.error(`[${timestamp}] ========================================`);
      return NextResponse.redirect(
        new URL(`/dashboard?error=token_exchange_failed&message=${encodeURIComponent(errorData.error_description || errorData.error)}`, request.url)
      );
    }

    const tokens = tokenData as GoogleTokenResponse;
    console.log(`[${timestamp}] ✓ Token exchange successful`);
    console.log(`[${timestamp}] Access token received: ${tokens.access_token.substring(0, 20)}... (length: ${tokens.access_token.length})`);
    console.log(`[${timestamp}] Refresh token received: ${tokens.refresh_token ? 'YES' : 'NO - THIS IS A PROBLEM!'}`);
    console.log(`[${timestamp}] Token expires in: ${tokens.expires_in} seconds`);
    console.log(`[${timestamp}] Token type: ${tokens.token_type}`);
    console.log(`[${timestamp}] Scopes granted: ${tokens.scope}`);

    if (!tokens.refresh_token) {
      console.warn(`[${timestamp}] ========================================`);
      console.warn(`[${timestamp}] WARNING: No refresh token received!`);
      console.warn(`[${timestamp}] This usually means:`);
      console.warn(`[${timestamp}] 1. User already granted access before`);
      console.warn(`[${timestamp}] 2. access_type=offline was not set`);
      console.warn(`[${timestamp}] 3. prompt=consent was not set`);
      console.warn(`[${timestamp}] The user may need to revoke access at`);
      console.warn(`[${timestamp}] https://myaccount.google.com/permissions`);
      console.warn(`[${timestamp}] ========================================`);
    }

    // Calculate token expiry
    const tokenExpiry = new Date(Date.now() + tokens.expires_in * 1000);
    console.log(`[${timestamp}] Token expiry: ${tokenExpiry.toISOString()}`);

    // Fetch user's Google email
    console.log(`[${timestamp}] Fetching Google user info...`);
    
    const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        'Authorization': `Bearer ${tokens.access_token}`,
      },
    });

    let calendarEmail = '';
    
    if (userInfoResponse.ok) {
      const userInfo = await userInfoResponse.json() as GoogleUserInfo;
      calendarEmail = userInfo.email;
      console.log(`[${timestamp}] ✓ Google user info fetched`);
      console.log(`[${timestamp}] Calendar email: ${calendarEmail}`);
    } else {
      console.warn(`[${timestamp}] Could not fetch user info: ${userInfoResponse.status}`);
    }

    // Save to database using service role
    console.log(`[${timestamp}] Saving calendar connection to database...`);
    
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const connectionData = {
      user_id: userId,
      provider: 'google',
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token || '',
      token_expiry: tokenExpiry.toISOString(),
      calendar_email: calendarEmail,
      connected_at: new Date().toISOString(),
      last_synced: null,
    };

    console.log(`[${timestamp}] Connection data prepared:`);
    console.log(`[${timestamp}]   - User ID: ${userId}`);
    console.log(`[${timestamp}]   - Provider: google`);
    console.log(`[${timestamp}]   - Access token length: ${tokens.access_token.length}`);
    console.log(`[${timestamp}]   - Has refresh token: ${!!tokens.refresh_token}`);
    console.log(`[${timestamp}]   - Token expiry: ${tokenExpiry.toISOString()}`);
    console.log(`[${timestamp}]   - Calendar email: ${calendarEmail}`);

    // Upsert - update if exists, insert if not
    const { data: savedConnection, error: dbError } = await supabaseAdmin
      .from('calendar_connections')
      .upsert(connectionData, {
        onConflict: 'user_id,provider',
      })
      .select()
      .single();

    if (dbError) {
      console.error(`[${timestamp}] ========================================`);
      console.error(`[${timestamp}] Database save failed`);
      console.error(`[${timestamp}] Error code: ${dbError.code}`);
      console.error(`[${timestamp}] Error message: ${dbError.message}`);
      console.error(`[${timestamp}] Error details: ${JSON.stringify(dbError.details)}`);
      console.error(`[${timestamp}] ========================================`);
      return NextResponse.redirect(
        new URL(`/dashboard?error=database_save_failed&message=${encodeURIComponent(dbError.message)}`, request.url)
      );
    }

    console.log(`[${timestamp}] ✓ Calendar connection saved to database`);
    console.log(`[${timestamp}] Connection ID: ${savedConnection?.id}`);

    // Clear OAuth cookies
    const response = NextResponse.redirect(
      new URL('/dashboard?success=calendar_connected', request.url)
    );

    response.cookies.delete('google_oauth_state');
    response.cookies.delete('google_oauth_user_id');

    console.log(`[${timestamp}] ========================================`);
    console.log(`[${timestamp}] ✓ SUCCESS: Google Calendar connected!`);
    console.log(`[${timestamp}] User: ${userId}`);
    console.log(`[${timestamp}] Email: ${calendarEmail}`);
    console.log(`[${timestamp}] Redirecting to dashboard...`);
    console.log(`[${timestamp}] ========================================`);

    return response;

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : '';
    
    console.error(`[${timestamp}] ========================================`);
    console.error(`[${timestamp}] FATAL ERROR in OAuth callback`);
    console.error(`[${timestamp}] Error: ${errorMessage}`);
    console.error(`[${timestamp}] Stack trace:`);
    console.error(errorStack);
    console.error(`[${timestamp}] ========================================`);

    return NextResponse.redirect(
      new URL(`/dashboard?error=callback_failed&message=${encodeURIComponent(errorMessage)}`, request.url)
    );
  }
}
