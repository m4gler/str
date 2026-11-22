'use client'

import React, { useState } from 'react'
import ProfileModal from './ProfileModal'
import type { User as PayloadUser } from '@/payload-types'

export default function ProfileCard({ user }: { user: PayloadUser }) {
    const [isProfileModalOpen, setIsProfileModalOpen] = useState(false)

    return (
        <>
            <div className="group relative rounded-3xl border border-white/10 bg-[#203e5f]/60 backdrop-blur-md p-8 hover:bg-[#203e5f]/80 hover:border-[#ffcc00]/50 transition-all duration-300 hover:-translate-y-1 animate-in fade-in slide-in-from-bottom-8 delay-100 cursor-pointer" onClick={() => setIsProfileModalOpen(true)}>
                <div className="absolute inset-0 rounded-3xl bg-linear-to-br from-[#ffcc00]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <div className="relative z-10">
                    <div className="w-14 h-14 rounded-2xl bg-[#ffcc00]/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300 border border-[#ffcc00]/20">
                        <svg className="w-7 h-7 text-[#ffcc00]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
                        </svg>
                    </div>
                    <h3 className="text-xl font-bold text-white mb-3 group-hover:text-[#ffcc00] transition-colors">Your Profile</h3>
                    <p className="text-white/50 text-sm leading-relaxed mb-6">
                        Update your personal details, manage role settings, and customize your experience.
                    </p>
                    <div className="flex items-center text-sm font-bold text-[#ffcc00] opacity-0 group-hover:opacity-100 transform -translate-x-2.5 group-hover:translate-x-0 transition-all duration-300">
                        Manage Profile <span className="ml-2">→</span>
                    </div>
                </div>
            </div>

            {isProfileModalOpen && (
                <ProfileModal user={user} onClose={() => setIsProfileModalOpen(false)} />
            )}
        </>
    )
}
