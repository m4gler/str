'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { PlatformSetting } from '@/payload-types'
import { login, register } from '@/app/actions'
import {
    EMAIL_VERIFICATION_RESEND_COOLDOWN_SECONDS,
    EMAIL_VERIFICATION_TTL_HOURS,
} from '@/lib/verificationWindow'

type OnboardingSettings = PlatformSetting['onboarding'];

interface AuthSettings {
    loginTitle?: string;
    loginSubtitle?: string;
    registerTitle?: string;
    registerSubtitle?: string;
    emailLabel?: string;
    emailPlaceholder?: string;
    passwordLabel?: string;
    roleLabel?: string;
    loginButtonText?: string;
    registerButtonText?: string;
    noAccountText?: string;
    hasAccountText?: string;
    signUpLinkText?: string;
    signInLinkText?: string;
    founderRoleLabel?: string;
    investorRoleLabel?: string;
    forgotPasswordLinkText?: string;
    forgotPasswordTitle?: string;
    forgotPasswordSubtitle?: string;
    sendResetLinkButtonText?: string;
    backToLoginText?: string;
    resetLinkSentMessage?: string;
}

interface AuthFormProps {
    currentUser?: any;
    authSettings?: AuthSettings;
    onboardingSettings?: OnboardingSettings;
    redirectTo?: string;
}

function getResendCooldownStorageKey(email: string): string {
    return `verification-resend-cooldown:${email}`
}

function loadStoredResendCooldownUntil(email: string): number | null {
    if (typeof window === 'undefined') return null

    const rawValue = window.localStorage.getItem(getResendCooldownStorageKey(email))
    if (!rawValue) return null

    const parsedValue = Number(rawValue)
    if (!Number.isFinite(parsedValue)) {
        window.localStorage.removeItem(getResendCooldownStorageKey(email))
        return null
    }

    return parsedValue
}

function saveResendCooldownUntil(email: string, cooldownUntil: number): void {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(getResendCooldownStorageKey(email), String(cooldownUntil))
}

function clearStoredResendCooldown(email: string): void {
    if (typeof window === 'undefined') return
    window.localStorage.removeItem(getResendCooldownStorageKey(email))
}

