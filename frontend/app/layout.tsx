import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css"; // v2.0 - dark theme
import Script from 'next/script'

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
    title: "RIFT '26 - Hackathon Registration",
    description: "Official registration platform for RIFT '26 Hackathon",
    manifest: '/manifest.json',
    appleWebApp: {
        capable: true,
        statusBarStyle: 'black-translucent',
        title: "RIFT '26",
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
    return (
        <html lang="en">
            <head>
                {/* PWA Meta Tags */}
                <link rel="manifest" href="/manifest.json" />
                <link rel="apple-touch-icon" href="/icon-192.png" />
                <meta name="apple-mobile-web-app-capable" content="yes" />
                <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
                <meta name="apple-mobile-web-app-title" content="RIFT '26" />

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
