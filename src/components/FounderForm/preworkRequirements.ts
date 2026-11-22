import type { Section } from './types'

export function makePreworkSectionsOptional(sections: Section[], isPrework: boolean): Section[] {
    if (!isPrework) return sections

    return sections.map((section) => ({
        ...section,
        questions: section.questions.map((question) => ({
            ...question,
            required: false,
        })),
    }))
}
