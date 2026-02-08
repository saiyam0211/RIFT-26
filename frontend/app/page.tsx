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
    const [otpEnabled, setOtpEnabled] = useState(true); // Track if OTP is enabled on backend
    const [rsvpOpenMode, setRsvpOpenMode] = useState<string>('false'); // from backend config only: 'true' | 'false' | 'pin'
    const [showRSVPClosedModal, setShowRSVPClosedModal] = useState(false);
    const [showPinModal, setShowPinModal] = useState(false);
    const [pinValue, setPinValue] = useState('');
    const [pinError, setPinError] = useState('');
    const [pinLoading, setPinLoading] = useState(false);

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
            // First, check RSVP mode: "true" | "false" | "pin"
            const configResponse = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/config`);
            const mode = configResponse.data.rsvp_open === 'pin' ? 'pin' : configResponse.data.rsvp_open === true || configResponse.data.rsvp_open === 'true' ? 'true' : 'false';
            setRsvpOpenMode(mode);

            // If RSVP is fully closed (not pin) and team hasn't done RSVP yet, show closed modal
            if (mode === 'false' && !selectedTeam.rsvp_locked) {
                setLoading(false);
                setShowRSVPClosedModal(true);
                return;
            }

            // If team has already done RSVP, redirect to dashboard
            if (selectedTeam.rsvp_locked) {
                // Authenticate first to get dashboard token
                const response = await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/auth/send-email-otp`, {
                    team_id: selectedTeam.id,
                    email: email
                });

                const requiresOtp = response.data.otp_enabled !== false && response.data.requires_otp !== false;
                setOtpEnabled(requiresOtp);

                if (!requiresOtp) {
                    await handleDirectAuth();
                } else {
                    setStep('verifying');
                }
                return;
            }

            // Normal flow - RSVP is open and team hasn't done RSVP
            const response = await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/auth/send-email-otp`, {
                team_id: selectedTeam.id,
                email: email
            });

            console.log('Response:', response.data);

            // Check if OTP is enabled on backend
            const requiresOtp = response.data.otp_enabled !== false && response.data.requires_otp !== false;
            setOtpEnabled(requiresOtp);

            if (!requiresOtp) {
                // OTP is disabled - directly authenticate and redirect
                console.log('OTP disabled - authenticating directly');
                await handleDirectAuth();
            } else {
                // OTP is enabled - proceed to verification step
                console.log('OTP sent successfully:', response.data.message);
                setStep('verifying');
            }
        } catch (err: any) {
            setError(err.response?.data?.error || err.message || 'Failed to authenticate');
            console.error('Auth Error:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleDirectAuth = async () => {
        if (!selectedTeam) return;

        setLoading(true);
        setError('');

        try {
            // Call verify endpoint without OTP code when OTP is disabled
            const response = await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/auth/verify-email-otp`, {
                team_id: selectedTeam.id,
                email: email,
                otp_code: '', // Empty OTP code when disabled
            });

            setAuth(response.data.token, response.data.team);

            // Store user email for leader identification
            localStorage.setItem('user_email', email);

            const team = response.data.team;
            if (team.rsvp_locked && team.dashboard_token) {
                router.push(`/dashboard/${team.dashboard_token}`);
            } else {
                const configRes = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/config`);
                const m = configRes.data.rsvp_open === 'pin' ? 'pin' : configRes.data.rsvp_open === true || configRes.data.rsvp_open === 'true' ? 'true' : 'false';
                if (m === 'pin') {
                    setShowPinModal(true);
                } else {
                    router.push(`/rsvp/${team.id}`);
                }
            }
        } catch (err: any) {
            setError(err.response?.data?.error || err.message || 'Failed to authenticate');
            console.error('Authentication Error:', err);
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

            // Store user email for leader identification
            localStorage.setItem('user_email', email);

            const team = response.data.team;
            if (team.rsvp_locked && team.dashboard_token) {
                router.push(`/dashboard/${team.dashboard_token}`);
            } else {
                const configRes = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/config`);
                const m = configRes.data.rsvp_open === 'pin' ? 'pin' : configRes.data.rsvp_open === true || configRes.data.rsvp_open === 'true' ? 'true' : 'false';
                if (m === 'pin') {
                    setShowPinModal(true);
                } else {
                    router.push(`/rsvp/${team.id}`);
                }
            }
        } catch (err: any) {
            setError(err.response?.data?.error || err.message || 'Failed to verify OTP');
            console.error('OTP Verification Error:', err);
        } finally {
            setLoading(false);
        }
    };

    const handlePinSubmit = async () => {
        const trimmed = pinValue.replace(/\D/g, '').slice(0, 6);
        if (trimmed.length !== 6) {
            setPinError('Please enter a 6-digit PIN');
            return;
        }
        setPinError('');
        setPinLoading(true);
        try {
            const res = await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/auth/validate-rsvp-pin`, { pin: trimmed });
            if (res.data.valid && selectedTeam) {
                setShowPinModal(false);
                setPinValue('');
                router.push(`/rsvp/${selectedTeam.id}`);
            } else {
                setPinError('Invalid PIN');
            }
        } catch (err: any) {
            setPinError(err.response?.data?.error || 'Invalid PIN');
        } finally {
            setPinLoading(false);
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
        <div className="min-h-screen flex flex-col lg:flex-row relative overflow-hidden">
            {/* LightRays Background */}
            <RIFTBackground />

            {/* Left Side - Fixed Title and Steps */}
            <div className="w-full lg:w-1/2 flex flex-col justify-center mt-20 md:mt-0 px-28 py-8 lg:ml-20 lg:px-16 lg:py-12 lg:fixed lg:left-0 lg:top-0 lg:h-screen">
                <div className="space-y-8 lg:space-y-12">
                    {/* Title */}
                    <div className="text-center md:text-left">
                        <h1 className="text-4xl sm:text-6xl lg:text-8xl font-tan font-bold text-[#c0211f] mb-2 lg:mb-4">
                            RIFT '26
                        </h1>
                    </div>

                    {/* Steps - Horizontal on Mobile, Vertical on Desktop */}
                    {/* Mobile: Horizontal Stepper */}
                    <div className="lg:hidden flex justify-center">
                        <div className="flex items-center justify-center gap-12 relative w-full">
                            {/* Step 1 */}
                            <div className="flex flex-col items-center z-10">
                                <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg transition-all ${currentStepInfo.number >= 1 ? 'bg-[#c0211f] text-white' : 'bg-gray-700 text-gray-400'}`}>
                                    1
                                </div>
                                <span className="text-white text-xs mt-2 text-center whitespace-nowrap">Search Team</span>
                            </div>

                            {/* Step 2 */}
                            <div className="flex flex-col items-center z-10">
                                <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg transition-all ${currentStepInfo.number >= 2 ? 'bg-[#c0211f] text-white' : 'bg-gray-700 text-gray-400'}`}>
                                    2
                                </div>
                                <span className="text-white text-xs mt-2 text-center whitespace-nowrap">Verify Details</span>
                            </div>

                            {/* Step 3 */}
                            <div className="flex flex-col items-center z-10">
                                <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg transition-all ${currentStepInfo.number >= 3 ? 'bg-[#c0211f] text-white' : 'bg-gray-700 text-gray-400'}`}>
                                    3
                                </div>
                                <span className="text-white text-xs mt-2 text-center whitespace-nowrap">Complete RSVP</span>
                            </div>
                        </div>
                    </div>

                    {/* Desktop: Vertical Steps */}
                    <div className="hidden lg:block space-y-6">
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

            {/* Right Side - Content */}
            <div className="w-full lg:w-1/2 lg:ml-auto flex items-center justify-center min-h-screen py-8 md:mt-0 -mt-96 lg:py-12">
                <div className="w-full max-w-2xl space-y-6 px-6 lg:px-8">
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
                                        <div className="loader-wrapper">
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
                                        <style jsx>{`
                                            .loader-wrapper {
                                                position: relative;
                                                display: flex;
                                                align-items: center;
                                                justify-content: center;
                                                color: white;
                                                user-select: none;
                                                gap: 10px;
                                            }

                                            .loader {
                                                width: 20px;
                                                height: 20px;
                                                aspect-ratio: 1 / 1;
                                                border-radius: 50%;
                                                background-color: transparent;
                                                animation: loader-rotate 1.5s linear infinite;
                                                z-index: 0;
                                            }

                                            @keyframes loader-rotate {
                                                0% {
                                                    transform: rotate(90deg);
                                                    box-shadow:
                                                        0 1px 1px 0 #fff inset,
                                                        0 3px 5px 0 #ff5f9f inset,
                                                        0 4px 4px 0 #0693ff inset;
                                                }
                                                50% {
                                                    transform: rotate(270deg);
                                                    background: #7c0911;
                                                    box-shadow:
                                                        0 1px 1px 0 #fff inset,
                                                        0 3px 5px 0 #d60a47 inset,
                                                        0 4px 4px 0 #fbef19 inset;
                                                }
                                                100% {
                                                    transform: rotate(450deg);
                                                    box-shadow:
                                                        0 1px 1px 0 #fff inset,
                                                        0 3px 5px 0 #ff5f9f inset,
                                                        0 4px 4px 0 #28a9ff inset;
                                                }
                                            }
                                            .letter-wrapper {
                                                display: flex;
                                                gap: 1px;
                                            }
                                            .loader-letter {
                                                display: inline-block;
                                                opacity: 0.4;
                                                transform: translateY(0);
                                                animation: loader-letter-anim 2s infinite;
                                                z-index: 1;
                                                border-radius: 50ch;
                                                border: none;
                                            }

                                            .loader-letter:nth-child(1) {
                                                animation-delay: 0s;
                                            }
                                            .loader-letter:nth-child(2) {
                                                animation-delay: 0.1s;
                                            }
                                            .loader-letter:nth-child(3) {
                                                animation-delay: 0.2s;
                                            }
                                            .loader-letter:nth-child(4) {
                                                animation-delay: 0.3s;
                                            }
                                            .loader-letter:nth-child(5) {
                                                animation-delay: 0.4s;
                                            }
                                            .loader-letter:nth-child(6) {
                                                animation-delay: 0.5s;
                                            }
                                            .loader-letter:nth-child(7) {
                                                animation-delay: 0.6s;
                                            }
                                            .loader-letter:nth-child(8) {
                                                animation-delay: 0.7s;
                                            }
                                            .loader-letter:nth-child(9) {
                                                animation-delay: 0.8s;
                                            }

                                            @keyframes loader-letter-anim {
                                                0%,
                                                100% {
                                                    opacity: 0.4;
                                                    transform: translateY(0);
                                                }
                                                20% {
                                                    opacity: 1;
                                                    transform: scale(1.15);
                                                }
                                                40% {
                                                    opacity: 0.7;
                                                    transform: translateY(0);
                                                }
                                            }
                                        `}</style>
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
                        <div className="space-y-6 mt-20 md:justify-center">
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
                                {loading ? 'Processing...' : 'Continue'}
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

            {/* RSVP Closed Modal */}
            {showRSVPClosedModal && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-gradient-to-br from-zinc-900 to-black border-2 border-red-600/50 rounded-2xl p-6 md:p-8 max-w-md w-full shadow-2xl">
                        <div className="text-center space-y-6">
                            {/* Icon */}
                            <div className="flex justify-center">
                                <div className="bg-red-600/20 p-4 rounded-full">
                                    <svg className="w-16 h-16 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                </div>
                            </div>

                            {/* Title */}
                            <div>
                                <h2 className="text-2xl md:text-3xl font-bold text-white mb-2">
                                    RSVP Closed
                                </h2>
                                <p className="text-red-400 text-lg font-semibold">
                                    You're Late!
                                </p>
                            </div>

                            {/* Message */}
                            <div className="space-y-2">
                                <p className="text-gray-300 text-sm md:text-base">
                                    The RSVP window has been closed. Unfortunately, you cannot complete your RSVP at this time.
                                </p>
                                <p className="text-gray-400 text-xs md:text-sm">
                                    If you believe this is an error, please contact the RIFT team.
                                </p>
                            </div>

                            {/* Action Buttons */}
                            <div className="space-y-3 pt-4">
                                <button
                                    onClick={() => {
                                        setShowRSVPClosedModal(false);
                                        setStep('search');
                                        setSelectedTeam(null);
                                        setEmail('');
                                        setSearchQuery('');
                                    }}
                                    className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-3 px-6 rounded-lg transition-all"
                                >
                                    Back to Home
                                </button>
                                <button
                                    onClick={() => window.open('https://www.instagram.com/rift.pwioi', '_blank')}
                                    className="w-full bg-white/10 hover:bg-white/20 text-white font-medium py-2 px-6 rounded-lg transition-all border border-white/20"
                                >
                                    Contact Us on Instagram
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* RSVP PIN Modal (when RSVP_OPEN=pin and team hasn't done RSVP) */}
            {showPinModal && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-zinc-900 border-2 border-red-600/50 rounded-2xl p-6 md:p-8 max-w-md w-full shadow-2xl">
                        <div className="text-center space-y-6">
                            <div className="flex justify-center">
                                <div className="bg-red-600/20 p-4 rounded-full">
                                    <svg className="w-12 h-12 md:w-14 md:h-14 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                    </svg>
                                </div>
                            </div>
                            <div>
                                <h2 className="text-xl md:text-2xl font-bold text-white mb-1">Enter Secret PIN</h2>
                                <p className="text-gray-400 text-sm md:text-base">Ask your organizer for the 6-digit PIN to continue RSVP</p>
                            </div>
                            <div>
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    maxLength={6}
                                    placeholder="000000"
                                    value={pinValue}
                                    onChange={(e) => {
                                        const v = e.target.value.replace(/\D/g, '').slice(0, 6);
                                        setPinValue(v);
                                        setPinError('');
                                    }}
                                    className="w-full text-center text-2xl md:text-3xl tracking-[0.5em] font-mono bg-zinc-950 border-2 border-zinc-700 rounded-lg py-3 px-4 text-white placeholder-zinc-500 focus:border-red-600 focus:ring-2 focus:ring-red-600/30 focus:outline-none"
                                />
                                {pinError && <p className="text-red-400 text-sm mt-2">{pinError}</p>}
                            </div>
                            <div className="space-y-3 pt-2">
                                <button
                                    onClick={handlePinSubmit}
                                    disabled={pinLoading || pinValue.replace(/\D/g, '').length !== 6}
                                    className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-lg transition-all"
                                >
                                    {pinLoading ? 'Verifying...' : 'Continue to RSVP'}
                                </button>
                                <button
                                    onClick={() => {
                                        setShowPinModal(false);
                                        setPinValue('');
                                        setPinError('');
                                        setStep('search');
                                        setSelectedTeam(null);
                                        setEmail('');
                                        setSearchQuery('');
                                    }}
                                    className="w-full bg-white/10 hover:bg-white/20 text-white font-medium py-2 px-6 rounded-lg transition-all border border-white/20"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
