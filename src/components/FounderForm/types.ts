
export interface Question {
    question_id: string;
    question_text: string;
    question_type: 'short_text' | 'long_text' | 'email' | 'url' | 'number' | 'dropdown' | 'multiple_choice_single' | 'multiple_choice_multiple' | 'yes_no' | 'date' | 'range' | 'statement' | 'file_upload';
    required?: boolean;
    choices?: { label: string; value: string }[];
    placeholder?: string;
    helperText?: string;
    exampleHintTitle?: string;
    exampleHintBody?: string;
    fileUploadAccept?: string;
    statementVariant?: 'workspace_card' | 'optional_profile_notice';
    statementBody?: string;
}

export interface Section {
    id: string;
    title: string;
    description?: string;
    questions: Question[];
}
