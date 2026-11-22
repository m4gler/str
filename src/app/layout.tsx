import type { Metadata, Viewport } from "next";
import { Space_Grotesk } from "next/font/google";
import { cookies } from 'next/headers'
import Script from 'next/script'
import "./globals.css";
import { LanguageProvider } from "@/lib/i18n";
import { DEFAULT_LANGUAGE, LANGUAGE_COOKIE_KEY, normalizeLanguage } from '@/lib/language'

const GOOGLE_ANALYTICS_ID = 'G-5L5PM6S3L5'
const GOOGLE_ANALYTICS_SRC = 'https://www.googletagmanager.com/gtag/js?id=G-5L5PM6S3L5'

const spaceGrotesk = Space_Grotesk({
    variable: "--font-space-grotesk",
    subsets: ["latin"],
});

export const metadata: Metadata = {
    title: {
        default: "MESGA Platform",
        template: "%s | MESGA Platform",
    },
    description: "MESGA Founder Platform - Making European Startups Great Again",
    metadataBase: new URL(process.env.NEXT_PUBLIC_SERVER_URL || 'https://mesga.eu'),
    icons: {
        icon: [
            { url: '/favicon.ico', sizes: 'any' },
            { url: '/icon.svg', type: 'image/svg+xml' },
        ],
        apple: '/apple-icon.png',
    },
    openGraph: {
        title: "MESGA Platform",
        description: "MESGA Founder Platform - Making European Startups Great Again",
        siteName: "MESGA Platform",
        type: "website",
    },
    appleWebApp: {
        title: "MESGA",
        capable: true,
        statusBarStyle: "black-translucent",
    },
};

export const viewport: Viewport = {
    themeColor: '#1a2634',
    width: 'device-width',
    initialScale: 1,
};

export default async function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    const cookieStore = await cookies()
    const initialLang = normalizeLanguage(cookieStore.get(LANGUAGE_COOKIE_KEY)?.value, DEFAULT_LANGUAGE)

    return (
        <html lang={initialLang} className={spaceGrotesk.variable}>
            <body className="antialiased font-sans overflow-x-hidden">
                <Script
                    src={GOOGLE_ANALYTICS_SRC}
                    strategy="afterInteractive"
                />
                <Script id="google-analytics" strategy="afterInteractive">
                    {`
                        window.dataLayer = window.dataLayer || [];
                        function gtag(){dataLayer.push(arguments);}
                        gtag('js', new Date());
                        gtag('config', 'G-5L5PM6S3L5');
                    `}
                </Script>
                <LanguageProvider initialLang={initialLang}>
                    {children}
                </LanguageProvider>
            </body>
        </html>
    );
}
