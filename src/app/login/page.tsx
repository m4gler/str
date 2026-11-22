import AuthForm from '@/components/AuthForm'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import MesgaHorizontalLogo from '@/components/MesgaHorizontalLogo'

export default async function PlatformLoginPage(props: {
    searchParams?: Promise<{ next?: string }>
}) {
    const searchParams = props.searchParams ? await props.searchParams : {}
    const redirectTo = searchParams?.next && searchParams.next.startsWith('/') ? searchParams.next : '/'

    const payload = await getPayload({ config })
    const headersObj = await headers()
    const { user } = await payload.auth({ headers: headersObj })

    if (user) {
        redirect(redirectTo)
    }

    let siteSettings: any = {}
    try {
        siteSettings = await payload.findGlobal({ slug: 'platform-settings' })
    } catch (e) {
        console.warn('Failed to fetch site settings:', e)
    }

    const logoUrl = siteSettings?.logo?.url || '/assets/mesga-horizontal-logo.png'
    const companyName = siteSettings?.companyName || 'MESGA'

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

                <AuthForm
                    currentUser={user}
                    authSettings={siteSettings?.auth}
                    onboardingSettings={siteSettings?.onboarding}
                    redirectTo={redirectTo}
                />
            </div>
        </main>
    )
}
