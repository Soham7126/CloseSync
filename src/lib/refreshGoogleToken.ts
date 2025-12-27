import { createClient } from '@supabase/supabase-js';

interface CalendarConnection {
  id: string;
  user_id: string;
  provider: string;
  access_token: string;
  refresh_token: string;
  token_expiry: string;
  calendar_email: string | null;
  connected_at: string;
  last_synced: string | null;
}

interface GoogleTokenRefreshResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
  scope: string;
}

interface GoogleErrorResponse {
  error: string;
  error_description?: string;
}

/**
 * Refreshes the Google OAuth access token for a user
 * 
 * @param userId - The user's UUID
 * @returns Valid access token or throws an error
 */
export async function refreshGoogleToken(userId: string): Promise<string> {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ========================================`);
  console.log(`[${timestamp}] Starting token refresh check`);
  console.log(`[${timestamp}] User ID: ${userId}`);
  console.log(`[${timestamp}] ========================================`);

  // Initialize Supabase client with service role
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Fetch current tokens from database
  console.log(`[${timestamp}] Fetching calendar connection from database...`);
  
  const { data: connection, error: fetchError } = await supabase
    .from('calendar_connections')
    .select('*')
    .eq('user_id', userId)
    .eq('provider', 'google')
    .single();

  if (fetchError || !connection) {
    console.error(`[${timestamp}] ERROR: No calendar connection found`);
    console.error(`[${timestamp}] Fetch error: ${fetchError?.message}`);
    throw new Error('No Google Calendar connection found for this user');
  }

  const calendarConnection = connection as CalendarConnection;
  console.log(`[${timestamp}] ✓ Calendar connection found`);
  console.log(`[${timestamp}] Calendar email: ${calendarConnection.calendar_email}`);
  console.log(`[${timestamp}] Token expiry: ${calendarConnection.token_expiry}`);

  // Check if token is expired (with 5 minute buffer)
  const tokenExpiry = new Date(calendarConnection.token_expiry);
  const now = new Date();
  const bufferMs = 5 * 60 * 1000; // 5 minutes
  const isExpired = tokenExpiry.getTime() - bufferMs < now.getTime();

  console.log(`[${timestamp}] Current time: ${now.toISOString()}`);
  console.log(`[${timestamp}] Token expires: ${tokenExpiry.toISOString()}`);
  console.log(`[${timestamp}] Is expired (with 5min buffer): ${isExpired}`);

  if (!isExpired) {
    console.log(`[${timestamp}] ✓ Token is still valid, returning existing token`);
    console.log(`[${timestamp}] ========================================`);
    return calendarConnection.access_token;
  }

  // Token is expired, refresh it
  console.log(`[${timestamp}] Token is expired or expiring soon, refreshing...`);

  if (!calendarConnection.refresh_token) {
    console.error(`[${timestamp}] ERROR: No refresh token available`);
    console.error(`[${timestamp}] User needs to re-connect Google Calendar`);
    throw new Error('No refresh token available. Please reconnect Google Calendar.');
  }

  // Validate environment variables
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.error(`[${timestamp}] ERROR: Missing Google OAuth credentials`);
    throw new Error('Google OAuth credentials not configured');
  }

  // Refresh the token
  console.log(`[${timestamp}] Calling Google token refresh endpoint...`);
  
  const refreshResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      refresh_token: calendarConnection.refresh_token,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
    }),
  });

  const refreshData = await refreshResponse.json() as GoogleTokenRefreshResponse | GoogleErrorResponse;

  if (!refreshResponse.ok) {
    const errorData = refreshData as GoogleErrorResponse;
    console.error(`[${timestamp}] ========================================`);
    console.error(`[${timestamp}] Token refresh failed`);
    console.error(`[${timestamp}] Status: ${refreshResponse.status}`);
    console.error(`[${timestamp}] Error: ${errorData.error}`);
    console.error(`[${timestamp}] Description: ${errorData.error_description}`);
    console.error(`[${timestamp}] ========================================`);

    // If refresh token is invalid/revoked, clear the connection
    if (errorData.error === 'invalid_grant') {
      console.error(`[${timestamp}] Refresh token is invalid/revoked`);
      console.error(`[${timestamp}] User needs to re-authorize`);
      
      // Optionally delete the invalid connection
      await supabase
        .from('calendar_connections')
        .delete()
        .eq('user_id', userId)
        .eq('provider', 'google');

      throw new Error('Google Calendar access was revoked. Please reconnect.');
    }

    throw new Error(`Token refresh failed: ${errorData.error_description || errorData.error}`);
  }

  const newTokens = refreshData as GoogleTokenRefreshResponse;
  console.log(`[${timestamp}] ✓ Token refresh successful`);
  console.log(`[${timestamp}] New access token: ${newTokens.access_token.substring(0, 20)}...`);
  console.log(`[${timestamp}] Expires in: ${newTokens.expires_in} seconds`);

  // Calculate new expiry
  const newTokenExpiry = new Date(Date.now() + newTokens.expires_in * 1000);
  console.log(`[${timestamp}] New token expiry: ${newTokenExpiry.toISOString()}`);

  // Update database with new token
  console.log(`[${timestamp}] Updating database with new token...`);
  
  const { error: updateError } = await supabase
    .from('calendar_connections')
    .update({
      access_token: newTokens.access_token,
      token_expiry: newTokenExpiry.toISOString(),
    })
    .eq('user_id', userId)
    .eq('provider', 'google');

  if (updateError) {
    console.error(`[${timestamp}] ERROR: Failed to update token in database`);
    console.error(`[${timestamp}] Error: ${updateError.message}`);
    // Still return the new token even if DB update fails
    console.warn(`[${timestamp}] Returning new token anyway, but it won't be persisted`);
  } else {
    console.log(`[${timestamp}] ✓ Database updated with new token`);
  }

  console.log(`[${timestamp}] ========================================`);
  console.log(`[${timestamp}] ✓ Token refresh complete`);
  console.log(`[${timestamp}] ========================================`);

  return newTokens.access_token;
}

/**
 * Check if a user has a valid Google Calendar connection
 */
export async function hasValidGoogleConnection(userId: string): Promise<boolean> {
  const timestamp = new Date().toISOString();
  
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: connection } = await supabase
      .from('calendar_connections')
      .select('refresh_token')
      .eq('user_id', userId)
      .eq('provider', 'google')
      .single();

    const hasConnection = !!connection?.refresh_token;
    console.log(`[${timestamp}] User ${userId} has valid Google connection: ${hasConnection}`);
    return hasConnection;
  } catch {
    console.log(`[${timestamp}] Error checking Google connection for user ${userId}`);
    return false;
  }
}
