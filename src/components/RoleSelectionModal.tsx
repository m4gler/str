'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, User, Rocket, Euro } from 'lucide-react'
import type { User as PayloadUser } from '@/payload-types'
import { updateProfile } from '@/app/actions'

interface RoleSelectionModalProps {
    user: PayloadUser
}

export default function RoleSelectionModal({ user }: RoleSelectionModalProps) {
    const router = useRouter()
    const [isSaving, setIsSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [selectedRole, setSelectedRole] = useState<'founder' | 'investor' | null>(null)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!selectedRole) {
            setError('Please select a role')
            return
        }

        setIsSaving(true)
        setError(null)

        try {
            await updateProfile(user.id, {
                role: selectedRole,
                isOnboarded: true,
            })

            if (selectedRole === 'investor') {
                router.push('/intake')
            } else {
                router.refresh()
            }
        } catch (err: any) {
            setError(err.message || 'Something went wrong')
            setIsSaving(false)
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-full max-w-md bg-[#203e5f] border border-white/10 rounded-3xl p-8 shadow-2xl relative animate-in zoom-in-95 duration-200">

                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/3 h-1 bg-linear-to-r from-transparent via-[#ffcc00] to-transparent" />

                <div className="text-center mb-8">
                    <h1 className="text-2xl font-bold mb-2 bg-clip-text text-transparent bg-linear-to-r from-white via-gray-200 to-gray-400">
                        Select Your Role
                    </h1>
                    <p className="text-gray-400 text-sm">
                        Tell us how you plan to use MESGA.
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                        <button
                            type="button"
                            onClick={() => setSelectedRole('founder')}
                            className={`p-4 rounded-xl border transition-all flex flex-col items-center gap-3 ${selectedRole === 'founder'
                                ? 'bg-[#ffcc00]/10 border-[#ffcc00] text-white'
                                : 'bg-black/20 border-white/10 text-gray-400 hover:border-white/30 hover:bg-white/5'
                                }`}
                        >
                            <Rocket className={`w-8 h-8 ${selectedRole === 'founder' ? 'text-[#ffcc00]' : 'text-gray-500'}`} />
                            <span className="font-medium">Founder</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => setSelectedRole('investor')}
                            className={`p-4 rounded-xl border transition-all flex flex-col items-center gap-3 ${selectedRole === 'investor'
                                ? 'bg-[#ffcc00]/10 border-[#ffcc00] text-white'
                                : 'bg-black/20 border-white/10 text-gray-400 hover:border-white/30 hover:bg-white/5'
                                }`}
                        >
                            <Euro className={`w-8 h-8 ${selectedRole === 'investor' ? 'text-[#ffcc00]' : 'text-gray-500'}`} />
                            <span className="font-medium">Investor</span>
                        </button>
                    </div>

                    {error && (
                        <div className="p-3 bg-red-900/20 border border-red-900/50 rounded-xl text-red-200 text-sm text-center">
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={isSaving || !selectedRole}
                        className="w-full bg-white text-black font-bold py-3 px-6 rounded-xl hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
                    >
                        {isSaving ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                            'Continue'
                        )}
                    </button>
                </form>
            </div>
        </div>
    )
}
