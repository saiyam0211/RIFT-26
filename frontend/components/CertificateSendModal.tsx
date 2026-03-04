'use client';

import { useState } from 'react';
import { X, Award, Send, CheckCircle, AlertTriangle } from 'lucide-react';
import { getAdminToken } from '../src/lib/admin-auth';

type CertType = 'participant' | 'semi_finalist' | 'winner' | 'volunteer' | 'hod' | 'custom';

interface CertificateSendModalProps {
    isOpen: boolean;
    onClose: () => void;
    selectedTeamIds: string[];
    certType: CertType;
    estimatedParticipants: number;
    /** If true, shows position input (for winner certs) */
    showPositionInput?: boolean;
}

interface SendResult {
    message: string;
    sent_count: number;
    skipped_count: number;
    total: number;
    errors: string[];
}

const certLabels: Record<CertType, string> = {
    participant: 'Participation Certificate',
    semi_finalist: 'Semi-Finalist Certificate',
    winner: 'Winner Certificate',
    volunteer: 'Volunteer Certificate',
    hod: 'Head of Department Certificate',
    custom: 'Custom Certificate',
};

export function CertificateSendModal({
    isOpen,
    onClose,
    selectedTeamIds,
    certType,
    estimatedParticipants,
    showPositionInput,
}: CertificateSendModalProps) {
    const [sending, setSending] = useState(false);
    const [result, setResult] = useState<SendResult | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [position, setPosition] = useState('');

    if (!isOpen) return null;

    const needsPosition = showPositionInput || certType === 'winner';
    const certLabel = certLabels[certType] || 'Certificate';

    const handleSend = async () => {
        if (needsPosition && !position.trim()) {
            setError('Please enter a position (e.g. "1st Place", "2nd Place")');
            return;
        }

        setSending(true);
        setError(null);
        setResult(null);
        try {
            const token = getAdminToken();
            const body: Record<string, unknown> = {
                team_ids: selectedTeamIds,
                cert_type: certType,
            };
            if (needsPosition) {
                body.position = position.trim();
            }

            const res = await fetch(
                `${process.env.NEXT_PUBLIC_API_URL}/admin/certificates/send`,
                {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(body),
                }
            );
            const data = await res.json();
            if (!res.ok) {
                setError(data.error || 'Failed to send certificates');
                return;
            }
            setResult(data);
        } catch {
            setError('Network error. Please try again.');
        } finally {
            setSending(false);
        }
    };

    const handleClose = () => {
        setResult(null);
        setError(null);
        setPosition('');
        onClose();
    };

    return (
        <div
            className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
            onClick={(e) => e.target === e.currentTarget && handleClose()}
        >
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl max-w-md w-full shadow-2xl">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-zinc-800">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center">
                            <Award className="w-5 h-5 text-amber-400" />
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold text-white">Send Certificates</h3>
                            <p className="text-xs text-zinc-500 mt-0.5">{certLabel}</p>
                        </div>
                    </div>
                    <button onClick={handleClose} className="text-zinc-400 hover:text-white transition p-1">
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 space-y-4">
                    {!result ? (
                        <>
                            {/* Stats */}
                            <div className="grid grid-cols-2 gap-3">
                                <div className="bg-zinc-800/60 rounded-lg p-4 text-center">
                                    <div className="text-2xl font-bold text-white">{selectedTeamIds.length}</div>
                                    <div className="text-xs text-zinc-400 mt-1">Teams Selected</div>
                                </div>
                                <div className="bg-zinc-800/60 rounded-lg p-4 text-center">
                                    <div className="text-2xl font-bold text-amber-400">~{estimatedParticipants}</div>
                                    <div className="text-xs text-zinc-400 mt-1">Participants</div>
                                </div>
                            </div>

                            {/* Position input for winners */}
                            {needsPosition && (
                                <div>
                                    <label className="block text-sm text-zinc-300 font-medium mb-2">
                                        Position / Title <span className="text-red-400">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={position}
                                        onChange={(e) => setPosition(e.target.value)}
                                        placeholder="e.g. 1st Place, Best Innovation, etc."
                                        className="w-full px-4 py-3 bg-zinc-950 border border-zinc-700 text-white rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent placeholder:text-zinc-600"
                                    />
                                </div>
                            )}

                            {/* Info note */}
                            <div className="bg-zinc-800/40 border border-zinc-700/50 rounded-lg p-4 space-y-2 text-sm text-zinc-400">
                                <p>✅ Each participant receives a <strong className="text-zinc-200">unique, verifiable certificate</strong> via email.</p>
                                <p>🔗 The email includes a <strong className="text-zinc-200">LinkedIn &quot;Add to Profile&quot;</strong> button.</p>
                                <p>🔄 Re-sending to a team refreshes their certificate with the latest issue date.</p>
                            </div>

                            {error && (
                                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 flex items-center gap-2 text-red-400 text-sm">
                                    <AlertTriangle className="w-4 h-4 shrink-0" />
                                    {error}
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="space-y-4">
                            <div className="flex items-center gap-3 text-green-400">
                                <CheckCircle className="w-6 h-6" />
                                <span className="font-semibold text-lg">Certificates Sent!</span>
                            </div>
                            <div className="grid grid-cols-3 gap-3">
                                <div className="bg-zinc-800/60 rounded-lg p-3 text-center">
                                    <div className="text-xl font-bold text-green-400">{result.sent_count}</div>
                                    <div className="text-xs text-zinc-400 mt-1">Sent</div>
                                </div>
                                <div className="bg-zinc-800/60 rounded-lg p-3 text-center">
                                    <div className="text-xl font-bold text-amber-400">{result.skipped_count}</div>
                                    <div className="text-xs text-zinc-400 mt-1">Skipped</div>
                                </div>
                                <div className="bg-zinc-800/60 rounded-lg p-3 text-center">
                                    <div className="text-xl font-bold text-zinc-200">{result.total}</div>
                                    <div className="text-xs text-zinc-400 mt-1">Total</div>
                                </div>
                            </div>
                            {result.errors && result.errors.length > 0 && (
                                <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 max-h-32 overflow-y-auto">
                                    <p className="text-red-400 text-xs font-semibold mb-2">Errors ({result.errors.length})</p>
                                    {result.errors.map((e, i) => (
                                        <p key={i} className="text-red-300 text-xs">{e}</p>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-zinc-800 flex gap-3 justify-end">
                    <button
                        onClick={handleClose}
                        className="px-4 py-2 rounded-lg bg-zinc-800 text-zinc-200 hover:bg-zinc-700 text-sm font-medium transition"
                    >
                        {result ? 'Close' : 'Cancel'}
                    </button>
                    {!result && (
                        <button
                            onClick={handleSend}
                            disabled={sending || selectedTeamIds.length === 0}
                            className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 disabled:opacity-60 text-black font-semibold text-sm transition"
                        >
                            {sending ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                                    Sending...
                                </>
                            ) : (
                                <>
                                    <Send className="w-4 h-4" />
                                    Send Certificates
                                </>
                            )}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
