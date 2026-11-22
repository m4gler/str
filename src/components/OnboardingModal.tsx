'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Rocket, Lightbulb, Phone, X } from 'lucide-react'
import type { User as PayloadUser, PlatformSetting } from '@/payload-types'
import { updateProfile } from '@/app/actions'

type OnboardingSettings = PlatformSetting['onboarding'];

interface OnboardingModalProps {
    user: PayloadUser
    onClose: () => void
    onboardingSettings?: OnboardingSettings
}

export default function OnboardingModal({ user, onClose, onboardingSettings }: OnboardingModalProps) {
    const router = useRouter()
    const [isSaving, setIsSaving] = useState(false)


    const [businessIdea, setBusinessIdea] = useState(user.businessIdea || '')
    const [phoneNumber, setPhoneNumber] = useState(user.phoneNumber || '')
    const [error, setError] = useState<string | null>(null)

    const settings = {
        title: onboardingSettings?.title || 'Complete Your Profile',
        subtitle: onboardingSettings?.subtitle || "Share your vision and help us know you better.",
        businessIdeaLabel: onboardingSettings?.businessIdeaLabel || 'Your Business Idea / Concept',
        businessIdeaPlaceholder: onboardingSettings?.businessIdeaPlaceholder || "Describe what you're building in a few sentences...",
        phoneLabel: onboardingSettings?.phoneLabel || 'Phone Number (Optional)',
        phonePlaceholder: onboardingSettings?.phonePlaceholder || '+48 123 456 789',
        submitButtonText: onboardingSettings?.submitButtonText || 'Get Started',
        skipButtonText: onboardingSettings?.skipButtonText || 'Skip for now',
    }

    const validatePhone = (phone: string) => {
        const phoneRegex = /^[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}$/im
        return phoneRegex.test(phone)
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        if (phoneNumber && !validatePhone(phoneNumber)) {
            setError('Please enter a valid phone number')
            return
        }

        setIsSaving(true)
        setError(null)

        try {
            const res = await updateProfile(user.id, {
                businessIdea,
                phoneNumber,
                isOnboarded: true,
            })

            if (!res.success) {
                throw new Error('Failed to save details')
            }

            router.refresh()
            onClose()

        } catch (err: any) {
            setError(err.message || 'Something went wrong')
        } finally {
            setIsSaving(false)
        }
    }

    const title = settings.title
    const subtitle = settings.subtitle
    const ideaLabel = settings.businessIdeaLabel
    const ideaPlaceholder = settings.businessIdeaPlaceholder
    const submitText = settings.submitButtonText

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-full max-w-2xl bg-[#203e5f] border border-white/10 rounded-3xl p-8 md:p-12 shadow-2xl relative animate-in zoom-in-95 duration-200">

                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 p-2 text-gray-500 hover:text-white transition-colors rounded-full hover:bg-white/10"
                >
                    <X className="w-6 h-6" />
                </button>


                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/3 h-1 bg-linear-to-r from-transparent via-[#ffcc00] to-transparent" />

                <div className="text-center mb-10">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-linear-to-br from-[#003399] to-[#ffcc00] mb-6 shadow-lg shadow-[#ffcc00]/20">
                        <Rocket className="w-8 h-8 text-white" />
                    </div>
                    <h1 className="text-2xl md:text-3xl font-bold mb-3 bg-clip-text text-transparent bg-linear-to-r from-white via-gray-200 to-gray-400">
                        {title}
                    </h1>
                    <p className="text-gray-400 text-base">
                        {subtitle}
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">


                    <div className="space-y-2">
                        <label htmlFor="businessIdea" className="flex items-center text-sm font-medium text-gray-300">
                            <Lightbulb className="w-4 h-4 mr-2 text-[#F4C542]" />
                            {ideaLabel}
                        </label>
                        <textarea
                            id="businessIdea"
                            value={businessIdea}
                            onChange={(e) => setBusinessIdea(e.target.value)}
                            rows={4}
                            className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-[#ffcc00] focus:border-transparent transition-all hover:border-white/20 resize-none"
                            placeholder={ideaPlaceholder}
                        />
                    </div>


                    <div className="space-y-2">
                        <label htmlFor="phoneNumber" className="flex items-center text-sm font-medium text-gray-300">
                            <Phone className="w-4 h-4 mr-2 text-[#3AB7A5]" />
                            {settings.phoneLabel}
                        </label>
                        <input
                            id="phoneNumber"
                            type="tel"
                            value={phoneNumber}
                            onChange={(e) => setPhoneNumber(e.target.value)}
                            className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-[#ffcc00] focus:border-transparent transition-all hover:border-white/20"
                            placeholder={settings.phonePlaceholder}
                        />
                    </div>

                    {error && (
                        <div className="p-3 bg-red-900/20 border border-red-900/50 rounded-xl text-red-200 text-sm text-center">
                            {error}
                        </div>
                    )}

                    <div className="pt-2">
                        <button
                            type="submit"
                            disabled={isSaving}
                            className="w-full bg-linear-to-r from-[#003399] to-[#ffcc00] hover:from-[#002277] hover:to-[#0088dd] text-white font-bold py-3 px-6 rounded-full shadow-lg shadow-[#ffcc00]/25 transform transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {isSaving ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                                <>
                                    <span>{submitText}</span>
                                    <Rocket className="w-5 h-5" />
                                </>
                            )}
                        </button>

                        <div className="mt-4 text-center">
                            <button
                                type="button"
                                onClick={async () => {
                                    await updateProfile(user.id, { isOnboarded: true })
                                    onClose()
                                }}
                                className="text-sm text-gray-500 hover:text-white transition-colors"
                            >
                                {settings.skipButtonText}
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    )
}
