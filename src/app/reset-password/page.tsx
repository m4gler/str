import { Suspense } from 'react'
import ResetPasswordForm from '@/components/ResetPasswordForm'
import MesgaHorizontalLogo from '@/components/MesgaHorizontalLogo'
import { getPayload } from 'payload'
import config from '@/payload.config'
import type { PlatformSetting, Media } from '@/payload-types'

function LoadingFallback() {
    return (
        <div className="w-full max-w-md p-8 bg-[#203e5f] border border-white/10 rounded-2xl shadow-xl backdrop-blur-sm text-center">
            <div className="animate-pulse">
                <div className="h-8 bg-white/10 rounded w-48 mx-auto mb-4"></div>
                <div className="h-4 bg-white/10 rounded w-64 mx-auto"></div>
            </div>
        </div>
    )
}

export default async function ResetPasswordPage() {
    const payload = await getPayload({ config })
    let siteSettings: Partial<PlatformSetting> = {};
    try {
        siteSettings = await payload.findGlobal({
            slug: 'platform-settings',
        })
    } catch (e) {
        console.warn("Failed to fetch site settings:", e);
    }

    const logo = siteSettings?.logo;
    const logoUrl = (typeof logo === 'object' && logo?.url) ? logo.url : '/assets/mesga-horizontal-logo.png';
    const companyName = siteSettings?.companyName || 'MESGA';

    return (
        <main className="flex min-h-screen flex-col items-center justify-center p-4 bg-[#203e5f] relative overflow-hidden">
            <div className="absolute inset-0 bg-[#203e5f]" />
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
                <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] bg-[#ffcc00]/20 blur-[100px] rounded-full mix-blend-screen" />
                <div className="absolute top-[20%] -right-[10%] w-[40%] h-[40%] bg-[#203e5f]/20 blur-[100px] rounded-full mix-blend-screen" />
            </div>

            <div className="relative z-10 w-full flex flex-col items-center">
                <div className="mb-8 flex items-center">
                    <MesgaHorizontalLogo companyName={companyName} logoUrl={logoUrl} size="auth" />
                </div>

                <Suspense fallback={<LoadingFallback />}>
                    <ResetPasswordForm />
                </Suspense>
            </div>
        </main>
    )
}
