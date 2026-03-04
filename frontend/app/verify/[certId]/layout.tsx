import type { Metadata } from 'next';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1';
const FRONTEND_URL = process.env.NEXT_PUBLIC_FRONTEND_URL || 'https://rift.pwioi.com';

interface CertData {
    valid: boolean;
    certificate?: {
        id: string;
        participant_name: string;
        participant_email: string;
        team_name: string;
        cert_type: string;
    };
    label?: string;
    issued_at?: string;
    image_url?: string;
}

async function fetchCert(certId: string): Promise<CertData | null> {
    try {
        const res = await fetch(`${API_URL}/certificates/verify/${certId}`, {
            next: { revalidate: 3600 }, // cache for 1 hour
        });
        if (!res.ok) return null;
        return res.json();
    } catch {
        return null;
    }
}

export async function generateMetadata({
    params,
}: {
    params: Promise<{ certId: string }>;
}): Promise<Metadata> {
    const { certId } = await params;
    const data = await fetchCert(certId);

    if (!data?.valid || !data.certificate) {
        return {
            title: "Invalid Certificate | RIFT '26",
            description: "This certificate could not be found or verified.",
        };
    }

    const cert = data.certificate;
    const title = `${cert.participant_name} | RIFT '26 Certificate`;
    const description = `${cert.participant_name} received a ${data.label} for their participation in RIFT '26 Hackathon with team ${cert.team_name}. Issued: ${data.issued_at}.`;
    const imageUrl = data.image_url || `${API_URL}/certificates/${cert.id}/image.jpg`;
    const pageUrl = `${FRONTEND_URL}/verify/${cert.id}`;


    return {
        title,
        description,
        openGraph: {
            type: 'website',
            title,
            description,
            url: pageUrl,
            siteName: "RIFT '26 Hackathon",
            images: [
                {
                    url: imageUrl,
                    width: 1200,
                    height: 848,
                    alt: `${cert.participant_name}'s RIFT '26 Certificate`,
                },
            ],
        },
        twitter: {
            card: 'summary_large_image',
            title,
            description,
            images: [imageUrl],
        },
        // LinkedIn picks up standard og: tags — no extra config needed
    };
}

export default function VerifyLayout({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
}
