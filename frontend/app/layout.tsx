import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css"; // v2.0 - dark theme
import Script from 'next/script'

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
    title: "RIFT '26 - India's Premier Hackathon | Register Now",
    description: "Join RIFT '26, India's most exciting hackathon! Register your team, compete with the best innovators, and win amazing prizes. Multi-city event in Bangalore, Pune, Noida, and Lucknow.",
    keywords: [
        "RIFT 26",
        "RIFT hackathon",
        "hackathon India",
        "coding competition",
        "tech event 2026",
        "student hackathon",
        "innovation challenge",
        "programming contest",
        "Bangalore hackathon",
        "Pune hackathon",
        "Noida hackathon",
        "Lucknow hackathon",
        "PWIOI",
        "team registration",
        "tech competition"
    ],
    authors: [{ name: "PWIOI", url: "https://rift.pwioi.com" }],
    creator: "PWIOI",
    publisher: "PWIOI",
    manifest: '/manifest.json',
    metadataBase: new URL('https://rift.pwioi.com'),
    alternates: {
        canonical: 'https://rift.pwioi.com',
    },
    openGraph: {
        type: 'website',
        locale: 'en_IN',
        url: 'https://rift.pwioi.com',
        title: "RIFT '26 - India's Premier Hackathon",
        description: "Join RIFT '26, India's most exciting hackathon! Register your team, compete with the best innovators, and win amazing prizes.",
        siteName: "RIFT '26",
        images: [
            {
                url: '/RIFT.png',
                width: 1200,
                height: 630,
                alt: "RIFT '26 Hackathon Logo",
            }
        ],
    },
    twitter: {
        card: 'summary_large_image',
        title: "RIFT '26 - India's Premier Hackathon",
        description: "Join RIFT '26, India's most exciting hackathon! Register your team and compete with the best.",
        images: ['/RIFT.png'],
        creator: '@rift.pwioi',
    },
    robots: {
        index: true,
        follow: true,
        googleBot: {
            index: true,
            follow: true,
            'max-video-preview': -1,
            'max-image-preview': 'large',
            'max-snippet': -1,
        },
    },
    icons: {
        icon: [
            { url: '/icon.png', type: 'image/png' },
            { url: '/RIFT.png', type: 'image/png' },
        ],
        apple: [
            { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
            { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
        shortcut: '/RIFT.png',
    },
    appleWebApp: {
        capable: true,
        statusBarStyle: 'black-translucent',
        title: "RIFT '26",
    },
    verification: {
        google: 'your-google-verification-code', // Add your Google Search Console verification code
    },
};

export const viewport: Viewport = {
    themeColor: '#c0211f',
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
}

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    const jsonLd = {
        '@context': 'https://schema.org',
        '@type': 'Event',
        name: "RIFT '26 - India's Premier Hackathon",
        description: "Join RIFT '26, India's most exciting hackathon! Register your team, compete with the best innovators, and win amazing prizes.",
        image: 'https://rift.pwioi.com/RIFT.png',
        startDate: '2026-02-01',
        endDate: '2026-02-28',
        eventStatus: 'https://schema.org/EventScheduled',
        eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
        location: [
            {
                '@type': 'Place',
                name: 'Bangalore',
                address: {
                    '@type': 'PostalAddress',
                    addressLocality: 'Bangalore',
                    addressCountry: 'IN'
                }
            },
            {
                '@type': 'Place',
                name: 'Pune',
                address: {
                    '@type': 'PostalAddress',
                    addressLocality: 'Pune',
                    addressCountry: 'IN'
                }
            },
            {
                '@type': 'Place',
                name: 'Noida',
                address: {
                    '@type': 'PostalAddress',
                    addressLocality: 'Noida',
                    addressCountry: 'IN'
                }
            },
            {
                '@type': 'Place',
                name: 'Lucknow',
                address: {
                    '@type': 'PostalAddress',
                    addressLocality: 'Lucknow',
                    addressCountry: 'IN'
                }
            }
        ],
        organizer: {
            '@type': 'Organization',
            name: 'PWIOI',
            url: 'https://rift.pwioi.com',
            sameAs: [
                'https://www.instagram.com/rift.pwioi'
            ]
        },
        offers: {
            '@type': 'Offer',
            url: 'https://rift.pwioi.com',
            price: '0',
            priceCurrency: 'INR',
            availability: 'https://schema.org/InStock',
            validFrom: '2026-01-01'
        }
    };

    return (
        <html lang="en">
            <head>
                {/* Favicon */}
                <link rel="icon" href="/RIFT.png" type="image/png" />
                <link rel="shortcut icon" href="/RIFT.png" />
                
                {/* PWA Meta Tags */}
                <link rel="manifest" href="/manifest.json" />
                <link rel="apple-touch-icon" href="/icon-192.png" />
                <meta name="apple-mobile-web-app-capable" content="yes" />
                <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
                <meta name="apple-mobile-web-app-title" content="RIFT '26" />

                {/* Additional SEO Meta Tags */}
                <meta name="format-detection" content="telephone=no" />
                <meta name="mobile-web-app-capable" content="yes" />
                <meta name="theme-color" content="#c0211f" />
                
                {/* Social Media Links */}
                <link rel="me" href="https://www.instagram.com/rift.pwioi" />

                {/* Structured Data */}
                <script
                    type="application/ld+json"
                    dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
                />

                {/* reCAPTCHA */}
                <script
                    src={`https://www.google.com/recaptcha/enterprise.js?render=${process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY}`}
                    async
                    defer
                />
            </head>
            <body className={inter.className}>
                {children}

                {/* Service Worker Registration */}
                <Script id="sw-register" strategy="afterInteractive">
                    {`
                        if ('serviceWorker' in navigator) {
                            window.addEventListener('load', function() {
                                navigator.serviceWorker.register('/sw.js')
                                    .then(function(registration) {
                                        console.log('SW registered:', registration);
                                    })
                                    .catch(function(error) {
                                        console.log('SW registration failed:', error);
                                    });
                            });
                        }
                    `}
                </Script>
            </body>
        </html>
    );
}
