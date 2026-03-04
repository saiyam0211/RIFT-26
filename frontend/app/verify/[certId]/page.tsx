'use client';

import { useEffect, useRef, useState } from 'react';
import {
    CheckCircle, XCircle, Download, Linkedin, Shield,
    Users, Calendar, Award, Share2, ExternalLink, Copy, Check
} from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:9000/api/v1';

interface Certificate {
    id: string;
    participant_name: string;
    participant_email: string;
    team_name: string;
    cert_type: string;
}

interface VerifyResponse {
    valid: boolean;
    certificate?: Certificate;
    label?: string;
    issued_at?: string;
    image_url?: string;   // JPEG – used as OG image
    verify_url?: string;  // Canonical frontend URL
    error?: string;
}

// ── LinkedIn helpers ────────────────────────────────────────────────────────

/**
 * "Add to Certifications" deep-link.
 * LinkedIn reads certUrl to let the user click through to verify the credential.
 * The name appears in the Certifications section of their profile.
 */
function buildLinkedInAddURL(cert: Certificate, certTitle: string, verifyUrl: string) {
    const params = new URLSearchParams();
    params.set('startTask', 'CERTIFICATION_NAME');
    params.set('name', certTitle);
    params.set('organizationName', "RIFT '26");
    params.set('issueYear', '2026');
    params.set('issueMonth', '2');
    params.set('certUrl', verifyUrl);   // must be a real public URL
    params.set('certId', cert.id);
    return `https://www.linkedin.com/profile/add?${params.toString()}`;
}

/**
 * "Share on LinkedIn" URL.
 * LinkedIn scrapes this URL for og:image → shows the certificate image as a rich card.
 * The user can then save the post to their "Featured" section to have it on their profile.
 */
function buildLinkedInShareURL(verifyUrl: string) {
    return `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(verifyUrl)}`;
}

// ── Page component ──────────────────────────────────────────────────────────

