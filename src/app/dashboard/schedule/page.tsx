'use client';

import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import {
    ChevronLeft,
    ChevronRight,
    Users,
    Coffee,
    Briefcase,
    Gamepad2,
    Lightbulb,
    ListTodo,
    MessageSquare,
    Trophy,
    Loader2,
    AlertCircle,
    RefreshCw,
    MoreHorizontal,
    Bell,
    Pencil,
    Trash2,
    X,
    Clock,
    Calendar,
} from 'lucide-react';
import { createSupabaseBrowserClient } from '@/lib/supabase';

// Types
interface Attendee {
    id: string;
    name: string;
    avatar: string;
}

interface CalendarEvent {
    id: string;
    title: string;
    startTime: string;
    endTime: string;
    date: Date;
    category: 'work' | 'personal' | 'break' | 'activities' | 'essentials';
    icon: React.ReactNode;
    attendees?: Attendee[];
    hasZoomLink?: boolean;
    isGroupMeeting?: boolean;
}

interface CalendarCategory {
    id: string;
    name: string;
    color: string;
    dotColor: string;
}

interface ApiCalendarEvent {
    id: string;
    title: string;
    startTime: string;
    endTime: string;
    category: 'work' | 'personal' | 'break' | 'activities' | 'essentials';
    attendees: Attendee[];
    isGroupMeeting: boolean;
    hasZoomLink?: boolean;
    notes?: string;
}

// Calendar categories/legends with new color scheme matching reference
const calendarCategories: CalendarCategory[] = [
    { id: 'work', name: 'Work', color: 'bg-orange-50', dotColor: 'bg-orange-500' },
    { id: 'personal', name: 'Personal', color: 'bg-green-50', dotColor: 'bg-green-500' },
    { id: 'break', name: 'Break', color: 'bg-blue-50', dotColor: 'bg-blue-500' },
    { id: 'activities', name: 'Activities', color: 'bg-red-50', dotColor: 'bg-red-500' },
    { id: 'essentials', name: 'Essentials', color: 'bg-gray-50', dotColor: 'bg-gray-400' },
];

// Get card colors based on category
const getCardColors = (category: string) => {
    switch (category) {
        case 'work':
            return {
                bg: 'bg-orange-50',
                border: 'border-orange-200',
                text: 'text-orange-700',
                icon: 'bg-orange-500',
            };
        case 'personal':
            return {
                bg: 'bg-green-50',
                border: 'border-green-200',
                text: 'text-green-700',
                icon: 'bg-green-500',
            };
        case 'break':
            return {
                bg: 'bg-blue-50',
                border: 'border-blue-200',
                text: 'text-blue-700',
                icon: 'bg-blue-500',
            };
        case 'activities':
            return {
                bg: 'bg-red-50',
                border: 'border-red-200',
                text: 'text-red-700',
                icon: 'bg-red-500',
            };
        default:
            return {
                bg: 'bg-gray-50',
                border: 'border-gray-200',
                text: 'text-gray-700',
                icon: 'bg-gray-500',
            };
    }
};

// Constants for time grid
const PIXELS_PER_HOUR = 60; // Height of each hour slot in pixels
const START_HOUR = 0; // Calendar starts at 12 AM (midnight)
const END_HOUR = 24; // Calendar ends at 12 AM (next day)

// Get icon for category
const getCategoryIcon = (category: string, title: string) => {
    const lowerTitle = title.toLowerCase();

    if (lowerTitle.includes('sync') || lowerTitle.includes('team') || lowerTitle.includes('meeting')) {
        return <Users className="w-3.5 h-3.5" />;
    }
    if (lowerTitle.includes('lunch') || lowerTitle.includes('break') || lowerTitle.includes('coffee')) {
        return <Coffee className="w-3.5 h-3.5" />;
    }
    if (lowerTitle.includes('1-on-1') || lowerTitle.includes('1:1')) {
        return <Users className="w-3.5 h-3.5" />;
    }
    if (lowerTitle.includes('sport') || lowerTitle.includes('gym') || lowerTitle.includes('fun')) {
        return <Trophy className="w-3.5 h-3.5" />;
    }
    if (lowerTitle.includes('game') || lowerTitle.includes('play')) {
        return <Gamepad2 className="w-3.5 h-3.5" />;
    }
    if (lowerTitle.includes('idea') || lowerTitle.includes('brainstorm') || lowerTitle.includes('prototype')) {
        return <Lightbulb className="w-3.5 h-3.5" />;
    }
    if (lowerTitle.includes('chore') || lowerTitle.includes('task')) {
        return <ListTodo className="w-3.5 h-3.5" />;
    }
    if (lowerTitle.includes('review') || lowerTitle.includes('critique') || lowerTitle.includes('feedback')) {
        return <MessageSquare className="w-3.5 h-3.5" />;
    }

    switch (category) {
        case 'work':
            return <Briefcase className="w-3.5 h-3.5" />;
        case 'personal':
            return <ListTodo className="w-3.5 h-3.5" />;
        case 'break':
            return <Coffee className="w-3.5 h-3.5" />;
        case 'activities':
            return <Trophy className="w-3.5 h-3.5" />;
        case 'essentials':
            return <Users className="w-3.5 h-3.5" />;
        default:
            return <Calendar className="w-3.5 h-3.5" />;
    }
};

