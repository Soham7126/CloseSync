'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createSupabaseBrowserClient } from '@/lib/supabase';
import MeetingCard from '@/components/MeetingCard';

interface Participant {
  id: string;
  name: string;
  email: string;
  avatar_url?: string | null;
}

interface Meeting {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  duration: number;
  status: 'scheduled' | 'completed' | 'cancelled';
  notes?: string | null;
  organizer: Participant;
  participants: Participant[];
  isOrganizer: boolean;
  isGroupMeeting: boolean;
}

export default function MeetingsPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'upcoming' | 'past'>('upcoming');
  const [upcomingMeetings, setUpcomingMeetings] = useState<Meeting[]>([]);
  const [pastMeetings, setPastMeetings] = useState<Meeting[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMeetings = async (range: 'upcoming' | 'past') => {
    try {
      const supabase = createSupabaseBrowserClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return [];
      }

      const response = await fetch(`/api/meetings/list?range=${range}`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch meetings');
      }

      const data = await response.json();
      return data.meetings || [];
    } catch (err) {
      console.error('Error fetching meetings:', err);
      setError('Failed to load meetings');
      return [];
    }
  };

  const loadAllMeetings = async () => {
    setIsLoading(true);
    const [upcoming, past] = await Promise.all([
      fetchMeetings('upcoming'),
      fetchMeetings('past'),
    ]);
    setUpcomingMeetings(upcoming);
    setPastMeetings(past);
    setIsLoading(false);
  };

  useEffect(() => {
    loadAllMeetings();
  }, []);

  const handleCancelMeeting = async (meetingId: string) => {
    const meeting = [...upcomingMeetings, ...pastMeetings].find(m => m.id === meetingId);
    if (!meeting) return;

    try {
      const supabase = createSupabaseBrowserClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const endpoint = meeting.isGroupMeeting
        ? '/api/meetings/group/delete'
        : '/api/meetings/delete';

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ meetingId }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to cancel meeting');
      }

      // Refresh meetings list
      await loadAllMeetings();
    } catch (err) {
      console.error('Error cancelling meeting:', err);
      setError('Failed to cancel meeting');
    }
  };

  const currentMeetings = activeTab === 'upcoming' ? upcomingMeetings : pastMeetings;

  return (
    <div className="min-h-screen bg-[#13141C] text-white">
      {/* Header */}
      <header className="bg-[#1a1b26] border-b border-[#232436] sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push('/dashboard')}
                className="p-2 hover:bg-[#232436] rounded-lg transition-colors"
              >
                <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <h1 className="text-xl font-bold text-white">Meetings</h1>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 mt-4">
            <button
              onClick={() => setActiveTab('upcoming')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'upcoming'
                  ? 'bg-purple-600 text-white'
                  : 'bg-[#232436] text-slate-400 hover:text-white'
              }`}
            >
              Upcoming ({upcomingMeetings.length})
            </button>
            <button
              onClick={() => setActiveTab('past')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'past'
                  ? 'bg-purple-600 text-white'
                  : 'bg-[#232436] text-slate-400 hover:text-white'
              }`}
            >
              Past ({pastMeetings.length})
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 py-6">
        {error && (
          <div className="mb-4 p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400">
            {error}
            <button
              onClick={() => setError(null)}
              className="ml-2 underline hover:no-underline"
            >
              Dismiss
            </button>
          </div>
        )}

        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div
                key={i}
                className="h-24 bg-[#1a1b26] rounded-xl animate-pulse"
              />
            ))}
          </div>
        ) : currentMeetings.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#232436] flex items-center justify-center">
              <svg className="w-8 h-8 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-white mb-2">
              {activeTab === 'upcoming' ? 'No upcoming meetings' : 'No past meetings'}
            </h3>
            <p className="text-slate-400 mb-6">
              {activeTab === 'upcoming'
                ? 'Schedule a meeting from the dashboard to get started.'
                : 'Past meetings from the last 7 days will appear here.'}
            </p>
            {activeTab === 'upcoming' && (
              <button
                onClick={() => router.push('/dashboard')}
                className="px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-lg transition-colors"
              >
                Go to Dashboard
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {currentMeetings.map(meeting => (
              <MeetingCard
                key={meeting.id}
                id={meeting.id}
                title={meeting.title}
                startTime={meeting.startTime}
                endTime={meeting.endTime}
                duration={meeting.duration}
                organizer={meeting.organizer}
                participants={meeting.participants}
                isOrganizer={meeting.isOrganizer}
                status={meeting.status}
                notes={meeting.notes}
                isGroupMeeting={meeting.isGroupMeeting}
                onCancel={handleCancelMeeting}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
