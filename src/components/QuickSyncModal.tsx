'use client';

import { useState, useEffect, useCallback } from 'react';
import MeetingForm from './MeetingForm';
import type { User, UserStatus } from '@/lib/supabase';

interface AvailableSlot {
  start: string;
  end: string;
  duration: number;
  participants_free: string[];
}

interface QuickSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUserId: string;
  targetUser: User;
  targetUserStatus: UserStatus | null;
  onMeetingCreated?: () => void;
}

type ModalView = 'slots' | 'booking';

export default function QuickSyncModal({
  isOpen,
  onClose,
  currentUserId,
  targetUser,
  targetUserStatus,
  onMeetingCreated,
}: QuickSyncModalProps) {
  const [view, setView] = useState<ModalView>('slots');
  const [slots, setSlots] = useState<AvailableSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<AvailableSlot | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Fetch available slots
  const fetchSlots = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/availability/slots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userIds: [currentUserId, targetUser.id],
          minDuration: 15,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to fetch available slots');
      }

      const data = await response.json();
      setSlots(data.slots?.slice(0, 5) || []);
    } catch (err) {
      console.error('Failed to fetch slots:', err);
      setError(err instanceof Error ? err.message : 'Failed to load available slots');
      
      // Fallback: Generate mock slots for demo
      const mockSlots = generateMockSlots();
      setSlots(mockSlots);
    } finally {
      setLoading(false);
    }
  }, [currentUserId, targetUser.id]);

  useEffect(() => {
    if (isOpen) {
      setView('slots');
      setSelectedSlot(null);
      setSuccessMessage(null);
      setError(null);
      fetchSlots();
    }
  }, [isOpen, fetchSlots]);

  // Generate mock slots for demo/fallback
  const generateMockSlots = (): AvailableSlot[] => {
    const slots: AvailableSlot[] = [];
    const now = new Date();
    
    // Start from next hour
    const startTime = new Date(now);
    startTime.setMinutes(0, 0, 0);
    startTime.setHours(startTime.getHours() + 1);

    // Working hours: 9am - 6pm
    const workStart = 9;
    const workEnd = 18;

    let currentTime = new Date(startTime);
    
    for (let i = 0; i < 5 && slots.length < 5; i++) {
      // Skip to next working hour if needed
      if (currentTime.getHours() < workStart) {
        currentTime.setHours(workStart, 0, 0, 0);
      } else if (currentTime.getHours() >= workEnd) {
        currentTime.setDate(currentTime.getDate() + 1);
        currentTime.setHours(workStart, 0, 0, 0);
      }

      // Create a 1-2 hour slot
      const duration = Math.random() > 0.5 ? 60 : 120;
      const endTime = new Date(currentTime.getTime() + duration * 60 * 1000);

      // Don't exceed working hours
      if (endTime.getHours() > workEnd) {
        endTime.setHours(workEnd, 0, 0, 0);
      }

      const slotDuration = Math.round((endTime.getTime() - currentTime.getTime()) / (60 * 1000));

      if (slotDuration >= 15) {
        slots.push({
          start: currentTime.toISOString(),
          end: endTime.toISOString(),
          duration: slotDuration,
          participants_free: [currentUserId, targetUser.id],
        });
      }

      // Move to next potential slot (skip 1-2 hours for "busy" time)
      currentTime = new Date(endTime.getTime() + (60 + Math.random() * 60) * 60 * 1000);
    }

    return slots;
  };

  const handleSlotSelect = (slot: AvailableSlot) => {
    setSelectedSlot(slot);
    setView('booking');
  };

  const handleBookingSubmit = async (data: {
    title: string;
    duration: number;
    notes: string;
  }) => {
    if (!selectedSlot) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/meetings/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          participantId: targetUser.id,
          title: data.title,
          startTime: selectedSlot.start,
          duration: data.duration,
          notes: data.notes,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to create meeting');
      }

      setSuccessMessage(`Meeting scheduled with ${targetUser.name}!`);
      
      // Callback to parent
      if (onMeetingCreated) {
        onMeetingCreated();
      }

      // Close after delay
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
    setView('slots');
    setSelectedSlot(null);
    setError(null);
  };

  const formatSlotTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleTimeString('en-US', {
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

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === tomorrow.toDateString()) {
      return 'Tomorrow';
    } else {
      return date.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      });
    }
  };

  const formatDuration = (minutes: number) => {
    if (minutes < 60) {
      return `${minutes}min`;
    } else if (minutes === 60) {
      return '1hr';
    } else {
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      return mins > 0 ? `${hours}hr ${mins}min` : `${hours}hr`;
    }
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
      <div className="relative bg-[#1a1b26] rounded-2xl border border-[#232436] shadow-2xl w-full max-w-md max-h-[85vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[#232436]">
          <div className="flex items-center gap-3">
            {view === 'booking' && (
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
                {view === 'slots' ? 'Quick Sync' : 'Book Meeting'}
              </h2>
              <p className="text-sm text-slate-400">
                {view === 'slots' 
                  ? `Find a time with ${targetUser.name}` 
                  : 'Confirm meeting details'}
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

          {/* Slots View */}
          {view === 'slots' && !successMessage && (
            <>
              {/* Target User Card */}
              <div className="flex items-center gap-3 p-4 bg-[#232436]/50 rounded-xl mb-5">
                <div className={`w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold`}>
                  {getInitials(targetUser.name)}
                </div>
                <div className="flex-1">
                  <p className="text-white font-medium">{targetUser.name}</p>
                  <p className="text-sm text-slate-400">{targetUser.email}</p>
                </div>
                <div className={`w-3 h-3 rounded-full ${
                  targetUserStatus?.status_color === 'green' ? 'bg-emerald-500' :
                  targetUserStatus?.status_color === 'yellow' ? 'bg-amber-500' :
                  targetUserStatus?.status_color === 'red' ? 'bg-rose-500' :
                  'bg-slate-500'
                }`} />
              </div>

              {/* Loading */}
              {loading && (
                <div className="flex flex-col items-center justify-center py-8">
                  <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mb-3" />
                  <p className="text-slate-400 text-sm">Finding available times...</p>
                </div>
              )}

              {/* No Slots */}
              {!loading && slots.length === 0 && (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <div className="w-12 h-12 rounded-full bg-slate-700/50 flex items-center justify-center mb-3">
                    <svg className="w-6 h-6 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <p className="text-slate-400">No available slots found</p>
                  <p className="text-sm text-slate-500 mt-1">Try again later or check calendars</p>
                </div>
              )}

              {/* Slots List */}
              {!loading && slots.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm text-slate-400 mb-3">Next available times:</p>
                  {slots.map((slot, index) => (
                    <button
                      key={index}
                      onClick={() => handleSlotSelect(slot)}
                      className="w-full p-4 bg-[#232436] hover:bg-[#2a2b3d] rounded-xl transition-colors text-left group"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="text-center">
                            <p className="text-xs text-slate-500 uppercase">
                              {formatSlotDate(slot.start)}
                            </p>
                            <p className="text-lg font-semibold text-white">
                              {formatSlotTime(slot.start)}
                            </p>
                          </div>
                          <div className="h-8 w-px bg-[#2a2b3d]" />
                          <div>
                            <p className="text-white font-medium">
                              {formatSlotTime(slot.start)} - {formatSlotTime(slot.end)}
                            </p>
                            <p className="text-sm text-slate-400">
                              {formatDuration(slot.duration)} available
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 text-purple-400 opacity-0 group-hover:opacity-100 transition-opacity">
                          <span className="text-sm">Book</span>
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}

          {/* Booking View */}
          {view === 'booking' && selectedSlot && !successMessage && (
            <MeetingForm
              participantName={targetUser.name}
              selectedSlot={selectedSlot}
              onSubmit={handleBookingSubmit}
              onCancel={handleBack}
              isSubmitting={isSubmitting}
            />
          )}
        </div>
      </div>
    </div>
  );
}