// Time conversion helpers
const timeToMinutes = (time: string): number => {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
};

const formatTimeFromISO = (isoString: string): string => {
    const date = new Date(isoString);
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
};

const formatTimeToAMPM = (time: string): string => {
    const [hours, minutes] = time.split(':').map(Number);
    const hour12 = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours;
    const ampm = hours >= 12 ? 'PM' : 'AM';
    if (minutes === 0) {
        return `${hour12} ${ampm}`;
    }
    return `${hour12}:${minutes.toString().padStart(2, '0')} ${ampm}`;
};

// Attendee colors for avatars without images
const ATTENDEE_COLORS = [
    'bg-yellow-400',
    'bg-purple-500',
    'bg-blue-500',
    'bg-green-500',
    'bg-pink-500',
    'bg-orange-500',
    'bg-teal-500',
    'bg-red-500',
];

// Event Card Component - Redesigned to match the reference
function EventCard({
    event,
    pixelsPerHour,
    onEdit,
    onDelete,
    onSetReminder,
}: {
    event: CalendarEvent;
    pixelsPerHour: number;
    onEdit: (event: CalendarEvent) => void;
    onDelete: (event: CalendarEvent) => void;
    onSetReminder: (event: CalendarEvent) => void;
}) {
    const [showMenu, setShowMenu] = useState(false);
    const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
    const buttonRef = useRef<HTMLButtonElement>(null);
    const startMinutes = timeToMinutes(event.startTime);
    const endMinutes = timeToMinutes(event.endTime);
    const durationMinutes = endMinutes - startMinutes;

    // Calculate position based on pixelsPerHour
    const topOffset = ((startMinutes - START_HOUR * 60) / 60) * pixelsPerHour;
    const height = Math.max((durationMinutes / 60) * pixelsPerHour - 2, 60);

    // Format time display
    const timeDisplay = `${formatTimeToAMPM(event.startTime)} - ${formatTimeToAMPM(event.endTime)}`;

    // Check if this is a busy block (not a real meeting)
    const isBusyBlock = event.id.startsWith('busy-');

    // Get colors based on category
    const colors = getCardColors(event.category);

    return (
        <div
            className={`absolute left-1 right-1 rounded-2xl border ${colors.border} ${colors.bg} cursor-pointer transition-all duration-200 hover:shadow-md overflow-visible`}
            style={{
                top: `${topOffset}px`,
                height: `${height}px`,
            }}
        >
            <div className="flex flex-col h-full p-3 overflow-hidden relative">
                {/* Icon badge in top left */}
                <div className={`w-8 h-8 rounded-lg ${colors.icon} flex items-center justify-center mb-2`}>
                    <span className="text-white">
                        {event.icon}
                    </span>
                </div>

                {/* Title */}
                <h4 className={`text-sm font-semibold ${colors.text} truncate leading-tight`}>
                    {event.title}
                </h4>

                {/* Time display */}
                <p className="text-xs text-gray-500 mt-0.5">
                    {timeDisplay}
                </p>

                {/* Bottom section with attendees and menu */}
                <div className="flex items-center justify-between mt-auto pt-2">
                    {/* Attendees */}
                    {event.attendees && event.attendees.length > 0 ? (
                        <div className="flex items-center">
                            <div className="flex -space-x-2">
                                {event.attendees.slice(0, 3).map((attendee, index) => (
                                    <div
                                        key={attendee.id}
                                        className={`w-7 h-7 rounded-full border-2 border-white flex items-center justify-center overflow-hidden ${ATTENDEE_COLORS[index % ATTENDEE_COLORS.length]}`}
                                        style={{ zIndex: 10 - index }}
                                        title={attendee.name}
                                    >
                                        {attendee.avatar ? (
                                            <img
                                                src={attendee.avatar}
                                                alt={attendee.name}
                                                className="w-full h-full object-cover"
                                                onError={(e) => {
                                                    const target = e.target as HTMLImageElement;
                                                    target.style.display = 'none';
                                                }}
                                            />
                                        ) : (
                                            <span className="text-[10px] font-semibold text-white">
                                                {attendee.name?.charAt(0)?.toUpperCase()}
                                            </span>
                                        )}
                                    </div>
                                ))}
                            </div>
                            {event.attendees.length > 3 && (
                                <span className="ml-1.5 text-xs text-gray-500 font-medium">
                                    {event.attendees.length - 3}+
                                </span>
                            )}
                        </div>
                    ) : (
                        <div />
                    )}

                    {/* Menu Button - Always visible */}
                    {!isBusyBlock && (
                        <div className="relative">
                            <button
                                ref={buttonRef}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    if (buttonRef.current) {
                                        const rect = buttonRef.current.getBoundingClientRect();
                                        setMenuPosition({
                                            top: rect.bottom + 8,
                                            left: Math.min(rect.left, window.innerWidth - 200),
                                        });
                                    }
                                    setShowMenu(!showMenu);
                                }}
                                className="w-8 h-8 rounded-full bg-white/80 hover:bg-white flex items-center justify-center shadow-sm border border-gray-200"
                            >
                                <MoreHorizontal className="w-4 h-4 text-gray-600" />
                            </button>

                            {/* Context Menu */}
                            {showMenu && (
                                <>
                                    {/* Backdrop to close menu */}
                                    <div
                                        className="fixed inset-0 z-[99]"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setShowMenu(false);
                                        }}
                                    />
                                    <div
                                        className="fixed w-52 bg-white rounded-xl shadow-2xl border border-gray-100 py-2 z-[100]"
                                        style={{ top: menuPosition.top, left: menuPosition.left }}
                                    >
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setShowMenu(false);
                                                onSetReminder(event);
                                            }}
                                            className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-3"
                                        >
                                            <Bell className="w-4 h-4 text-gray-400" />
                                            Set reminder
                                        </button>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setShowMenu(false);
                                                onEdit(event);
                                            }}
                                            className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-3"
                                        >
                                            <Pencil className="w-4 h-4 text-gray-400" />
                                            <span className="flex-1">Edit</span>
                                            <ChevronRight className="w-4 h-4 text-gray-300" />
                                        </button>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setShowMenu(false);
                                                onDelete(event);
                                            }}
                                            className="w-full px-4 py-2.5 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-3"
                                        >
                                            <Trash2 className="w-4 h-4 text-red-500" />
                                            Delete
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// Delete Confirmation Modal
function DeleteModal({
    event,
    isOpen,
    onClose,
    onConfirm,
    isDeleting,
}: {
    event: CalendarEvent | null;
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    isDeleting: boolean;
}) {
    if (!isOpen || !event) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/50" onClick={onClose} />
            <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 p-1 hover:bg-gray-100 rounded-full"
                >
                    <X className="w-5 h-5 text-gray-500" />
                </button>

                <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                        <Trash2 className="w-5 h-5 text-red-600" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900">Delete Meeting</h3>
                </div>

                <p className="text-gray-600 mb-6">
                    Are you sure you want to delete <span className="font-medium">&quot;{event.title}&quot;</span>?
                    This action cannot be undone.
                </p>

                <div className="flex gap-3 justify-end">
                    <button
                        onClick={onClose}
                        disabled={isDeleting}
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onConfirm}
                        disabled={isDeleting}
                        className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                    >
                        {isDeleting && <Loader2 className="w-4 h-4 animate-spin" />}
                        {isDeleting ? 'Deleting...' : 'Delete'}
                    </button>
                </div>
            </div>
        </div>
    );
}

