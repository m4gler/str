'use client'

import { useLanguage } from '@/lib/i18n'

interface LanguageSwitcherProps {
    className?: string
}

export default function LanguageSwitcher({ className = '' }: LanguageSwitcherProps) {
    const { lang, setLang } = useLanguage()

    const toggle = () => setLang(lang === 'en' ? 'pl' : 'en')

    return (
        <button
            type="button"
            onClick={toggle}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-white/10 bg-white/5 text-xs font-bold uppercase tracking-wider text-white/60 hover:bg-white/10 hover:border-white/20 hover:text-white/80 transition-all select-none ${className}`}
            title={lang === 'en' ? 'Przełącz na polski' : 'Switch to English'}
        >
            <span className={lang === 'en' ? 'text-white' : 'text-white/40'}>EN</span>
            <span className="text-white/20">|</span>
            <span className={lang === 'pl' ? 'text-white' : 'text-white/40'}>PL</span>
        </button>
    )
}
