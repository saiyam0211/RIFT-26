'use client';

import { useState } from 'react';
import {
    Award, Send, CheckCircle, AlertTriangle,
    Users, Trophy, Heart, Shield, Star
} from 'lucide-react';
import { getAdminToken } from '../../../src/lib/admin-auth';

type CertType = 'participant' | 'semi_finalist' | 'winner' | 'volunteer' | 'hod' | 'custom';

const certOptions: { value: CertType; label: string; icon: React.ReactNode; needsTeam: boolean; needsPosition: boolean; color: string }[] = [
    { value: 'participant', label: 'Participant', icon: <Users className="w-4 h-4" />, needsTeam: true, needsPosition: false, color: 'bg-red-600' },
    { value: 'semi_finalist', label: 'Semi-Finalist', icon: <Star className="w-4 h-4" />, needsTeam: true, needsPosition: false, color: 'bg-purple-600' },
    { value: 'winner', label: 'Winner', icon: <Trophy className="w-4 h-4" />, needsTeam: true, needsPosition: true, color: 'bg-amber-500' },
    { value: 'volunteer', label: 'Volunteer', icon: <Heart className="w-4 h-4" />, needsTeam: false, needsPosition: false, color: 'bg-green-600' },
    { value: 'hod', label: 'Head of Dept', icon: <Shield className="w-4 h-4" />, needsTeam: false, needsPosition: false, color: 'bg-blue-600' },
    { value: 'custom', label: 'Custom', icon: <Award className="w-4 h-4" />, needsTeam: false, needsPosition: true, color: 'bg-zinc-600' },
];

interface SendResult {
    message: string;
    cert_id?: string;
    error?: string;
}

