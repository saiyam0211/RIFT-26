'use client';

import { useState } from 'react';
import Papa from 'papaparse';
import { getAdminToken } from '../../../src/lib/admin-auth';
import { BulkUploadResponse } from '../../../src/types/admin';

interface ParsedTeamData {
    teamId: string;
    teamName: string;
    city: string;
    members: Array<{
        name: string;
        email: string;
        mobile: string;
        userType: string;
    }>;
}

interface PreviewData {
    totalTeams: number;
    totalMembers: number;
    cityBreakdown: Record<string, number>;
    teams: ParsedTeamData[];
}

interface UploadProgress {
    currentTeam: string;
    currentIndex: number;
    totalTeams: number;
    percentage: number;
}

type Step = 'select' | 'preview' | 'uploading' | 'complete';

export default function BulkUpload() {
    const [file, setFile] = useState<File | null>(null);
    const [step, setStep] = useState<Step>('select');
    const [parsedData, setParsedData] = useState<PreviewData | null>(null);
    const [progress, setProgress] = useState<UploadProgress | null>(null);
    const [result, setResult] = useState<BulkUploadResponse | null>(null);
    const [parsing, setParsing] = useState(false);

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const selectedFile = e.target.files[0];
            setFile(selectedFile);
            setResult(null);

            // Parse CSV client-side for preview
            setParsing(true);
            try {
                const preview = await parseCSVFile(selectedFile);
                setParsedData(preview);
                setStep('preview');
            } catch (error) {
                console.error('Failed to parse CSV:', error);
                alert('Failed to parse CSV file. Please check the format.');
            } finally {
                setParsing(false);
            }
        }
    };

    const parseCSVFile = (file: File): Promise<PreviewData> => {
        return new Promise((resolve, reject) => {
            Papa.parse(file, {
                complete: (results) => {
                    try {
                        const rows = results.data as string[][];
                        if (rows.length < 2) {
                            reject(new Error('CSV must have header and data rows'));
                            return;
                        }

                        // Group by team ID
                        const teamsMap: Record<string, ParsedTeamData> = {};
                        const cityCount: Record<string, number> = {};

                        for (let i = 1; i < rows.length; i++) {
                            const row = rows[i];
                            if (row.length < 19 || !row[0]?.trim()) continue;

                            const teamId = row[0].trim();
                            const teamName = row[1].trim();
                            const candidateName = row[2].trim();
                            const email = row[3].trim();
                            const mobile = row[4].trim();
                            const userType = row[6].trim();
                            const city = row[18].trim();

                            if (!teamsMap[teamId]) {
                                teamsMap[teamId] = {
                                    teamId,
                                    teamName: teamName || `Team ${teamId}`,
                                    city,
                                    members: []
                                };

                                // Count cities
                                if (city) {
                                    cityCount[city] = (cityCount[city] || 0) + 1;
                                }
                            }

                            teamsMap[teamId].members.push({
                                name: candidateName,
                                email,
                                mobile,
                                userType
                            });
                        }

                        const teams = Object.values(teamsMap);
                        const totalMembers = teams.reduce((sum, team) => sum + team.members.length, 0);

                        resolve({
                            totalTeams: teams.length,
                            totalMembers,
                            cityBreakdown: cityCount,
                            teams
                        });
                    } catch (error) {
                        reject(error);
                    }
                },
                error: (error) => reject(error)
            });
        });
    };

    const handleConfirm = async () => {
        if (!file || !parsedData) return;

        setStep('uploading');

        const teams = parsedData.teams;
        const totalTeams = teams.length;

        // Estimate upload time: ~100ms per team (adjust based on actual performance)
        const estimatedTimeMs = totalTeams * 100;
        const updateIntervalMs = Math.max(100, Math.floor(estimatedTimeMs / totalTeams));

        let currentIndex = 0;

        // Start progress tracking
        const progressInterval = setInterval(() => {
            currentIndex++;
            if (currentIndex <= totalTeams) {
                setProgress({
                    currentTeam: teams[Math.min(currentIndex - 1, teams.length - 1)]?.teamName || '',
                    currentIndex: currentIndex,
                    totalTeams: totalTeams,
                    percentage: Math.min(99, Math.round((currentIndex / totalTeams) * 100)) // Cap at 99% until upload completes
                });
            }
        }, updateIntervalMs);

        // Actually upload
        try {
            const formData = new FormData();
            formData.append('file', file);

            const token = getAdminToken();
            const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/teams/bulk-upload`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
                body: formData,
            });

            const data = await response.json();

            // Stop progress tracking
            clearInterval(progressInterval);

            // Set to 100% complete
            setProgress({
                currentTeam: teams[teams.length - 1]?.teamName || 'Complete',
                currentIndex: totalTeams,
                totalTeams: totalTeams,
                percentage: 100
            });

            // Wait a bit to show 100%, then show results
            setTimeout(() => {
                setResult(data);
                setStep('complete');
                setProgress(null);
            }, 800);
        } catch (error) {
            clearInterval(progressInterval);
            console.error('Upload failed:', error);
            alert('Upload failed. Please try again.');
            setStep('preview');
        }
    };

    const handleCancel = () => {
        setStep('select');
        setFile(null);
        setParsedData(null);
        setProgress(null);
        setResult(null);
    };

    const handleClearData = async () => {
        if (!confirm('⚠️ Are you sure you want to delete ALL teams and members? This cannot be undone!')) {
            return;
        }

        try {
            const token = getAdminToken();
            const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/data/clear`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` },
            });

            const data = await response.json();
            if (response.ok) {
                alert('✅ All data cleared successfully!');
                handleCancel();
            } else {
                alert('❌ Failed to clear data: ' + (data.error || 'Unknown error'));
            }
        } catch (error) {
            console.error('Clear failed:', error);
            alert('❌ Failed to clear data. Please try again.');
        }
    };

    return (
        <div>
            <h1 className="text-3xl font-bold text-white mb-8">Bulk Team Upload</h1>

            {/* Step 1: File Selection */}
            {step === 'select' && (
                <div className="bg-zinc-900 border border-zinc-800 rounded-lg shadow p-6 w-full">
                    <div className="mb-6">
                        <h2 className="text-lg font-semibold mb-2 text-white">Upload CSV File</h2>
                        <p className="text-zinc-400 text-sm mb-4">
                            Upload a CSV file with team and member information.
                            <a href="/SAMPLE_TEAMS_CSV.md" className="text-red-500 hover:underline ml-1">
                                View sample format
                            </a>
                        </p>

                        <div className="border-2 border-dashed border-zinc-700 rounded-lg p-8 text-center hover:border-red-600 transition-colors bg-zinc-950">
                            <input
                                type="file"
                                accept=".csv"
                                onChange={handleFileChange}
                                className="hidden"
                                id="csv-upload"
                                disabled={parsing}
                            />
                            <label
                                htmlFor="csv-upload"
                                className="cursor-pointer flex flex-col items-center"
                            >
                                <svg className="w-12 h-12 text-zinc-500 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                </svg>
                                <span className="text-sm text-zinc-400">
                                    {parsing ? 'Parsing CSV...' : 'Click to select CSV file'}
                                </span>
                            </label>
                        </div>
                    </div>
                </div>
            )}

            {/* Step 2: Preview */}
            {step === 'preview' && parsedData && (
                <div className="space-y-6 w-full">
                    <div className="bg-zinc-900 border border-zinc-800 rounded-lg shadow-lg p-6">
                        <h2 className="text-xl font-bold text-white mb-4">📊 Upload Preview</h2>

                        {/* Stats Grid */}
                        <div className="grid grid-cols-2 gap-4 mb-6">
                            <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-4 text-center">
                                <p className="text-3xl font-bold text-red-500">{parsedData.totalTeams}</p>
                                <p className="text-sm text-zinc-400">Teams</p>
                            </div>
                            <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-4 text-center">
                                <p className="text-3xl font-bold text-red-500">{parsedData.totalMembers}</p>
                                <p className="text-sm text-zinc-400">Members</p>
                            </div>
                        </div>

                        {/* City Breakdown */}
                        {Object.keys(parsedData.cityBreakdown).length > 0 && (
                            <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-4">
                                <h3 className="font-semibold text-white mb-3">📍 City Breakdown</h3>
                                <div className="grid grid-cols-2 gap-2">
                                    {Object.entries(parsedData.cityBreakdown)
                                        .sort((a, b) => b[1] - a[1])
                                        .map(([city, count]) => (
                                            <div key={city} className="flex justify-between text-sm">
                                                <span className="text-zinc-300">{city}:</span>
                                                <span className="font-semibold text-red-500">{count} teams</span>
                                            </div>
                                        ))}
                                </div>
                            </div>
                        )}

                        {/* Sample Teams */}
                        <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-4 mt-4">
                            <h3 className="font-semibold text-white mb-3">👥 Sample Teams (first 5)</h3>
                            <ul className="space-y-2 text-sm">
                                {parsedData.teams.slice(0, 5).map((team) => (
                                    <li key={team.teamId} className="flex justify-between">
                                        <span className="text-zinc-300">{team.teamName}</span>
                                        <span className="text-zinc-500">{team.members.length} members</span>
                                    </li>
                                ))}
                                {parsedData.teams.length > 5 && (
                                    <li className="text-zinc-500 italic">... and {parsedData.teams.length - 5} more</li>
                                )}
                            </ul>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex gap-3 mt-6">
                            <button
                                onClick={handleConfirm}
                                className="flex-1 bg-red-600 text-white font-semibold py-3 px-6 rounded-lg hover:bg-red-700 transition-colors"
                            >
                                ✓ Confirm Upload
                            </button>
                            <button
                                onClick={handleCancel}
                                className="flex-1 bg-zinc-800 border border-zinc-700 text-zinc-300 font-semibold py-3 px-6 rounded-lg hover:bg-zinc-700 transition-colors"
                            >
                                ✕ Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Step 3: Uploading with Progress */}
            {step === 'uploading' && progress && (
                <div className="bg-zinc-900 border border-zinc-800 rounded-lg shadow-lg p-8 w-full">
                    <h2 className="text-2xl font-bold text-white mb-6">Uploading Teams...</h2>

                    {/* Progress Bar */}
                    <div className="w-full bg-zinc-800 rounded-full h-6 mb-4 overflow-hidden">
                        <div
                            className="bg-gradient-to-r from-red-600 to-red-700 h-6 rounded-full transition-all duration-300 ease-out flex items-center justify-end pr-3"
                            style={{ width: `${progress.percentage}%` }}
                        >
                            <span className="text-white text-xs font-bold">
                                {progress.percentage}%
                            </span>
                        </div>
                    </div>

                    {/* Stats */}
                    <div className="flex justify-between text-lg mb-4">
                        <span className="text-zinc-300">
                            <span className="font-bold text-red-500">{progress.currentIndex}</span> / {progress.totalTeams} teams
                        </span>
                        <span className="text-zinc-400">{progress.percentage}%</span>
                    </div>

                    {/* Current Team */}
                    <div className="bg-red-950/30 border border-red-800/50 rounded-lg p-4">
                        <p className="text-sm text-zinc-400 mb-1">Currently processing:</p>
                        <p className="text-lg font-bold text-white">{progress.currentTeam}</p>
                    </div>
                </div>
            )}

            {/* Step 4: Results */}
            {step === 'complete' && result && (
                <div className="max-w-full space-y-6">
                    <div className={`p-6 rounded-lg border ${result.error_count > 0 ? 'bg-yellow-950/30 border-yellow-800/50' : 'bg-green-950/30 border-green-800/50'}`}>
                        <h3 className="text-xl font-semibold mb-4 text-white">Upload Complete!</h3>
                        <div className="space-y-2">
                            <p className="text-lg text-zinc-300">✅ Successfully created: <strong className="text-green-400">{result.success_count}</strong> teams</p>
                            <p className="text-lg text-zinc-300">❌ Errors: <strong className="text-red-400">{result.error_count}</strong></p>
                            <p className="text-lg text-zinc-300">📊 Total teams in file: <strong className="text-white">{result.total_teams}</strong></p>
                        </div>
                    </div>

                    {result.errors && result.errors.length > 0 && (
                        <div className="bg-red-950/30 border border-red-800/50 p-4 rounded-lg">
                            <h4 className="font-semibold text-red-400 mb-2">Errors:</h4>
                            <ul className="text-sm text-red-300 space-y-1">
                                {result.errors.slice(0, 10).map((error, i) => (
                                    <li key={i}>• {error}</li>
                                ))}
                                {result.errors.length > 10 && (
                                    <li className="text-red-400 italic">... and {result.errors.length - 10} more</li>
                                )}
                            </ul>
                        </div>
                    )}

                    <button
                        onClick={handleCancel}
                        className="w-full bg-red-600 text-white font-semibold py-3 px-6 rounded-lg hover:bg-red-700 transition-colors"
                    >
                        Upload Another File
                    </button>
                </div>
            )}

            {/* Danger Zone - Clear Data */}
            {(step === 'select' || step === 'complete') && (
                <div className="bg-red-950/30 border border-red-800/50 rounded-lg p-4 w-full mt-6">
                    <h3 className="font-semibold text-red-400 mb-2">⚠️ Danger Zone</h3>
                    <p className="text-sm text-red-300 mb-3">
                        Clear all teams and members from the database. This action cannot be undone.
                    </p>
                    <button
                        onClick={handleClearData}
                        className="bg-red-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-red-700 transition-colors text-sm"
                    >
                        Clear All Data
                    </button>
                </div>
            )}

            {/* CSV Format Info */}
            <div className="mt-8 bg-blue-950/30 border border-blue-800/50 rounded-lg p-4 w-full">
                <h3 className="font-semibold text-blue-400 mb-2">📝 CSV Format Requirements</h3>
                <p className="text-sm text-blue-300">
                    The CSV should have 19 columns with team members on separate rows.
                    Members with the same Team ID will be grouped together.
                    The system will automatically identify the team leader based on the "User Type" column.
                </p>
            </div>
        </div>
    );
}
