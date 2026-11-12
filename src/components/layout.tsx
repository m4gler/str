import type { Metadata, Viewport } from "next";
import { Space_Grotesk } from "next/font/google";
import "./globals.css";
import { LanguageProvider } from "@/lib/i18n";

const spaceGrotesk = Space_Grotesk({
    variable: "--font-space-grotesk",
    subsets: ["latin"],
});

export const metadata: Metadata = {
    title: "MESGA Platform — 100 Days Acceleration OS",
    description: "MESGA Founder Platform - Making European Startups Great Again",
};

export const viewport: Viewport = {
    themeColor: '#1a2634',
    width: 'device-width',
    initialScale: 1,
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en" className={spaceGrotesk.variable}>
            <body className="antialiased font-sans overflow-x-hidden">
                <LanguageProvider initialLang="en">
                    {children}
                </LanguageProvider>
            </body>
        </html>
    );
}
