'use client';

import { useState, useEffect } from 'react';
import axios from 'axios';
import { getAdminToken } from '../../../src/lib/admin-auth';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1';

export default function EmailsPage() {
    const [subject, setSubject] = useState('');
    const [htmlContent, setHTMLContent] = useState('');
    const [teamSizes, setTeamSizes] = useState<number[]>([]);
    const [cities, setCities] = useState<string[]>([]);
    const [sending, setSending] = useState(false);
    const [emailLogs, setEmailLogs] = useState<any[]>([]);
    const [showLogs, setShowLogs] = useState(false);

    const cityOptions = ['BLR', 'PUNE', 'HYD', 'CHN', 'DEL', 'MUM'];
    const teamSizeOptions = [1, 2, 3, 4, 5];

    useEffect(() => {
        fetchEmailLogs();
    }, []);

    const fetchEmailLogs = async () => {
        try {
            const token = getAdminToken();
            const response = await axios.get(`${API_URL}/admin/email-logs`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setEmailLogs(response.data.logs || []);
        } catch (error) {
            console.error('Failed to fetch email logs:', error);
        }
    };

    const handleSendEmail = async () => {
        if (!subject || !htmlContent) {
            alert('Please fill in subject and content');
            return;
        }

        setSending(true);
        try {
            const token = getAdminToken();
            const response = await axios.post(
                `${API_URL}/admin/send-bulk-email`,
                {
                    subject,
                    html_content: htmlContent,
                    filters: {
                        team_sizes: teamSizes,
                        cities,
                    },
                },
                { headers: { Authorization: `Bearer ${token}` } }
            );

            alert(`Email sent successfully to ${response.data.recipients_count} recipients!`);
            setSubject('');
            setHTMLContent('');
            setTeamSizes([]);
            setCities([]);
            fetchEmailLogs();
        } catch (error: any) {
            console.error('Failed to send email:', error);
            alert('Failed to send email: ' + (error.response?.data?.error || error.message));
        } finally {
            setSending(false);
        }
    };

    const generateTemplate = () => {
        const template = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #060010; color: #fff; padding: 0; margin: 0; }
    .container { max-width: 600px; margin: 40px auto; background: linear-gradient(135deg, #1a0420 0%, #060010 100%); border: 1px solid #c0211f30; border-radius: 12px; overflow: hidden; }
    .header { background: linear-gradient(90deg, #c0211f 0%, #8a1816 100%); padding: 30px; text-align: center; }
    .header h1 { margin: 0; font-size: 28px; color: #fff; text-shadow: 0 2px 4px rgba(0,0,0,0.3); }
    .content { padding: 30px; }
    .footer { padding: 20px 30px; background: rgba(255,255,255,0.03); border-top: 1px solid rgba(255,255,255,0.1); font-size: 12px; color: #888; text-align: center; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🚀 RIFT '26 Update</h1>
    </div>
    <div class="content">
      <p>Hi Team,</p>
      <p>This is an important update from the RIFT '26 team.</p>
      <!-- Add your content here -->
      <p>Thank you for being part of RIFT '26!</p>
    </div>
    <div class="footer">
      <strong>RIFT '26 Hackathon Team</strong>
    </div>
  </div>
</body>
</html>`;
        setHTMLContent(template);
    };

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Bulk Email Sender</h1>
                    <p className="text-gray-600 mt-1">Send custom emails to filtered teams</p>
                </div>
                <button
                    onClick={() => setShowLogs(!showLogs)}
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                >
                    {showLogs ? 'Hide Logs' : 'View Logs'}
                </button>
            </div>

            {showLogs ? (
                <div className="bg-white rounded-lg shadow p-6">
                    <h2 className="text-xl font-bold mb-4">Email History</h2>
                    {emailLogs.length === 0 ? (
                        <p className="text-gray-500">No emails sent yet</p>
                    ) : (
                        <div className="space-y-3">
                            {emailLogs.map((log) => (
                                <div key={log.id} className="border-b pb-3">
                                    <div className="flex justify-between">
                                        <span className="font-semibold">{log.subject}</span>
                                        <span className="text-sm text-gray-500">
                                            {log.sent_count} recipients
                                        </span>
                                    </div>
                                    <p className="text-xs text-gray-500 mt-1">
                                        {new Date(log.created_at).toLocaleString()}
                                    </p>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            ) : (
                <div className="bg-white rounded-lg shadow p-6">
                    {/* Filters */}
                    <div className="mb-6">
                        <h3 className="text-lg font-semibold mb-3">Target Filters</h3>

                        <div className="grid md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Team Sizes
                                </label>
                                <div className="flex flex-wrap gap-2">
                                    {teamSizeOptions.map((size) => (
                                        <button
                                            key={size}
                                            onClick={() =>
                                                setTeamSizes((prev) =>
                                                    prev.includes(size)
                                                        ? prev.filter((s) => s !== size)
                                                        : [...prev, size]
                                                )
                                            }
                                            className={`px-3 py-1 rounded-lg text-sm transition-colors ${teamSizes.includes(size)
                                                    ? 'bg-purple-600 text-white'
                                                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                                }`}
                                        >
                                            {size} {size === 1 ? 'member' : 'members'}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Cities
                                </label>
                                <div className="flex flex-wrap gap-2">
                                    {cityOptions.map((city) => (
                                        <button
                                            key={city}
                                            onClick={() =>
                                                setCities((prev) =>
                                                    prev.includes(city)
                                                        ? prev.filter((c) => c !== city)
                                                        : [...prev, city]
                                                )
                                            }
                                            className={`px-3 py-1 rounded-lg text-sm transition-colors ${cities.includes(city)
                                                    ? 'bg-purple-600 text-white'
                                                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                                }`}
                                        >
                                            {city}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {(teamSizes.length > 0 || cities.length > 0) && (
                            <div className="mt-3 text-sm text-gray-600">
                                <strong>Targeting:</strong>{' '}
                                {teamSizes.length > 0 && `Teams of ${teamSizes.join(', ')} members`}
                                {teamSizes.length > 0 && cities.length > 0 && ' in '}
                                {cities.length > 0 && cities.join(', ')}
                            </div>
                        )}
                    </div>

                    {/* Email Content */}
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Subject
                        </label>
                        <input
                            type="text"
                            value={subject}
                            onChange={(e) => setSubject(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                            placeholder="Email subject..."
                        />
                    </div>

                    <div className="mb-4">
                        <div className="flex justify-between items-center mb-2">
                            <label className="block text-sm font-medium text-gray-700">
                                HTML Content
                            </label>
                            <button
                                onClick={generateTemplate}
                                className="text-sm text-purple-600 hover:text-purple-700"
                            >
                                Load Template
                            </button>
                        </div>
                        <textarea
                            value={htmlContent}
                            onChange={(e) => setHTMLContent(e.target.value)}
                            rows={12}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent font-mono text-sm"
                            placeholder="Paste your HTML email content here..."
                        />
                    </div>

                    {/* Preview */}
                    {htmlContent && (
                        <details className="mb-4">
                            <summary className="cursor-pointer text-sm font-medium text-gray-700 mb-2">
                                Preview Email
                            </summary>
                            <div
                                className="border border-gray-300 rounded-lg p-4 bg-gray-50"
                                dangerouslySetInnerHTML={{ __html: htmlContent }}
                            />
                        </details>
                    )}

                    {/* Send Button */}
                    <button
                        onClick={handleSendEmail}
                        disabled={sending || !subject || !htmlContent}
                        className="w-full px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                    >
                        {sending ? (
                            <>
                                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                                Sending...
                            </>
                        ) : (
                            <>
                                <span>📧</span>
                                Send Bulk Email
                            </>
                        )}
                    </button>

                    {teamSizes.length === 0 && cities.length === 0 && (
                        <p className="mt-3 text-sm text-yellow-600 text-center">
                            ⚠️ No filters selected - email will be sent to ALL teams
                        </p>
                    )}
                </div>
            )}
        </div>
    );
}
