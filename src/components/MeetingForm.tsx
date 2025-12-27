'use client';

import { useState } from 'react';

interface MeetingFormProps {
  participantName: string;
  selectedSlot: {
    start: string;
    end: string;
    duration: number;
  };
  onSubmit: (data: {
    title: string;
    duration: number;
    notes: string;
  }) => Promise<void>;
  onCancel: () => void;
  isSubmitting?: boolean;
}

const DURATION_OPTIONS = [
  { value: 15, label: '15 minutes' },
  { value: 30, label: '30 minutes' },
  { value: 45, label: '45 minutes' },
  { value: 60, label: '1 hour' },
];

export default function MeetingForm({
  participantName,
  selectedSlot,
  onSubmit,
  onCancel,
  isSubmitting = false,
}: MeetingFormProps) {
  const [title, setTitle] = useState('Quick sync');
  const [duration, setDuration] = useState(30);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Filter duration options based on available time
  const availableDurations = DURATION_OPTIONS.filter(
    opt => opt.value <= selectedSlot.duration
  );

  // If selected duration is not available, default to first available
  if (!availableDurations.find(d => d.value === duration) && availableDurations.length > 0) {
    setDuration(availableDurations[0].value);
  }

  const formatDateTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError('Please enter a meeting title');
      return;
    }

    try {
      await onSubmit({
        title: title.trim(),
        duration,
        notes: notes.trim(),
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create meeting';
      setError(errorMessage);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3 pb-4 border-b border-[#232436]">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm">
          {participantName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
        </div>
        <div>
          <h3 className="text-white font-medium">Schedule with {participantName}</h3>
          <p className="text-sm text-slate-400">{formatDateTime(selectedSlot.start)}</p>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Title */}
      <div>
        <label htmlFor="title" className="block text-sm font-medium text-slate-300 mb-2">
          Meeting Title
        </label>
        <input
          type="text"
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Quick sync"
          className="w-full px-4 py-2.5 bg-[#232436] border border-[#2a2b3d] rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500"
          maxLength={100}
        />
      </div>

      {/* Duration */}
      <div>
        <label htmlFor="duration" className="block text-sm font-medium text-slate-300 mb-2">
          Duration
        </label>
        <div className="grid grid-cols-2 gap-2">
          {availableDurations.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setDuration(opt.value)}
              className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                duration === opt.value
                  ? 'bg-purple-600 text-white'
                  : 'bg-[#232436] text-slate-300 hover:bg-[#2a2b3d]'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        {availableDurations.length === 0 && (
          <p className="text-sm text-red-400 mt-2">
            No duration options available for this slot
          </p>
        )}
      </div>

      {/* Notes */}
      <div>
        <label htmlFor="notes" className="block text-sm font-medium text-slate-300 mb-2">
          Notes <span className="text-slate-500">(optional)</span>
        </label>
        <textarea
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="What would you like to discuss?"
          rows={3}
          className="w-full px-4 py-2.5 bg-[#232436] border border-[#2a2b3d] rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 resize-none"
          maxLength={500}
        />
      </div>

      {/* Meeting details summary */}
      <div className="p-4 bg-[#232436]/50 rounded-lg space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-slate-400">Start</span>
          <span className="text-white">{formatDateTime(selectedSlot.start)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-slate-400">Duration</span>
          <span className="text-white">{duration} minutes</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-slate-400">End</span>
          <span className="text-white">
            {formatDateTime(
              new Date(new Date(selectedSlot.start).getTime() + duration * 60 * 1000).toISOString()
            )}
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={isSubmitting}
          className="flex-1 px-4 py-2.5 bg-[#232436] text-slate-300 rounded-lg hover:bg-[#2a2b3d] transition-colors disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSubmitting || availableDurations.length === 0}
          className="flex-1 px-4 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {isSubmitting ? (
            <>
              <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
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
    </form>
  );
}
