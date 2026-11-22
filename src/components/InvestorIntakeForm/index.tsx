'use client';

import React, { useEffect, useState } from 'react';
import { InvestorForm } from '@/payload-types';
import { QuestionRenderer } from '@/components/QuestionRenderer';
import { submitInvestorForm } from '@/app/actions';
import { SerializeRichText } from '@/components/SerializeRichText';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import SiteFooter from '@/components/SiteFooter';
import MesgaHorizontalLogo from '@/components/MesgaHorizontalLogo';
import { useFormAutoSave } from '@/hooks/useFormAutoSave';

interface InvestorIntakeFormProps {
    form: InvestorForm;
    platformSettings?: any;
}

type InvestorFormSection = NonNullable<InvestorForm['sections']>[number];

export default function InvestorIntakeForm({ form, platformSettings }: InvestorIntakeFormProps) {
    const router = useRouter();
    const [answers, setAnswers] = useState<Record<string, any>>({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [completed, setCompleted] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

    const s = platformSettings?.investorForm || {};
    const v = platformSettings?.validation || {};
    const formTitle = s.title || 'Investor / Mentor';
    const formSubtitle = s.subtitle;
    const warningText = s.warningText || 'This form can only be submitted once — please fill it carefully.';
    const submitButtonText = s.submitButtonText || 'Save';
    const savingButtonText = s.savingButtonText || 'Saving...';
    const requiredMsg = v.requiredFieldMessage || 'This field is required';
    const fixFieldsMsg = v.fixHighlightedFieldsMessage || 'Please fix the highlighted fields.';
    const unexpectedErrorMsg = v.unexpectedErrorMessage || 'An unexpected error occurred.';
    const invalidEmailMsg = v.invalidEmailMessage || 'Please enter a valid email address';
    const invalidUrlMsg = v.invalidUrlMessage || 'Please enter a valid URL';

    const companyName = platformSettings?.companyName || 'MESGA';
    const logoUrl = platformSettings?.logo?.url;
    const accentColor = platformSettings?.primaryColor || '#ffcc00';
    const founderFormSettings = platformSettings?.founderForm || {};
    const autoSaveSavedLabel = founderFormSettings.autoSaveLabel || 'Draft saved';
    const autoSaveSavingLabel = founderFormSettings.autoSaveSavingLabel || 'Saving draft…';

    const sections = form.sections || [];
    const consentQuestionId = 'I0_CONSENT';
    const consentRejected = String(answers[consentQuestionId] || '').trim().toLowerCase() === 'no';

    /**
     * Evaluate conditional logic for a question.
     * Format: "SHOW_IF:<question_id>:value1|value2"
     * Returns true if question should be visible.
     */
    const isQuestionVisible = (question: any): boolean => {
        const logic = question.logic as string | undefined;
        if (!logic) return true;

        const match = logic.match(/^SHOW_IF:([^:]+):(.+)$/);
        if (!match) return true;

        const [, refQuestionId, valuesStr] = match;
        const allowedValues = (valuesStr.includes('|') ? valuesStr.split('|') : valuesStr.split(','))
            .map((v: string) => v.trim().toLowerCase())
            .filter(Boolean);
        const currentValue = answers[refQuestionId];

        if (currentValue === undefined || currentValue === null || currentValue === '') return false;

        // Handle array values (multiple choice)
        if (Array.isArray(currentValue)) {
            return currentValue.some((v: string) =>
                allowedValues.includes(String(v).toLowerCase()),
            );
        }

        return allowedValues.includes(String(currentValue).toLowerCase());
    };

    const isAnswerMissing = (value: any): boolean =>
        value == null || value === '' || (Array.isArray(value) && value.length === 0);

    const getVisibleQuestions = (section: InvestorFormSection) =>
        (section.questions || []).filter((question) => {
            if (consentRejected && question.question_id !== consentQuestionId) {
                return false;
            }

            return isQuestionVisible(question);
        });

    const visibleSections = sections
        .map((section) => ({
            ...section,
            questions: getVisibleQuestions(section),
        }))
        .filter((section) => (section.questions?.length || 0) > 0);

    const autoSave = useFormAutoSave({
        formSlug: form.slug || 'investor-intake-v1',
        formType: 'investor',
        answers,
        enabled: Boolean(form.slug),
        onHydrate: (draft) => {
            setAnswers((prev) => (Object.keys(prev).length === 0 ? { ...draft } : prev));
        },
    });

    useEffect(() => {
        if (!form.slug) return;
        setAnswers({});
    }, [form.slug]);

    const getVisibleAnswers = () => {
        const visibleQuestionIds = new Set(
            visibleSections.flatMap((section) =>
                (section.questions || []).map((question) => question.question_id),
            ),
        );

        return Object.fromEntries(
            Object.entries(answers).filter(([key]) =>
                visibleQuestionIds.has(key) ||
                (key.endsWith('_OTHER') && visibleQuestionIds.has(key.slice(0, -6))),
            ),
        );
    };

    const handleAnswerChange = (questionId: string, value: any) => {
        setAnswers((prev) => ({
            ...prev,
            [questionId]: value,
        }));
        if (fieldErrors[questionId]) {
            setFieldErrors((prev) => {
                const next = { ...prev };
                delete next[questionId];
                return next;
            });
        }
    };

    const validateFormat = (q: any, value: any): string | null => {
        if (value === undefined || value === null || value === '') return null;
        if (q.question_type === 'email') {
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return invalidEmailMsg;
        }
        if (q.question_type === 'url') {
            try {
                const href = /^https?:\/\//i.test(value) ? value : `https://${value}`;
                const parsed = new URL(href);
                if (!parsed.hostname.includes('.')) return invalidUrlMsg;
            } catch {
                return invalidUrlMsg;
            }
        }
        if (q.question_type === 'number') {
            const num = parseFloat(value);
            if (isNaN(num)) return 'Please enter a valid number';
            if (q.numberMinType === 'custom' && q.numberMinValue != null && num < q.numberMinValue) {
                return `Value must be at least ${q.numberMinValue}`;
            }
            if (q.numberMaxType === 'custom' && q.numberMaxValue != null && num > q.numberMaxValue) {
                return `Value must be at most ${q.numberMaxValue}`;
            }
        }
        return null;
    };

    const handleSubmit = async () => {
        setIsSubmitting(true);
        setError(null);
        setCompleted(false);

        const missingFields: string[] = [];
        const newFieldErrors: Record<string, string> = {};

        for (const section of visibleSections) {
            if (section.questions) {
                for (const q of section.questions) {
                    if (q.question_type === 'statement') continue;

                    if (q.required && isAnswerMissing(answers[q.question_id])) {
                        missingFields.push(q.question_id);
                    } else {
                        const formatErr = validateFormat(q, answers[q.question_id]);
                        if (formatErr) newFieldErrors[q.question_id] = formatErr;
                    }
                }
            }
        }

        const hasFormatErrors = Object.keys(newFieldErrors).length > 0;

        if (missingFields.length > 0 || hasFormatErrors) {
            setError(fixFieldsMsg);
            setFieldErrors(newFieldErrors);
            setIsSubmitting(false);
            setCompleted(true);

            const firstErrorId = missingFields[0] ?? Object.keys(newFieldErrors)[0];
            setTimeout(() => {
                const element = document.getElementById(firstErrorId);
                if (element) {
                    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                } else {
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                }
            }, 100);
            return;
        }

        try {
            const result = await submitInvestorForm(form.id, getVisibleAnswers(), null, form.slug);
            if (result.error) {
                setError(result.error);
                window.scrollTo({ top: 0, behavior: 'smooth' });
            } else {
                void autoSave.clear();
                router.push('/');
            }
        } catch (e) {
            setError(unexpectedErrorMsg);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="relative w-full min-h-screen bg-[#1a2634] text-white flex flex-col font-sans selection:bg-[#ffcc00]/30 overflow-hidden">
            <div className="absolute inset-0 z-0 pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-[#ffcc00]/8 blur-[120px] rounded-full" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-[#ffcc00]/8 blur-[120px] rounded-full" />
            </div>

            <header className="sticky top-0 z-50 flex items-center justify-center px-4 sm:px-6 py-4 backdrop-blur-md border-b border-white/5 bg-[#1a2634]/80">
                <div className="flex w-full max-w-5xl items-center justify-between">
                    <Link href="/" className="group flex items-center">
                        <MesgaHorizontalLogo
                            companyName={companyName}
                            logoUrl={logoUrl}
                            size="header"
                            className="transition-opacity group-hover:opacity-85"
                        />
                    </Link>
                    <form action="/logout" method="POST">
                        <button
                            type="submit"
                            className="rounded-full border border-white/10 bg-white/5 px-5 py-2 text-sm font-medium text-white hover:bg-white/10 hover:border-white/20 transition-all active:scale-95"
                        >
                            Log out
                        </button>
                    </form>
                </div>
            </header>

            <div className="relative z-10 w-full max-w-3xl mx-auto p-6 md:p-12 pb-32 flex-1">
                <div className="text-center mb-16 space-y-5 animate-in fade-in slide-in-from-bottom-8 duration-700">
                    <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-white uppercase">
                        {formTitle}
                    </h1>
                    <p className="text-white/50 text-lg">
                        <SerializeRichText
                            content={formSubtitle}
                            boldClassName="text-[#ffcc00] font-semibold"
                            disableParagraphs
                        />
                    </p>
                    {!(form as any).allowMultipleSubmissions && (
                        <div className="inline-flex items-center gap-2 text-[#ffcc00]/80 text-sm border border-[#ffcc00]/20 bg-[#ffcc00]/5 rounded-xl px-5 py-3">
                            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                            </svg>
                            {warningText}
                        </div>
                    )}
                </div>

                {error && (
                    <div className="mb-8 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-300 text-center text-sm sticky top-20 backdrop-blur-md z-40 flex items-center justify-center gap-2">
                        <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
                        </svg>
                        {error}
                    </div>
                )}

                {consentRejected && (
                    <div className="mb-8 p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-200 text-center text-sm">
                        We cannot continue the intake without consent. You can submit only your consent preference.
                    </div>
                )}

                <div className="space-y-12">
                    {visibleSections.map((section, sIdx) => (
                        <div key={sIdx} className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700" style={{ animationDelay: `${sIdx * 80}ms` }}>
                            <div className="flex items-center gap-4 mb-2">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-[#ffcc00]/10 border border-[#ffcc00]/20 flex items-center justify-center text-[#ffcc00] text-sm font-bold">
                                        {sIdx + 1}
                                    </div>
                                    <h2 className="text-xl font-semibold text-white/90">
                                        {section.title}
                                    </h2>
                                </div>
                                <div className="h-px bg-white/10 flex-1"></div>
                            </div>
                            {section.description && (
                                <p className="text-sm text-white/40 -mt-2 mb-4 leading-relaxed pl-11">
                                    {section.description}
                                </p>
                            )}

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {section.questions?.map((question) => {
                                    const isFullWidth =
                                        question.question_type === 'long_text' ||
                                        question.question_type === 'multiple_choice_multiple' ||
                                        question.question_type === 'range' ||
                                        question.question_type === 'yes_no' ||
                                        question.question_type === 'statement' ||
                                        (question.question_id ?? '').endsWith('_CONSENT') ||
                                        (question.question_id ?? '').endsWith('_consent') ||
                                        (question.question_text ?? '').length > 30;

                                    const isError =
                                        completed &&
                                        question.required &&
                                        isAnswerMissing(answers[question.question_id]);

                                    return (
                                        <div
                                            key={question.question_id}
                                            id={question.question_id}
                                            className={`${isFullWidth ? 'md:col-span-2' : 'md:col-span-1'} h-full`}
                                        >
                                            <QuestionRenderer
                                                question={question as any}
                                                value={answers[question.question_id]}
                                                onChange={(val) => handleAnswerChange(question.question_id, val)}
                                                error={!!isError}
                                                errorMessage={
                                                    fieldErrors[question.question_id] ||
                                                    (isError ? requiredMsg : undefined)
                                                }
                                                otherValue={answers[question.question_id + '_OTHER'] || ''}
                                                onOtherChange={(val) => handleAnswerChange(question.question_id + '_OTHER', val)}
                                                accentColor="#ffcc00"
                                            />
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>

                <div className="mt-16 flex flex-col items-center gap-3">
                    <button
                        onClick={handleSubmit}
                        disabled={isSubmitting}
                        className="px-12 py-4 bg-linear-to-r from-[#ffcc00] to-[#F59E0B] hover:opacity-90 disabled:opacity-50 text-white font-bold text-lg rounded-full shadow-[0_0_30px_rgba(228,185,77,0.25)] hover:shadow-[0_0_50px_rgba(228,185,77,0.4)] transition-all duration-300 transform hover:-translate-y-1 active:translate-y-0 w-full md:w-auto min-w-50"
                    >
                        {isSubmitting ? savingButtonText : consentRejected ? 'Finish' : submitButtonText}
                    </button>
                    {(autoSave.isSaving || autoSave.lastSavedAt) && (
                        <span className="text-xs text-white/40">
                            {autoSave.isSaving
                                ? autoSaveSavingLabel
                                : `${autoSaveSavedLabel}${autoSave.lastSavedAt ? ` · ${autoSave.lastSavedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}`}
                        </span>
                    )}
                </div>
            </div>

            <SiteFooter settings={platformSettings} companyName={companyName} variant="fixed" />
        </div>
    );
}
