'use client';

import { useState, useEffect } from 'react';
import axios from 'axios';
import { useRouter } from 'next/navigation';
import { auth } from '@/lib/firebase';
import { RecaptchaVerifier, signInWithPhoneNumber, ConfirmationResult } from 'firebase/auth';
import { setAuth } from '@/lib/auth';

interface Team {
    id: string;
    team_name: string;
    masked_phone: string;
    city: string | null;
    status: string;
    member_count: number;
    leader_name?: string;
    members?: Array<{ user_type: string; name: string }>;
}

export default function Home() {
    const router = useRouter();
    const [step, setStep] = useState<'search' | 'otp' | 'verifying'>('search');
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<Team[]>([]);
    const [suggestions, setSuggestions] = useState<Team[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
    const [phoneNumber, setPhoneNumber] = useState('');
    const [otpCode, setOtpCode] = useState('');
    const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // Debounced autocomplete
    useEffect(() => {
        const timer = setTimeout(async () => {
            if (searchQuery.trim().length >= 2) {
                try {
                    const response = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/teams/search`, {
                        params: { query: searchQuery },
                    });
                    setSuggestions(response.data.teams || []);
                    setShowSuggestions(true);
                } catch (err) {
                    console.error('Autocomplete error:', err);
                    setSuggestions([]);
                }
            } else {
                setSuggestions([]);
                setShowSuggestions(false);
            }
        }, 300);

        return () => clearTimeout(timer);
    }, [searchQuery]);

    const setupRecaptcha = () => {
        // Clear any existing verifier
        if ((window as any).recaptchaVerifier) {
            try {
                (window as any).recaptchaVerifier.clear();
            } catch (e) {
                console.log('Error clearing recaptcha:', e);
            }
        }

        // Create new verifier
        (window as any).recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
            size: 'invisible',
            callback: () => {
                console.log('reCAPTCHA solved');
            },
            'expired-callback': () => {
                console.log('reCAPTCHA expired');
            }
        });
    };

    const handleSearch = async () => {
        if (!searchQuery.trim()) return;
        setLoading(true);
        setError('');
        setShowSuggestions(false);

        try {
            const response = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/teams/search`, {
                params: { query: searchQuery },
            });
            setSearchResults(response.data.teams || []);
        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed to search teams');
        } finally {
            setLoading(false);
        }
    };

    const handleTeamSelect = (team: any) => {
        setSelectedTeam(team);
        setPhoneNumber('');
        setSearchQuery(team.team_name);
        setShowSuggestions(false);
        setStep('otp');
    };

    const handleSuggestionClick = (team: Team) => {
        handleTeamSelect(team);
    };

    const handleSendOTP = async () => {
        if (!selectedTeam) return;

        // Verify that 4 digits are entered
        if (phoneNumber.length !== 4) {
            setError('Please enter the last 4 digits of the team leader\'s phone number');
            return;
        }

        // Verify last 4 digits match
        const maskedLast4 = selectedTeam.masked_phone.slice(-4);
        if (phoneNumber !== maskedLast4) {
            setError('Last 4 digits do not match. Please check and try again.');
            return;
        }

        setLoading(true);
        setError('');

        try {
            // Get full phone number from backend after verification
            const verifyResponse = await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/teams/verify-phone`, {
                team_id: selectedTeam.id,
                last_4_digits: phoneNumber
            });

            const fullPhoneNumber = verifyResponse.data.phone_number;

            // Send OTP via Firebase
            setupRecaptcha();
            const formattedPhone = `+91${fullPhoneNumber}`;
            const confirmation = await signInWithPhoneNumber(auth, formattedPhone, (window as any).recaptchaVerifier);
            setConfirmationResult(confirmation);
            setStep('verifying');
        } catch (err: any) {
            setError(err.response?.data?.error || err.message || 'Failed to send OTP');
            console.error('OTP Send Error:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyOTP = async () => {
        if (!otpCode || otpCode.length !== 6) {
            setError('Please enter a valid 6-digit OTP');
            return;
        }

        if (!confirmationResult) {
            setError('Please request OTP first');
            return;
        }

        setLoading(true);
        setError('');

        try {
            // Verify OTP with Firebase
            const result = await confirmationResult.confirm(otpCode);
            const idToken = await result.user.getIdToken();

            // Send to backend for verification and JWT generation
            const response = await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/auth/verify-firebase`, {
                id_token: idToken,
                team_id: selectedTeam?.id,
            });

            // Save auth data
            setAuth(response.data.token, response.data.team);

            // Redirect based on RSVP status
            if (response.data.team.rsvp_locked) {
                router.push(`/dashboard/${response.data.team.dashboard_token}`);
            } else {
                router.push(`/rsvp/${response.data.team.id}`);
            }
        } catch (err: any) {
            setError(err.response?.data?.error || err.message || 'Failed to verify OTP');
            console.error('OTP Verification Error:', err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                <div className="bg-white rounded-2xl shadow-xl p-8">
                    <div className="text-center mb-8">
                        <h1 className="text-4xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                            RIFT '26
                        </h1>
                        <p className="text-gray-600 mt-2">Hackathon Registration</p>
                    </div>

                    {error && (
                        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                            {error}
                        </div>
                    )}

                    {/* Search Step */}
                    {step === 'search' && (
                        <div className="space-y-4">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Search Your Team
                            </label>

                            {/* Search Input with Autocomplete */}
                            <div className="relative">
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                                    placeholder="Enter team name"
                                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                />

                                {/* Autocomplete Suggestions Dropdown */}
                                {showSuggestions && suggestions.length > 0 && (
                                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-80 overflow-y-auto">
                                        {suggestions.map((team) => (
                                            <div
                                                key={team.id}
                                                onClick={() => handleSuggestionClick(team)}
                                                className="px-4 py-3 hover:bg-indigo-50 cursor-pointer border-b border-gray-100 last:border-b-0 transition-colors"
                                            >
                                                <div className="flex items-start justify-between">
                                                    <div className="flex-1">
                                                        <div className="font-semibold text-gray-900">{team.team_name}</div>
                                                        {team.leader_name && (
                                                            <div className="text-sm text-gray-600 mt-1">
                                                                <span className="font-medium">Leader:</span> {team.leader_name}
                                                            </div>
                                                        )}
                                                        <div className="text-xs text-gray-500 mt-0.5">
                                                            {team.city} • {team.member_count} members
                                                        </div>
                                                    </div>
                                                    {team.status && (
                                                        <div className="ml-4">
                                                            <span className={`px-2 py-1 text-xs rounded-full ${team.status === 'confirmed'
                                                                ? 'bg-green-100 text-green-700'
                                                                : team.status === 'shortlisted'
                                                                    ? 'bg-blue-100 text-blue-700'
                                                                    : 'bg-gray-100 text-gray-700'
                                                                }`}>
                                                                {team.status}
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <button
                                onClick={handleSearch}
                                disabled={loading || !searchQuery.trim()}
                                className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold py-3 px-6 rounded-lg hover:from-indigo-700 hover:to-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {loading ? 'Searching...' : 'Search Team'}
                            </button>

                            {searchResults.length > 0 && (
                                <div className="mt-6 space-y-2">
                                    <p className="text-sm font-medium text-gray-700">Select your team:</p>
                                    {searchResults.map((team) => (
                                        <button
                                            key={team.id}
                                            onClick={() => handleTeamSelect(team)}
                                            className="w-full p-4 text-left border border-gray-200 rounded-lg hover:border-indigo-500 hover:bg-indigo-50 transition"
                                        >
                                            <p className="font-medium text-gray-900">{team.team_name}</p>
                                            <p className="text-sm text-gray-600">{team.masked_phone}</p>
                                            <p className="text-xs text-gray-500">
                                                {team.city || 'No city selected'} • {team.member_count} members
                                            </p>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Phone Verification Step */}
                    {step === 'otp' && selectedTeam && (
                        <div className="space-y-4">
                            <button
                                onClick={() => { setStep('search'); setSelectedTeam(null); setShowSuggestions(false); }}
                                className="text-sm text-indigo-600 hover:text-indigo-700 flex items-center"
                            >
                                ← Back to search
                            </button>

                            <div className="bg-indigo-50 p-4 rounded-lg mb-4">
                                <p className="font-semibold text-gray-900">{selectedTeam.team_name}</p>
                                {/* <p className="text-sm text-gray-600 mt-1">
                                    Team Leader's Phone: {selectedTeam.masked_phone}
                                </p> */}
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Enter Last 4 Digits to Verify
                                </label>
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    value={phoneNumber}
                                    onChange={(e) => {
                                        const value = e.target.value.replace(/\D/g, '');
                                        if (value.length <= 4) {
                                            setPhoneNumber(value);
                                        }
                                    }}
                                    placeholder="••••"
                                    maxLength={4}
                                    className="w-full px-4 py-4 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-center text-3xl tracking-widest font-mono font-bold"
                                />
                                <p className="text-xs text-gray-500 mt-2 text-center">
                                    Enter the last 4 digits of the team leader's registered mobile number
                                </p>
                            </div>

                            <button
                                onClick={handleSendOTP}
                                disabled={loading || phoneNumber.length !== 4}
                                className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold py-3 px-6 rounded-lg hover:from-indigo-700 hover:to-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {loading ? 'Verifying...' : 'Send OTP'}
                            </button>

                            {/* reCAPTCHA Container - Now visible */}
                            <div className="mt-4">
                                <div id="recaptcha-container"></div>
                            </div>
                        </div>
                    )}

                    {/* OTP Verification Step */}
                    {step === 'verifying' && (
                        <div className="space-y-4">
                            <button
                                onClick={() => setStep('otp')}
                                className="text-sm text-indigo-600 hover:text-indigo-700 flex items-center"
                            >
                                ← Back
                            </button>

                            <div className="bg-green-50 p-4 rounded-lg">
                                <p className="text-sm text-green-800">
                                    ✓ OTP sent to {selectedTeam?.masked_phone}
                                </p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Enter OTP
                                </label>
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    value={otpCode}
                                    onChange={(e) => {
                                        const value = e.target.value.replace(/\D/g, '');
                                        if (value.length <= 6) {
                                            setOtpCode(value);
                                        }
                                    }}
                                    placeholder="6-digit OTP"
                                    maxLength={6}
                                    className="w-full px-4 py-4 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-center text-3xl tracking-widest font-mono font-bold"
                                />
                            </div>

                            <button
                                onClick={handleVerifyOTP}
                                disabled={loading || otpCode.length !== 6}
                                className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold py-3 px-6 rounded-lg hover:from-indigo-700 hover:to-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {loading ? 'Verifying...' : 'Verify OTP'}
                            </button>
                        </div>
                    )}

                    <div id="recaptcha-container"></div>
                </div>
            </div>
        </div>
    );
}
