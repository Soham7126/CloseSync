'use client';

import { useState } from 'react';

interface InviteModalProps {
    isOpen: boolean;
    onClose: () => void;
    teamName: string;
    inviteCode: string;
}

export default function InviteModal({ isOpen, onClose, teamName, inviteCode }: InviteModalProps) {
    const [copied, setCopied] = useState(false);
    const [copiedCode, setCopiedCode] = useState(false);

    if (!isOpen) return null;

    const inviteLink = `${typeof window !== 'undefined' ? window.location.origin : ''}/join/${inviteCode}`;

    // Fallback copy function for browsers without clipboard API
    const copyToClipboard = (text: string): boolean => {
        // Try modern clipboard API first
        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(text);
            return true;
        }

        // Fallback for HTTP or older browsers
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

    return (
        <div
            className="fixed inset-0 flex items-center justify-center p-4"
            style={{ zIndex: 9999 }}
        >
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/70 backdrop-blur-sm"
                onClick={onClose}
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
                            <p className="text-sm text-gray-400">Share this link with your teammates</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-lg hover:bg-[#2a2a3e] text-gray-400 hover:text-white transition-colors"
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Content */}
                <div className="p-5 space-y-5">
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
                            Anyone with this link can join your team. Only share with people you trust.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
