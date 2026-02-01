'use client';

import { useEffect, useState } from 'react';
import { getAdminToken } from '@/lib/admin-auth';
import { Team } from '@/types/admin';

export default function TeamsPage() {
    const [teams, setTeams] = useState<Team[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState({ status: '', city: '' });

    useEffect(() => {
        fetchTeams();
    }, [filter]);

    const fetchTeams = async () => {
        try {
            const token = getAdminToken();
            const params = new URLSearchParams();
            if (filter.status) params.append('status', filter.status);
            if (filter.city) params.append('city', filter.city);

            const response = await fetch(
                `${process.env.NEXT_PUBLIC_API_URL}/admin/teams?${params}`,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            const data = await response.json();
            setTeams(data.teams || []);
        } catch (error) {
            console.error('Failed to fetch teams:', error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-8">All Teams</h1>

            {/* Filters */}
            <div className="bg-white rounded-lg shadow p-4 mb-6 flex gap-4">
                <select
                    value={filter.status}
                    onChange={(e) => setFilter({ ...filter, status: e.target.value })}
                    className="px-4 py-2 border border-gray-300 rounded-lg"
                >
                    <option value="">All Status</option>
                    <option value="shortlisted">Shortlisted</option>
                    <option value="confirmed">Confirmed</option>
                    <option value="rejected">Rejected</option>
                </select>

                <input
                    type="text"
                    placeholder="Filter by city..."
                    value={filter.city}
                    onChange={(e) => setFilter({ ...filter, city: e.target.value })}
                    className="px-4 py-2 border border-gray-300 rounded-lg flex-1"
                />
            </div>

            {loading ? (
                <div className="text-center py-12">Loading teams...</div>
            ) : (
                <div className="bg-white rounded-lg shadow overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                    Team Name
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                    Status
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                    Members
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                    RSVP
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                    Checked In
                                </th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {teams.map((team) => (
                                <tr key={team.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="font-medium text-gray-900">{team.team_name}</div>
                                        {team.city && <div className="text-sm text-gray-500">{team.city}</div>}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${team.status === 'confirmed' ? 'bg-green-100 text-green-800' :
                                                team.status === 'shortlisted' ? 'bg-blue-100 text-blue-800' :
                                                    'bg-gray-100 text-gray-800'
                                            }`}>
                                            {team.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {team.members?.length || 0}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        {team.rsvp_locked ? '✅' : '❌'}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        {team.checked_in ? '✅' : '❌'}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {teams.length === 0 && (
                        <div className="text-center py-12 text-gray-500">
                            No teams found
                        </div>
                    )}
                </div>
            )}

            <div className="mt-4 text-sm text-gray-600">
                Total: {teams.length} teams
            </div>
        </div>
    );
}
