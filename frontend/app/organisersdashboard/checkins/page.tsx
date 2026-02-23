'use client';

import { useEffect, useState } from 'react';
import { getAdminToken } from '../../../src/lib/admin-auth';
import { Team } from '../../../src/types/admin';
import { Eye, X, LogOut, UserMinus, Star } from 'lucide-react';

export default function CheckInsPage() {
    const [teams, setTeams] = useState<Team[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterCity, setFilterCity] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [viewTeam, setViewTeam] = useState<Team | null>(null);
    const [undoingId, setUndoingId] = useState<string | null>(null);
    const [undoingMemberId, setUndoingMemberId] = useState<string | null>(null);
    const teamsPerPage = 7;

    useEffect(() => {
        fetchCheckIns();
    }, []);

    const fetchCheckIns = async (): Promise<Team[]> => {
        try {
            const token = getAdminToken();
            const response = await fetch(
                `${process.env.NEXT_PUBLIC_API_URL}/admin/teams?status=checked_in`,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            const data = await response.json();
            const list = data.teams || [];
            setTeams(list);
            return list;
        } catch (error) {
            console.error('Failed to fetch check-ins:', error);
            return [];
        } finally {
            setLoading(false);
        }
    };

    const filteredTeams = teams.filter(team => {
        const matchesSearch = !searchQuery ||
            team.team_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            team.members?.some(m => m.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                m.email?.toLowerCase().includes(searchQuery.toLowerCase()));
        const matchesCity = !filterCity || team.city === filterCity;
        return matchesSearch && matchesCity;
    });

    const uniqueCities = [...new Set(teams.map(t => t.city).filter(Boolean))].sort();

    const totalPages = Math.ceil(filteredTeams.length / teamsPerPage);
    const startIndex = (currentPage - 1) * teamsPerPage;
    const endIndex = startIndex + teamsPerPage;
    const paginatedTeams = filteredTeams.slice(startIndex, endIndex);

    useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery, filterCity]);

    const goToPage = (page: number) => {
        setCurrentPage(page);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const downloadCSV = () => {
        const dataToExport = filteredTeams;
        if (dataToExport.length === 0) {
            alert('No check-ins to export with current filters');
            return;
        }
        const headers = [
            'Team Name', 'City', 'Member Count', 'Leader Name', 'Leader Email', 'Leader Phone',
            'Member 2 Name', 'Member 2 Email', 'Member 2 Phone',
            'Member 3 Name', 'Member 3 Email', 'Member 3 Phone',
            'Member 4 Name', 'Member 4 Email', 'Member 4 Phone', 'Created At'
        ];
        const rows = dataToExport.map(team => {
            const leader = team.members?.find(m => m.role === 'leader');
            const otherMembers = team.members?.filter(m => m.role !== 'leader') || [];
            return [
                team.team_name || '',
                team.city || '',
                team.members?.length || 0,
                leader?.name || '', leader?.email || '', leader?.phone || '',
                otherMembers[0]?.name || '', otherMembers[0]?.email || '', otherMembers[0]?.phone || '',
                otherMembers[1]?.name || '', otherMembers[1]?.email || '', otherMembers[1]?.phone || '',
                otherMembers[2]?.name || '', otherMembers[2]?.email || '', otherMembers[2]?.phone || '',
                (team as { created_at?: string }).created_at || ''
            ];
        });
        const csvContent = [headers.join(','), ...rows.map(row => row.map(cell => `"${cell}"`).join(','))].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `checkins_export_${new Date().toISOString().split('T')[0]}.csv`;
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleUndoCheckIn = async (teamId: string) => {
        if (!confirm('Remove check-in for this team? They will need to check in again.')) return;
        setUndoingId(teamId);
        try {
            const token = getAdminToken();
            const res = await fetch(
                `${process.env.NEXT_PUBLIC_API_URL}/admin/checkin/${teamId}`,
                { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }
            );
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                alert(data.error || 'Failed to undo check-in');
                return;
            }
            setViewTeam(null);
            await fetchCheckIns();
        } finally {
            setUndoingId(null);
        }
    };

    const handleUndoCheckInMember = async (teamId: string, memberId: string) => {
        if (!confirm('Remove check-in for this member only? They will need to be checked in again.')) return;
        setUndoingMemberId(memberId);
        try {
            const token = getAdminToken();
            const res = await fetch(
                `${process.env.NEXT_PUBLIC_API_URL}/admin/checkin/${teamId}/member/${memberId}`,
                { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }
            );
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                alert(data.error || 'Failed to remove member check-in');
                return;
            }
            const newTeams = await fetchCheckIns();
            const stillCheckedIn = newTeams.find(t => t.id === teamId);
            if (stillCheckedIn) {
                setViewTeam(stillCheckedIn);
            } else {
                setViewTeam(null);
            }
        } finally {
            setUndoingMemberId(null);
        }
    };

    return (
        <div>
            <div className="flex justify-between items-center mb-8">
                <h1 className="text-3xl font-bold text-white">Check-ins</h1>
                <button
                    onClick={downloadCSV}
                    className="bg-zinc-900 border border-zinc-800 text-white px-6 py-2 rounded-lg hover:bg-zinc-800 transition-all flex items-center gap-2"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Download CSV
                </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
                <div className="bg-zinc-900 border border-zinc-800 text-white rounded-lg p-6">
                    <div className="text-4xl font-bold">{teams.length}</div>
                    <div className="text-zinc-400 mt-2">Checked-in Teams</div>
                </div>
                <div className="bg-zinc-900 border border-zinc-800 text-white rounded-lg p-6">
                    <div className="text-4xl font-bold">
                        {teams.reduce((sum, t) => sum + (t.members?.length || 0), 0)}
                    </div>
                    <div className="text-zinc-400 mt-2">Total Participants</div>
                </div>
                <div className="bg-red-600 text-white rounded-lg p-6">
                    <div className="text-4xl font-bold">{uniqueCities.length}</div>
                    <div className="text-red-100 mt-2">Cities</div>
                </div>
                <div className="bg-zinc-900 border border-zinc-800 text-white rounded-lg p-6">
                    <div className="text-4xl font-bold">{filteredTeams.length}</div>
                    <div className="text-zinc-400 mt-2">Showing (filtered)</div>
                </div>
            </div>

            {/* Search & City Filter */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 mb-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="relative">
                        <input
                            type="text"
                            placeholder="Search by team name, member name, or email..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full px-4 py-3 pl-12 bg-zinc-950 border border-zinc-800 text-white rounded-lg focus:ring-2 focus:ring-red-600 focus:border-transparent"
                        />
                        <svg className="w-5 h-5 text-zinc-400 absolute left-4 top-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                    </div>
                    <select
                        value={filterCity}
                        onChange={(e) => setFilterCity(e.target.value)}
                        className="px-4 py-3 bg-zinc-950 border border-zinc-800 text-white rounded-lg focus:ring-2 focus:ring-red-600"
                    >
                        <option value="">All Cities</option>
                        {uniqueCities.map(city => (
                            <option key={city} value={city}>{city}</option>
                        ))}
                    </select>
                </div>
                {(searchQuery || filterCity) && (
                    <div className="flex flex-wrap gap-2 pt-2">
                        <span className="text-sm text-zinc-400">Active filters:</span>
                        {searchQuery && (
                            <span className="bg-red-600/20 text-red-400 px-3 py-1 rounded-full text-sm flex items-center gap-1">
                                Search: &quot;{searchQuery}&quot;
                                <button onClick={() => setSearchQuery('')} className="hover:text-red-300">×</button>
                            </span>
                        )}
                        {filterCity && (
                            <span className="bg-zinc-800 text-zinc-300 px-3 py-1 rounded-full text-sm flex items-center gap-1">
                                City: {filterCity}
                                <button onClick={() => setFilterCity('')} className="hover:text-white">×</button>
                            </span>
                        )}
                        <button
                            onClick={() => { setSearchQuery(''); setFilterCity(''); }}
                            className="text-sm text-red-500 hover:text-red-400 underline"
                        >
                            Clear all
                        </button>
                    </div>
                )}
            </div>

            {loading ? (
                <div className="text-center py-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto"></div>
                    <p className="mt-4 text-zinc-400">Loading check-ins...</p>
                </div>
            ) : (
                <>
                    <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
                        <table className="min-w-full divide-y divide-zinc-800">
                            <thead className="bg-red-600 text-white">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Team Name</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Leader</th>
                                    <th className="px-6 py-3 text-center text-xs font-medium uppercase tracking-wider">City</th>
                                    <th className="px-6 py-3 text-center text-xs font-medium uppercase tracking-wider">Members</th>
                                    <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-800">
                                {paginatedTeams.map((team, idx) => (
                                    <tr key={team.id} className={`hover:bg-zinc-800 transition-colors ${idx % 2 === 0 ? 'bg-zinc-950' : 'bg-black'}`}>
                                        <td className="px-6 py-4">
                                            <div className="font-medium text-white">{team.team_name}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            {team.members?.find(m => m.role === 'leader') && (
                                                <div>
                                                    <div className="text-sm font-medium text-white">
                                                        {team.members.find(m => m.role === 'leader')?.name}
                                                    </div>
                                                    <div className="text-xs text-zinc-400">
                                                        {team.members.find(m => m.role === 'leader')?.email}
                                                    </div>
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            {team.city && (
                                                <span className="bg-zinc-800 text-zinc-200 px-3 py-1 rounded-full text-sm font-semibold">
                                                    {team.city}
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <span className="bg-zinc-800 text-zinc-200 px-3 py-1 rounded-full text-sm font-semibold">
                                                {team.members?.length || 0}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <button
                                                onClick={() => setViewTeam(team)}
                                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 text-zinc-200 hover:bg-zinc-700 text-sm font-medium transition"
                                            >
                                                <Eye className="w-4 h-4" />
                                                View
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {paginatedTeams.length === 0 && filteredTeams.length === 0 && (
                            <div className="text-center py-12 text-zinc-400">
                                <svg className="w-16 h-16 mx-auto text-zinc-700 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <p className="text-lg font-medium">No check-ins found</p>
                                <p className="text-sm mt-2">Try adjusting your filters or search</p>
                            </div>
                        )}
                    </div>

                    {filteredTeams.length > teamsPerPage && (
                        <div className="flex items-center justify-between bg-zinc-900 border border-zinc-800 rounded-lg p-4 mt-6">
                            <div className="text-sm text-zinc-400">
                                Showing <span className="font-semibold text-white">{startIndex + 1}</span> to{' '}
                                <span className="font-semibold text-white">{Math.min(endIndex, filteredTeams.length)}</span> of{' '}
                                <span className="font-semibold text-white">{filteredTeams.length}</span> teams
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => goToPage(currentPage - 1)}
                                    disabled={currentPage === 1}
                                    className={`px-3 py-2 rounded-lg flex items-center gap-1 transition-all ${currentPage === 1 ? 'bg-zinc-800 text-zinc-600 cursor-not-allowed' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'}`}
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                                    Previous
                                </button>
                                <div className="flex gap-1">
                                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => {
                                        if (page === 1 || page === totalPages || (page >= currentPage - 1 && page <= currentPage + 1)) {
                                            return (
                                                <button
                                                    key={page}
                                                    onClick={() => goToPage(page)}
                                                    className={`px-3 py-2 rounded-lg transition-all ${currentPage === page ? 'bg-red-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}`}
                                                >
                                                    {page}
                                                </button>
                                            );
                                        } else if (page === currentPage - 2 || page === currentPage + 2) {
                                            return <span key={page} className="px-2 text-zinc-600">...</span>;
                                        }
                                        return null;
                                    })}
                                </div>
                                <button
                                    onClick={() => goToPage(currentPage + 1)}
                                    disabled={currentPage === totalPages}
                                    className={`px-3 py-2 rounded-lg flex items-center gap-1 transition-all ${currentPage === totalPages ? 'bg-zinc-800 text-zinc-600 cursor-not-allowed' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'}`}
                                >
                                    Next
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                                </button>
                            </div>
                            <div className="text-sm text-zinc-400">
                                Page <span className="font-semibold text-white">{currentPage}</span> of <span className="font-semibold text-white">{totalPages}</span>
                            </div>
                        </div>
                    )}

                    {/* View team modal */}
                    {viewTeam && (
                        <div
                            className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
                            onClick={(e) => e.target === e.currentTarget && setViewTeam(null)}
                        >
                            <div className="bg-zinc-900 border border-zinc-800 rounded-xl max-w-lg w-full max-h-[90vh] flex flex-col shadow-xl">
                                <div className="flex items-center justify-between p-6 border-b border-zinc-800">
                                    <h3 className="text-xl font-semibold text-white">{viewTeam.team_name}</h3>
                                    <button
                                        onClick={() => setViewTeam(null)}
                                        className="text-zinc-400 hover:text-white transition p-1"
                                    >
                                        <X size={24} />
                                    </button>
                                </div>
                                <div className="p-6 overflow-y-auto space-y-4">
                                    {viewTeam.city && (
                                        <div>
                                            <span className="text-zinc-400 text-sm">City</span>
                                            <p className="text-white font-medium">{viewTeam.city}</p>
                                        </div>
                                    )}
                                    <div>
                                        <span className="text-zinc-400 text-sm block mb-2">Members ({viewTeam.members?.length || 0})</span>
                                        <ul className="space-y-2">
                                            {viewTeam.members?.map((m) => (
                                                <li key={m.id} className="bg-zinc-800/50 rounded-lg px-4 py-3 flex justify-between items-center gap-3">
                                                    <div className="min-w-0 flex-1">
                                                        <span className="text-white font-medium">{m.name}</span>
                                                        <span className="ml-2 text-zinc-400 text-sm">{m.role === 'leader' ? '(Leader)' : ''}</span>
                                                        <div className="text-zinc-400 text-sm truncate mt-0.5" title={m.email}>{m.email}</div>
                                                    </div>
                                                    <button
                                                        onClick={() => handleUndoCheckInMember(viewTeam.id, m.id)}
                                                        disabled={undoingMemberId === m.id}
                                                        className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-red-600/20 text-red-400 hover:bg-red-600/30 text-sm font-medium transition disabled:opacity-60"
                                                        title="Remove this member's check-in"
                                                    >
                                                        <UserMinus className="w-4 h-4" />
                                                        {undoingMemberId === m.id ? 'Removing...' : 'Uncheck-in'}
                                                    </button>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                </div>
                                <div className="p-6 border-t border-zinc-800 flex gap-3 justify-end">
                                    {/* <button
                                        onClick={() => setViewTeam(null)}
                                        className="px-4 py-2 rounded-lg bg-zinc-800 text-zinc-200 hover:bg-zinc-700 transition"
                                    >
                                        Close
                                    </button> */}
                                    <button
                                        onClick={async () => {
                                            if (!viewTeam) return;
                                            const token = getAdminToken();
                                            const res = await fetch(
                                                `${process.env.NEXT_PUBLIC_API_URL}/admin/semi-finalists/${viewTeam.id}`,
                                                { method: 'POST', headers: { Authorization: `Bearer ${token}` } }
                                            );
                                            const data = await res.json().catch(() => ({}));
                                            if (!res.ok) {
                                                alert(data.error || 'Failed to mark as semi-finalist');
                                                return;
                                            }
                                            alert('Team marked as semi-finalist');
                                        }}
                                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-black font-semibold transition"
                                    >
                                        {/* <Star className="w-4 h-4" /> */}
                                        Mark as semi-finalist
                                    </button>
                                    <button
                                        onClick={() => handleUndoCheckIn(viewTeam.id)}
                                        disabled={undoingId === viewTeam.id}
                                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white font-medium transition"
                                    >
                                        <LogOut className="w-4 h-4" />
                                        {undoingId === viewTeam.id ? 'Removing...' : 'Uncheck-in team'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="mt-6 text-sm text-zinc-400">
                        Total: <span className="font-semibold text-white">{filteredTeams.length}</span> teams
                        {filteredTeams.length !== teams.length && (
                            <span className="text-zinc-500"> (filtered from {teams.length})</span>
                        )}
                        {' · '}
                        Total Participants: <span className="font-semibold text-white">
                            {filteredTeams.reduce((sum, t) => sum + (t.members?.length || 0), 0)}
                        </span>
                    </div>
                </>
            )}
        </div>
    );
}
