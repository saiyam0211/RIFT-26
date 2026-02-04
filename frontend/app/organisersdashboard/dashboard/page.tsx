'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getAdminToken } from '../../../src/lib/admin-auth';
import { TeamStats } from '../../../src/types/admin';

export default function AdminDashboard() {
    const router = useRouter();
    const [stats, setStats] = useState<TeamStats | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchStats();
        // Refresh every 30 seconds
        const interval = setInterval(fetchStats, 30000);
        return () => clearInterval(interval);
    }, []);

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

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
            </div>
        );
    }

    const rsvpPercentage = stats?.total_teams ? Math.round((stats.rsvp_confirmed / stats.total_teams) * 100) : 0;
    const checkinPercentage = stats?.rsvp_confirmed ? Math.round((stats.checked_in / stats.rsvp_confirmed) * 100) : 0;

    return (
        <div className="space-y-8">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Dashboard Overview</h1>
                    <p className="text-gray-600 mt-1">Real-time statistics and insights</p>
                </div>
                <button
                    onClick={fetchStats}
                    className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-4 py-2 rounded-lg hover:from-purple-700 hover:to-pink-700 transition-all flex items-center gap-2 shadow-lg"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Refresh
                </button>
            </div>

            {/* Main Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard 
                    title="Total Teams" 
                    value={stats?.total_teams || 0} 
                    icon="👥" 
                    color="blue"
                    subtitle="Registered teams"
                    trend="+12% this week"
                />
                <StatCard 
                    title="RSVP Confirmed" 
                    value={stats?.rsvp_confirmed || 0} 
                    icon="✅" 
                    color="green"
                    subtitle={`${rsvpPercentage}% completion`}
                    trend={`${stats?.total_teams ? stats.total_teams - stats.rsvp_confirmed : 0} pending`}
                />
                <StatCard 
                    title="Checked In" 
                    value={stats?.checked_in || 0} 
                    icon="🎫" 
                    color="purple"
                    subtitle={`${checkinPercentage}% of RSVP`}
                    trend="Live updates"
                />
                <StatCard
                    title="Cities"
                    value={Object.keys(stats?.city_distribution || {}).length}
                    icon="🌍"
                    color="orange"
                    subtitle="Participating cities"
                    trend="Across India"
                />
            </div>

            {/* Progress Bars */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white rounded-lg shadow-lg p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">RSVP Progress</h3>
                    <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                            <span className="text-gray-600">Completed</span>
                            <span className="font-semibold text-gray-900">{rsvpPercentage}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-3">
                            <div 
                                className="bg-gradient-to-r from-green-500 to-green-600 h-3 rounded-full transition-all duration-500"
                                style={{ width: `${rsvpPercentage}%` }}
                            ></div>
                        </div>
                        <div className="flex justify-between text-xs text-gray-500 mt-2">
                            <span>{stats?.rsvp_confirmed || 0} Confirmed</span>
                            <span>{(stats?.total_teams || 0) - (stats?.rsvp_confirmed || 0)} Pending</span>
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-lg shadow-lg p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Check-in Progress</h3>
                    <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                            <span className="text-gray-600">Checked In</span>
                            <span className="font-semibold text-gray-900">{checkinPercentage}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-3">
                            <div 
                                className="bg-gradient-to-r from-purple-500 to-purple-600 h-3 rounded-full transition-all duration-500"
                                style={{ width: `${checkinPercentage}%` }}
                            ></div>
                        </div>
                        <div className="flex justify-between text-xs text-gray-500 mt-2">
                            <span>{stats?.checked_in || 0} Checked In</span>
                            <span>{(stats?.rsvp_confirmed || 0) - (stats?.checked_in || 0)} Remaining</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* City Distribution */}
            {stats?.city_distribution && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="bg-white rounded-lg shadow-lg p-6">
                        <h2 className="text-xl font-semibold mb-6 text-gray-900">Top Cities by Teams</h2>
                        <div className="space-y-4">
                            {Object.entries(stats.city_distribution)
                                .sort(([, a], [, b]) => (b as number) - (a as number))
                                .slice(0, 5)
                                .map(([city, count], index) => {
                                    const maxCount = Math.max(...Object.values(stats.city_distribution || {}) as number[]);
                                    const percentage = ((count as number) / maxCount) * 100;
                                    const colors = ['bg-purple-500', 'bg-blue-500', 'bg-green-500', 'bg-orange-500', 'bg-pink-500'];
                                    
                                    return (
                                        <div key={city}>
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="text-gray-700 font-medium">{city}</span>
                                                <span className="bg-gray-100 text-gray-700 px-3 py-1 rounded-full font-semibold text-sm">
                                                    {count} teams
                                                </span>
                                            </div>
                                            <div className="w-full bg-gray-200 rounded-full h-2">
                                                <div 
                                                    className={`${colors[index]} h-2 rounded-full transition-all duration-500`}
                                                    style={{ width: `${percentage}%` }}
                                                ></div>
                                            </div>
                                        </div>
                                    );
                                })}
                        </div>
                    </div>

                    <div className="bg-white rounded-lg shadow-lg p-6">
                        <h2 className="text-xl font-semibold mb-6 text-gray-900">Quick Actions</h2>
                        <div className="space-y-3">
                            <button
                                onClick={() => router.push('/organisersdashboard/teams')}
                                className="w-full flex items-center justify-between p-4 bg-gradient-to-r from-blue-50 to-blue-100 hover:from-blue-100 hover:to-blue-200 rounded-lg transition-all group"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="bg-blue-500 text-white p-2 rounded-lg">
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                        </svg>
                                    </div>
                                    <span className="font-semibold text-gray-900">Manage Teams</span>
                                </div>
                                <svg className="w-5 h-5 text-gray-400 group-hover:text-gray-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                            </button>

                            <button
                                onClick={() => router.push('/organisersdashboard/teams/add')}
                                className="w-full flex items-center justify-between p-4 bg-gradient-to-r from-green-50 to-green-100 hover:from-green-100 hover:to-green-200 rounded-lg transition-all group"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="bg-green-500 text-white p-2 rounded-lg">
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                        </svg>
                                    </div>
                                    <span className="font-semibold text-gray-900">Add Team Manually</span>
                                </div>
                                <svg className="w-5 h-5 text-gray-400 group-hover:text-gray-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                            </button>

                            <button
                                onClick={() => router.push('/organisersdashboard/bulk-upload')}
                                className="w-full flex items-center justify-between p-4 bg-gradient-to-r from-purple-50 to-purple-100 hover:from-purple-100 hover:to-purple-200 rounded-lg transition-all group"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="bg-purple-500 text-white p-2 rounded-lg">
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                        </svg>
                                    </div>
                                    <span className="font-semibold text-gray-900">Bulk Upload Teams</span>
                                </div>
                                <svg className="w-5 h-5 text-gray-400 group-hover:text-gray-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                            </button>

                            <button
                                onClick={() => router.push('/organisersdashboard/announcements')}
                                className="w-full flex items-center justify-between p-4 bg-gradient-to-r from-orange-50 to-orange-100 hover:from-orange-100 hover:to-orange-200 rounded-lg transition-all group"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="bg-orange-500 text-white p-2 rounded-lg">
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
                                        </svg>
                                    </div>
                                    <span className="font-semibold text-gray-900">Send Announcements</span>
                                </div>
                                <svg className="w-5 h-5 text-gray-400 group-hover:text-gray-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Last Updated */}
            <div className="text-center text-sm text-gray-500">
                Last updated: {new Date().toLocaleTimeString()} • Auto-refresh every 30 seconds
            </div>
        </div>
    );
}

function StatCard({ title, value, icon, color, subtitle, trend }: any) {
    const colors: any = {
        blue: 'from-blue-500 to-blue-600',
        green: 'from-green-500 to-green-600',
        purple: 'from-purple-500 to-purple-600',
        orange: 'from-orange-500 to-orange-600',
    };

    return (
        <div className={`bg-gradient-to-br ${colors[color]} text-white rounded-lg shadow-lg p-6 transform hover:scale-105 transition-transform`}>
            <div className="flex items-start justify-between mb-3">
                <span className="text-4xl">{icon}</span>
                <span className="text-5xl font-bold">{value}</span>
            </div>
            <p className="text-white font-semibold text-lg mb-1">{title}</p>
            <p className="text-white/70 text-sm">{subtitle}</p>
            {trend && (
                <div className="mt-3 pt-3 border-t border-white/20">
                    <p className="text-xs text-white/80">{trend}</p>
                </div>
            )}
        </div>
    );
}
