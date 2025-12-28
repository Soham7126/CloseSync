'use client';

import { useState, useEffect, useCallback } from 'react';
import type { User } from '@/lib/supabase';

interface TeamMember {
  user: User;
  selected: boolean;
}

interface AvailableSlot {
  start: string;
  end: string;
  duration: number;
  participants_free: string[];
}

interface GroupSchedulingModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUserId: string;
  teamMembers: { user: User }[];
  onMeetingCreated?: () => void;
}

type ModalView = 'select' | 'slots' | 'booking';

const DURATION_OPTIONS = [
  { value: 15, label: '15 min' },
  { value: 30, label: '30 min' },
  { value: 45, label: '45 min' },
  { value: 60, label: '1 hour' },
];

export default function GroupSchedulingModal({
  isOpen,
  onClose,
  currentUserId,
  teamMembers,
  onMeetingCreated,
}: GroupSchedulingModalProps) {
  const [view, setView] = useState<ModalView>('select');
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [duration, setDuration] = useState(30);
  const [slots, setSlots] = useState<AvailableSlot[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<AvailableSlot | null>(null);
  const [title, setTitle] = useState('Group sync');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Initialize members list (excluding current user)
  useEffect(() => {
    if (isOpen) {
      setMembers(
        teamMembers
          .filter(m => m.user.id !== currentUserId)
          .map(m => ({ user: m.user, selected: false }))
      );
      setView('select');
      setSlots([]);
      setSelectedSlot(null);
      setError(null);
      setSuccessMessage(null);
      setTitle('Group sync');
      setNotes('');
    }
  }, [isOpen, teamMembers, currentUserId]);

  const selectedCount = members.filter(m => m.selected).length;
  const canProceed = selectedCount >= 1; // At least 1 + current user = 2 people

  const toggleMember = (userId: string) => {
    setMembers(prev =>
      prev.map(m =>
        m.user.id === userId ? { ...m, selected: !m.selected } : m
      )
    );
  };

  const selectAll = () => {
    setMembers(prev => prev.map(m => ({ ...m, selected: true })));
  };

  const deselectAll = () => {
    setMembers(prev => prev.map(m => ({ ...m, selected: false })));
  };

  const fetchAvailableSlots = useCallback(async () => {
    setLoading(true);
    setError(null);

    const selectedUserIds = [
      currentUserId,
      ...members.filter(m => m.selected).map(m => m.user.id),
    ];

    try {
      const response = await fetch('/api/availability/slots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userIds: selectedUserIds,
          minDuration: duration,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to fetch available slots');
      }

      const data = await response.json();
      setSlots(data.slots?.slice(0, 8) || []);
      setView('slots');
    } catch (err) {
      console.error('Failed to fetch slots:', err);
      setError(err instanceof Error ? err.message : 'Failed to load available slots');
      
      // Fallback: Generate mock slots
      const mockSlots = generateMockSlots(selectedUserIds, duration);
      setSlots(mockSlots);
      setView('slots');
    } finally {
      setLoading(false);
    }
  }, [currentUserId, members, duration]);

  const generateMockSlots = (userIds: string[], minDuration: number): AvailableSlot[] => {
    const slots: AvailableSlot[] = [];
    const now = new Date();
    
    let currentTime = new Date(now);
    currentTime.setMinutes(0, 0, 0);
    currentTime.setHours(currentTime.getHours() + 1);

    for (let i = 0; i < 8; i++) {
      // Skip to next working hour
      if (currentTime.getHours() < 9) {
        currentTime.setHours(9, 0, 0, 0);
      } else if (currentTime.getHours() >= 18) {
        currentTime.setDate(currentTime.getDate() + 1);
        currentTime.setHours(9, 0, 0, 0);
      }

      const slotDuration = Math.max(minDuration, 60 + Math.floor(Math.random() * 60));
      const endTime = new Date(currentTime.getTime() + slotDuration * 60 * 1000);

      if (endTime.getHours() > 18) {
        endTime.setHours(18, 0, 0, 0);
      }

      const actualDuration = Math.round((endTime.getTime() - currentTime.getTime()) / (60 * 1000));

      if (actualDuration >= minDuration) {
        slots.push({
          start: currentTime.toISOString(),
          end: endTime.toISOString(),
          duration: actualDuration,
          participants_free: userIds,
        });
      }

      currentTime = new Date(endTime.getTime() + (60 + Math.random() * 120) * 60 * 1000);
    }

    return slots;
  };

  const handleSlotSelect = (slot: AvailableSlot) => {
    setSelectedSlot(slot);
    setView('booking');
  };

  const handleCreateMeeting = async () => {
    if (!selectedSlot) return;

    setIsSubmitting(true);
    setError(null);

    const participantIds = members.filter(m => m.selected).map(m => m.user.id);

    try {
      const response = await fetch('/api/meetings/group/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim() || 'Group sync',
          participantIds,
          startTime: selectedSlot.start,
          duration,
          notes: notes.trim(),
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to create meeting');
      }

      setSuccessMessage(`Meeting scheduled with ${participantIds.length} people!`);
      
      if (onMeetingCreated) {
        onMeetingCreated();
      }

      setTimeout(() => {
        onClose();
      }, 2000);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create meeting');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBack = () => {
    if (view === 'booking') {
      setView('slots');
      setSelectedSlot(null);
    } else if (view === 'slots') {
      setView('select');
    }
    setError(null);
  };

  const formatSlotTime = (isoString: string) => {
    return new Date(isoString).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const formatSlotDate = (isoString: string) => {
    const date = new Date(isoString);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (date.toDateString() === today.toDateString()) return 'Today';
    if (date.toDateString() === tomorrow.toDateString()) return 'Tomorrow';

    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${minutes} min`;
    if (minutes === 60) return '1 hour';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours} hours`;
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-[#1a1b26] rounded-2xl border border-[#232436] shadow-2xl w-full max-w-lg max-h-[85vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[#232436]">
          <div className="flex items-center gap-3">
            {view !== 'select' && (
              <button
                onClick={handleBack}
                className="p-1 rounded-lg hover:bg-[#232436] text-slate-400 hover:text-white transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            )}
            <div>
              <h2 className="text-lg font-semibold text-white">
                {view === 'select' && 'Schedule Group Meeting'}
                {view === 'slots' && 'Available Times'}
                {view === 'booking' && 'Confirm Meeting'}
              </h2>
              <p className="text-sm text-slate-400">
                {view === 'select' && 'Select team members to invite'}
                {view === 'slots' && `Times when everyone is free`}
                {view === 'booking' && 'Review and create meeting'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-[#232436] text-slate-400 hover:text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto max-h-[calc(85vh-80px)]">
          {/* Success Message */}
          {successMessage && (
            <div className="flex flex-col items-center justify-center py-8">
              <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-white font-medium text-lg">{successMessage}</p>
              <p className="text-slate-400 text-sm mt-1">Calendar invites sent</p>
            </div>
          )}

          {/* Error Message */}
          {error && !successMessage && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* SELECT VIEW */}
          {view === 'select' && !successMessage && (
            <div className="space-y-5">
              {/* Duration Selector */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Meeting Duration
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {DURATION_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setDuration(opt.value)}
                      className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                        duration === opt.value
                          ? 'bg-purple-600 text-white'
                          : 'bg-[#232436] text-slate-300 hover:bg-[#2a2b3d]'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Team Members List */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-slate-300">
                    Select Participants ({selectedCount} selected)
                  </label>
                  <div className="flex gap-2">
                    <button
                      onClick={selectAll}
                      className="text-xs text-purple-400 hover:text-purple-300"
                    >
                      Select all
                    </button>
                    <span className="text-slate-600">|</span>
                    <button
                      onClick={deselectAll}
                      className="text-xs text-slate-400 hover:text-slate-300"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {members.length === 0 ? (
                    <div className="text-center py-8 text-slate-500">
                      No other team members found
                    </div>
                  ) : (
                    members.map(member => (
                      <button
                        key={member.user.id}
                        onClick={() => toggleMember(member.user.id)}
                        className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${
                          member.selected
                            ? 'bg-purple-600/20 border border-purple-500/30'
                            : 'bg-[#232436] border border-transparent hover:border-[#3a3b4d]'
                        }`}
                      >
                        {/* Checkbox */}
                        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                          member.selected
                            ? 'bg-purple-600 border-purple-600'
                            : 'border-slate-500'
                        }`}>
                          {member.selected && (
                            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>

                        {/* Avatar */}
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm">
                          {getInitials(member.user.name)}
                        </div>

                        {/* Name */}
                        <div className="flex-1 text-left">
                          <p className="text-white font-medium">{member.user.name}</p>
                          <p className="text-xs text-slate-400">{member.user.email}</p>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>

              {/* Find Times Button */}
              <button
                onClick={fetchAvailableSlots}
                disabled={!canProceed || loading}
                className="w-full py-3 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-white font-semibold transition-all flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    <span>Finding times...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <span>Find Available Times</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* SLOTS VIEW */}
          {view === 'slots' && !successMessage && (
            <div className="space-y-3">
              {/* Selected participants summary */}
              <div className="flex flex-wrap gap-2 mb-4">
                {members.filter(m => m.selected).map(m => (
                  <span key={m.user.id} className="px-2 py-1 bg-purple-500/20 text-purple-300 text-xs rounded-full">
                    {m.user.name.split(' ')[0]}
                  </span>
                ))}
              </div>

              {loading && (
                <div className="flex flex-col items-center justify-center py-8">
                  <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mb-3" />
                  <p className="text-slate-400 text-sm">Finding times for everyone...</p>
                </div>
              )}

              {!loading && slots.length === 0 && (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <div className="w-12 h-12 rounded-full bg-slate-700/50 flex items-center justify-center mb-3">
                    <svg className="w-6 h-6 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <p className="text-slate-400">No common free time found</p>
                  <p className="text-sm text-slate-500 mt-1">Try selecting fewer people or a shorter duration</p>
                </div>
              )}

              {!loading && slots.length > 0 && (
                <>
                  {slots.map((slot, index) => (
                    <button
                      key={index}
                      onClick={() => handleSlotSelect(slot)}
                      className="w-full p-4 bg-[#1e1f2e] hover:bg-[#252636] border border-[#2a2b3d] hover:border-purple-500/30 rounded-xl transition-all text-left group"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center flex-shrink-0">
                          <svg className="w-6 h-6 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                          </svg>
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <p className="text-white font-semibold text-base">
                            {formatSlotDate(slot.start)} {formatSlotTime(slot.start)}
                          </p>
                          <div className="flex items-center gap-1.5 mt-1 text-slate-400">
                            <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span className="text-sm">{formatDuration(slot.duration)} available</span>
                          </div>
                        </div>

                        <div className="text-purple-400 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                      </div>
                    </button>
                  ))}
                </>
              )}
            </div>
          )}

          {/* BOOKING VIEW */}
          {view === 'booking' && selectedSlot && !successMessage && (
            <div className="space-y-5">
              {/* Participants */}
              <div className="flex flex-wrap gap-2">
                {members.filter(m => m.selected).map(m => (
                  <div key={m.user.id} className="flex items-center gap-2 px-3 py-1.5 bg-[#232436] rounded-full">
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-xs">
                      {getInitials(m.user.name)}
                    </div>
                    <span className="text-sm text-white">{m.user.name.split(' ')[0]}</span>
                  </div>
                ))}
              </div>

              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Meeting Title
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Group sync"
                  className="w-full px-4 py-2.5 bg-[#232436] border border-[#2a2b3d] rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500"
                  maxLength={100}
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Notes <span className="text-slate-500">(optional)</span>
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="What would you like to discuss?"
                  rows={3}
                  className="w-full px-4 py-2.5 bg-[#232436] border border-[#2a2b3d] rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 resize-none"
                  maxLength={500}
                />
              </div>

              {/* Meeting Summary */}
              <div className="p-4 bg-[#232436]/50 rounded-lg space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">When</span>
                  <span className="text-white">{formatSlotDate(selectedSlot.start)} {formatSlotTime(selectedSlot.start)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Duration</span>
                  <span className="text-white">{formatDuration(duration)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Participants</span>
                  <span className="text-white">{selectedCount + 1} people</span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleBack}
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-2.5 bg-[#232436] text-slate-300 rounded-lg hover:bg-[#2a2b3d] transition-colors disabled:opacity-50"
                >
                  Back
                </button>
                <button
                  onClick={handleCreateMeeting}
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      <span>Creating...</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span>Create Meeting</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
