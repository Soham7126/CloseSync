'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import CalendarConnection from '@/components/CalendarConnection';
import InviteModal from '@/components/InviteModal';
import { createSupabaseBrowserClient } from '@/lib/supabase';
import type { User } from '@/lib/supabase';

type SettingsTab = 'profile' | 'calendar' | 'notifications' | 'team' | 'billing' | 'account';

const tabs: { id: SettingsTab; label: string; icon: React.ReactNode }[] = [
    {
        id: 'profile',
        label: 'Profile',
        icon: (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
        ),
    },
    {
        id: 'calendar',
        label: 'Calendar Integration',
        icon: (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
        ),
    },
    {
        id: 'notifications',
        label: 'Notifications',
        icon: (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
        ),
    },
    {
        id: 'team',
        label: 'Team',
        icon: (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
        ),
    },
    {
        id: 'billing',
        label: 'Billing',
        icon: (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
            </svg>
        ),
    },
    {
        id: 'account',
        label: 'Account',
        icon: (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
        ),
    },
];

function SettingsContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { user, profile, team } = useAuth();

    const currentTab = (searchParams.get('tab') as SettingsTab) || 'profile';

    const [timezone, setTimezone] = useState('Asia/Kolkata');
    const [workingHoursStart, setWorkingHoursStart] = useState('09:00');
    const [workingHoursEnd, setWorkingHoursEnd] = useState('18:00');
    const [emailNotifications, setEmailNotifications] = useState({
        newMeeting: true,
        meetingReminder: true,
        dailySummary: false,
    });
    const [browserNotifications, setBrowserNotifications] = useState({
        newMeeting: true,
        meetingStarting: true,
    });
    const [teamMembers, setTeamMembers] = useState<User[]>([]);
    const [showInviteModal, setShowInviteModal] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);

    const setActiveTab = (tab: SettingsTab) => {
        router.push(`/dashboard/settings?tab=${tab}`);
    };

    const fetchTeamMembers = useCallback(async () => {
        if (!team?.id) return;

        const supabase = createSupabaseBrowserClient();
        const { data } = await supabase
            .from('users')
            .select('*')
            .eq('team_id', team.id);

        if (data) {
            setTeamMembers(data);
        }
    }, [team?.id]);

    useEffect(() => {
        fetchTeamMembers();
    }, [fetchTeamMembers]);

    const handleSaveProfile = async () => {
        setIsSaving(true);
        // Save profile settings
        await new Promise(resolve => setTimeout(resolve, 1000));
        setIsSaving(false);
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
    };

    const getInitials = (name: string) => {
        return name
            .split(' ')
            .map(n => n[0])
            .join('')
            .toUpperCase()
            .slice(0, 2);
    };

    const renderTabContent = () => {
        switch (currentTab) {
            case 'profile':
                return (
                    <div className="space-y-6">
                        <div>
                            <h3 className="text-lg font-semibold text-[#1F2937] mb-4">Profile Settings</h3>

                            {/* Avatar */}
                            <div className="flex items-center gap-4 mb-6">
                                <div className="w-20 h-20 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 font-bold text-2xl">
                                    {getInitials(profile?.name || 'U')}
                                </div>
                                <button className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-[#1F2937] hover:bg-gray-50 transition-colors">
                                    Upload Photo
                                </button>
                            </div>

                            {/* Name & Email */}
                            <div className="grid grid-cols-2 gap-4 mb-4">
                                <div>
                                    <label className="block text-sm font-medium text-[#1F2937] mb-1">Name</label>
                                    <input
                                        type="text"
                                        value={profile?.name || ''}
                                        disabled
                                        className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 text-gray-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-[#1F2937] mb-1">Email</label>
                                    <input
                                        type="email"
                                        value={profile?.email || user?.email || ''}
                                        disabled
                                        className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 text-gray-500"
                                    />
                                </div>
                            </div>

                            {/* Timezone */}
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-[#1F2937] mb-1">Timezone</label>
                                <select
                                    value={timezone}
                                    onChange={(e) => setTimezone(e.target.value)}
                                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-[#1F2937] focus:outline-none focus:ring-2 focus:ring-[#6366F1]/20 focus:border-[#6366F1]"
                                >
                                    <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
                                    <option value="America/New_York">America/New_York (EST)</option>
                                    <option value="America/Los_Angeles">America/Los_Angeles (PST)</option>
                                    <option value="Europe/London">Europe/London (GMT)</option>
                                    <option value="Europe/Paris">Europe/Paris (CET)</option>
                                </select>
                            </div>

                            {/* Working Hours */}
                            <div className="mb-6">
                                <label className="block text-sm font-medium text-[#1F2937] mb-1">Working Hours</label>
                                <div className="flex items-center gap-3">
                                    <input
                                        type="time"
                                        value={workingHoursStart}
                                        onChange={(e) => setWorkingHoursStart(e.target.value)}
                                        className="px-3 py-2 rounded-lg border border-gray-200 text-[#1F2937] focus:outline-none focus:ring-2 focus:ring-[#6366F1]/20 focus:border-[#6366F1]"
                                    />
                                    <span className="text-gray-500">to</span>
                                    <input
                                        type="time"
                                        value={workingHoursEnd}
                                        onChange={(e) => setWorkingHoursEnd(e.target.value)}
                                        className="px-3 py-2 rounded-lg border border-gray-200 text-[#1F2937] focus:outline-none focus:ring-2 focus:ring-[#6366F1]/20 focus:border-[#6366F1]"
                                    />
                                </div>
                            </div>

                            <button
                                onClick={handleSaveProfile}
                                disabled={isSaving}
                                className="px-6 py-2.5 bg-[#6366F1] text-white rounded-lg font-medium hover:bg-[#5558E3] transition-colors disabled:opacity-50 flex items-center gap-2"
                            >
                                {isSaving ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                        Saving...
                                    </>
                                ) : saveSuccess ? (
                                    <>
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                        </svg>
                                        Saved!
                                    </>
                                ) : (
                                    'Save Changes'
                                )}
                            </button>
                        </div>
                    </div>
                );

            case 'calendar':
                return (
                    <div>
                        <h3 className="text-lg font-semibold text-[#1F2937] mb-4">Calendar Integration</h3>
                        {user && <CalendarConnection userId={user.id} />}
                    </div>
                );

            case 'notifications':
                return (
                    <div className="space-y-6">
                        <h3 className="text-lg font-semibold text-[#1F2937] mb-4">Notification Preferences</h3>

                        <div>
                            <h4 className="text-sm font-medium text-[#1F2937] mb-3">Email Notifications</h4>
                            <div className="space-y-3">
                                {Object.entries(emailNotifications).map(([key, value]) => (
                                    <label key={key} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                        <span className="text-[#1F2937] capitalize">
                                            {key.replace(/([A-Z])/g, ' $1').trim()}
                                        </span>
                                        <button
                                            onClick={() => setEmailNotifications(prev => ({ ...prev, [key]: !value }))}
                                            className={`w-10 h-6 rounded-full transition-colors ${value ? 'bg-[#6366F1]' : 'bg-gray-300'}`}
                                        >
                                            <div className={`w-4 h-4 bg-white rounded-full transition-transform ml-1 ${value ? 'translate-x-4' : ''}`} />
                                        </button>
                                    </label>
                                ))}
                            </div>
                        </div>

                        <div>
                            <h4 className="text-sm font-medium text-[#1F2937] mb-3">Browser Notifications</h4>
                            <div className="space-y-3">
                                {Object.entries(browserNotifications).map(([key, value]) => (
                                    <label key={key} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                        <span className="text-[#1F2937] capitalize">
                                            {key.replace(/([A-Z])/g, ' $1').trim()}
                                        </span>
                                        <button
                                            onClick={() => setBrowserNotifications(prev => ({ ...prev, [key]: !value }))}
                                            className={`w-10 h-6 rounded-full transition-colors ${value ? 'bg-[#6366F1]' : 'bg-gray-300'}`}
                                        >
                                            <div className={`w-4 h-4 bg-white rounded-full transition-transform ml-1 ${value ? 'translate-x-4' : ''}`} />
                                        </button>
                                    </label>
                                ))}
                            </div>
                        </div>
                    </div>
                );

            case 'team':
                const isSuperAdmin = profile?.role === 'super_admin';
                const getRoleBadgeColor = (role: string) => {
                    switch (role) {
                        case 'super_admin':
                            return 'bg-purple-100 text-purple-700';
                        case 'admin':
                            return 'bg-blue-100 text-blue-700';
                        default:
                            return 'bg-gray-100 text-gray-700';
                    }
                };
                const formatRole = (role: string) => {
                    switch (role) {
                        case 'super_admin':
                            return 'Super Admin';
                        case 'admin':
                            return 'Admin';
                        default:
                            return 'Member';
                    }
                };

                return (
                    <div className="space-y-6">
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-semibold text-[#1F2937]">Team Management</h3>
                            {isSuperAdmin && (
                                <button
                                    onClick={() => setShowInviteModal(true)}
                                    className="px-4 py-2 bg-[#6366F1] text-white rounded-lg text-sm font-medium hover:bg-[#5558E3] transition-colors flex items-center gap-2"
                                >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                                    </svg>
                                    Invite Members
                                </button>
                            )}
                        </div>

                        {/* Your Role Info */}
                        <div className="p-4 bg-gradient-to-r from-[#6366F1]/10 to-[#8B5CF6]/10 rounded-xl border border-[#6366F1]/20">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-[#6366F1]/20">
                                    <svg className="w-5 h-5 text-[#6366F1]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                                    </svg>
                                </div>
                                <div>
                                    <p className="text-sm text-[#6B7280]">Your Role</p>
                                    <p className="font-semibold text-[#1F2937]">{formatRole(profile?.role || 'member')}</p>
                                </div>
                            </div>
                            {isSuperAdmin && (
                                <p className="mt-3 text-xs text-[#6B7280]">
                                    As a Super Admin, you can invite new members, manage roles, and configure team settings.
                                </p>
                            )}
                        </div>

                        {team && (
                            <div className="p-4 bg-gray-50 rounded-lg">
                                <label className="block text-sm font-medium text-[#1F2937] mb-1">Team Name</label>
                                <input
                                    type="text"
                                    value={team.name}
                                    disabled
                                    className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-[#1F2937]"
                                />
                            </div>
                        )}

                        <div>
                            <h4 className="text-sm font-medium text-[#1F2937] mb-3">Team Members ({teamMembers.length})</h4>
                            <div className="space-y-2">
                                {teamMembers.map((member) => (
                                    <div key={member.id} className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 font-medium text-sm">
                                                {getInitials(member.name)}
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <p className="text-[#1F2937] font-medium">{member.name}</p>
                                                    {member.id === user?.id && (
                                                        <span className="text-xs text-[#6B7280]">(You)</span>
                                                    )}
                                                </div>
                                                <p className="text-sm text-[#6B7280]">{member.email}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getRoleBadgeColor(member.role || 'member')}`}>
                                                {formatRole(member.role || 'member')}
                                            </span>
                                            {isSuperAdmin && member.id !== user?.id && (
                                                <button className="text-sm text-red-600 hover:text-red-700">
                                                    Remove
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                );

            case 'billing':
                return (
                    <div className="space-y-6">
                        <h3 className="text-lg font-semibold text-[#1F2937] mb-4">Billing & Subscription</h3>

                        <div className="p-6 bg-gradient-to-r from-[#6366F1] to-[#8B5CF6] rounded-xl text-white">
                            <div className="flex items-center justify-between mb-4">
                                <div>
                                    <p className="text-white/80 text-sm">Current Plan</p>
                                    <h4 className="text-2xl font-bold">Free</h4>
                                </div>
                                <button className="px-4 py-2 bg-white text-[#6366F1] rounded-lg font-medium hover:bg-gray-100 transition-colors">
                                    Upgrade
                                </button>
                            </div>
                            <div className="text-white/80 text-sm">
                                <p>{teamMembers.length} of 5 team members used</p>
                                <div className="mt-2 h-2 bg-white/20 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-white rounded-full"
                                        style={{ width: `${Math.min(100, (teamMembers.length / 5) * 100)}%` }}
                                    />
                                </div>
                            </div>
                        </div>

                        <div>
                            <h4 className="text-sm font-medium text-[#1F2937] mb-3">Available Plans</h4>
                            <div className="grid grid-cols-3 gap-4">
                                {[
                                    { name: 'Free', price: '$0', features: ['5 team members', 'Basic features'] },
                                    { name: 'Pro', price: '$12', features: ['25 team members', 'Advanced features', 'Priority support'] },
                                    { name: 'Business', price: '$29', features: ['Unlimited members', 'All features', 'Dedicated support'] },
                                ].map((plan) => (
                                    <div key={plan.name} className="p-4 border border-gray-200 rounded-xl">
                                        <h5 className="font-semibold text-[#1F2937]">{plan.name}</h5>
                                        <p className="text-2xl font-bold text-[#1F2937] mt-1">
                                            {plan.price}<span className="text-sm font-normal text-gray-500">/mo</span>
                                        </p>
                                        <ul className="mt-3 space-y-1">
                                            {plan.features.map((f, i) => (
                                                <li key={i} className="text-sm text-[#6B7280] flex items-center gap-2">
                                                    <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                    </svg>
                                                    {f}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                );

            case 'account':
                return (
                    <div className="space-y-6">
                        <h3 className="text-lg font-semibold text-[#1F2937] mb-4">Account Settings</h3>

                        <div>
                            <h4 className="text-sm font-medium text-[#1F2937] mb-3">Security</h4>
                            <div className="space-y-3">
                                <div className="p-4 bg-gray-50 rounded-lg flex items-center justify-between">
                                    <div>
                                        <p className="text-[#1F2937] font-medium">Change Password</p>
                                        <p className="text-sm text-[#6B7280]">Update your password regularly</p>
                                    </div>
                                    <button className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-[#1F2937] hover:bg-white transition-colors">
                                        Change
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div>
                            <h4 className="text-sm font-medium text-[#1F2937] mb-3">Data</h4>
                            <div className="p-4 bg-gray-50 rounded-lg flex items-center justify-between">
                                <div>
                                    <p className="text-[#1F2937] font-medium">Export Data</p>
                                    <p className="text-sm text-[#6B7280]">Download all your data</p>
                                </div>
                                <button className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-[#1F2937] hover:bg-white transition-colors">
                                    Export
                                </button>
                            </div>
                        </div>

                        <div className="pt-6 border-t border-gray-200">
                            <h4 className="text-sm font-medium text-red-600 mb-3">Danger Zone</h4>
                            <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-center justify-between">
                                <div>
                                    <p className="text-red-700 font-medium">Delete Account</p>
                                    <p className="text-sm text-red-600">Permanently delete your account and data</p>
                                </div>
                                <button className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors">
                                    Delete
                                </button>
                            </div>
                        </div>
                    </div>
                );

            default:
                return null;
        }
    };

    return (
        <div className="max-w-6xl mx-auto">

            <div className="flex gap-6">
                {/* Sidebar */}
                <div className="w-56 flex-shrink-0">
                    <nav className="space-y-1">
                        {tabs.map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left text-sm font-medium transition-colors ${currentTab === tab.id
                                    ? 'bg-[#6366F1] text-white'
                                    : 'text-[#6B7280] hover:bg-gray-100'
                                    }`}
                            >
                                {tab.icon}
                                {tab.label}
                            </button>
                        ))}
                    </nav>
                </div>

                {/* Content */}
                <div className="flex-1 bg-white rounded-2xl border border-gray-200 p-6">
                    {renderTabContent()}
                </div>
            </div>

            {/* Invite Modal */}
            {team && (
                <InviteModal
                    isOpen={showInviteModal}
                    onClose={() => setShowInviteModal(false)}
                    teamName={team.name}
                    inviteCode={team.invite_code}
                />
            )}
        </div>
    );
}

export default function SettingsPage() {
    return (
        <Suspense fallback={
            <div className="max-w-6xl mx-auto">
                <div className="animate-pulse">
                    <div className="h-8 bg-gray-200 rounded w-32 mb-6" />
                    <div className="flex gap-6">
                        <div className="w-56 space-y-2">
                            {[1, 2, 3, 4, 5, 6].map(i => (
                                <div key={i} className="h-10 bg-gray-200 rounded-lg" />
                            ))}
                        </div>
                        <div className="flex-1 h-96 bg-gray-200 rounded-2xl" />
                    </div>
                </div>
            </div>
        }>
            <SettingsContent />
        </Suspense>
    );
}
