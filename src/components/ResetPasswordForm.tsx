'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Loader2 } from 'lucide-react'

export default function ResetPasswordForm() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const token = searchParams.get('token')
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState(false)
    const [isLoading, setIsLoading] = useState(false)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError(null)

        if (!token) {
            setError('Missing reset token.')
            return
        }

        if (password !== confirmPassword) {
            setError('Passwords do not match.')
            return
        }

        setIsLoading(true)

        try {
            const res = await fetch('/api/users/reset-password', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    token,
                    password,
                }),
            })

            const data = await res.json()

            if (!res.ok) {
                if (data.errors && data.errors[0]) {
                    throw new Error(data.errors[0].message)
                }
                throw new Error(data.message || 'Something went wrong')
            }

            setSuccess(true)
            setTimeout(() => {
                router.push('/login')
            }, 3000)

        } catch (err: any) {
            setError(err.message)
        } finally {
            setIsLoading(false)
        }
    }

    if (success) {
        return (
            <div className="w-full max-w-md p-8 bg-[#203e5f] border border-white/10 rounded-2xl shadow-xl backdrop-blur-sm text-center">
                <h2 className="text-2xl font-bold text-green-400 mb-4">Password Reset Successful</h2>
                <p className="text-gray-400">Your password has been updated. Redirecting to login...</p>
            </div>
        )
    }

    return (
        <div className="w-full max-w-md p-8 space-y-8 bg-[#203e5f] border border-white/10 rounded-2xl shadow-xl backdrop-blur-sm">
            <div className="text-center">
                <h2 className="text-3xl font-bold bg-linear-to-r from-[#fee5b1] to-[#203e5f] bg-clip-text text-transparent">
                    Reset Password
                </h2>
                <p className="mt-2 text-sm text-gray-400">
                    Enter your new password below.
                </p>
            </div>

            <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
                <div className="space-y-4">
                    <div>
                        <label htmlFor="password" className="block text-sm font-medium text-gray-300">
                            New Password
                        </label>
                        <input
                            id="password"
                            name="password"
                            type="password"
                            autoComplete="new-password"
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full px-4 py-3 mt-1 text-white bg-black/50 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#ffcc00] focus:border-transparent transition-all placeholder-gray-600"
                            placeholder="••••••••"
                        />
                    </div>
                    <div>
                        <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-300">
                            Confirm Password
                        </label>
                        <input
                            id="confirmPassword"
                            name="confirmPassword"
                            type="password"
                            autoComplete="new-password"
                            required
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            className="w-full px-4 py-3 mt-1 text-white bg-black/50 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#ffcc00] focus:border-transparent transition-all placeholder-gray-600"
                            placeholder="••••••••"
                        />
                    </div>
                </div>

                {error && (
                    <div className="p-3 text-sm text-red-500 bg-red-900/20 border border-red-900/50 rounded-lg">
                        {error}
                    </div>
                )}

                <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full flex items-center justify-center py-3 px-4 rounded-full text-sm font-bold text-white bg-linear-to-r from-[#ffcc00] to-[#203e5f] hover:opacity-90 transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#ffcc00] focus:ring-offset-[#203e5f] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isLoading ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                        'Reset Password'
                    )}
                </button>
            </form>
        </div>
    )
}
