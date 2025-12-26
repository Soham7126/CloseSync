'use client';

import { useState, useCallback } from 'react';
import { saveStatus, fetchTeamStatuses, ParsedStatusData } from '@/lib/saveStatus';
import { useAuth } from '@/components/AuthProvider';
import type { TeamMemberStatus, UserStatus } from '@/lib/supabase';

interface Toast {
    id: string;
    type: 'success' | 'error';
    message: string;
}

export type SaveState = 'idle' | 'saving' | 'success' | 'error';

interface UseSaveStatusReturn {
    save: (data: ParsedStatusData) => Promise<boolean>;
    saveState: SaveState;
    isSaving: boolean;
    teamStatuses: TeamMemberStatus[];
    isLoadingTeam: boolean;
    refetchTeam: () => Promise<void>;
    toasts: Toast[];
    dismissToast: (id: string) => void;
    // For optimistic updates
    optimisticStatus: UserStatus | null;
    clearOptimisticStatus: () => void;
}

export function useSaveStatus(): UseSaveStatusReturn {
    const { user, team } = useAuth();
    const [saveState, setSaveState] = useState<SaveState>('idle');
    const [teamStatuses, setTeamStatuses] = useState<TeamMemberStatus[]>([]);
    const [isLoadingTeam, setIsLoadingTeam] = useState(false);
    const [toasts, setToasts] = useState<Toast[]>([]);
    const [optimisticStatus, setOptimisticStatus] = useState<UserStatus | null>(null);

    // Add a toast notification
    const addToast = useCallback((type: 'success' | 'error', message: string) => {
        const id = `toast-${Date.now()}`;
        setToasts(prev => [...prev, { id, type, message }]);

        // Auto-dismiss after 4 seconds
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
        }, 4000);
    }, []);

    // Dismiss a toast
    const dismissToast = useCallback((id: string) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    // Clear optimistic status
    const clearOptimisticStatus = useCallback(() => {
        setOptimisticStatus(null);
    }, []);

    // Fetch team statuses
    const refetchTeam = useCallback(async () => {
        if (!team?.id) return;

        setIsLoadingTeam(true);
        try {
            const result = await fetchTeamStatuses(team.id);
            if (result.success && result.data) {
                setTeamStatuses(result.data);
            }
        } catch (error) {
            console.error('Failed to fetch team statuses:', error);
        } finally {
            setIsLoadingTeam(false);
        }
    }, [team?.id]);

    // Save status with optimistic update
    const save = useCallback(async (data: ParsedStatusData): Promise<boolean> => {
        if (!user?.id) {
            addToast('error', 'You must be logged in to save status');
            return false;
        }

        // Create optimistic status immediately
        const optimistic: UserStatus = {
            id: 'optimistic-' + Date.now(),
            user_id: user.id,
            tasks: data.tasks,
            busy_blocks: data.busy_blocks,
            free_after: data.free_after,
            free_until: data.free_until,
            blockers: data.blockers,
            status_color: data.blockers.length > 0 ? 'red' : data.busy_blocks.length > 0 ? 'yellow' : 'green',
            raw_transcript: data.raw_transcript,
            confidence_score: data.confidence_score ?? 1.0,
            last_updated: new Date().toISOString(),
        };

        // Step 1: Immediately show optimistic update
        setOptimisticStatus(optimistic);
        setSaveState('saving');

        try {
            // Step 2: Save to database
            const result = await saveStatus(user.id, data);

            if (result.success) {
                // Step 3: Show success state briefly
                setSaveState('success');
                addToast('success', 'Status updated successfully!');

                // Clear success state after brief delay
                setTimeout(() => {
                    setSaveState('idle');
                    setOptimisticStatus(null);
                }, 1500);

                // Refetch team statuses after successful save
                if (team?.id) {
                    await refetchTeam();
                }

                return true;
            } else {
                // Step 4: On failure, revert optimistic update
                setSaveState('error');
                setOptimisticStatus(null);
                addToast('error', result.error || 'Failed to save status');

                // Reset to idle after showing error
                setTimeout(() => {
                    setSaveState('idle');
                }, 2000);

                return false;
            }
        } catch (error) {
            // Handle unexpected errors
            console.error('Save status error:', error);
            setSaveState('error');
            setOptimisticStatus(null);
            addToast('error', 'An unexpected error occurred');

            setTimeout(() => {
                setSaveState('idle');
            }, 2000);

            return false;
        }
    }, [user?.id, team?.id, addToast, refetchTeam]);

    return {
        save,
        saveState,
        isSaving: saveState === 'saving',
        teamStatuses,
        isLoadingTeam,
        refetchTeam,
        toasts,
        dismissToast,
        optimisticStatus,
        clearOptimisticStatus,
    };
}

// Toast component for displaying notifications
export function ToastContainer({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: string) => void }) {
    if (toasts.length === 0) return null;

    return (
        <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
            {toasts.map((toast) => (
                <div
                    key={toast.id}
                    className={`
            flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg
            animate-in slide-in-from-right-5 fade-in duration-200
            ${toast.type === 'success'
                            ? 'bg-green-600 text-white'
                            : 'bg-red-600 text-white'
                        }
          `}
                >
                    {toast.type === 'success' ? (
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                    ) : (
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    )}
                    <span className="text-sm font-medium">{toast.message}</span>
                    <button
                        onClick={() => onDismiss(toast.id)}
                        className="ml-2 hover:opacity-80 transition-opacity"
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
            ))}
        </div>
    );
}

export default useSaveStatus;
