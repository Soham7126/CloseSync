import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

// Generate a random state string for CSRF protection
function generateState(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

export async function GET(request: NextRequest) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ========================================`);
  console.log(`[${timestamp}] OAuth flow starting...`);
  console.log(`[${timestamp}] ========================================`);

  try {
    // Validate environment variables
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI;

    if (!clientId) {
      console.error(`[${timestamp}] ERROR: GOOGLE_CLIENT_ID is not set`);
      return NextResponse.redirect(
        new URL('/dashboard?error=missing_google_client_id', request.url)
      );
    }

    if (!redirectUri) {
      console.error(`[${timestamp}] ERROR: GOOGLE_REDIRECT_URI is not set`);
      return NextResponse.redirect(
        new URL('/dashboard?error=missing_google_redirect_uri', request.url)
      );
    }

    console.log(`[${timestamp}] Client ID: ${clientId.substring(0, 20)}...`);
    console.log(`[${timestamp}] Redirect URI: ${redirectUri}`);

    // Verify user is authenticated
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
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
              // Ignore errors in Server Components
            }
          },
        },
      }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error(`[${timestamp}] ERROR: User not authenticated`);
      console.error(`[${timestamp}] Auth error:`, authError?.message);
      return NextResponse.redirect(
        new URL('/login?error=not_authenticated', request.url)
      );
    }

    console.log(`[${timestamp}] User authenticated: ${user.id}`);

    // Generate CSRF state token
    const state = generateState();
    console.log(`[${timestamp}] Generated state token: ${state.substring(0, 10)}...`);

    // Define Google OAuth scopes
    const scopes = [
      'https://www.googleapis.com/auth/calendar.readonly',
      'https://www.googleapis.com/auth/calendar.events',
      'https://www.googleapis.com/auth/userinfo.email'
    ];

    // Build authorization URL with EXACT parameters
    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', scopes.join(' '));
    authUrl.searchParams.set('access_type', 'offline'); // CRITICAL: Required for refresh token
    authUrl.searchParams.set('prompt', 'consent'); // Forces refresh token to be returned
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('include_granted_scopes', 'true');

    console.log(`[${timestamp}] Building authorization URL...`);
    console.log(`[${timestamp}] Scopes: ${scopes.join(' ')}`);
    console.log(`[${timestamp}] Access type: offline (for refresh token)`);
    console.log(`[${timestamp}] Prompt: consent (forces refresh token)`);
    console.log(`[${timestamp}] Authorization URL: ${authUrl.toString()}`);

    // Store state in cookie for CSRF verification
    const response = NextResponse.redirect(authUrl.toString());
    
    // Set state cookie (expires in 10 minutes)
    response.cookies.set('google_oauth_state', state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 600, // 10 minutes
      path: '/',
    });

    // Store user ID for callback (encrypted in production)
    response.cookies.set('google_oauth_user_id', user.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 600,
      path: '/',
    });

    console.log(`[${timestamp}] State cookie set`);
    console.log(`[${timestamp}] Redirecting to Google OAuth...`);
    console.log(`[${timestamp}] ========================================`);

    return response;

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : '';
    
    console.error(`[${timestamp}] ========================================`);
    console.error(`[${timestamp}] FATAL ERROR in OAuth initiation`);
    console.error(`[${timestamp}] Error: ${errorMessage}`);
    console.error(`[${timestamp}] Stack trace: ${errorStack}`);
    console.error(`[${timestamp}] ========================================`);

    return NextResponse.redirect(
      new URL(`/dashboard?error=oauth_init_failed&message=${encodeURIComponent(errorMessage)}`, request.url)
    );
  }
}
