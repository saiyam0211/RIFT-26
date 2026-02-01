'use client';

import { useState, useEffect } from 'react';
import axios from 'axios';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth-store';
import RIFTBackground from '@/components/RIFTBackground';
import CustomLoader from '@/components/CustomLoader';

interface Team {
    id: string;
    team_name: string;
    masked_email: string;
    city: string | null;
    status: string;
    member_count: number;
    leader_name?: string;
    rsvp_locked?: boolean;
}

export default function Home() {
    const router = useRouter();
    const { setAuth } = useAuthStore();
    const [step, setStep] = useState<'search' | 'email' | 'verifying'>('search');
    const [searchQuery, setSearchQuery] = useState('');
    const [suggestions, setSuggestions] = useState<Team[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
    const [email, setEmail] = useState('');
    const [otpCode, setOtpCode] = useState('');
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
        setEmail('');
        setSearchQuery(team.team_name);
        setShowSuggestions(false);
        setStep('email');
        setIsRSVPLocked(team.rsvp_locked || false);
    };

    const handleSendOTP = async () => {
        if (!selectedTeam) return;

        // Basic email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            setError('Please enter a valid email address');
            return;
        }

        setLoading(true);
        setError('');

        try {
            const response = await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/auth/send-email-otp`, {
                team_id: selectedTeam.id,
                email: email
            });

            console.log('OTP sent successfully:', response.data.message);
            setStep('verifying');
        } catch (err: any) {
            setError(err.response?.data?.error || err.message || 'Failed to send OTP');
            console.error('OTP Send Error:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyOTP = async (otpCode: string) => {
        if (!selectedTeam) return;

        setLoading(true);
        setError('');

        try {
            const response = await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/auth/verify-email-otp`, {
                team_id: selectedTeam.id,
                email: email,
                otp_code: otpCode,
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
        } else if (step === 'email' || step === 'verifying') {
            return { number: 2, text: 'Verify Details' };
        } else {
            return { number: 3, text: 'Complete RSVP' };
        }
    };

    const currentStepInfo = getStepInfo();

    return (
        <div className="min-h-screen flex relative overflow-hidden">
            {/* LightRays Background */}
            <RIFTBackground />

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


                                {/* Loading Animation - Positioned Absolutely Above */}
                                {searchingTeams && searchQuery.trim().length >= 2 && (
                                    <div className="relative top-12 left-1/2 transform -translate-x-1/2 z-20">
                                        <CustomLoader />
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

                    {/* Email Input Step */}
                    {step === 'email' && (
                        <div className="space-y-6">
                            <button
                                onClick={() => setStep('search')}
                                className="text-sm text-gray-400 hover:text-white flex items-center gap-2"
                            >
                                ← Back
                            </button>

                            {/* <div className="bg-blue-500/20 border border-blue-500/50 p-4 rounded-lg">
                                <p className="text-blue-200 text-sm">
                                    Team: <strong>{selectedTeam?.team_name}</strong>
                                </p>
                                <p className="text-blue-200/80 text-xs mt-1">
                                    Leader Email: {selectedTeam?.masked_email}
                                </p>
                            </div> */}

                            {error && (
                                <div className="p-4 bg-red-500/20 border border-red-500/50 rounded-lg">
                                    <p className="text-red-200 text-sm">{error}</p>
                                </div>
                            )}

                            <div>
                                <label className="block text-gray-300 text-sm font-medium mb-4 text-center mt-10">
                                    Enter Team Leader's Email Address
                                </label>
                                <div className="input-container">
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        placeholder={`${selectedTeam?.masked_email}`}
                                        autoComplete="email"
                                        className="text-center"
                                    />
                                </div>
                            </div>

                            <button
                                onClick={handleSendOTP}
                                disabled={loading || !email}
                                className="w-full bg-[#c0211f] cursor-pointer text-white font-semibold py-3 px-6 rounded-lg hover:bg-[#a01a17] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {loading ? 'Sending...' : 'Send OTP'}
                            </button>
                        </div>
                    )}

                    {/* OTP Verification Step */}
                    {step === 'verifying' && (
                        <div className="space-y-6">
                            <button
                                onClick={() => setStep('email')}
                                className="text-sm text-gray-400 hover:text-white flex items-center gap-2"
                            >
                                ← Back
                            </button>

                            <div className="bg-green-500/20 border border-green-500/50 p-4 rounded-lg">
                                <p className="text-green-200 text-sm">
                                    ✓ OTP sent to {email}
                                </p>
                            </div>

                            {error && (
                                <div className="p-4 bg-red-500/20 border border-red-500/50 rounded-lg">
                                    <p className="text-red-200 text-sm">{error}</p>
                                </div>
                            )}

                            <div>
                                <label className="block text-gray-300 text-sm font-medium mb-2 text-center">
                                    Enter OTP
                                </label>
                                <div className="input-container max-w-xs mx-auto">
                                    <input
                                        type="tel"
                                        inputMode="numeric"
                                        pattern="[0-9]*"
                                        maxLength={6}
                                        value={otpCode}
                                        onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                                        placeholder="******"
                                        autoComplete="off"
                                        className="text-center tracking-widest text-2xl font-mono"
                                        style={{ letterSpacing: '0.8em', paddingLeft: '0.8em' }}
                                    />
                                </div>
                            </div>

                            <button
                                onClick={() => handleVerifyOTP(otpCode)}
                                disabled={loading || otpCode.length !== 6}
                                className="w-full bg-[#c0211f] cursor-pointer text-white font-semibold py-3 px-6 rounded-lg hover:bg-[#a01a17] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
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
