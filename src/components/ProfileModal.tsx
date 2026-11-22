'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { User, Phone, Lightbulb, X, Loader2, Save } from 'lucide-react'
import type { User as PayloadUser } from '@/payload-types'
import { updateProfile } from '@/app/actions'

interface ProfileModalProps {
    user: PayloadUser
    onClose: () => void
}

export default function ProfileModal({ user, onClose }: ProfileModalProps) {
    const router = useRouter()
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState(false)

    // Using any for businessIdea because PayloadUser might not have strictly typed it yet if types weren't regenerated perfectly
    const [formData, setFormData] = useState({
        phoneNumber: user.phoneNumber || '',
        businessIdea: (user as any).businessIdea || '',
    })

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsLoading(true)
        setError(null)
        setSuccess(false)

        try {
            const res = await updateProfile(user.id, {
                phoneNumber: formData.phoneNumber,
                businessIdea: formData.businessIdea,
            })

            if (!res.success) {
                throw new Error('Failed to update profile')
            }

            setSuccess(true)
            router.refresh()

            // Close after a short delay on success
            setTimeout(() => {
                onClose()
            }, 1000)

        } catch (err) {
            console.error(err)
            setError('Something went wrong. Please try again.')
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="fixed inset-0 z-100 flex items-center justify-center p-4">
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
                onClick={onClose}
            />

            <div className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-white/10 bg-[#203e5f] shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-white/5 px-6 py-4">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <User className="w-5 h-5 text-[#ffcc00]" />
                        Edit Profile
                    </h2>
                    <button
                        onClick={onClose}
                        className="rounded-full p-2 text-white/50 hover:bg-white/5 hover:text-white transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    {/* Phone Number Field */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-white/70 flex items-center gap-2">
                            <Phone className="w-4 h-4" />
                            Phone Number
                        </label>
                        <input
                            type="tel"
                            value={formData.phoneNumber}
                            onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                            placeholder="+1 (555) 000-0000"
                            className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-white placeholder:text-white/20 focus:border-[#ffcc00] focus:outline-none focus:ring-1 focus:ring-[#ffcc00] transition-all"
                        />
                    </div>

                    {/* Business Idea Field */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-white/70 flex items-center gap-2">
                            <Lightbulb className="w-4 h-4" />
                            Business Idea / Concept
                        </label>
                        <textarea
                            value={formData.businessIdea}
                            onChange={(e) => setFormData({ ...formData, businessIdea: e.target.value })}
                            placeholder="Briefly describe your project or startup idea..."
                            rows={4}
                            className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-white placeholder:text-white/20 focus:border-[#ffcc00] focus:outline-none focus:ring-1 focus:ring-[#ffcc00] transition-all resize-none"
                        />
                        <p className="text-xs text-white/40">
                            This information helps us tailor resources for you.
                        </p>
                    </div>

                    {/* Status Messages */}
                    {error && (
                        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 text-sm">
                            {error}
                        </div>
                    )}

                    {success && (
                        <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-green-500 text-sm flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-green-500"></span>
                            Profile updated successfully!
                        </div>
                    )}

                    {/* Footer Actions */}
                    <div className="flex items-center gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 rounded-full border border-white/10 px-4 py-3 text-sm font-bold text-white hover:bg-white/5 transition-all"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isLoading || success}
                            className="flex-1 rounded-full bg-[#ffcc00] px-4 py-3 text-sm font-bold text-white hover:bg-[#ffcc00]/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Saving...
                                </>
                            ) : success ? (
                                'Saved'
                            ) : (
                                <>
                                    <Save className="w-4 h-4" />
                                    Save Changes
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
