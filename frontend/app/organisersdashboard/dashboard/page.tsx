'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
    Users, 
    CheckCircle, 
    Ticket, 
    MapPin, 
    RefreshCw,
    TrendingUp,
    Activity,
    BarChart3,
    Upload,
    UserPlus,
    Megaphone,
    KeyRound
} from 'lucide-react';
import { getAdminToken } from '../../../src/lib/admin-auth';
import { TeamStats } from '../../../src/types/admin';

interface RSVPPinData {
    enabled: boolean;
    pin: string;
    next_rotation_at: string | null;
    seconds_until_rotation: number;
}

export default function AdminDashboard() {
    const router = useRouter();
    const [stats, setStats] = useState<TeamStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [rsvpOpenMode, setRsvpOpenMode] = useState<string>('false'); // from backend: "true" | "false" | "pin"
    const [rsvpPin, setRsvpPin] = useState<RSVPPinData | null>(null);
    const [pinSecondsLeft, setPinSecondsLeft] = useState<number>(0);

    useEffect(() => {
        fetchStats();
        fetchConfig();
        const interval = setInterval(fetchStats, 30000);
        return () => clearInterval(interval);
    }, []);

    const fetchConfig = async () => {
        try {
            const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/config`);
            const data = await response.json();
            const mode = data.rsvp_open === 'pin' ? 'pin' : data.rsvp_open === true || data.rsvp_open === 'true' ? 'true' : 'false';
            setRsvpOpenMode(mode);
            if (mode === 'pin') {
                fetchRsvpPin();
            } else {
                setRsvpPin(null);
            }
        } catch (error) {
            console.error('Failed to fetch config:', error);
            setRsvpOpenMode('false');
        }
    };

    useEffect(() => {
        if (rsvpOpenMode !== 'pin' || !rsvpPin?.enabled || rsvpPin.seconds_until_rotation <= 0) return;
        setPinSecondsLeft(rsvpPin.seconds_until_rotation);
        const t = setInterval(() => {
            setPinSecondsLeft((prev) => {
                if (prev <= 1) {
                    fetchRsvpPin();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(t);
    }, [rsvpOpenMode, rsvpPin?.enabled, rsvpPin?.seconds_until_rotation]);

    const fetchStats = async () => {
        try {
            const token = getAdminToken();
            const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/stats/checkin`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await response.json();
            setStats(data);
        } catch (error) {
            console.error('Failed to fetch stats:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchRsvpPin = async () => {
        try {
            const token = getAdminToken();
            const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/rsvp-pin`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await response.json();
            setRsvpPin({
                enabled: data.enabled || false,
                pin: data.pin || '',
                next_rotation_at: data.next_rotation_at || null,
                seconds_until_rotation: data.seconds_until_rotation ?? 0,
            });
        } catch (error) {
            console.error('Failed to fetch RSVP PIN:', error);
            setRsvpPin(null);
        }
    };

    const formatCountdown = (seconds: number) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="flex flex-col items-center gap-4">
                    <div className="animate-spin rounded-full h-12 w-12 border-4 border-zinc-800 border-t-red-600"></div>
                    <p className="text-zinc-400 text-sm">Loading dashboard...</p>
                </div>
            </div>
        );
    }

    const rsvpPercentage = stats?.total_teams ? Math.round((stats.rsvp_confirmed / stats.total_teams) * 100) : 0;
    const checkinPercentage = stats?.rsvp_confirmed ? Math.round((stats.checked_in / stats.rsvp_confirmed) * 100) : 0;

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-white">Dashboard Overview</h1>
                    <p className="text-zinc-400 mt-1">Real-time statistics and insights</p>
                </div>
                <button
                    onClick={fetchStats}
                    className="bg-zinc-900 border border-zinc-800 text-white px-4 py-2 rounded-lg hover:bg-zinc-800 transition-all flex items-center gap-2"
                >
                    <RefreshCw className="w-5 h-5" />
                    Refresh
                </button>
            </div>

            {/* Main Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard 
                    title="Total Teams" 
                    value={stats?.total_teams || 0} 
                    icon={Users} 
                    subtitle="Registered teams"
                    trend="+12% this week"
                />
                <StatCard 
                    title="RSVP Confirmed" 
                    value={stats?.rsvp_confirmed || 0} 
                    icon={CheckCircle} 
                    subtitle={`${rsvpPercentage}% completion`}
                    trend={`${stats?.total_teams ? stats.total_teams - stats.rsvp_confirmed : 0} pending`}
                />
                <StatCard 
                    title="Checked In" 
                    value={stats?.checked_in || 0} 
                    icon={Ticket} 
                    subtitle={`${checkinPercentage}% of RSVP`}
                    trend="Live updates"
                />
                <StatCard
                    title="Cities"
                    value={Object.keys(stats?.city_distribution || {}).length}
                    icon={MapPin}
                    subtitle="Participating cities"
                    trend="Across India"
                />
            </div>

            {/* RSVP Secret PIN Card - only when backend config RSVP_OPEN=pin (no /admin/rsvp-pin call otherwise) */}
            {rsvpOpenMode === 'pin' && (
                <div className="bg-zinc-900 border-2 border-red-600/40 rounded-xl p-6">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <div className="p-3 bg-red-600/20 rounded-xl">
                                <KeyRound className="w-8 h-8 text-red-500" />
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold text-white">RSVP Secret PIN</h3>
                                <p className="text-zinc-400 text-sm">Share this PIN with team leaders to allow RSVP. Rotates every 3 hours.</p>
                            </div>
                        </div>
                        <div className="flex flex-col sm:items-end gap-2">
                            {rsvpPin ? (
                                <>
                                    <div className="bg-zinc-950 border border-zinc-700 rounded-lg px-6 py-4">
                                        <p className="text-zinc-400 text-xs uppercase tracking-wider mb-1">Current PIN</p>
                                        <p className="text-3xl md:text-4xl font-mono font-bold text-white tracking-[0.3em]">{rsvpPin.pin}</p>
                                    </div>
                                    <div className="text-sm text-zinc-400">
                                        <span className="text-zinc-500">Next rotation in </span>
                                        <span className="font-mono font-semibold text-red-400">{formatCountdown(pinSecondsLeft > 0 ? pinSecondsLeft : rsvpPin.seconds_until_rotation)}</span>
                                    </div>
                                </>
                            ) : (
                                <p className="text-zinc-500">Loading PIN…</p>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Progress Bars */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-red-600/10 rounded-lg">
                            <TrendingUp className="w-5 h-5 text-red-500" />
                        </div>
                        <h3 className="text-lg font-semibold text-white">RSVP Progress</h3>
                    </div>
                    <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                            <span className="text-zinc-400">Completed</span>
                            <span className="font-semibold text-white">{rsvpPercentage}%</span>
                        </div>
                        <div className="w-full bg-zinc-800 rounded-full h-3">
                            <div 
                                className="bg-red-600 h-3 rounded-full transition-all duration-500"
                                style={{ width: `${rsvpPercentage}%` }}
                            ></div>
                        </div>
                        <div className="flex justify-between text-xs text-zinc-500 mt-2">
                            <span>{stats?.rsvp_confirmed || 0} Confirmed</span>
                            <span>{(stats?.total_teams || 0) - (stats?.rsvp_confirmed || 0)} Pending</span>
                        </div>
                    </div>
                </div>

                <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-red-600/10 rounded-lg">
                            <Activity className="w-5 h-5 text-red-500" />
                        </div>
                        <h3 className="text-lg font-semibold text-white">Check-in Progress</h3>
                    </div>
                    <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                            <span className="text-zinc-400">Checked In</span>
                            <span className="font-semibold text-white">{checkinPercentage}%</span>
                        </div>
                        <div className="w-full bg-zinc-800 rounded-full h-3">
                            <div 
                                className="bg-red-600 h-3 rounded-full transition-all duration-500"
                                style={{ width: `${checkinPercentage}%` }}
                            ></div>
                        </div>
                        <div className="flex justify-between text-xs text-zinc-500 mt-2">
                            <span>{stats?.checked_in || 0} Checked In</span>
                            <span>{(stats?.rsvp_confirmed || 0) - (stats?.checked_in || 0)} Remaining</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* City Distribution */}
            {stats?.city_distribution && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-2 bg-red-600/10 rounded-lg">
                                <BarChart3 className="w-5 h-5 text-red-500" />
                            </div>
                            <h2 className="text-xl font-semibold text-white">Top Cities by Teams</h2>
                        </div>
                        <div className="space-y-4">
                            {Object.entries(stats.city_distribution)
                                .sort(([, a], [, b]) => (b as number) - (a as number))
                                .slice(0, 5)
                                .map(([city, count]) => {
                                    const maxCount = Math.max(...Object.values(stats.city_distribution || {}) as number[]);
                                    const percentage = ((count as number) / maxCount) * 100;
                                    
                                    return (
                                        <div key={city}>
                                            <div className="flex items-center justify-between mb-2">
                                                <div className="flex items-center gap-2">
                                                    <MapPin className="w-4 h-4 text-red-500" />
                                                    <span className="text-white font-medium">{city}</span>
                                                </div>
                                                <span className="bg-zinc-800 text-zinc-300 px-3 py-1 rounded-full font-semibold text-sm">
                                                    {count} teams
                                                </span>
                                            </div>
                                            <div className="w-full bg-zinc-800 rounded-full h-2">
                                                <div 
                                                    className="bg-red-600 h-2 rounded-full transition-all duration-500"
                                                    style={{ width: `${percentage}%` }}
                                                ></div>
                                            </div>
                                        </div>
                                    );
                                })}
                        </div>
                    </div>

                    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
                        <h2 className="text-xl font-semibold mb-6 text-white">Quick Actions</h2>
                        <div className="space-y-3">
                            <button
                                onClick={() => router.push('/organisersdashboard/teams')}
                                className="w-full flex items-center justify-between p-4 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg transition-all group"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="bg-red-600/10 text-red-500 p-2 rounded-lg">
                                        <Users className="w-5 h-5" />
                                    </div>
                                    <span className="font-semibold text-white">Manage Teams</span>
                                </div>
                                <svg className="w-5 h-5 text-zinc-400 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                            </button>

                            <button
                                onClick={() => router.push('/organisersdashboard/teams/add')}
                                className="w-full flex items-center justify-between p-4 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg transition-all group"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="bg-red-600/10 text-red-500 p-2 rounded-lg">
                                        <UserPlus className="w-5 h-5" />
                                    </div>
                                    <span className="font-semibold text-white">Add Team Manually</span>
                                </div>
                                <svg className="w-5 h-5 text-zinc-400 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                            </button>

                            <button
                                onClick={() => router.push('/organisersdashboard/bulk-upload')}
                                className="w-full flex items-center justify-between p-4 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg transition-all group"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="bg-red-600/10 text-red-500 p-2 rounded-lg">
                                        <Upload className="w-5 h-5" />
                                    </div>
                                    <span className="font-semibold text-white">Bulk Upload Teams</span>
                                </div>
                                <svg className="w-5 h-5 text-zinc-400 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                            </button>

                            <button
                                onClick={() => router.push('/organisersdashboard/announcements')}
                                className="w-full flex items-center justify-between p-4 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg transition-all group"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="bg-red-600/10 text-red-500 p-2 rounded-lg">
                                        <Megaphone className="w-5 h-5" />
                                    </div>
                                    <span className="font-semibold text-white">Send Announcements</span>
                                </div>
                                <svg className="w-5 h-5 text-zinc-400 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Last Updated */}
            <div className="text-center">
                <div className="inline-flex items-center gap-2 bg-zinc-900 border border-zinc-800 px-4 py-2 rounded-full">
                    <Activity className="w-4 h-4 text-red-500 animate-pulse" />
                    <span className="text-zinc-400 text-sm">
                        Last updated: {new Date().toLocaleTimeString()}
                    </span>
                    <span className="text-zinc-700">•</span>
                    <span className="text-zinc-400 text-sm">Auto-refresh every 30s</span>
                </div>
            </div>
        </div>
    );
}

function StatCard({ title, value, icon: Icon, subtitle, trend }: any) {
    return (
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 hover:border-red-600/50 transition-all duration-200">
            <div className="flex items-start justify-between mb-4">
                <div className="bg-red-600/10 p-3 rounded-lg">
                    <Icon className="w-6 h-6 text-red-500" />
                </div>
                <span className="text-5xl font-bold text-white">{value}</span>
            </div>
            <p className="text-white font-semibold text-lg mb-1">{title}</p>
            <p className="text-zinc-400 text-sm">{subtitle}</p>
            {trend && (
                <div className="mt-3 pt-3 border-t border-zinc-800">
                    <div className="flex items-center gap-1">
                        <TrendingUp className="w-3 h-3 text-red-500" />
                        <p className="text-xs text-zinc-500">{trend}</p>
                    </div>
                </div>
            )}
        </div>
    );
}
