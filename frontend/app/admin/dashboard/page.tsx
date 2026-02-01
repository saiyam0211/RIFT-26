'use client';

import { useEffect, useState } from 'react';
import { getAdminToken } from '@/lib/admin-auth';
import { TeamStats } from '@/types/admin';

export default function AdminDashboard() {
    const [stats, setStats] = useState<TeamStats | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchStats();
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
        return <div className="text-center py-12">Loading stats...</div>;
    }

    return (
        <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-8">Dashboard</h1>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <StatCard title="Total Teams" value={stats?.total_teams || 0} icon="👥" color="blue" />
                <StatCard title="RSVP Confirmed" value={stats?.rsvp_confirmed || 0} icon="✅" color="green" />
                <StatCard title="Checked In" value={stats?.checked_in || 0} icon="🎫" color="purple" />
                <StatCard
                    title="Cities"
                    value={Object.keys(stats?.city_distribution || {}).length}
                    icon="🌍"
                    color="orange"
                />
            </div>

            {stats?.city_distribution && (
                <div className="bg-white rounded-lg shadow p-6">
                    <h2 className="text-xl font-semibold mb-4">City Distribution</h2>
                    <div className="space-y-3">
                        {Object.entries(stats.city_distribution).map(([city, count]) => (
                            <div key={city} className="flex items-center justify-between">
                                <span className="text-gray-700">{city}</span>
                                <span className="bg-purple-100 text-purple-700 px-3 py-1 rounded-full font-semibold">
                                    {count}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

function StatCard({ title, value, icon, color }: any) {
    const colors: any = {
        blue: 'from-blue-500 to-blue-600',
        green: 'from-green-500 to-green-600',
        purple: 'from-purple-500 to-purple-600',
        orange: 'from-orange-500 to-orange-600',
    };

    return (
        <div className={`bg-gradient-to-br ${colors[color]} text-white rounded-lg shadow-lg p-6`}>
            <div className="flex items-center justify-between mb-2">
                <span className="text-3xl">{icon}</span>
                <span className="text-4xl font-bold">{value}</span>
            </div>
            <p className="text-white/80">{title}</p>
        </div>
    );
}