export default function AuthForm({ currentUser: serverUser, authSettings, redirectTo = '/' }: AuthFormProps) {
    const router = useRouter()
    const searchParams = useSearchParams()
    const initialRole = searchParams.get('role') || 'founder'
    const initialMode = searchParams.get('mode')
    const [isLogin, setIsLogin] = useState(initialMode !== 'register')
    const [isForgotPassword, setIsForgotPassword] = useState(false)
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [role, setRole] = useState(initialRole)
    const [error, setError] = useState<string | null>(null)
    const [successMessage, setSuccessMessage] = useState<string | null>(null)
    const [isLoading, setIsLoading] = useState(false)
    const [pendingVerificationEmail, setPendingVerificationEmail] = useState<string | null>(null)
    const [isResendingVerification, setIsResendingVerification] = useState(false)
    const [resendCooldownRemainingSeconds, setResendCooldownRemainingSeconds] = useState(0)

    const loginTitle = authSettings?.loginTitle || 'Welcome Back';
    const loginSubtitle = authSettings?.loginSubtitle || 'Sign in to access your account';
    const registerTitle = authSettings?.registerTitle || 'Join MESGA';
    const registerSubtitle = authSettings?.registerSubtitle || 'Start your journey with us';
    const emailLabel = authSettings?.emailLabel || 'Email address';
    const emailPlaceholder = authSettings?.emailPlaceholder || 'you@example.com';
    const passwordLabel = authSettings?.passwordLabel || 'Password';
    const roleLabel = authSettings?.roleLabel || 'I am a';
    const loginButtonText = authSettings?.loginButtonText || 'Sign in';
    const registerButtonText = authSettings?.registerButtonText || 'Create account';
    const noAccountText = authSettings?.noAccountText || "Don't have an account?";
    const hasAccountText = authSettings?.hasAccountText || 'Already have an account?';
    const signUpLinkText = authSettings?.signUpLinkText || 'Sign up';
    const signInLinkText = authSettings?.signInLinkText || 'Sign in';
    const founderRoleLabel = authSettings?.founderRoleLabel || 'Founder';
    const investorRoleLabel = authSettings?.investorRoleLabel || 'Investor / Mentor';
    const forgotPasswordLinkText = authSettings?.forgotPasswordLinkText || 'Forgot Password?';
    const forgotPasswordTitle = authSettings?.forgotPasswordTitle || 'Reset Password';
    const forgotPasswordSubtitle = authSettings?.forgotPasswordSubtitle || 'Enter your email to receive a reset link';
    const sendResetLinkButtonText = authSettings?.sendResetLinkButtonText || 'Send Reset Link';
    const backToLoginText = authSettings?.backToLoginText || 'Back to Login';
    const resetLinkSentMessage = authSettings?.resetLinkSentMessage || 'If an account exists with this email, a reset link has been sent.';
    const hideFormAfterSuccess = isForgotPassword && Boolean(successMessage)
    const resendVerificationButtonText = resendCooldownRemainingSeconds > 0
        ? `Resend confirmation email in ${Math.floor(resendCooldownRemainingSeconds / 60)}:${String(resendCooldownRemainingSeconds % 60).padStart(2, '0')}`
        : 'Resend confirmation email'

    useEffect(() => {
        if (serverUser) {
            router.push(redirectTo)
        }
    }, [serverUser, router, redirectTo])

    useEffect(() => {
        const verified = searchParams.get('verified')
        const verificationStatus = searchParams.get('verification')

        if (verified === '1') {
            setIsLogin(true)
            setIsForgotPassword(false)
            setError(null)
            setPendingVerificationEmail(null)
            setSuccessMessage('Email confirmed. You can sign in now.')
        } else if (verificationStatus === 'expired') {
            setIsLogin(false)
            setIsForgotPassword(false)
            setSuccessMessage(null)
            setPendingVerificationEmail(null)
            setError('The confirmation link expired and the unverified account was deleted. Register again to create a fresh one.')
        } else if (verificationStatus === 'invalid') {
            setIsLogin(true)
            setIsForgotPassword(false)
            setSuccessMessage(null)
            setPendingVerificationEmail(null)
            setError('This confirmation link is invalid or has already been used.')
        }
    }, [searchParams])

    useEffect(() => {
        if (!pendingVerificationEmail) {
            setResendCooldownRemainingSeconds(0)
            return
        }

        const syncCooldown = () => {
            const cooldownUntil = loadStoredResendCooldownUntil(pendingVerificationEmail)

            if (!cooldownUntil) {
                setResendCooldownRemainingSeconds(0)
                return
            }

            const remainingSeconds = Math.max(
                0,
                Math.ceil((cooldownUntil - Date.now()) / 1000),
            )

            if (remainingSeconds === 0) {
                clearStoredResendCooldown(pendingVerificationEmail)
            }

            setResendCooldownRemainingSeconds(remainingSeconds)
        }

        syncCooldown()
        const interval = window.setInterval(syncCooldown, 1000)

        return () => {
            window.clearInterval(interval)
        }
    }, [pendingVerificationEmail])

    const startResendCooldown = (
        emailAddress: string,
        cooldownSeconds = EMAIL_VERIFICATION_RESEND_COOLDOWN_SECONDS,
    ) => {
        const cooldownUntil = Date.now() + (cooldownSeconds * 1000)
        saveResendCooldownUntil(emailAddress, cooldownUntil)
        setResendCooldownRemainingSeconds(cooldownSeconds)
    }

    const resendVerificationEmail = async () => {
        if (!pendingVerificationEmail || resendCooldownRemainingSeconds > 0) return

        setIsResendingVerification(true)
        setError(null)

        try {
            const res = await fetch('/api/auth/resend-verification', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email: pendingVerificationEmail }),
            })

            const data = await res.json().catch(() => null)

            if (data?.expired) {
                clearStoredResendCooldown(pendingVerificationEmail)
                setPendingVerificationEmail(null)
                setIsLogin(false)
                setSuccessMessage(null)
                setError(data.message || 'The previous verification window expired. Register again to create a fresh account.')
                return
            }

            startResendCooldown(
                pendingVerificationEmail,
                Number(data?.cooldownRemainingSeconds) > 0
                    ? Number(data.cooldownRemainingSeconds)
                    : EMAIL_VERIFICATION_RESEND_COOLDOWN_SECONDS,
            )
            setSuccessMessage(data?.message || 'If this account still needs verification, we sent a new confirmation link.')
        } catch {
            setError('Failed to resend the confirmation email.')
        } finally {
            setIsResendingVerification(false)
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError(null)
        setSuccessMessage(null)
        setIsLoading(true)

        try {
            if (isForgotPassword) {
                const res = await fetch('/api/users/forgot-password', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email }),
                })

                if (res.ok) {
                    setSuccessMessage(resetLinkSentMessage)
                } else {
                    setError('Failed to send reset link')
                }
                setIsLoading(false)
                return
            }

            const formData = new FormData()
            formData.set('email', email)
            formData.set('password', password)
            formData.set('role', role)

            if (isLogin) {
                const result = await login(null, formData)

                if (!result?.success) {
                    if (result?.requiresVerification) {
                        setPendingVerificationEmail(email.trim().toLowerCase())
                    }

                    throw new Error(result?.error || 'Something went wrong')
                }

                router.push(redirectTo)
            } else {
                const result = await register(null, formData)

                if (!result?.success) {
                    if (result?.requiresVerification) {
                        setPendingVerificationEmail(email.trim().toLowerCase())
                    }

                    throw new Error(result?.error || 'Something went wrong')
                }

                const normalizedEmail = email.trim().toLowerCase()
                setPendingVerificationEmail(normalizedEmail)
                startResendCooldown(normalizedEmail)
                setIsLogin(true)
                setPassword('')
                setSuccessMessage(
                    result.message || `We sent a confirmation link to ${email.trim().toLowerCase()}. Confirm it within ${EMAIL_VERIFICATION_TTL_HOURS} hours before signing in.`
                )
            }

        } catch (err: any) {
            setError(err.message)
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="w-full max-w-lg p-8 space-y-8 bg-[#203e5f] border border-white/10 rounded-2xl shadow-xl backdrop-blur-sm">
            <div className="text-center">
                <h2 className="text-3xl font-bold bg-linear-to-r from-[#fee5b1] to-[#203e5f] bg-clip-text text-transparent">
                    {isForgotPassword ? forgotPasswordTitle : (isLogin ? loginTitle : registerTitle)}
                </h2>
                <p className="mt-3 text-base text-gray-300">
                    {isForgotPassword ? forgotPasswordSubtitle : (isLogin ? loginSubtitle : registerSubtitle)}
                </p>
            </div>

            {!isForgotPassword && (
                <div className="grid grid-cols-2 gap-2 rounded-2xl border border-white/10 bg-black/25 p-1.5">
                    <button
                        type="button"
                        onClick={() => {
                            setIsLogin(true)
                            setError(null)
                            setSuccessMessage(null)
                            setPendingVerificationEmail(null)
                        }}
                        className={`rounded-xl px-4 py-3 text-sm font-semibold transition-all ${
                            isLogin
                                ? 'bg-linear-to-r from-[#ffcc00] to-[#203e5f] text-white shadow-sm'
                                : 'text-white/75 hover:bg-white/5'
                        }`}
                    >
                        {signInLinkText}
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            setIsLogin(false)
                            setError(null)
                            setSuccessMessage(null)
                            setPendingVerificationEmail(null)
                        }}
                        className={`rounded-xl px-4 py-3 text-sm font-semibold transition-all ${
                            !isLogin
                                ? 'bg-linear-to-r from-[#ffcc00] to-[#203e5f] text-white shadow-sm'
                                : 'text-white/75 hover:bg-white/5'
                        }`}
                    >
                        {signUpLinkText}
                    </button>
                </div>
            )}

            <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
                <div className="space-y-4">
                    {!hideFormAfterSuccess && (
                        <div>
                            <label htmlFor="email" className="block text-sm font-semibold text-gray-200">
                                {emailLabel}
                            </label>
                            <input
                                id="email"
                                name="email"
                                type="email"
                                autoComplete="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full px-4 py-3 mt-1.5 text-base text-white bg-black/50 border border-white/15 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#ffcc00] focus:border-transparent transition-all placeholder-gray-500"
                                placeholder={emailPlaceholder}
                            />
                        </div>
                    )}

                    {!isForgotPassword && (
                        <div>
                            <div className="flex justify-between items-center mb-1">
                                <label htmlFor="password" className="block text-sm font-semibold text-gray-200">
                                    {passwordLabel}
                                </label>
                                {isLogin && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setIsForgotPassword(true)
                                            setError(null)
                                            setSuccessMessage(null)
                                            setPendingVerificationEmail(null)
                                        }}
                                        className="text-xs font-medium text-[#6ec9ff] hover:text-white transition-colors"
                                    >
                                        {forgotPasswordLinkText}
                                    </button>
                                )}
                            </div>
                            <input
                                id="password"
                                name="password"
                                type="password"
                                autoComplete={isLogin ? "current-password" : "new-password"}
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full px-4 py-3 mt-1.5 text-base text-white bg-black/50 border border-white/15 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#ffcc00] focus:border-transparent transition-all placeholder-gray-500"
                                placeholder="••••••••"
                            />
                        </div>
                    )}

                    {!isLogin && !isForgotPassword && (
                        <div>
                            <label htmlFor="role" className="block text-sm font-semibold text-gray-200">
                                {roleLabel}
                            </label>
                            <div className="relative w-full mt-1.5">
                                <select
                                    id="role"
                                    name="role"
                                    value={role}
                                    onChange={(e) => setRole(e.target.value)}
                                    className="w-full px-4 py-3 text-base text-white bg-[#1C1C1E] border border-white/10 rounded-lg focus:outline-none focus:ring-1 focus:border-[#ffcc00] focus:ring-[#ffcc00] transition-all duration-200 appearance-none cursor-pointer"
                                >
                                    <option value="founder" className="bg-[#1C1C1E] text-white">{founderRoleLabel}</option>
                                    <option value="investor" className="bg-[#1C1C1E] text-white">{investorRoleLabel}</option>
                                </select>
                                <div className="absolute inset-y-0 right-0 flex items-center px-4 pointer-events-none text-gray-400">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {error && (
                    <div className="p-3 text-sm text-red-300 bg-red-900/20 border border-red-900/50 rounded-lg">
                        {error}
                    </div>
                )}

                {successMessage && (
                    <div className="p-3 text-sm text-green-400 bg-green-900/20 border border-green-900/50 rounded-lg">
                        {successMessage}
                    </div>
                )}

                {pendingVerificationEmail && !isForgotPassword && (
                    <button
                        type="button"
                        onClick={resendVerificationEmail}
                        disabled={isResendingVerification || resendCooldownRemainingSeconds > 0}
                        className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-full text-sm font-semibold text-[#6ec9ff] bg-white/5 border border-white/10 hover:bg-white/10 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isResendingVerification ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            resendVerificationButtonText
                        )}
                    </button>
                )}

                {!hideFormAfterSuccess && (
                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full flex items-center justify-center py-3.5 px-4 rounded-full text-base font-bold text-white bg-linear-to-r from-[#ffcc00] to-[#203e5f] hover:opacity-90 transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#ffcc00] focus:ring-offset-[#203e5f] disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isLoading ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                            isForgotPassword ? sendResetLinkButtonText : (isLogin ? loginButtonText : registerButtonText)
                        )}
                    </button>
                )}

                {!isForgotPassword && !hideFormAfterSuccess && (
                    <>
                        <div className="relative my-6">
                            <div className="absolute inset-0 flex items-center">
                                <div className="w-full border-t border-white/10"></div>
                            </div>
                            <div className="relative flex justify-center text-sm">
                                <span className="px-2 text-gray-500 bg-[#203e5f]">Or continue with</span>
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={() => {
                                const nextParam = redirectTo && redirectTo !== '/' ? `&next=${encodeURIComponent(redirectTo)}` : ''
                                window.location.href = `/api/auth/google?role=${role}&source=${isLogin ? 'login' : 'register'}${nextParam}`
                            }}
                            className="w-full flex items-center justify-center gap-3 py-3.5 px-4 rounded-full text-base font-medium text-white bg-white/5 border border-white/10 hover:bg-white/10 transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#ffcc00] focus:ring-offset-[#203e5f]"
                        >
                            <svg className="w-5 h-5" viewBox="0 0 24 24">
                                <path
                                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                                    fill="#4285F4"
                                />
                                <path
                                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                                    fill="#34A853"
                                />
                                <path
                                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                                    fill="#FBBC05"
                                />
                                <path
                                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                                    fill="#EA4335"
                                />
                            </svg>
                            Google
                        </button>
                    </>
                )}

                <div className="flex items-center justify-center text-sm">
                    {isForgotPassword ? (
                        <button
                            type="button"
                            onClick={() => {
                                setIsForgotPassword(false)
                                setError(null)
                                setSuccessMessage(null)
                                setPendingVerificationEmail(null)
                            }}
                            className="font-medium text-[#ffcc00] hover:text-[#203e5f] transition-colors focus:outline-none"
                        >
                            {backToLoginText}
                        </button>
                    ) : (
                        <>
                                <span className="text-gray-300">
                                    {isLogin ? noAccountText : hasAccountText}
                                </span>
                            <button
                                type="button"
                                onClick={() => {
                                    setIsLogin(!isLogin)
                                    setError(null)
                                    setSuccessMessage(null)
                                    setPendingVerificationEmail(null)
                                }}
                                className="ml-2 font-semibold text-[#6ec9ff] hover:text-white transition-colors focus:outline-none"
                            >
                                {isLogin ? signUpLinkText : signInLinkText}
                            </button>
                        </>
                    )}
                </div>
            </form>
        </div>
    )
}
