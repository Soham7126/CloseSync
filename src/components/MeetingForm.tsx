'use client';

import { useState, useEffect } from 'react';

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
    customStartTime?: string;
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
  
  // Custom date/time state
  const [customDate, setCustomDate] = useState('');
  const [customTime, setCustomTime] = useState('');
  const [useCustomTime, setUseCustomTime] = useState(false);

  // Initialize with selected slot values
  useEffect(() => {
    const slotDate = new Date(selectedSlot.start);
    setCustomDate(slotDate.toISOString().split('T')[0]);
    setCustomTime(slotDate.toTimeString().slice(0, 5));
  }, [selectedSlot.start]);

  // Calculate the actual start time (either from slot or custom)
  const getActualStartTime = (): Date => {
    if (useCustomTime && customDate && customTime) {
      return new Date(`${customDate}T${customTime}`);
    }
    return new Date(selectedSlot.start);
  };

  const actualStartTime = getActualStartTime();

  // Get minimum date (today)
  const getMinDate = () => {
    return new Date().toISOString().split('T')[0];
  };

  // Get maximum date (30 days from now)
  const getMaxDate = () => {
    const maxDate = new Date();
    maxDate.setDate(maxDate.getDate() + 30);
    return maxDate.toISOString().split('T')[0];
  };

  const formatDateTime = (date: Date) => {
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

    // Validate custom time is in the future
    if (actualStartTime <= new Date()) {
      setError('Please select a time in the future');
      return;
    }

    try {
      await onSubmit({
        title: title.trim(),
        duration,
        notes: notes.trim(),
        customStartTime: useCustomTime ? actualStartTime.toISOString() : undefined,
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
          <p className="text-sm text-slate-400">{formatDateTime(actualStartTime)}</p>
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

      {/* Date & Time Picker */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-medium text-slate-300">
            Date & Time
          </label>
          <button
            type="button"
            onClick={() => setUseCustomTime(!useCustomTime)}
            className="text-xs text-purple-400 hover:text-purple-300 transition-colors"
          >
            {useCustomTime ? 'Use suggested time' : 'Choose custom time'}
          </button>
        </div>
        
        {useCustomTime ? (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="date" className="block text-xs text-slate-500 mb-1">Date</label>
              <input
                type="date"
                id="date"
                value={customDate}
                onChange={(e) => setCustomDate(e.target.value)}
                min={getMinDate()}
                max={getMaxDate()}
                className="w-full px-3 py-2.5 bg-[#232436] border border-[#2a2b3d] rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 [color-scheme:dark]"
              />
            </div>
            <div>
              <label htmlFor="time" className="block text-xs text-slate-500 mb-1">Time</label>
              <input
                type="time"
                id="time"
                value={customTime}
                onChange={(e) => setCustomTime(e.target.value)}
                className="w-full px-3 py-2.5 bg-[#232436] border border-[#2a2b3d] rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 [color-scheme:dark]"
              />
            </div>
          </div>
        ) : (
          <div className="p-3 bg-[#232436] border border-[#2a2b3d] rounded-lg">
            <p className="text-white">{formatDateTime(new Date(selectedSlot.start))}</p>
            <p className="text-xs text-slate-500 mt-1">Based on mutual availability</p>
          </div>
        )}
      </div>

      {/* Duration */}
      <div>
        <label htmlFor="duration" className="block text-sm font-medium text-slate-300 mb-2">
          Duration
        </label>
        <div className="grid grid-cols-2 gap-2">
          {DURATION_OPTIONS.map((opt) => (
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
          <span className="text-white">{formatDateTime(actualStartTime)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-slate-400">Duration</span>
          <span className="text-white">{duration} minutes</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-slate-400">End</span>
          <span className="text-white">
            {formatDateTime(
              new Date(actualStartTime.getTime() + duration * 60 * 1000)
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
          disabled={isSubmitting}
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