// Edit Meeting Modal
function EditModal({
    event,
    isOpen,
    onClose,
    onSave,
    isSaving,
}: {
    event: CalendarEvent | null;
    isOpen: boolean;
    onClose: () => void;
    onSave: (title: string, startTime: string, endTime: string) => void;
    isSaving: boolean;
}) {
    const [title, setTitle] = useState('');
    const [startTime, setStartTime] = useState('');
    const [endTime, setEndTime] = useState('');

    useEffect(() => {
        if (event) {
            setTitle(event.title);
            setStartTime(event.startTime);
            setEndTime(event.endTime);
        }
    }, [event]);

    if (!isOpen || !event) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/50" onClick={onClose} />
            <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 p-1 hover:bg-gray-100 rounded-full"
                >
                    <X className="w-5 h-5 text-gray-500" />
                </button>

                <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center">
                        <Pencil className="w-5 h-5 text-orange-600" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900">Edit Meeting</h3>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Meeting Title
                        </label>
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
                            placeholder="Enter meeting title"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Start Time
                            </label>
                            <input
                                type="time"
                                value={startTime}
                                onChange={(e) => setStartTime(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                End Time
                            </label>
                            <input
                                type="time"
                                value={endTime}
                                onChange={(e) => setEndTime(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
                            />
                        </div>
                    </div>
                </div>

                <div className="flex gap-3 justify-end mt-6">
                    <button
                        onClick={onClose}
                        disabled={isSaving}
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={() => onSave(title, startTime, endTime)}
                        disabled={isSaving || !title.trim()}
                        className="px-4 py-2 text-sm font-medium text-white bg-orange-500 rounded-lg hover:bg-orange-600 transition-colors disabled:opacity-50 flex items-center gap-2"
                    >
                        {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                        {isSaving ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>
            </div>
        </div>
    );
}

// Set Reminder Modal
function ReminderModal({
    event,
    isOpen,
    onClose,
    onSetReminder,
    isSetting,
}: {
    event: CalendarEvent | null;
    isOpen: boolean;
    onClose: () => void;
    onSetReminder: (minutes: number) => void;
    isSetting: boolean;
}) {
    const [selectedTime, setSelectedTime] = useState(15);

    const reminderOptions = [
        { value: 5, label: '5 minutes before' },
        { value: 10, label: '10 minutes before' },
        { value: 15, label: '15 minutes before' },
        { value: 30, label: '30 minutes before' },
        { value: 60, label: '1 hour before' },
        { value: 1440, label: '1 day before' },
    ];

    if (!isOpen || !event) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/50" onClick={onClose} />
            <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 p-1 hover:bg-gray-100 rounded-full"
                >
                    <X className="w-5 h-5 text-gray-500" />
                </button>

                <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                        <Bell className="w-5 h-5 text-blue-600" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900">Set Reminder</h3>
                </div>

                <p className="text-gray-600 mb-4">
                    Set a reminder for <span className="font-medium">&quot;{event.title}&quot;</span>
                </p>

                <div className="space-y-2">
                    {reminderOptions.map((option) => (
                        <label
                            key={option.value}
                            className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                                selectedTime === option.value
                                    ? 'border-orange-500 bg-orange-50'
                                    : 'border-gray-200 hover:bg-gray-50'
                            }`}
                        >
                            <input
                                type="radio"
                                name="reminder"
                                value={option.value}
                                checked={selectedTime === option.value}
                                onChange={() => setSelectedTime(option.value)}
                                className="w-4 h-4 text-orange-500 focus:ring-orange-500"
                            />
                            <Clock className="w-4 h-4 text-gray-400" />
                            <span className="text-sm text-gray-700">{option.label}</span>
                        </label>
                    ))}
                </div>

                <div className="flex gap-3 justify-end mt-6">
                    <button
                        onClick={onClose}
                        disabled={isSetting}
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={() => onSetReminder(selectedTime)}
                        disabled={isSetting}
                        className="px-4 py-2 text-sm font-medium text-white bg-orange-500 rounded-lg hover:bg-orange-600 transition-colors disabled:opacity-50 flex items-center gap-2"
                    >
                        {isSetting && <Loader2 className="w-4 h-4 animate-spin" />}
                        {isSetting ? 'Setting...' : 'Set Reminder'}
                    </button>
                </div>
            </div>
        </div>
    );
}

// Main Schedule Page Component
export default function SchedulePage() {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [daysDisplayed] = useState(7);
    const [events, setEvents] = useState<CalendarEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [currentTime, setCurrentTime] = useState(new Date());

    // Modal states
    const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showReminderModal, setShowReminderModal] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isSettingReminder, setIsSettingReminder] = useState(false);

    const supabase = createSupabaseBrowserClient();

    // Update current time every minute for the realtime indicator
    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentTime(new Date());
        }, 60000); // Update every minute

        return () => clearInterval(timer);
    }, []);

    // Calculate the position of the current time indicator
    const getCurrentTimePosition = () => {
        const hours = currentTime.getHours();
        const minutes = currentTime.getMinutes();
        const totalMinutes = hours * 60 + minutes - START_HOUR * 60;
        return (totalMinutes / 60) * PIXELS_PER_HOUR;
    };

    // Format current time for display on the indicator
    const formatCurrentTimeLabel = () => {
        const hours = currentTime.getHours();
        const minutes = currentTime.getMinutes();
        const hour12 = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours;
        const ampm = hours >= 12 ? 'PM' : 'AM';
        return `${hour12}:${minutes.toString().padStart(2, '0')} ${ampm}`;
    };

    // Get week days based on current date
    const weekDays = useMemo(() => {
        const days: Date[] = [];
        const start = new Date(currentDate);
        const dayOfWeek = (start.getDay() + 6) % 7; // Monday = 0
        start.setDate(start.getDate() - dayOfWeek);

        for (let i = 0; i < daysDisplayed; i++) {
            const day = new Date(start);
            day.setDate(day.getDate() + i);
            days.push(day);
        }
        return days;
    }, [currentDate, daysDisplayed]);

    // Fetch events from API
    const fetchEvents = useCallback(async () => {
        setLoading(true);
        setError(null);

        try {
            const { data: { session } } = await supabase.auth.getSession();

            if (!session?.access_token) {
                setError('Please log in to view your schedule');
                setLoading(false);
                return;
            }

            // Calculate date range for the displayed week
            const start = new Date(weekDays[0]);
            start.setHours(0, 0, 0, 0);

            const end = new Date(weekDays[weekDays.length - 1]);
            end.setHours(23, 59, 59, 999);

            const response = await fetch(
                `/api/calendar/events?startDate=${start.toISOString()}&endDate=${end.toISOString()}`,
                {
                    headers: {
                        Authorization: `Bearer ${session.access_token}`,
                    },
                }
            );

            if (!response.ok) {
                throw new Error('Failed to fetch events');
            }

            const data = await response.json();

            // Transform API events to CalendarEvent format
            const transformedEvents: CalendarEvent[] = (data.events || []).map((event: ApiCalendarEvent) => ({
                id: event.id,
                title: event.title,
                startTime: formatTimeFromISO(event.startTime),
                endTime: formatTimeFromISO(event.endTime),
                date: new Date(event.startTime),
                category: event.category,
                icon: getCategoryIcon(event.category, event.title),
                attendees: event.attendees,
                hasZoomLink: event.hasZoomLink,
                isGroupMeeting: event.isGroupMeeting,
            }));

            setEvents(transformedEvents);
        } catch (err) {
            console.error('Error fetching events:', err);
            setError('Failed to load events. Please try again.');
        } finally {
            setLoading(false);
        }
    }, [supabase, weekDays]);

    // Fetch events when week changes
    useEffect(() => {
        fetchEvents();
    }, [fetchEvents]);

    // Generate time slots from START_HOUR to END_HOUR
    const timeSlots = useMemo(() => {
        const slots: string[] = [];
        for (let hour = START_HOUR; hour <= END_HOUR; hour++) {
            const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
            const ampm = hour >= 12 ? 'PM' : 'AM';
            slots.push(`${displayHour} ${ampm}`);
        }
        return slots;
    }, []);

    const handleWeekChange = (direction: 'prev' | 'next') => {
        setCurrentDate((prev) => {
            const newDate = new Date(prev);
            newDate.setDate(newDate.getDate() + (direction === 'next' ? 7 : -7));
            return newDate;
        });
    };

    const goToToday = () => {
        const today = new Date();
        setCurrentDate(today);
    };

    // Event action handlers
    const handleEditEvent = (event: CalendarEvent) => {
        setSelectedEvent(event);
        setShowEditModal(true);
    };

    const handleDeleteEvent = (event: CalendarEvent) => {
        setSelectedEvent(event);
        setShowDeleteModal(true);
    };

    const handleSetReminder = (event: CalendarEvent) => {
        setSelectedEvent(event);
        setShowReminderModal(true);
    };

    // Delete event API call
    const confirmDeleteEvent = async () => {
        if (!selectedEvent) return;

        setIsDeleting(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.access_token) {
                throw new Error('Not authenticated');
            }

            const endpoint = selectedEvent.isGroupMeeting
                ? '/api/meetings/group/delete'
                : '/api/meetings/delete';

            const method = selectedEvent.isGroupMeeting ? 'POST' : 'DELETE';

            const response = await fetch(endpoint, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${session.access_token}`,
                },
                body: JSON.stringify({
                    meetingId: selectedEvent.id,
                    hardDelete: false,
                }),
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to delete meeting');
            }

            // Refresh events after deletion
            await fetchEvents();
            setShowDeleteModal(false);
            setSelectedEvent(null);
        } catch (err) {
            console.error('Error deleting event:', err);
            alert(err instanceof Error ? err.message : 'Failed to delete meeting');
        } finally {
            setIsDeleting(false);
        }
    };

    // Edit event API call
    const saveEditEvent = async (title: string, startTime: string, endTime: string) => {
        if (!selectedEvent) return;

        setIsSaving(true);
        try {
            const { data: { session: editSession } } = await supabase.auth.getSession();
            if (!editSession?.access_token) {
                throw new Error('Not authenticated');
            }

            // Build the new start and end times using the event's original date
            const eventDate = new Date(selectedEvent.date);
            const [startHours, startMinutes] = startTime.split(':').map(Number);
            const [endHours, endMinutes] = endTime.split(':').map(Number);

            const newStartTime = new Date(eventDate);
            newStartTime.setHours(startHours, startMinutes, 0, 0);

            const newEndTime = new Date(eventDate);
            newEndTime.setHours(endHours, endMinutes, 0, 0);

            const tableName = selectedEvent.isGroupMeeting ? 'group_meetings' : 'meetings';

            // Use supabase REST API directly
            const response = await fetch(
                `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/${tableName}?id=eq.${selectedEvent.id}`,
                {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                        'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
                        'Authorization': `Bearer ${editSession.access_token}`,
                        'Prefer': 'return=minimal',
                    },
                    body: JSON.stringify({
                        title,
                        start_time: newStartTime.toISOString(),
                        end_time: newEndTime.toISOString(),
                    }),
                }
            );

            if (!response.ok) {
                throw new Error('Failed to update meeting');
            }

            // Refresh events after update
            await fetchEvents();
            setShowEditModal(false);
            setSelectedEvent(null);
        } catch (err) {
            console.error('Error updating event:', err);
            alert(err instanceof Error ? err.message : 'Failed to update meeting');
        } finally {
            setIsSaving(false);
        }
    };

    // Set reminder for event
    const confirmSetReminder = async (minutesBefore: number) => {
        if (!selectedEvent) return;

        setIsSettingReminder(true);
        try {
            // Calculate reminder time
            const eventDate = new Date(selectedEvent.date);
            const [hours, minutes] = selectedEvent.startTime.split(':').map(Number);
            eventDate.setHours(hours, minutes, 0, 0);

            const reminderTime = new Date(eventDate.getTime() - minutesBefore * 60 * 1000);

            // Check if browser supports notifications
            if ('Notification' in window) {
                const permission = await Notification.requestPermission();
                if (permission === 'granted') {
                    // Calculate delay until reminder
                    const delay = reminderTime.getTime() - Date.now();

                    if (delay > 0) {
                        // Store reminder in localStorage for persistence
                        const reminders = JSON.parse(localStorage.getItem('meetingReminders') || '[]');
                        reminders.push({
                            eventId: selectedEvent.id,
                            eventTitle: selectedEvent.title,
                            reminderTime: reminderTime.toISOString(),
                            eventTime: eventDate.toISOString(),
                        });
                        localStorage.setItem('meetingReminders', JSON.stringify(reminders));

                        // Set timeout for notification (if page stays open)
                        setTimeout(() => {
                            new Notification(`Meeting Reminder: ${selectedEvent.title}`, {
                                body: `Your meeting starts in ${minutesBefore} minutes`,
                                icon: '/favicon.ico',
                            });
                        }, delay);

                        alert(`Reminder set for ${minutesBefore} minutes before the meeting`);
                    } else {
                        alert('Cannot set reminder - the time has already passed');
                    }
                } else {
                    alert('Please enable notifications to set reminders');
                }
            } else {
                alert('Your browser does not support notifications');
            }

            setShowReminderModal(false);
            setSelectedEvent(null);
        } catch (err) {
            console.error('Error setting reminder:', err);
            alert('Failed to set reminder');
        } finally {
            setIsSettingReminder(false);
        }
    };

    const monthYearDisplay = currentDate.toLocaleDateString('en-US', {
        month: 'long',
        year: 'numeric',
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get events for a specific day
    const getEventsForDay = (day: Date) => {
        return events.filter((event) => {
            const eventDate = new Date(event.date);
            return (
                eventDate.getFullYear() === day.getFullYear() &&
                eventDate.getMonth() === day.getMonth() &&
                eventDate.getDate() === day.getDate()
            );
        });
    };

    return (
        <div className="flex h-[calc(100vh-80px)] bg-[#F5F5F5] -m-6 overflow-hidden">
            {/* Main Content */}
            <main className="flex-1 flex flex-col overflow-hidden">
                {/* Top Header */}
                <header className="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-200">
                    {/* Month Navigator */}
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => handleWeekChange('prev')}
                            className="p-1.5 hover:bg-gray-100 rounded-full transition-colors"
                        >
                            <ChevronLeft className="w-5 h-5 text-gray-400" />
                        </button>
                        <span className="text-base font-medium text-gray-800 min-w-[140px] text-center">
                            {monthYearDisplay}
                        </span>
                        <button
                            onClick={() => handleWeekChange('next')}
                            className="p-1.5 hover:bg-gray-100 rounded-full transition-colors"
                        >
                            <ChevronRight className="w-5 h-5 text-gray-400" />
                        </button>
                    </div>

                    <div className="flex items-center gap-3">
                        {/* Refresh Button */}
                        <button
                            onClick={fetchEvents}
                            disabled={loading}
                            className="p-2 hover:bg-gray-100 rounded-lg transition-colors relative"
                            title="Refresh events"
                        >
                            <RefreshCw className={`w-5 h-5 text-gray-600 ${loading ? 'animate-spin' : ''}`} />
                        </button>

                        {/* Notification Bell */}
                        <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors relative">
                            <svg className="w-5 h-5 text-gray-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                            </svg>
                        </button>

                        {/* Today Button */}
                        <button
                            onClick={goToToday}
                            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                        >
                            Today
                        </button>
                    </div>
                </header>

                {/* Error Message */}
                {error && (
                    <div className="mx-6 mt-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
                        <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                        <p className="text-sm text-red-700">{error}</p>
                        <button
                            onClick={fetchEvents}
                            className="ml-auto text-sm text-red-600 hover:text-red-700 font-medium"
                        >
                            Retry
                        </button>
                    </div>
                )}

                {/* Loading State */}
                {loading && !error && (
                    <div className="flex items-center justify-center py-8">
                        <Loader2 className="w-6 h-6 text-orange-500 animate-spin" />
                        <span className="ml-2 text-gray-600">Loading your schedule...</span>
                    </div>
                )}

                {/* Calendar Grid */}
                <div className="flex-1 overflow-auto">
                    <div className="min-w-[800px]">
                        {/* Day Headers */}
                        <div className="grid bg-white border-b border-gray-200 sticky top-0 z-10" style={{ gridTemplateColumns: `70px repeat(${daysDisplayed}, 1fr)` }}>
                            {/* Timezone */}
                            <div className="px-2 py-3 text-xs text-gray-400 text-center border-r border-gray-200">
                                {Intl.DateTimeFormat().resolvedOptions().timeZone.split('/').pop()?.replace('_', ' ') || 'Local'}
                            </div>

                            {/* Day Columns */}
                            {weekDays.map((day, index) => {
                                const isToday = day.toDateString() === today.toDateString();
                                const dayNum = day.getDate();
                                const dayName = day.toLocaleDateString('en-US', { weekday: 'short' });

                                return (
                                    <div
                                        key={index}
                                        className={`px-4 py-3 text-center border-r border-gray-200 ${isToday ? 'bg-orange-50' : ''}`}
                                    >
                                        <div className={`text-2xl font-bold ${isToday ? 'text-orange-500' : 'text-gray-900'}`}>
                                            {dayNum.toString().padStart(2, '0')}
                                        </div>
                                        <div className={`text-xs font-medium ${isToday ? 'text-orange-500' : 'text-gray-500'}`}>
                                            {dayName}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* All Day Row */}
                        <div className="grid bg-white border-b border-gray-200" style={{ gridTemplateColumns: `70px repeat(${daysDisplayed}, 1fr)` }}>
                            <div className="px-2 py-2 text-xs text-gray-400 text-center border-r border-gray-200">
                                All Day
                            </div>
                            {weekDays.map((_, index) => (
                                <div key={index} className="px-2 py-2 border-r border-gray-200 min-h-[40px]" />
                            ))}
                        </div>

                        {/* Time Grid */}
                        <div className="relative">
                            {/* Realtime Indicator - Spans across entire grid */}
                            <div
                                className="absolute left-0 right-0 z-20 pointer-events-none flex items-center"
                                style={{ top: `${getCurrentTimePosition()}px` }}
                            >
                                {/* Time label on the left */}
                                <div className="w-[70px] flex justify-end pr-2">
                                    <span className="bg-blue-600 text-white text-[10px] font-semibold px-2 py-0.5 rounded">
                                        {formatCurrentTimeLabel()}
                                    </span>
                                </div>
                                {/* Horizontal line with dots */}
                                <div className="flex-1 flex items-center">
                                    {/* Left dot */}
                                    <div className="w-2.5 h-2.5 bg-blue-600 rounded-full flex-shrink-0" />
                                    {/* Line */}
                                    <div className="flex-1 h-0.5 bg-blue-600" />
                                    {/* Right dot */}
                                    <div className="w-2.5 h-2.5 bg-blue-600 rounded-full flex-shrink-0" />
                                </div>
                            </div>

                            <div className="grid" style={{ gridTemplateColumns: `70px repeat(${daysDisplayed}, 1fr)` }}>
                                {/* Time Labels Column */}
                                <div className="border-r border-gray-200 bg-white">
                                    {timeSlots.map((time, index) => (
                                        <div key={index} className="relative border-b border-gray-200" style={{ height: `${PIXELS_PER_HOUR}px` }}>
                                            <span className="absolute -top-2.5 right-3 text-xs text-gray-400 font-medium bg-white px-1">
                                                {time}
                                            </span>
                                        </div>
                                    ))}
                                </div>

                                {/* Day Columns */}
                                {weekDays.map((day, dayIndex) => {
                                    const dayEvents = getEventsForDay(day);
                                    const isToday = day.toDateString() === today.toDateString();

                                    return (
                                        <div
                                            key={dayIndex}
                                            className={`relative border-r border-gray-200 ${isToday ? 'bg-orange-50/50' : ''}`}
                                        >
                                            {/* Hour Lines */}
                                            {timeSlots.map((_, index) => (
                                                <div
                                                    key={index}
                                                    className="border-b border-gray-200"
                                                    style={{ height: `${PIXELS_PER_HOUR}px` }}
                                                />
                                            ))}

                                            {/* Events */}
                                            {dayEvents.map((event) => (
                                                <EventCard
                                                    key={event.id}
                                                    event={event}
                                                    pixelsPerHour={PIXELS_PER_HOUR}
                                                    onEdit={handleEditEvent}
                                                    onDelete={handleDeleteEvent}
                                                    onSetReminder={handleSetReminder}
                                                />
                                            ))}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            {/* Modals */}
            <DeleteModal
                event={selectedEvent}
                isOpen={showDeleteModal}
                onClose={() => {
                    setShowDeleteModal(false);
                    setSelectedEvent(null);
                }}
                onConfirm={confirmDeleteEvent}
                isDeleting={isDeleting}
            />

            <EditModal
                event={selectedEvent}
                isOpen={showEditModal}
                onClose={() => {
                    setShowEditModal(false);
                    setSelectedEvent(null);
                }}
                onSave={saveEditEvent}
                isSaving={isSaving}
            />

            <ReminderModal
                event={selectedEvent}
                isOpen={showReminderModal}
                onClose={() => {
                    setShowReminderModal(false);
                    setSelectedEvent(null);
                }}
                onSetReminder={confirmSetReminder}
                isSetting={isSettingReminder}
            />
        </div>
    );
}
