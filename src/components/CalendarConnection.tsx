'use client';

import { useState, useEffect, useCallback } from 'react';
import { createBrowserClient } from '@supabase/ssr';

interface CalendarConnectionData {
  id: string;
  user_id: string;
  provider: string;
  calendar_email: string | null;
  connected_at: string;
  last_synced: string | null;
}

interface CalendarConnectionProps {
  userId: string;
}

export default function CalendarConnection({ userId }: CalendarConnectionProps) {
  const [connection, setConnection] = useState<CalendarConnectionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // Fetch connection status
  const fetchConnection = useCallback(async () => {
    console.log('[CalendarConnection] Fetching calendar connection...');
    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from('calendar_connections')
        .select('*')
        .eq('user_id', userId)
        .eq('provider', 'google')
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 = no rows
        console.error('[CalendarConnection] Fetch error:', fetchError);
        throw new Error(fetchError.message);
      }

      console.log('[CalendarConnection] Connection found:', !!data);
      setConnection(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch connection';
      console.error('[CalendarConnection] Error:', errorMessage);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [supabase, userId]);

  useEffect(() => {
    fetchConnection();

    // Check for URL params (success/error from OAuth callback)
    const urlParams = new URLSearchParams(window.location.search);
    const success = urlParams.get('success');
    const errorParam = urlParams.get('error');
    const message = urlParams.get('message');

    if (success === 'calendar_connected') {
      setSuccessMessage('Google Calendar connected successfully!');
      // Refresh connection data
      fetchConnection();
      // Clear URL params
      window.history.replaceState({}, '', window.location.pathname);
    } else if (errorParam) {
      setError(`Connection failed: ${message || errorParam}`);
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [fetchConnection]);

  // Connect to Google Calendar
  const handleConnect = () => {
    console.log('[CalendarConnection] Initiating Google Calendar connection...');
    setError(null);
    // Redirect to OAuth initiation endpoint
    window.location.href = '/api/auth/google';
  };

  // Manual sync
  const handleSync = async () => {
    console.log('[CalendarConnection] Starting manual sync...');
    setSyncing(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const response = await fetch('/api/calendar/sync-now', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Sync failed');
      }

      console.log('[CalendarConnection] Sync completed:', data);
      setSuccessMessage(`Synced ${data.eventsCount || 0} calendar events!`);
      
      // Refresh connection to get updated last_synced
      await fetchConnection();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Sync failed';
      console.error('[CalendarConnection] Sync error:', errorMessage);
      setError(errorMessage);
    } finally {
      setSyncing(false);
    }
  };

  // Disconnect calendar
  const handleDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect Google Calendar?')) {
      return;
    }

    console.log('[CalendarConnection] Disconnecting Google Calendar...');
    setDisconnecting(true);
    setError(null);

    try {
      const response = await fetch('/api/calendar/disconnect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Disconnect failed');
      }

      console.log('[CalendarConnection] Disconnect successful');
      setConnection(null);
      setSuccessMessage('Google Calendar disconnected');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Disconnect failed';
      console.error('[CalendarConnection] Disconnect error:', errorMessage);
      setError(errorMessage);
    } finally {
      setDisconnecting(false);
    }
  };

  // Format timestamp
  const formatTimestamp = (timestamp: string | null) => {
    if (!timestamp) return 'Never';
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  // Loading state
  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold mb-4">Google Calendar</h3>
        <div className="flex items-center gap-2 text-gray-500">
          <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span>Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M19 4H5C3.89543 4 3 4.89543 3 6V20C3 21.1046 3.89543 22 5 22H19C20.1046 22 21 21.1046 21 20V6C21 4.89543 20.1046 4 19 4Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M16 2V6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M8 2V6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M3 10H21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        Google Calendar
      </h3>

      {/* Error message */}
      {error && (
        <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-md text-sm">
          <div className="flex items-start gap-2">
            <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{error}</span>
          </div>
        </div>
      )}

      {/* Success message */}
      {successMessage && (
        <div className="mb-4 p-3 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-md text-sm">
          <div className="flex items-start gap-2">
            <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{successMessage}</span>
          </div>
        </div>
      )}

      {connection ? (
        // Connected state
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
            </svg>
            <span className="font-medium">Connected to {connection.calendar_email}</span>
          </div>

          <div className="text-sm text-gray-500 dark:text-gray-400 space-y-1">
            <p>Connected: {formatTimestamp(connection.connected_at)}</p>
            <p>Last synced: {formatTimestamp(connection.last_synced)}</p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleSync}
              disabled={syncing}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {syncing ? (
                <>
                  <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>Syncing...</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  <span>Sync Now</span>
                </>
              )}
            </button>

            <button
              onClick={handleDisconnect}
              disabled={disconnecting}
              className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {disconnecting ? 'Disconnecting...' : 'Disconnect'}
            </button>
          </div>
        </div>
      ) : (
        // Not connected state
        <div className="space-y-4">
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            Connect your Google Calendar to automatically sync your busy times with your team.
          </p>

          <button
            onClick={handleConnect}
            className="w-full px-4 py-3 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 flex items-center justify-center gap-3 transition-colors"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            <span className="font-medium">Connect Google Calendar</span>
          </button>
        </div>
      )}
    </div>
  );
}
