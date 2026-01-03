'use client';

import { useState } from 'react';

interface InviteModalProps {
    isOpen: boolean;
    onClose: () => void;
    teamName: string;
    inviteCode: string;
}

type InviteMethod = 'select' | 'code' | 'email';

interface EmailInvite {
    email: string;
    role: 'admin' | 'member';
}

export default function InviteModal({ isOpen, onClose, teamName, inviteCode }: InviteModalProps) {
    const [inviteMethod, setInviteMethod] = useState<InviteMethod>('select');
    const [copied, setCopied] = useState(false);
    const [copiedCode, setCopiedCode] = useState(false);

    // Email invite state
    const [emailInvites, setEmailInvites] = useState<EmailInvite[]>([
        { email: '', role: 'member' },
        { email: '', role: 'member' },
        { email: '', role: 'member' },
    ]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitSuccess, setSubmitSuccess] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [sentInvites, setSentInvites] = useState<Array<{ email: string; link: string; role: string }>>([]);

    if (!isOpen) return null;

    const inviteLink = `${typeof window !== 'undefined' ? window.location.origin : ''}/join/${inviteCode}`;

    const copyToClipboard = (text: string): boolean => {
        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(text);
            return true;
        }

        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();

        try {
            document.execCommand('copy');
            textArea.remove();
            return true;
        } catch (error) {
            console.error('Fallback copy failed:', error);
            textArea.remove();
            return false;
        }
    };

    const handleCopyLink = () => {
        if (copyToClipboard(inviteLink)) {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    const handleCopyCode = () => {
        if (copyToClipboard(inviteCode)) {
            setCopiedCode(true);
            setTimeout(() => setCopiedCode(false), 2000);
        }
    };

    const handleEmailChange = (index: number, email: string) => {
        const updated = [...emailInvites];
        updated[index].email = email;
        setEmailInvites(updated);
    };

    const handleRoleChange = (index: number, role: 'admin' | 'member') => {
        const updated = [...emailInvites];
        updated[index].role = role;
        setEmailInvites(updated);
    };

    const addMoreInvites = () => {
        setEmailInvites([...emailInvites, { email: '', role: 'member' }]);
    };

    const handleSendInvitations = async () => {
        const validInvites = emailInvites.filter(inv => inv.email.trim() && inv.email.includes('@'));

        if (validInvites.length === 0) {
            setSubmitError('Please enter at least one valid email address');
            return;
        }

        setIsSubmitting(true);
        setSubmitError(null);

        try {
            const response = await fetch('/api/team/invite', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ invitations: validInvites }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to send invitations');
            }

            setSentInvites(data.invitations || []);
            setSubmitSuccess(true);
        } catch (error) {
            setSubmitError(error instanceof Error ? error.message : 'Failed to send invitations');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleClose = () => {
        setInviteMethod('select');
        setEmailInvites([
            { email: '', role: 'member' },
            { email: '', role: 'member' },
            { email: '', role: 'member' },
        ]);
        setSubmitSuccess(false);
        setSubmitError(null);
        setSentInvites([]);
        onClose();
    };

    const renderMethodSelection = () => (
        <div className="p-6 space-y-4">
            <p className="text-gray-400 text-center mb-6">Choose how you want to invite team members</p>

            {/* Invite via Code Option */}
            <button
                onClick={() => setInviteMethod('code')}
                className="w-full p-4 rounded-xl border border-[#2a2a3e] hover:border-purple-500/50 hover:bg-[#2a2a3e]/50 transition-all group text-left"
            >
                <div className="flex items-start gap-4">
                    <div className="p-3 rounded-xl bg-purple-600/20 text-purple-400 group-hover:bg-purple-600/30 transition-colors">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                        </svg>
                    </div>
                    <div className="flex-1">
                        <h3 className="text-white font-semibold mb-1">Invite via Code</h3>
                        <p className="text-gray-400 text-sm">Share an invite link or code that anyone can use to join your team</p>
                    </div>
                    <svg className="w-5 h-5 text-gray-500 group-hover:text-purple-400 mt-1 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                </div>
            </button>

            {/* Invite via Email Option */}
            <button
                onClick={() => setInviteMethod('email')}
                className="w-full p-4 rounded-xl border border-[#2a2a3e] hover:border-purple-500/50 hover:bg-[#2a2a3e]/50 transition-all group text-left"
            >
                <div className="flex items-start gap-4">
                    <div className="p-3 rounded-xl bg-blue-600/20 text-blue-400 group-hover:bg-blue-600/30 transition-colors">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                    </div>
                    <div className="flex-1">
                        <h3 className="text-white font-semibold mb-1">Invite via Email</h3>
                        <p className="text-gray-400 text-sm">Send personalized invitations to specific people with assigned roles</p>
                    </div>
                    <svg className="w-5 h-5 text-gray-500 group-hover:text-blue-400 mt-1 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                </div>
            </button>
        </div>
    );

    const renderCodeInvite = () => (
        <div className="p-5 space-y-5">
            {/* Back button */}
            <button
                onClick={() => setInviteMethod('select')}
                className="flex items-center gap-2 text-gray-400 hover:text-white text-sm transition-colors"
            >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back to options
            </button>

            {/* Invite Link */}
            <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                    Invite Link
                </label>
                <div className="flex gap-2">
                    <div className="flex-1 px-3 py-2.5 rounded-lg bg-[#0f0f23] border border-[#2a2a3e] text-sm font-mono text-gray-300 truncate">
                        {inviteLink}
                    </div>
                    <button
                        onClick={handleCopyLink}
                        className={`px-4 py-2.5 rounded-lg font-medium text-sm transition-all flex items-center gap-2 ${copied
                            ? 'bg-green-600 text-white'
                            : 'bg-purple-600 hover:bg-purple-700 text-white'
                            }`}
                    >
                        {copied ? (
                            <>
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                                Copied!
                            </>
                        ) : (
                            <>
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                </svg>
                                Copy
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* Invite Code */}
            <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                    Or share this code
                </label>
                <div className="flex items-center justify-center gap-4 p-4 rounded-xl bg-[#0f0f23] border border-[#2a2a3e]">
                    <span className="text-2xl font-bold font-mono tracking-widest text-white">{inviteCode}</span>
                    <button
                        onClick={handleCopyCode}
                        className={`p-2 rounded-lg transition-colors ${copiedCode
                            ? 'bg-green-600 text-white'
                            : 'hover:bg-[#2a2a3e] text-gray-400 hover:text-white'
                            }`}
                    >
                        {copiedCode ? (
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                        ) : (
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                        )}
                    </button>
                </div>
            </div>

            {/* Info */}
            <div className="flex items-start gap-3 p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
                <svg className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm text-blue-300">
                    Anyone with this link can join your team as a member. Only share with people you trust.
                </p>
            </div>
        </div>
    );

    const renderEmailInvite = () => {
        if (submitSuccess) {
            return (
                <div className="p-6 space-y-5">
                    <div className="text-center py-4">
                        <div className="w-16 h-16 bg-green-600/20 rounded-full flex items-center justify-center mx-auto mb-4">
                            <svg className="w-8 h-8 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                        </div>
                        <h3 className="text-xl font-semibold text-white mb-2">Invitations Sent!</h3>
                        <p className="text-gray-400">Share these links with your team members</p>
                    </div>

                    <div className="space-y-3 max-h-60 overflow-y-auto">
                        {sentInvites.map((invite, idx) => (
                            <div key={idx} className="p-3 bg-[#0f0f23] rounded-lg border border-[#2a2a3e]">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-white text-sm font-medium">{invite.email}</span>
                                    <span className="text-xs px-2 py-1 rounded bg-purple-600/20 text-purple-400 capitalize">
                                        {invite.role}
                                    </span>
                                </div>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        readOnly
                                        value={invite.link}
                                        className="flex-1 px-2 py-1.5 rounded bg-[#1a1a2e] border border-[#2a2a3e] text-xs font-mono text-gray-400 truncate"
                                    />
                                    <button
                                        onClick={() => copyToClipboard(invite.link)}
                                        className="px-3 py-1.5 rounded bg-purple-600 hover:bg-purple-700 text-white text-xs font-medium transition-colors"
                                    >
                                        Copy
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
                        <svg className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        <p className="text-sm text-amber-300">
                            Please share these links manually with your team members. Links expire in 7 days.
                        </p>
                    </div>

                    <button
                        onClick={handleClose}
                        className="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors"
                    >
                        Done
                    </button>
                </div>
            );
        }

        return (
            <div className="p-5 space-y-4">
                {/* Back button */}
                <button
                    onClick={() => setInviteMethod('select')}
                    className="flex items-center gap-2 text-gray-400 hover:text-white text-sm transition-colors"
                >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    Back to options
                </button>

                <p className="text-gray-400 text-sm">
                    Enter email addresses and select roles for each team member
                </p>

                {/* Email inputs */}
                <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                    <div className="flex gap-2 text-xs text-gray-500 px-1">
                        <span className="flex-1">Email address</span>
                        <span className="w-32">Role</span>
                    </div>
                    {emailInvites.map((invite, idx) => (
                        <div key={idx} className="flex gap-2">
                            <input
                                type="email"
                                value={invite.email}
                                onChange={(e) => handleEmailChange(idx, e.target.value)}
                                placeholder="name@example.com"
                                className="flex-1 px-3 py-2.5 rounded-lg bg-[#0f0f23] border border-[#2a2a3e] text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 text-sm"
                            />
                            <select
                                value={invite.role}
                                onChange={(e) => handleRoleChange(idx, e.target.value as 'admin' | 'member')}
                                className="w-32 px-2 py-2.5 rounded-lg bg-[#0f0f23] border border-[#2a2a3e] text-white focus:outline-none focus:border-purple-500 text-sm cursor-pointer"
                            >
                                <option value="member">Member</option>
                                <option value="admin">Admin</option>
                            </select>
                        </div>
                    ))}
                </div>

                {/* Add more button */}
                <button
                    onClick={addMoreInvites}
                    className="w-full py-2.5 border border-dashed border-[#2a2a3e] rounded-lg text-gray-400 hover:text-white hover:border-[#3a3a4e] transition-colors text-sm flex items-center justify-center gap-2"
                >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Add more
                </button>

                {/* Error message */}
                {submitError && (
                    <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                        {submitError}
                    </div>
                )}

                {/* Send button */}
                <button
                    onClick={handleSendInvitations}
                    disabled={isSubmitting}
                    className="w-full py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-600/50 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                >
                    {isSubmitting ? (
                        <>
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            Sending...
                        </>
                    ) : (
                        <>
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                            </svg>
                            Send invitations
                        </>
                    )}
                </button>

                {/* Info */}
                <div className="flex items-start gap-3 p-3 rounded-xl bg-blue-500/10 border border-blue-500/20">
                    <svg className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-xs text-blue-300">
                        Each person will receive a unique link. They can sign up and join directly with their assigned role.
                    </p>
                </div>
            </div>
        );
    };

    return (
        <div
            className="fixed inset-0 flex items-center justify-center p-4"
            style={{ zIndex: 9999 }}
        >
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/70 backdrop-blur-sm"
                onClick={handleClose}
            />

            {/* Modal */}
            <div className="relative bg-[#1a1a2e] rounded-2xl border border-[#2a2a3e] shadow-2xl w-full max-w-md overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b border-[#2a2a3e]">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-purple-600/20">
                            <svg className="w-5 h-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                            </svg>
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold text-white">Invite to {teamName}</h2>
                            <p className="text-sm text-gray-400">
                                {inviteMethod === 'select' && 'Choose an invitation method'}
                                {inviteMethod === 'code' && 'Share link with your team'}
                                {inviteMethod === 'email' && 'Send email invitations'}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={handleClose}
                        className="p-2 rounded-lg hover:bg-[#2a2a3e] text-gray-400 hover:text-white transition-colors"
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Content */}
                {inviteMethod === 'select' && renderMethodSelection()}
                {inviteMethod === 'code' && renderCodeInvite()}
                {inviteMethod === 'email' && renderEmailInvite()}
            </div>
        </div>
    );
}
