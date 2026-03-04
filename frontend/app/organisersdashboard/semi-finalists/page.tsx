'use client';

import { useEffect, useState } from 'react';
import { getAdminToken } from '../../../src/lib/admin-auth';
import { Eye, Filter, Star, Award, CheckSquare, Square, MinusSquare, X } from 'lucide-react';
import { CertificateSendModal } from '../../../components/CertificateSendModal';

interface SemiFinalist {
  id: string;
  team_id: string;
  problem_statement_id: string;
  team_name: string;
  team_city?: string;
  ps_track: string;
  ps_name: string;
  leader_name?: string;
  leader_email?: string;
  position?: number | null;
  best_web3?: boolean;
}

export default function SemiFinalistsPage() {
  const [items, setItems] = useState<SemiFinalist[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCity, setFilterCity] = useState('');
  const [filterPS, setFilterPS] = useState('');
  const [selected, setSelected] = useState<SemiFinalist | null>(null);
  const [positionInput, setPositionInput] = useState<string>('');
  const [bestWeb3, setBestWeb3] = useState(false);
  const [savingAwards, setSavingAwards] = useState(false);

  // Multi-select state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [certModalType, setCertModalType] = useState<'semi_finalist' | 'winner' | null>(null);

  useEffect(() => {
    fetchSemiFinalists();
  }, []);


  const fetchSemiFinalists = async () => {
    try {
      const token = getAdminToken();
      const params = new URLSearchParams();
      if (filterCity) params.set('city', filterCity);
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/admin/semi-finalists?${params.toString()}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await res.json();
      setItems(data.semi_finalists || []);
    } catch (e) {
      console.error('Failed to fetch semi-finalists:', e);
    } finally {
      setLoading(false);
    }
  };

  const uniqueCities = Array.from(
    new Set(items.map(i => i.team_city).filter(Boolean) as string[])
  ).sort();

  const uniquePS = Array.from(
    new Set(items.map(i => `${i.ps_track} – ${i.ps_name}`))
  ).sort();

  const filtered = items.filter(item => {
    const matchesSearch =
      !searchQuery ||
      item.team_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.ps_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.ps_track.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCity = !filterCity || item.team_city === filterCity;
    const psLabel = `${item.ps_track} – ${item.ps_name}`;
    const matchesPS = !filterPS || psLabel === filterPS;
    return matchesSearch && matchesCity && matchesPS;
  });

  // ---- Selection helpers ----
  // Semi-finalists only have team_id for sending certs
  const toggleSelect = (teamId: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(teamId)) next.delete(teamId);
      else next.add(teamId);
      return next;
    });
  };

  const isPageAllSelected = filtered.length > 0 && filtered.every(i => selectedIds.has(i.team_id));
  const isPagePartialSelected = filtered.some(i => selectedIds.has(i.team_id)) && !isPageAllSelected;

  const toggleAllFiltered = () => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (isPageAllSelected) {
        filtered.forEach(i => next.delete(i.team_id));
      } else {
        filtered.forEach(i => next.add(i.team_id));
      }
      return next;
    });
  };

  const clearSelection = () => setSelectedIds(new Set());

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-white">Semi Finalists</h1>
      </div>

      {/* Filters */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 mb-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative">
            <input
              type="text"
              placeholder="Search by team or PS..."
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
          <select
            value={filterPS}
            onChange={(e) => setFilterPS(e.target.value)}
            className="px-4 py-3 bg-zinc-950 border border-zinc-800 text-white rounded-lg focus:ring-2 focus:ring-red-600"
          >
            <option value="">All Problem Statements</option>
            {uniquePS.map(label => (
              <option key={label} value={label}>{label}</option>
            ))}
          </select>
        </div>
        {(searchQuery || filterCity || filterPS) && (
          <div className="flex items-center gap-2 text-sm text-zinc-400">
            <Filter className="w-4 h-4" />
            <span>Active filters:</span>
            {searchQuery && <span className="text-white">Search "{searchQuery}"</span>}
            {filterCity && <span className="text-white">City {filterCity}</span>}
            {filterPS && <span className="text-white">PS {filterPS}</span>}
            <button
              onClick={() => { setSearchQuery(''); setFilterCity(''); setFilterPS(''); }}
              className="ml-auto text-red-500 hover:text-red-400 underline"
            >
              Clear all
            </button>
          </div>
        )}
      </div>

      {/* Select-all banner */}
      {selectedIds.size > 0 && !isPageAllSelected && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg px-4 py-3 mb-3 flex items-center justify-between text-sm">
          <span className="text-amber-300">{selectedIds.size} team{selectedIds.size !== 1 ? 's' : ''} selected.</span>
          <button onClick={toggleAllFiltered} className="text-amber-400 font-semibold hover:text-amber-300 underline">
            Select all {filtered.length} filtered teams
          </button>
        </div>
      )}
      {isPageAllSelected && filtered.length > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg px-4 py-3 mb-3 flex items-center justify-between text-sm">
          <span className="text-amber-300">All {filtered.length} teams selected.</span>
          <button onClick={clearSelection} className="text-amber-400 font-semibold hover:text-amber-300 underline">Clear selection</button>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto"></div>
          <p className="mt-4 text-zinc-400">Loading semi-finalists...</p>
        </div>
      ) : (
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-zinc-800">
            <thead className="bg-red-600 text-white">
              <tr>
                <th className="px-4 py-3 w-10">
                  <button
                    onClick={toggleAllFiltered}
                    className="flex items-center justify-center text-white hover:text-amber-200 transition"
                    title={isPageAllSelected ? 'Deselect all' : 'Select all filtered'}
                  >
                    {isPageAllSelected ? (
                      <CheckSquare className="w-5 h-5" />
                    ) : isPagePartialSelected ? (
                      <MinusSquare className="w-5 h-5 opacity-70" />
                    ) : (
                      <Square className="w-5 h-5 opacity-60" />
                    )}
                  </button>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Team Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">City</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Problem Statement</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Leader</th>
                <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider">Awards</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {filtered.map((item, idx) => {
                const isSelected = selectedIds.has(item.team_id);
                return (
                  <tr
                    key={item.id}
                    className={`hover:bg-zinc-800 transition-colors ${isSelected ? 'bg-amber-500/5 border-l-2 border-amber-500' : idx % 2 === 0 ? 'bg-zinc-950' : 'bg-black'}`}
                  >
                    <td className="px-4 py-4">
                      <button
                        onClick={() => toggleSelect(item.team_id)}
                        className={`flex items-center justify-center transition ${isSelected ? 'text-amber-400' : 'text-zinc-600 hover:text-zinc-400'}`}
                      >
                        {isSelected ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5" />}
                      </button>
                    </td>
                    <td className="px-6 py-4 text-white font-medium">{item.team_name}</td>
                    <td className="px-6 py-4 text-zinc-200">{item.team_city || '—'}</td>
                    <td className="px-6 py-4">
                      <div className="text-white font-medium">{item.ps_name}</div>
                      <div className="text-zinc-400 text-sm mt-0.5">{item.ps_track}</div>
                    </td>
                    <td className="px-6 py-4">
                      {item.leader_name ? (
                        <>
                          <div className="text-white text-sm font-medium">{item.leader_name}</div>
                          {item.leader_email && (
                            <div className="text-zinc-400 text-xs truncate max-w-[220px]" title={item.leader_email}>
                              {item.leader_email}
                            </div>
                          )}
                        </>
                      ) : (
                        <span className="text-zinc-500 text-sm">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {item.position && (
                          <span className="px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-300 text-xs font-semibold">
                            {item.position}{item.position === 1 ? 'st' : item.position === 2 ? 'nd' : item.position === 3 ? 'rd' : 'th'}
                          </span>
                        )}
                        {item.best_web3 && (
                          <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-semibold">
                            Best Web3
                          </span>
                        )}
                        <button
                          onClick={() => {
                            setSelected(item);
                            setPositionInput(item.position ? String(item.position) : '');
                            setBestWeb3(!!item.best_web3);
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 text-zinc-200 hover:bg-zinc-700 text-xs font-medium transition"
                        >
                          <Eye className="w-4 h-4" />
                          View
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-zinc-400">
                    No semi-finalists found for the selected filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Awards modal */}
      {selected && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
          onClick={(e) => e.target === e.currentTarget && setSelected(null)}
        >
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl max-w-lg w-full max-h-[90vh] flex flex-col shadow-xl">
            <div className="flex items-center justify-between p-6 border-b border-zinc-800">
              <div>
                <h3 className="text-xl font-semibold text-white">{selected.team_name}</h3>
                <p className="text-zinc-400 text-sm mt-1">
                  {selected.team_city || '—'} · {selected.ps_track} · {selected.ps_name}
                </p>
              </div>
            </div>
            <div className="p-6 space-y-4 overflow-y-auto">
              {selected.leader_name && (
                <div>
                  <span className="text-zinc-400 text-sm block mb-1">Leader</span>
                  <p className="text-white text-sm font-medium">
                    {selected.leader_name}
                    {selected.leader_email && (
                      <span className="text-zinc-400 text-xs ml-2">{selected.leader_email}</span>
                    )}
                  </p>
                </div>
              )}
              <div>
                <label className="text-zinc-300 text-sm mb-2 block">Position (1–5, optional)</label>
                <input
                  type="number"
                  min={1}
                  max={5}
                  value={positionInput}
                  onChange={(e) => setPositionInput(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  placeholder="Leave empty if no overall position"
                />
              </div>
              <label className="inline-flex items-center gap-2 text-sm text-zinc-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={bestWeb3}
                  onChange={(e) => setBestWeb3(e.target.checked)}
                  className="rounded border-zinc-700 bg-zinc-900 text-emerald-500 focus:ring-0"
                />
                <span>Best Web3 project of the city</span>
              </label>
            </div>
            <div className="p-6 border-t border-zinc-800 flex justify-end gap-3">
              <button
                onClick={() => setSelected(null)}
                className="px-4 py-2 rounded-lg bg-zinc-800 text-zinc-200 hover:bg-zinc-700 text-sm font-medium transition"
              >
                Close
              </button>
              <button
                onClick={async () => {
                  if (!selected) return;
                  let pos: number | null = null;
                  if (positionInput.trim() !== '') {
                    const n = Number(positionInput);
                    if (!Number.isInteger(n) || n < 1 || n > 5) {
                      alert('Position must be an integer between 1 and 5');
                      return;
                    }
                    pos = n;
                  }
                  setSavingAwards(true);
                  try {
                    const token = getAdminToken();
                    const res = await fetch(
                      `${process.env.NEXT_PUBLIC_API_URL}/admin/semi-finalists/${selected.team_id}/awards`,
                      {
                        method: 'POST',
                        headers: {
                          Authorization: `Bearer ${token}`,
                          'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                          position: pos,
                          best_web3: bestWeb3,
                        }),
                      }
                    );
                    const data = await res.json().catch(() => ({}));
                    if (!res.ok) {
                      alert(data.error || 'Failed to save awards');
                      return;
                    }
                    await fetchSemiFinalists();
                    setSelected(null);
                  } finally {
                    setSavingAwards(false);
                  }
                }}
                disabled={savingAwards}
                className="px-5 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-black font-semibold text-sm inline-flex items-center gap-2 disabled:opacity-60 transition"
              >
                <Star className="w-4 h-4" />
                {savingAwards ? 'Saving...' : 'Save awards'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating action bar – two cert options */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 bg-zinc-900 border border-zinc-700 rounded-2xl shadow-2xl px-5 py-3 animate-in fade-in slide-in-from-bottom-4 duration-200">
          <span className="text-white font-semibold text-sm">
            {selectedIds.size} team{selectedIds.size !== 1 ? 's' : ''} selected
          </span>
          <div className="w-px h-5 bg-zinc-700" />
          <button
            onClick={() => setCertModalType('semi_finalist')}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-sm transition-all"
          >
            <Award className="w-4 h-4" />
            Semi-Finalist Certificate
          </button>
          <button
            onClick={() => setCertModalType('winner')}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-sm transition-all"
          >
            <Star className="w-4 h-4" />
            Winner Certificate
          </button>
          <button
            onClick={clearSelection}
            className="text-zinc-400 hover:text-white transition p-1"
            title="Clear selection"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <CertificateSendModal
        isOpen={certModalType !== null}
        onClose={() => setCertModalType(null)}
        selectedTeamIds={Array.from(selectedIds)}
        certType={certModalType || 'semi_finalist'}
        estimatedParticipants={selectedIds.size * 4}
        showPositionInput={certModalType === 'winner'}
      />
    </div>
  );
}

