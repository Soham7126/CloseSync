import { createSupabaseBrowserClient } from './supabase';
import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import type { UserStatus } from './supabase';

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

export interface RealtimeCallbacks {
    onStatusChange: (payload: RealtimePostgresChangesPayload<UserStatus>) => void;
    onConnectionChange?: (status: ConnectionStatus) => void;
}

/**
 * Subscribe to real-time updates for user_status table
 * Returns an unsubscribe function
 */
export function subscribeToTeamStatuses(
    teamUserIds: string[],
    callbacks: RealtimeCallbacks
): { channel: RealtimeChannel; unsubscribe: () => void } {
    const supabase = createSupabaseBrowserClient();

    // Create a unique channel name
    const channelName = `team-status-${Date.now()}`;

    const channel = supabase
        .channel(channelName, {
            config: {
                presence: { key: 'user_id' },
            },
        })
        .on(
            'postgres_changes',
            {
                event: '*', // Listen to INSERT, UPDATE, DELETE
                schema: 'public',
                table: 'user_status',
                filter: teamUserIds.length > 0
                    ? `user_id=in.(${teamUserIds.join(',')})`
                    : undefined,
            },
            (payload) => {
                console.log('Realtime status update:', payload);
                callbacks.onStatusChange(payload as RealtimePostgresChangesPayload<UserStatus>);
            }
        )
        .subscribe((status) => {
            console.log('Realtime connection status:', status);

            if (callbacks.onConnectionChange) {
                switch (status) {
                    case 'SUBSCRIBED':
                        callbacks.onConnectionChange('connected');
                        break;
                    case 'CHANNEL_ERROR':
                        callbacks.onConnectionChange('error');
                        break;
                    case 'TIMED_OUT':
                        callbacks.onConnectionChange('disconnected');
                        break;
                    case 'CLOSED':
                        callbacks.onConnectionChange('disconnected');
                        break;
                    default:
                        callbacks.onConnectionChange('connecting');
                }
            }
        });

    const unsubscribe = () => {
        supabase.removeChannel(channel);
    };

    return { channel, unsubscribe };
}

/**
 * Reconnect to real-time channel after disconnect
 */
export function reconnectChannel(channel: RealtimeChannel): Promise<boolean> {
    return new Promise((resolve) => {
        channel.subscribe((status) => {
            resolve(status === 'SUBSCRIBED');
        });
    });
}
