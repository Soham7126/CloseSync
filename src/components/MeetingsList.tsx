'use client';

import { useState, useEffect, useCallback } from 'react';

interface User {
  id: string;
  name: string;
  email: string;
  avatar_url: string | null;
}

interface Meeting {
  id: string;
  title: string;
  description: string | null;
  organizer_id: string;
  participant_id: string;
  start_time: string;
  end_time: string;
  duration: number;
  status: 'scheduled' | 'completed' | 'cancelled';
  notes: string | null;
  created_at: string;
  organizer: User;
  participant: User;
  isOrganizer: boolean;
}

interface MeetingsListProps {
  token: string;
  onMeetingDeleted?: () => void;
}

export default function MeetingsList({ token, onMeetingDeleted }: MeetingsListProps) {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const fetchMeetings = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/meetings?status=scheduled&limit=20', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch meetings');
      }

      const data = await response.json();
      setMeetings(data.meetings || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load meetings');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchMeetings();
  }, [fetchMeetings]);

  const handleDelete = async (meetingId: string) => {
    try {
      setDeletingId(meetingId);
      const response = await fetch('/api/meetings/delete', {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ meetingId, hardDelete: false }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete meeting');
      }

      // Remove from local state
      setMeetings(prev => prev.filter(m => m.id !== meetingId));
      setConfirmDelete(null);
      onMeetingDeleted?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete meeting');
    } finally {
      setDeletingId(null);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const isToday = date.toDateString() === today.toDateString();
    const isTomorrow = date.toDateString() === tomorrow.toDateString();

    if (isToday) return 'Today';
    if (isTomorrow) return 'Tomorrow';

    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  if (loading) {
    return (
      <div className="bg-[#232436] rounded-xl p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Upcoming Meetings</h3>
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-6 w-6 border-2 border-purple-500 border-t-transparent"></div>
          <span className="ml-3 text-gray-400">Loading meetings...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-[#232436] rounded-xl p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Upcoming Meetings</h3>
        <div className="text-center py-8">
          <div className="text-red-400 mb-2">⚠️ {error}</div>
          <button
            onClick={fetchMeetings}
            className="text-purple-400 hover:text-purple-300 text-sm"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#232436] rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white">Upcoming Meetings</h3>
        <button
          onClick={fetchMeetings}
          className="text-gray-400 hover:text-white transition-colors p-1"
          title="Refresh"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>

      {meetings.length === 0 ? (
        <div className="text-center py-8">
          <div className="text-4xl mb-3">📅</div>
          <p className="text-gray-400">No upcoming meetings</p>
          <p className="text-gray-500 text-sm mt-1">
            Click on a teammate&apos;s card to schedule a quick sync
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {meetings.map((meeting) => (
            <div
              key={meeting.id}
              className="bg-[#1a1b26] rounded-lg p-4 hover:bg-[#1e1f2e] transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <h4 className="text-white font-medium truncate">{meeting.title}</h4>
                  <div className="flex items-center gap-2 mt-1 text-sm text-gray-400">
                    <span className="text-purple-400">{formatDate(meeting.start_time)}</span>
                    <span>•</span>
                    <span>
                      {formatTime(meeting.start_time)} - {formatTime(meeting.end_time)}
                    </span>
                    <span>•</span>
                    <span>{meeting.duration} min</span>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-gray-500 text-sm">
                      {meeting.isOrganizer ? 'With' : 'Organized by'}:
                    </span>
                    <div className="flex items-center gap-2">
                      {(meeting.isOrganizer ? meeting.participant : meeting.organizer)?.avatar_url ? (
                        <img
                          src={(meeting.isOrganizer ? meeting.participant : meeting.organizer).avatar_url!}
                          alt=""
                          className="w-5 h-5 rounded-full"
                        />
                      ) : (
                        <div className="w-5 h-5 rounded-full bg-purple-600 flex items-center justify-center text-xs text-white">
                          {(meeting.isOrganizer ? meeting.participant : meeting.organizer)?.name?.charAt(0) || '?'}
                        </div>
                      )}
                      <span className="text-gray-300 text-sm">
                        {(meeting.isOrganizer ? meeting.participant : meeting.organizer)?.name || 'Unknown'}
                      </span>
                    </div>
                  </div>
                  {meeting.notes && (
                    <p className="text-gray-500 text-sm mt-2 line-clamp-2">{meeting.notes}</p>
                  )}
                </div>

                <div className="ml-4 flex-shrink-0">
                  {confirmDelete === meeting.id ? (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleDelete(meeting.id)}
                        disabled={deletingId === meeting.id}
                        className="px-3 py-1 text-xs bg-red-600 hover:bg-red-700 text-white rounded-lg disabled:opacity-50 transition-colors"
                      >
                        {deletingId === meeting.id ? 'Deleting...' : 'Confirm'}
                      </button>
                      <button
                        onClick={() => setConfirmDelete(null)}
                        disabled={deletingId === meeting.id}
                        className="px-3 py-1 text-xs bg-gray-600 hover:bg-gray-700 text-white rounded-lg disabled:opacity-50 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmDelete(meeting.id)}
                      className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                      title="Delete meeting"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
