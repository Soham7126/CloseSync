'use client';

import { useState } from 'react';

interface Participant {
  id: string;
  name: string;
  email: string;
  avatar_url?: string | null;
}

interface MeetingCardProps {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  duration: number;
  organizer: Participant;
  participants: Participant[];
  isOrganizer: boolean;
  status: 'scheduled' | 'completed' | 'cancelled';
  notes?: string | null;
  isGroupMeeting?: boolean;
  onCancel?: (id: string) => Promise<void>;
  onViewDetails?: (id: string) => void;
}

export default function MeetingCard({
  id,
  title,
  startTime,
  endTime,
  duration,
  organizer,
  participants,
  isOrganizer,
  status,
  notes,
  isGroupMeeting = false,
  onCancel,
  onViewDetails,
}: MeetingCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) return 'Today';
    if (date.toDateString() === tomorrow.toDateString()) return 'Tomorrow';
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';

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

  const formatDuration = (mins: number) => {
    if (mins < 60) return `${mins} min`;
    const hours = Math.floor(mins / 60);
    const minutes = mins % 60;
    if (minutes === 0) return `${hours}h`;
    return `${hours}h ${minutes}m`;
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const isPast = new Date(endTime) < new Date();
  const isCancelled = status === 'cancelled';

  const handleCancel = async () => {
    if (!onCancel) return;
    setIsCancelling(true);
    try {
      await onCancel(id);
    } finally {
      setIsCancelling(false);
      setShowCancelConfirm(false);
    }
  };

  const allParticipants = isGroupMeeting 
    ? participants 
    : [organizer, ...participants.filter(p => p.id !== organizer.id)];

  return (
    <div
      className={`rounded-xl border transition-all ${
        isCancelled 
          ? 'bg-[#1a1b26]/50 border-[#232436] opacity-60' 
          : isPast
            ? 'bg-[#1a1b26] border-[#232436]'
            : 'bg-[#1e1f2e] border-[#2a2b3d] hover:border-purple-500/30'
      }`}
    >
      {/* Main Card Content */}
      <div
        className="p-4 cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-start justify-between gap-4">
          {/* Left: Time & Title */}
          <div className="flex gap-4 flex-1 min-w-0">
            {/* Time Block */}
            <div className="flex-shrink-0 text-center min-w-[70px]">
              <p className="text-purple-400 text-sm font-medium">
                {formatDate(startTime)}
              </p>
              <p className="text-white font-semibold text-lg">
                {formatTime(startTime)}
              </p>
              <p className="text-slate-500 text-xs">
                {formatDuration(duration)}
              </p>
            </div>

            {/* Title & Participants */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className={`font-semibold truncate ${isCancelled ? 'text-slate-400 line-through' : 'text-white'}`}>
                  {title}
                </h3>
                {isCancelled && (
                  <span className="px-2 py-0.5 text-xs bg-red-500/20 text-red-400 rounded-full flex-shrink-0">
                    Cancelled
                  </span>
                )}
                {isGroupMeeting && !isCancelled && (
                  <span className="px-2 py-0.5 text-xs bg-purple-500/20 text-purple-400 rounded-full flex-shrink-0">
                    Group
                  </span>
                )}
              </div>

              {/* Participants */}
              <div className="flex items-center gap-2 mt-2">
                <div className="flex -space-x-2">
                  {allParticipants.slice(0, 4).map((p, i) => (
                    <div
                      key={p.id}
                      className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold border-2 border-[#1e1f2e]"
                      title={p.name}
                      style={{ zIndex: 4 - i }}
                    >
                      {getInitials(p.name)}
                    </div>
                  ))}
                  {allParticipants.length > 4 && (
                    <div className="w-7 h-7 rounded-full bg-[#232436] flex items-center justify-center text-slate-400 text-xs font-bold border-2 border-[#1e1f2e]">
                      +{allParticipants.length - 4}
                    </div>
                  )}
                </div>
                <span className="text-slate-400 text-sm truncate">
                  {isOrganizer 
                    ? `You + ${participants.length} other${participants.length !== 1 ? 's' : ''}`
                    : `${organizer.name} + ${allParticipants.length - 1} other${allParticipants.length - 1 !== 1 ? 's' : ''}`
                  }
                </span>
              </div>
            </div>
          </div>

          {/* Right: Expand Icon */}
          <div className="flex-shrink-0">
            <svg
              className={`w-5 h-5 text-slate-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      </div>

      {/* Expanded Details */}
      {isExpanded && (
        <div className="px-4 pb-4 pt-0 border-t border-[#232436] mt-0">
          <div className="pt-4 space-y-4">
            {/* Time Details */}
            <div className="flex items-center gap-3 text-sm">
              <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-slate-300">
                {formatTime(startTime)} - {formatTime(endTime)} ({formatDuration(duration)})
              </span>
            </div>

            {/* Organizer */}
            <div className="flex items-center gap-3 text-sm">
              <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <span className="text-slate-300">
                Organized by {isOrganizer ? 'you' : organizer.name}
              </span>
            </div>

            {/* All Participants */}
            <div className="space-y-2">
              <p className="text-sm text-slate-500">Participants:</p>
              <div className="flex flex-wrap gap-2">
                {allParticipants.map(p => (
                  <div
                    key={p.id}
                    className="flex items-center gap-2 px-3 py-1.5 bg-[#232436] rounded-full"
                  >
                    <div className="w-5 h-5 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-[10px] font-bold">
                      {getInitials(p.name)}
                    </div>
                    <span className="text-sm text-white">{p.name}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Notes */}
            {notes && (
              <div className="space-y-2">
                <p className="text-sm text-slate-500">Notes:</p>
                <p className="text-sm text-slate-300 bg-[#232436] rounded-lg p-3">
                  {notes}
                </p>
              </div>
            )}

            {/* Actions */}
            {!isPast && !isCancelled && (
              <div className="flex gap-3 pt-2">
                {showCancelConfirm ? (
                  <>
                    <button
                      onClick={handleCancel}
                      disabled={isCancelling}
                      className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                    >
                      {isCancelling ? 'Cancelling...' : 'Confirm Cancel'}
                    </button>
                    <button
                      onClick={() => setShowCancelConfirm(false)}
                      disabled={isCancelling}
                      className="flex-1 px-4 py-2 bg-[#232436] hover:bg-[#2a2b3d] text-slate-300 text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                    >
                      Keep Meeting
                    </button>
                  </>
                ) : (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowCancelConfirm(true);
                    }}
                    className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    Cancel Meeting
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