export default function CertificatesPage() {
    const [certType, setCertType] = useState<CertType>('participant');
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [teamName, setTeamName] = useState('');
    const [position, setPosition] = useState('');
    const [sending, setSending] = useState(false);
    const [result, setResult] = useState<SendResult | null>(null);
    const [error, setError] = useState<string | null>(null);

    const selected = certOptions.find(o => o.value === certType)!;

    const handleSend = async () => {
        if (!name.trim()) { setError('Name is required'); return; }
        if (!email.trim() || !email.includes('@')) { setError('Valid email is required'); return; }
        if (selected.needsTeam && !teamName.trim()) { setError('Team name is required for ' + selected.label); return; }
        if (selected.needsPosition && !position.trim()) { setError('Position/title is required for ' + selected.label); return; }

        setSending(true);
        setError(null);
        setResult(null);

        try {
            const token = getAdminToken();
            const body: Record<string, unknown> = {
                name: name.trim(),
                email: email.trim(),
                cert_type: certType,
            };
            if (selected.needsTeam) body.team_name = teamName.trim();
            if (selected.needsPosition) body.position = position.trim();

            const res = await fetch(
                `${process.env.NEXT_PUBLIC_API_URL}/admin/certificates/send-manual`,
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
                setError(data.error || 'Failed to send certificate');
                return;
            }
            setResult(data);
        } catch {
            setError('Network error. Please try again.');
        } finally {
            setSending(false);
        }
    };

    const resetForm = () => {
        setName('');
        setEmail('');
        setTeamName('');
        setPosition('');
        setResult(null);
        setError(null);
    };

    return (
        <div>
            <div className="flex justify-between items-center mb-8">
                <h1 className="text-3xl font-bold text-white">Send Certificates</h1>
            </div>

            <div className="max-w-2xl mx-auto space-y-6">

                {/* Certificate Type selector */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-4">
                    <label className="block text-sm text-zinc-300 font-semibold">Certificate Type</label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {certOptions.map(opt => (
                            <button
                                key={opt.value}
                                onClick={() => { setCertType(opt.value); setError(null); }}
                                className={`flex items-center gap-2.5 px-4 py-3 rounded-xl border text-sm font-semibold transition-all
                                    ${certType === opt.value
                                        ? `${opt.color} border-transparent text-white shadow-lg scale-[1.02]`
                                        : 'bg-zinc-800/60 border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-white'
                                    }`}
                            >
                                {opt.icon}
                                {opt.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Form */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-4">
                    <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                        <Award className="w-5 h-5 text-amber-400" />
                        Recipient Details
                    </h3>

                    {/* Name */}
                    <div>
                        <label className="block text-sm text-zinc-400 mb-1.5">Full Name <span className="text-red-400">*</span></label>
                        <input
                            type="text"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            placeholder="e.g. John Doe"
                            className="w-full px-4 py-3 bg-zinc-950 border border-zinc-700 text-white rounded-lg focus:ring-2 focus:ring-red-600 focus:border-transparent placeholder:text-zinc-600"
                        />
                    </div>

                    {/* Email */}
                    <div>
                        <label className="block text-sm text-zinc-400 mb-1.5">Email <span className="text-red-400">*</span></label>
                        <input
                            type="email"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            placeholder="e.g. john@example.com"
                            className="w-full px-4 py-3 bg-zinc-950 border border-zinc-700 text-white rounded-lg focus:ring-2 focus:ring-red-600 focus:border-transparent placeholder:text-zinc-600"
                        />
                    </div>

                    {/* Team Name — only for team-based certs */}
                    {selected.needsTeam && (
                        <div>
                            <label className="block text-sm text-zinc-400 mb-1.5">Team Name <span className="text-red-400">*</span></label>
                            <input
                                type="text"
                                value={teamName}
                                onChange={e => setTeamName(e.target.value)}
                                placeholder="e.g. Team Alpha"
                                className="w-full px-4 py-3 bg-zinc-950 border border-zinc-700 text-white rounded-lg focus:ring-2 focus:ring-red-600 focus:border-transparent placeholder:text-zinc-600"
                            />
                        </div>
                    )}

                    {/* Position — only for winner / custom */}
                    {selected.needsPosition && (
                        <div>
                            <label className="block text-sm text-zinc-400 mb-1.5">
                                {certType === 'winner' ? 'Position' : 'Title / Role'} <span className="text-red-400">*</span>
                            </label>
                            <input
                                type="text"
                                value={position}
                                onChange={e => setPosition(e.target.value)}
                                placeholder={certType === 'winner' ? 'e.g. 1st Place, Best Innovation' : 'e.g. Head of Design, Event Coordinator'}
                                className="w-full px-4 py-3 bg-zinc-950 border border-zinc-700 text-white rounded-lg focus:ring-2 focus:ring-red-600 focus:border-transparent placeholder:text-zinc-600"
                            />
                        </div>
                    )}

                    {/* Error */}
                    {error && (
                        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 flex items-center gap-2 text-red-400 text-sm">
                            <AlertTriangle className="w-4 h-4 shrink-0" />
                            {error}
                        </div>
                    )}

                    {/* Success */}
                    {result && (
                        <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 space-y-2">
                            <div className="flex items-center gap-2 text-green-400">
                                <CheckCircle className="w-5 h-5" />
                                <span className="font-semibold">{result.message}</span>
                            </div>
                            {result.cert_id && (
                                <p className="text-zinc-400 text-xs font-mono">Certificate ID: {result.cert_id}</p>
                            )}
                            <button
                                onClick={resetForm}
                                className="mt-2 text-sm text-zinc-400 hover:text-white underline transition"
                            >
                                Send another certificate
                            </button>
                        </div>
                    )}

                    {/* Send button */}
                    {!result && (
                        <button
                            onClick={handleSend}
                            disabled={sending}
                            className={`w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-bold text-sm transition-all disabled:opacity-60
                                ${selected.color} text-white hover:brightness-110 active:scale-[0.97]`}
                        >
                            {sending ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    Sending...
                                </>
                            ) : (
                                <>
                                    <Send className="w-4 h-4" />
                                    Send {selected.label} Certificate
                                </>
                            )}
                        </button>
                    )}
                </div>

                {/* Help text */}
                <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-5 space-y-2 text-sm text-zinc-500">
                    <p>✅ The recipient will receive a <strong className="text-zinc-300">unique, verifiable certificate</strong> via email.</p>
                    <p>🔗 The email includes an <strong className="text-zinc-300">&quot;Add to LinkedIn&quot;</strong> button and a public verify page link.</p>
                    <p>📋 <strong className="text-zinc-300">Team-based types</strong> (Participant, Semi-Finalist, Winner) require a team name.</p>
                    <p>🏷️ <strong className="text-zinc-300">Non-team types</strong> (Volunteer, HOD, Custom) don&apos;t need a team name.</p>
                </div>
            </div>
        </div>
    );
}
