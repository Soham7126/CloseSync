'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import {
    ChevronLeft,
    ChevronRight,
    Plus,
    Minus,
    Calendar,
    Video,
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

// Calendar categories/legends
const calendarCategories: CalendarCategory[] = [
    { id: 'work', name: 'Work', color: 'bg-orange-100', dotColor: 'bg-orange-500' },
    { id: 'personal', name: 'Personal', color: 'bg-purple-100', dotColor: 'bg-purple-500' },
    { id: 'break', name: 'Break', color: 'bg-green-100', dotColor: 'bg-green-500' },
    { id: 'activities', name: 'Activities', color: 'bg-blue-100', dotColor: 'bg-blue-500' },
    { id: 'essentials', name: 'Essentials', color: 'bg-gray-100', dotColor: 'bg-gray-400' },
];

// Constants for time grid
const PIXELS_PER_HOUR = 60; // Height of each hour slot in pixels
const START_HOUR = 6; // Calendar starts at 6 AM
const END_HOUR = 22; // Calendar ends at 10 PM

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

// Mini Calendar Component
function MiniCalendar({
    currentDate,
    selectedDate,
    onDateSelect,
    onMonthChange,
}: {
    currentDate: Date;
    selectedDate: Date;
    onDateSelect: (date: Date) => void;
    onMonthChange: (direction: 'prev' | 'next') => void;
}) {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const monthName = currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);
    const startingDayOfWeek = (firstDayOfMonth.getDay() + 6) % 7; // Monday = 0
    const daysInMonth = lastDayOfMonth.getDate();

    const prevMonthLastDay = new Date(year, month, 0).getDate();

    const days: { date: Date; isCurrentMonth: boolean }[] = [];

    // Previous month days
    for (let i = startingDayOfWeek - 1; i >= 0; i--) {
        days.push({
            date: new Date(year, month - 1, prevMonthLastDay - i),
            isCurrentMonth: false,
        });
    }

    // Current month days
    for (let i = 1; i <= daysInMonth; i++) {
        days.push({
            date: new Date(year, month, i),
            isCurrentMonth: true,
        });
    }

    // Next month days to fill the grid
    const remainingDays = 42 - days.length;
    for (let i = 1; i <= remainingDays; i++) {
        days.push({
            date: new Date(year, month + 1, i),
            isCurrentMonth: false,
        });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return (
        <div className="p-4">
            {/* Month Navigation */}
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-gray-800">{monthName}</h3>
                <div className="flex items-center gap-1">
                    <button
                        onClick={() => onMonthChange('prev')}
                        className="p-1 hover:bg-gray-100 rounded transition-colors"
                    >
                        <ChevronLeft className="w-4 h-4 text-gray-500" />
                    </button>
                    <button
                        onClick={() => onMonthChange('next')}
                        className="p-1 hover:bg-gray-100 rounded transition-colors"
                    >
                        <ChevronRight className="w-4 h-4 text-gray-500" />
                    </button>
                </div>
            </div>

            {/* Day Headers */}
            <div className="grid grid-cols-7 gap-1 mb-2">
                {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map((day) => (
                    <div key={day} className="text-center text-xs font-medium text-gray-400 py-1">
                        {day}
                    </div>
                ))}
            </div>

            {/* Calendar Grid */}
            <div className="grid grid-cols-7 gap-1">
                {days.map(({ date, isCurrentMonth }, index) => {
                    const isToday = date.toDateString() === today.toDateString();
                    const isSelected = date.toDateString() === selectedDate.toDateString();

                    return (
                        <button
                            key={index}
                            onClick={() => onDateSelect(date)}
                            className={`
                                w-7 h-7 text-xs rounded-full flex items-center justify-center transition-all
                                ${!isCurrentMonth ? 'text-gray-300' : 'text-gray-700'}
                                ${isToday ? 'bg-orange-500 text-white font-semibold' : ''}
                                ${isSelected && !isToday ? 'bg-orange-100 text-orange-600' : ''}
                                ${!isToday && !isSelected ? 'hover:bg-gray-100' : ''}
                            `}
                        >
                            {date.getDate()}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

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
function EventCard({ event, pixelsPerHour }: { event: CalendarEvent; pixelsPerHour: number }) {
    const startMinutes = timeToMinutes(event.startTime);
    const endMinutes = timeToMinutes(event.endTime);
    const durationMinutes = endMinutes - startMinutes;

    // Calculate position based on pixelsPerHour
    const topOffset = ((startMinutes - START_HOUR * 60) / 60) * pixelsPerHour;
    const height = Math.max((durationMinutes / 60) * pixelsPerHour - 2, 60);

    // Format time display
    const timeDisplay = `${formatTimeToAMPM(event.startTime)} - ${formatTimeToAMPM(event.endTime)}`;

    return (
        <div
            className="absolute left-1 right-1 rounded-xl border border-gray-200 bg-white shadow-sm cursor-pointer transition-all duration-200 hover:shadow-md overflow-hidden"
            style={{
                top: `${topOffset}px`,
                height: `${height}px`,
            }}
        >
            <div className="flex flex-col h-full p-2.5">
                {/* Header with icon and title */}
                <div className="flex items-center gap-2">
                    <span className="text-gray-400 flex-shrink-0">
                        {event.icon}
                    </span>
                    <h4 className="text-sm font-semibold text-gray-900 truncate leading-tight">
                        {event.title}
                    </h4>
                </div>

                {/* Time display */}
                <p className="text-xs text-gray-400 mt-0.5">
                    {timeDisplay}
                </p>

                {/* Attendees - Colored circle avatars like in the reference */}
                {event.attendees && event.attendees.length > 0 && (
                    <div className="flex items-center mt-auto pt-1">
                        <div className="flex -space-x-1">
                            {event.attendees.slice(0, 4).map((attendee, index) => (
                                <div
                                    key={attendee.id}
                                    className={`w-6 h-6 rounded-full border-2 border-white flex items-center justify-center overflow-hidden ${ATTENDEE_COLORS[index % ATTENDEE_COLORS.length]}`}
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
                                    ) : null}
                                </div>
                            ))}
                            {event.attendees.length > 4 && (
                                <div
                                    className="w-6 h-6 rounded-full bg-gray-200 border-2 border-white flex items-center justify-center"
                                    style={{ zIndex: 5 }}
                                >
                                    <span className="text-[9px] font-semibold text-gray-600">
                                        +{event.attendees.length - 4}
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Zoom Link */}
                {event.hasZoomLink && height > 90 && (
                    <button className="flex items-center gap-1.5 mt-2 text-xs text-blue-600 hover:text-blue-700 font-medium">
                        <Video className="w-3.5 h-3.5" />
                        Launch Zoom
                    </button>
                )}
            </div>
        </div>
    );
}

// Main Schedule Page Component
export default function SchedulePage() {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [daysDisplayed, setDaysDisplayed] = useState(5);
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [events, setEvents] = useState<CalendarEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const supabase = createSupabaseBrowserClient();

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

    const handleMonthChange = (direction: 'prev' | 'next') => {
        setCurrentDate((prev) => {
            const newDate = new Date(prev);
            newDate.setMonth(newDate.getMonth() + (direction === 'next' ? 1 : -1));
            return newDate;
        });
    };

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
        setSelectedDate(today);
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
            {/* Left Sidebar */}
            <aside
                className={`
                    ${sidebarOpen ? 'w-64' : 'w-0'}
                    flex-shrink-0 bg-white border-r border-gray-200
                    transition-all duration-300 overflow-hidden
                    lg:w-64
                `}
            >
                <div className="flex flex-col h-full">
                    {/* Mini Calendar */}
                    <MiniCalendar
                        currentDate={currentDate}
                        selectedDate={selectedDate}
                        onDateSelect={(date) => {
                            setSelectedDate(date);
                            setCurrentDate(date);
                        }}
                        onMonthChange={handleMonthChange}
                    />

                    {/* Days Displayed Counter */}
                    <div className="px-4 pb-4 border-b border-gray-100">
                        <div className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                            <button
                                onClick={() => setDaysDisplayed(Math.max(1, daysDisplayed - 1))}
                                className="p-1 hover:bg-gray-200 rounded transition-colors"
                            >
                                <Minus className="w-3 h-3 text-gray-500" />
                            </button>
                            <span className="text-xs text-gray-600">
                                <span className="font-semibold">{daysDisplayed}</span>
                                <span className="mx-1">+</span>
                                <span>days displayed</span>
                            </span>
                            <button
                                onClick={() => setDaysDisplayed(Math.min(7, daysDisplayed + 1))}
                                className="p-1 hover:bg-gray-200 rounded transition-colors"
                            >
                                <Plus className="w-3 h-3 text-gray-500" />
                            </button>
                        </div>
                    </div>

                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 flex flex-col overflow-hidden">
                {/* Top Header */}
                <header className="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-200">
                    <h1 className="text-2xl font-bold text-gray-900">{monthYearDisplay}</h1>

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

                        {/* Navigation */}
                        <div className="flex items-center">
                            <button
                                onClick={() => handleWeekChange('prev')}
                                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                                <ChevronLeft className="w-5 h-5 text-gray-600" />
                            </button>
                            <button
                                onClick={() => handleWeekChange('next')}
                                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                                <ChevronRight className="w-5 h-5 text-gray-600" />
                            </button>
                        </div>
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

            {/* Mobile Sidebar Toggle */}
            <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="lg:hidden fixed bottom-4 left-4 p-3 bg-orange-500 text-white rounded-full shadow-lg z-50"
            >
                <Calendar className="w-5 h-5" />
            </button>
        </div>
    );
}