export default function VerifyPage({ params }: { params: Promise<{ certId: string }> }) {
    const [certId, setCertId] = useState('');
    const [data, setData] = useState<VerifyResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [copied, setCopied] = useState(false);
    const [downloading, setDownloading] = useState(false);
    const svgRef = useRef<HTMLImageElement>(null);

    useEffect(() => {
        params.then(({ certId: id }) => {
            setCertId(id);
            fetch(`${API_URL}/certificates/verify/${id}`)
                .then(r => r.json())
                .then(setData)
                .catch(() => setData({ valid: false, error: 'Network error. Please try again.' }))
                .finally(() => setLoading(false));
        });
    }, [params]);

    if (loading) {
        return (
            <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
                <div className="text-center space-y-4">
                    <div className="w-14 h-14 border-4 border-zinc-800 border-t-red-600 rounded-full animate-spin mx-auto" />
                    <p className="text-zinc-400 text-sm">Verifying certificate…</p>
                </div>
            </div>
        );
    }

    if (!data?.valid || !data.certificate) {
        return (
            <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-6">
                <div className="max-w-md w-full bg-zinc-900 border border-red-500/30 rounded-2xl p-8 text-center space-y-4">
                    <XCircle className="w-16 h-16 text-red-500 mx-auto" />
                    <h1 className="text-2xl font-bold text-white">Invalid Certificate</h1>
                    <p className="text-zinc-400 text-sm">{data?.error || 'Certificate not found or revoked.'}</p>
                    {certId && <p className="text-zinc-600 text-xs font-mono break-all">{certId}</p>}
                </div>
            </div>
        );
    }

    const cert = data.certificate;

    // Prefer server-provided URLs; fall back to constructed ones
    const verifyUrl = data.verify_url || (typeof window !== 'undefined' ? window.location.href : '');
    // Append a cache-busting timestamp so the browser always fetches the latest SVG (with new fonts/text)
    const timestamp = Date.now();
    const jpegUrl = (data.image_url || `${API_URL}/certificates/${cert.id}/image.jpg`) + `?t=${timestamp}`;
    const svgUrl = `${API_URL}/certificates/${cert.id}/image.svg?t=${timestamp}`;



    const certTitle = `Certificate ${data.label || 'of Appreciation'} – RIFT '26 Hackathon`;

    const linkedInAddUrl = buildLinkedInAddURL(cert, certTitle, verifyUrl);
    const linkedInShareUrl = buildLinkedInShareURL(verifyUrl);

    const badgeStyles: Record<string, string> = {
        winner: 'bg-amber-500 text-black',
        semi_finalist: 'bg-purple-600 text-white',
        participant: 'bg-red-600 text-white',
    };
    const badgeLabels: Record<string, string> = {
        winner: '🏆 WINNER',
        semi_finalist: '⚡ SEMI-FINALIST',
        participant: '✅ PARTICIPANT',
    };
    const badgeStyle = badgeStyles[cert.cert_type] || badgeStyles.participant;
    const badgeLabel = badgeLabels[cert.cert_type] || badgeLabels.participant;

    const copyLink = () => {
        navigator.clipboard.writeText(verifyUrl).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    };

    /**
     * Instant client-side JPEG download.
     * Draws the SVG <img> already rendered on the page onto an off-screen canvas,
     * converts it to a JPEG blob, and triggers a download — no backend trip needed.
     */
    const handleDownload = () => {
        const img = svgRef.current;
        if (!img || !img.complete) return;
        setDownloading(true);

        const canvas = document.createElement('canvas');
        canvas.width = 1200;
        canvas.height = 848;
        const ctx = canvas.getContext('2d');
        if (!ctx) { setDownloading(false); return; }

        // Draw white background first (JPEG has no transparency)
        ctx.fillStyle = '#111111';
        ctx.fillRect(0, 0, 1200, 848);
        ctx.drawImage(img, 0, 0, 1200, 848);

        canvas.toBlob((blob) => {
            if (!blob) { setDownloading(false); return; }
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `RIFT26-Certificate-${cert.participant_name.replace(/\s+/g, '-')}.jpg`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            setDownloading(false);
        }, 'image/jpeg', 0.92);
    };

    return (
        <div className="min-h-screen bg-zinc-950 py-10 px-4">

            {/* ── Header ── */}
            <header className="max-w-4xl mx-auto mb-8 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    {/* <span className="bg-red-600 text-white font-black text-lg px-3 py-1 rounded tracking-wider">RIFT</span>
                    <span className="text-zinc-500 text-sm">'26 Hackathon</span> */}
                </div>
                <span className="inline-flex items-center gap-1.5 bg-green-500/10 border border-green-500/30 text-green-400 text-xs font-semibold px-3 py-1.5 rounded-full">
                    <Shield className="w-3.5 h-3.5" />
                    Verified
                </span>
            </header>

            <main className="max-w-4xl mx-auto space-y-6">

                {/* ── Certificate image (SVG — full detail for view) ── */}
                <div className="rounded-2xl overflow-hidden shadow-2xl border border-zinc-800 bg-zinc-900">
                    <img
                        ref={svgRef}
                        src={svgUrl}
                        crossOrigin="anonymous"
                        alt={`${cert.participant_name}'s RIFT '26 Certificate`}
                        className="w-full h-auto block"
                        style={{ aspectRatio: '1200 / 848' }}
                    />
                </div>

                {/* ── Main info + actions ── */}
                <div className="flex flex-row gap-4">

                    {/* Verification card */}
                    <div className="flex-1 bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-4">
                        <div className="flex items-center gap-3">
                            <CheckCircle className="w-6 h-6 text-green-400 shrink-0" />
                            <h2 className="text-white font-bold text-3xl">Certificate Verified</h2>
                        </div>
                        <div className="space-y-3 text-lg mt-8">
                            <Row icon={<Award className="w-4 h-4 text-zinc-500" />} label="Recipient" value={cert.participant_name} />
                            <Row icon={<Users className="w-4 h-4 text-zinc-500" />} label="Team" value={cert.team_name} />
                            <Row icon={<Calendar className="w-4 h-4 text-zinc-500" />} label="Issued" value={data.issued_at || '—'} />
                        </div>
                    </div>

                    {/* Actions card */}
                    <div className="w-full sm:w-72 flex-1 bg-zinc-900 border border-zinc-800 rounded-2xl p-6 flex flex-col gap-3">
                        <p className="text-zinc-400 text-sm font-medium">Add to LinkedIn or share</p>

                        {/* ── Add to Certifications section ── */}
                        <a
                            href={linkedInAddUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-center gap-2.5 w-full bg-[#0a66c2] hover:bg-[#0958a8] active:scale-95 transition-all text-white font-bold text-sm py-3 px-4 rounded-xl"
                        >
                            <Linkedin className="w-4 h-4" />
                            Add to Certifications
                        </a>

                        {/* ── Share as LinkedIn post (image appears as rich card) ── */}
                        {/* <a
                            href={linkedInShareUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-center gap-2.5 w-full bg-[#0a66c2]/20 hover:bg-[#0a66c2]/30 border border-[#0a66c2]/40 active:scale-95 transition-all text-[#70aae8] font-semibold text-sm py-3 px-4 rounded-xl"
                        >
                            <Share2 className="w-4 h-4" />
                            Share on LinkedIn
                        </a> */}

                        {/* ── Download certificate (instant client-side JPEG) ── */}
                        <button
                            onClick={handleDownload}
                            disabled={downloading}
                            className="flex items-center justify-center gap-2.5 w-full bg-zinc-800 hover:bg-zinc-700 disabled:opacity-60 disabled:cursor-wait active:scale-95 transition-all text-zinc-200 font-semibold text-sm py-3 px-4 rounded-xl"
                        >
                            {downloading
                                ? <><div className="w-4 h-4 border-2 border-zinc-500 border-t-white rounded-full animate-spin" /> Preparing…</>
                                : <><Download className="w-4 h-4" /> Download as JPEG</>}
                        </button>

                        {/* ── Copy verify link ── */}
                        <button
                            onClick={copyLink}
                            className="flex items-center justify-center gap-2.5 w-full border border-zinc-700 hover:border-zinc-500 active:scale-95 transition-all text-zinc-400 hover:text-zinc-200 font-medium text-sm py-3 px-4 rounded-xl"
                        >
                            {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                            {copied ? 'Copied!' : 'Copy Certificate Link'}
                        </button>

                        <div className="pt-1 space-y-1.5 text-xs text-zinc-600">
                            <p>• <strong className="text-zinc-500">Add to Certifications</strong> — shows in the Certifications section of your LinkedIn profile.</p>
                            {/* <p>• <strong className="text-zinc-500">Share on LinkedIn</strong> — creates a post with the certificate image attached. You can then save it to your <em>Featured</em> section.</p> */}
                        </div>
                    </div>
                </div>

                {/* ── Certificate ID ── */}
                <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="flex-1 min-w-0">
                        <p className="text-zinc-500 text-xs uppercase tracking-widest mb-1">Certificate ID</p>
                        <p className="text-zinc-300 font-mono text-sm break-all">{cert.id}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        <span className="text-green-400 text-xs font-semibold bg-green-400/10 border border-green-400/20 px-3 py-1.5 rounded-full">
                            ✓ Authentic
                        </span>
                        <a
                            href={verifyUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-zinc-500 hover:text-zinc-300 transition"
                            title="Open verify page"
                        >
                            <ExternalLink className="w-4 h-4" />
                        </a>
                    </div>
                </div>

                <p className="text-center text-zinc-600 text-xs pb-6">
                    © 2026 RIFT Hackathon · Powered by Physics Wallah · This certificate is uniquely issued and verifiable.
                </p>
            </main>
        </div>
    );
}

// ── Small helper component ─────────────────────────────────────────────────
function Row({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
    return (
        <div className="flex items-start gap-3">
            <span className="mt-0.5 shrink-0">{icon}</span>
            <div>
                <p className="text-zinc-500 text-xs uppercase tracking-wide mb-0.5">{label}</p>
                <p className="text-white font-semibold">{value}</p>
            </div>
        </div>
    );
}
