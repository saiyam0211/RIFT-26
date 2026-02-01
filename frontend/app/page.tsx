'use client';

import { useState, useEffect } from 'react';
import axios from 'axios';
import { useRouter } from 'next/navigation';
import { auth } from '@/lib/firebase';
import { RecaptchaVerifier, signInWithPhoneNumber, ConfirmationResult } from 'firebase/auth';
import { useAuthStore } from '@/store/auth-store';
import LightRays from '@/components/LightRays';

interface Team {
    id: string;
    team_name: string;
    masked_phone: string;
    city: string | null;
    status: string;
    member_count: number;
    leader_name?: string;
    rsvp_locked?: boolean;
}

export default function Home() {
    const router = useRouter();
    const { setAuth } = useAuthStore();
    const [step, setStep] = useState<'search' | 'otp' | 'verifying'>('search');
    const [searchQuery, setSearchQuery] = useState('');
    const [suggestions, setSuggestions] = useState<Team[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
    const [phoneNumber, setPhoneNumber] = useState('');
    const [otpCode, setOtpCode] = useState('');
    const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
    const [loading, setLoading] = useState(false);
    const [searchingTeams, setSearchingTeams] = useState(false);
    const [error, setError] = useState('');
    const [isRSVPLocked, setIsRSVPLocked] = useState(false);

    // Debounced autocomplete with loading state
    useEffect(() => {
        const timer = setTimeout(async () => {
            if (searchQuery.trim().length >= 2) {
                setSearchingTeams(true);
                try {
                    const response = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/teams/search`, {
                        params: { query: searchQuery },
                    });
                    setSuggestions(response.data.teams || []);
                    setShowSuggestions(true);
                } catch (err) {
                    console.error('Autocomplete error:', err);
                    setSuggestions([]);
                } finally {
                    setSearchingTeams(false);
                }
            } else {
                setSuggestions([]);
                setShowSuggestions(false);
                setSearchingTeams(false);
            }
        }, 500);

        return () => clearTimeout(timer);
    }, [searchQuery]);

    const handleTeamSelect = (team: Team) => {
        setSelectedTeam(team);
        setPhoneNumber('');
        setSearchQuery(team.team_name);
        setShowSuggestions(false);
        setStep('otp');
        setIsRSVPLocked(team.rsvp_locked || false);
    };

    const setupRecaptcha = () => {
        if (!(window as any).recaptchaVerifier) {
            (window as any).recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
                size: 'normal',
                callback: () => console.log('reCAPTCHA resolved'),
            });
        }
    };

    const handleSendOTP = async () => {
        if (!selectedTeam) return;

        if (phoneNumber.length !== 4) {
            setError('Please enter the last 4 digits of the team leader\'s phone number');
            return;
        }

        const maskedLast4 = selectedTeam.masked_phone.slice(-4);
        if (phoneNumber !== maskedLast4) {
            setError('Last 4 digits do not match. Please check and try again.');
            return;
        }

        setLoading(true);
        setError('');

        try {
            const verifyResponse = await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/teams/verify-phone`, {
                team_id: selectedTeam.id,
                last_4_digits: phoneNumber
            });

            if (verifyResponse.data.rsvp_locked && verifyResponse.data.token) {
                console.log('RSVP already completed. Logging in directly...');
                setAuth(verifyResponse.data.token, verifyResponse.data.team);
                router.push(`/dashboard/${verifyResponse.data.dashboard_token}`);
                return;
            }

            const fullPhoneNumber = verifyResponse.data.phone_number;
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

    const handleVerifyOTP = async (otpCode: string) => {
        if (!confirmationResult) return;

        setLoading(true);
        setError('');

        try {
            const result = await confirmationResult.confirm(otpCode);
            const idToken = await result.user.getIdToken();

            const response = await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/auth/verify-firebase`, {
                id_token: idToken,
                team_id: selectedTeam?.id,
            });

            setAuth(response.data.token, response.data.team);

            const team = response.data.team;
            if (team.rsvp_locked && team.dashboard_token) {
                router.push(`/dashboard/${team.dashboard_token}`);
            } else {
                router.push(`/rsvp/${team.id}`);
            }
        } catch (err: any) {
            setError(err.response?.data?.error || err.message || 'Failed to verify OTP');
            console.error('OTP Verification Error:', err);
        } finally {
            setLoading(false);
        }
    };

    // Get current step info
    const getStepInfo = () => {
        if (step === 'search') {
            return { number: 1, text: 'Search Team' };
        } else if (step === 'otp') {
            return { number: 2, text: 'Verify Phone' };
        } else {
            return { number: 3, text: 'Verify OTP' };
        }
    };

    const currentStepInfo = getStepInfo();

    return (
        <div className="min-h-screen flex relative overflow-hidden">
            {/* LightRays Background */}
            <div className="absolute inset-0 -z-10 bg-[#060010]">
                <LightRays
                    raysOrigin="top-left"
                    raysColor="#c0211f"
                    raysSpeed={1}
                    lightSpread={0.5}
                    rayLength={3.5}
                    pulsating
                    fadeDistance={1}
                    saturation={1}
                    followMouse
                    mouseInfluence={0.1}
                    noiseAmount={0}
                    distortion={0}
                />
            </div>

            {/* Left Side - Fixed Title and Steps */}
            <div className="w-1/2 flex flex-col justify-center ml-20 px-16 py-12 fixed left-0 top-0 h-screen">
                <div className="space-y-12">
                    {/* Title */}
                    <div>
                        <h1 className="text-8xl font-tan font-bold text-[#c0211f] mb-4">
                            RIFT '26
                        </h1>
                        <p className="text-gray-400 text-xl">Hackathon Registration</p>
                    </div>

                    {/* Steps */}
                    <div className="space-y-6">
                        <div className={`flex items-center gap-4 transition-all duration-300 ${currentStepInfo.number === 1 ? 'opacity-100 scale-105' : 'opacity-50'}`}>
                            <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-xl ${currentStepInfo.number >= 1 ? 'bg-[#c0211f] text-white' : 'bg-gray-700 text-gray-400'}`}>
                                1
                            </div>
                            <span className="text-white text-2xl font-medium">Search Team</span>
                        </div>

                        <div className={`flex items-center gap-4 transition-all duration-300 ${currentStepInfo.number === 2 ? 'opacity-100 scale-105' : 'opacity-50'}`}>
                            <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-xl ${currentStepInfo.number >= 2 ? 'bg-[#c0211f] text-white' : 'bg-gray-700 text-gray-400'}`}>
                                2
                            </div>
                            <span className="text-white text-2xl font-medium">Verify Details</span>
                        </div>

                        <div className={`flex items-center gap-4 transition-all duration-300 ${currentStepInfo.number === 3 ? 'opacity-100 scale-105' : 'opacity-50'}`}>
                            <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-xl ${currentStepInfo.number >= 3 ? 'bg-[#c0211f] text-white' : 'bg-gray-700 text-gray-400'}`}>
                                3
                            </div>
                            <span className="text-white text-2xl font-medium">Complete RSVP/ <br />Open Dashboard</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Right Side - Dynamic Content */}
            <div className="w-1/2 ml-auto flex items-center justify-center min-h-screen">
                <div className="w-full max-w-md">
                    {/* Search Step */}
                    {step === 'search' && (
                        <div>
                            {/* Search Container - Fixed Position */}
                            <div className="relative">

                                {/* Search Input with Custom Styling */}
                                <div className="input-container w-full">
                                    <input
                                        type="text"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        placeholder="Enter team name"
                                        autoComplete="off"
                                    />
                                </div>

                                {/* Searching Animation - Positioned Absolutely Above */}
                                {searchingTeams && searchQuery.trim().length >= 2 && (
                                    <div className="relative top-12 left-1/2 transform -translate-x-1/2 loader-wrapper z-20">
                                        <div className="loader"></div>
                                        <div className="letter-wrapper">
                                            <span className="loader-letter">S</span>
                                            <span className="loader-letter">e</span>
                                            <span className="loader-letter">a</span>
                                            <span className="loader-letter">r</span>
                                            <span className="loader-letter">c</span>
                                            <span className="loader-letter">h</span>
                                            <span className="loader-letter">i</span>
                                            <span className="loader-letter">n</span>
                                            <span className="loader-letter">g</span>
                                        </div>
                                    </div>
                                )}


                                {/* Team Suggestions - Positioned Absolutely Below */}
                                {showSuggestions && suggestions.length > 0 && !searchingTeams && (
                                    <div className="absolute top-full mt-4 left-0 right-0 bg-black/40 backdrop-blur-xl rounded-xl shadow-2xl border border-white/10 max-h-64 overflow-y-auto animate-fade-in z-10 no-scrollbar">
                                        {suggestions.map((team) => (
                                            <button
                                                key={team.id}
                                                onClick={() => handleTeamSelect(team)}
                                                className="w-full p-4 text-left hover:bg-white/10 transition-colors border-b border-white/5 last:border-b-0"
                                            >
                                                <div className="flex items-center justify-between">
                                                    <div>
                                                        <p className="font-semibold text-white">{team.team_name}</p>
                                                        <p className="text-sm text-gray-300">Team Leader: {team.leader_name}</p>
                                                        <p className="text-xs text-gray-400">{team.city} • {team.member_count} members</p>
                                                    </div>
                                                    {team.rsvp_locked && (
                                                        <span className="px-3 py-1 bg-green-500/20 text-green-300 border border-green-500/30 rounded-full text-xs font-medium">
                                                            RSVP Done
                                                        </span>
                                                    )}
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                )}


                                {showSuggestions && suggestions.length === 0 && !searchingTeams && searchQuery.length >= 2 && (
                                    <div className="absolute top-full mt-4 left-0 right-0 bg-black/40 backdrop-blur-xl border border-white/10 rounded-xl p-4 text-center text-gray-400 animate-fade-in z-10">
                                        No teams found
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* OTP Step */}
                    {step === 'otp' && selectedTeam && (
                        <div className="space-y-6">
                            <button
                                onClick={() => {
                                    setStep('search');
                                    setSelectedTeam(null);
                                    setSearchQuery('');
                                }}
                                className="text-sm text-gray-400 hover:text-white flex items-center gap-2"
                            >
                                ← Back to search
                            </button>

                            {/* <div className="bg-white/10 backdrop-blur-lg p-6 rounded-2xl border border-white/20">
                                <h3 className="text-white text-xl font-semibold mb-2">{selectedTeam.team_name}</h3>
                                <p className="text-gray-400 text-sm mb-4">Leader: {selectedTeam.leader_name}</p>
                                <p className="text-gray-400 text-sm">Phone: {selectedTeam.masked_phone}</p>
                            </div> */}

                            {error && (
                                <div className="p-4 bg-red-500/20 border border-red-500/50 rounded-lg">
                                    <p className="text-red-200 text-sm">{error}</p>
                                </div>
                            )}

                            <div>
                                <label className="block text-gray-300 text-sm font-medium mb-2 text-center">
                                    Enter Last 4 Digits of Team Leader's Phone Number
                                </label>
                                <div className="input-container max-w-32 mx-auto">
                                    <input
                                        type="tel"
                                        inputMode="numeric"
                                        pattern="[0-9]*"
                                        maxLength={4}
                                        value={phoneNumber}
                                        onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, ''))}
                                        placeholder="****"
                                        autoComplete="off"
                                        className="text-center"
                                        style={{ letterSpacing: '0.5em' }}
                                    />
                                </div>
                            </div>

                            <button
                                onClick={handleSendOTP}
                                disabled={loading || phoneNumber.length !== 4}
                                className="w-full bg-[#c0211f] text-white font-semibold py-3 px-6 rounded-lg hover:bg-[#a01a17] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {loading ? 'Processing...' : (isRSVPLocked ? 'Go to Dashboard' : 'Send OTP')}
                            </button>

                            <div id="recaptcha-container"></div>
                        </div>
                    )}

                    {/* OTP Verification Step */}
                    {step === 'verifying' && (
                        <div className="space-y-6">
                            <button
                                onClick={() => setStep('otp')}
                                className="text-sm text-gray-400 hover:text-white flex items-center gap-2"
                            >
                                ← Back
                            </button>

                            <div className="bg-green-500/20 border border-green-500/50 p-4 rounded-lg">
                                <p className="text-green-200 text-sm">
                                    ✓ OTP sent to {selectedTeam?.masked_phone}
                                </p>
                            </div>

                            {error && (
                                <div className="p-4 bg-red-500/20 border border-red-500/50 rounded-lg">
                                    <p className="text-red-200 text-sm">{error}</p>
                                </div>
                            )}

                            <div>
                                <label className="block text-gray-300 text-sm font-medium mb-2">
                                    Enter OTP
                                </label>
                                <div className="input-container w-full">
                                    <input
                                        type="tel"
                                        inputMode="numeric"
                                        pattern="[0-9]*"
                                        maxLength={6}
                                        value={otpCode}
                                        onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                                        placeholder="Enter 6-digit OTP"
                                        autoComplete="off"
                                    />
                                </div>
                            </div>

                            <button
                                onClick={() => handleVerifyOTP(otpCode)}
                                disabled={loading || otpCode.length !== 6}
                                className="w-full bg-[#c0211f] text-white font-semibold py-3 px-6 rounded-lg hover:bg-[#a01a17] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {loading ? 'Verifying...' : 'Verify OTP'}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
