import { Section } from './types';

const LIKERT_5 = [
    { label: 'Strongly disagree', value: 'strongly_disagree' },
    { label: 'Disagree', value: 'disagree' },
    { label: 'Neither agree nor disagree', value: 'neither_agree_nor_disagree' },
    { label: 'Agree', value: 'agree' },
    { label: 'Strongly agree', value: 'strongly_agree' },
];

const EU_COUNTRIES = [
    { label: 'Austria', value: 'Austria' },
    { label: 'Belgium', value: 'Belgium' },
    { label: 'Bulgaria', value: 'Bulgaria' },
    { label: 'Croatia', value: 'Croatia' },
    { label: 'Cyprus', value: 'Cyprus' },
    { label: 'Czech Republic', value: 'Czech Republic' },
    { label: 'Denmark', value: 'Denmark' },
    { label: 'Estonia', value: 'Estonia' },
    { label: 'Finland', value: 'Finland' },
    { label: 'France', value: 'France' },
    { label: 'Germany', value: 'Germany' },
    { label: 'Greece', value: 'Greece' },
    { label: 'Hungary', value: 'Hungary' },
    { label: 'Ireland', value: 'Ireland' },
    { label: 'Italy', value: 'Italy' },
    { label: 'Latvia', value: 'Latvia' },
    { label: 'Lithuania', value: 'Lithuania' },
    { label: 'Luxembourg', value: 'Luxembourg' },
    { label: 'Malta', value: 'Malta' },
    { label: 'Netherlands', value: 'Netherlands' },
    { label: 'Poland', value: 'Poland' },
    { label: 'Portugal', value: 'Portugal' },
    { label: 'Romania', value: 'Romania' },
    { label: 'Slovakia', value: 'Slovakia' },
    { label: 'Slovenia', value: 'Slovenia' },
    { label: 'Spain', value: 'Spain' },
    { label: 'Sweden', value: 'Sweden' },
    { label: 'CEE', value: 'CEE' },
    { label: 'New Baltics', value: 'New Baltics' },
    { label: 'Balkans', value: 'Balkans' },
    { label: 'Other', value: 'Other' },
];

const INDUSTRIES = [
    { label: 'Software & Data (SaaS, AI, etc.)', value: 'Software & Data' },
    { label: 'Commerce & Retail', value: 'Commerce & Retail' },
    { label: 'Health & Life Sciences', value: 'Health & Life Sciences' },
    { label: 'Financial Services', value: 'Financial Services' },
    { label: 'Education & Workforce', value: 'Education & Workforce' },
    { label: 'Media / Social / Entertainment', value: 'Media / Social' },
    { label: 'Hardware / IoT / Robotics', value: 'Hardware / IoT' },
    { label: 'Marketing & Sales', value: 'Marketing & Sales' },
    { label: 'Food & Agriculture', value: 'Food & Agriculture' },
    { label: 'Other', value: 'Other' },
];

export const sections: Section[] = [
    {
        id: 'registration',
        title: 'Registration',
        questions: [
            {
                question_id: 'F0_EMAIL',
                question_text: 'Email (used for registration - contact)',
                question_type: 'email',
                required: true,
            },
            {
                question_id: 'F0_LINKEDIN',
                question_text: 'LinkedIn profile URL',
                question_type: 'url',
                required: true,
            },
            {
                question_id: 'F0_PATH',
                question_text: 'Which best describes you today?',
                question_type: 'dropdown',
                required: true,
                choices: [
                    { label: 'I have a startup idea (pre-company / not incorporated yet)', value: 'idea' },
                    { label: 'I already have a startup (incorporated / operating)', value: 'existing' },
                    { label: 'I want to join a startup as an employee / co-founder', value: 'join' },
                ]
            },
            {
                question_id: 'F0_CONSENT',
                question_text: 'I agree that MESGA / Bakery Ventures may process my answers for selection, matchmaking and aggregated ecosystem reporting.',
                question_type: 'yes_no',
                required: true,
            },
        ],
    },
    {
        id: 'demographics',
        title: 'Demographics',
        questions: [
            {
                question_id: 'F1_NATIONALITY',
                question_text: 'Nationality / citizenship',
                question_type: 'dropdown',
                choices: EU_COUNTRIES,
            },
            {
                question_id: 'F1_PATH',
                question_text: 'You are joining as:',
                question_type: 'dropdown',
                required: true,
                choices: [
                    { label: 'Solo Startup / Founder', value: 'solo' },
                    { label: 'Part of Startup Team', value: 'team' },
                    { label: 'From Accelerator / Incubator', value: 'accelerator' },
                    { label: 'From a Hackathon', value: 'hackathon' },
                    { label: 'From a Business School', value: 'school' },
                    { label: 'From a VC', value: 'vc' },
                    { label: 'From a Company', value: 'company' },
                    { label: 'Other', value: 'other' },
                ]
            },
            {
                question_id: 'F1_COMPANY_NAME',
                question_text: 'Company / project name',
                question_type: 'short_text',
                placeholder: 'Name of your startup or project (or "TBD")',
            },
            {
                question_id: 'F1_GENDER',
                question_text: 'Gender identity (optional)',
                question_type: 'dropdown',
                choices: [
                    { label: 'Prefer not to say', value: 'Prefer not to say' },
                    { label: 'Woman', value: 'Woman' },
                    { label: 'Man', value: 'Man' },
                    { label: 'Other', value: 'Other' },
                ]
            },
            {
                question_id: 'F1_AGE_RANGE',
                question_text: 'Age range (optional)',
                question_type: 'dropdown',
                choices: [
                    { label: 'Prefer not to say', value: 'Prefer not to say' },
                    { label: '<25', value: '<25' },
                    { label: '25-34', value: '25-34' },
                    { label: '35-44', value: '35-44' },
                    { label: '45-54', value: '45-54' },
                    { label: '55-64', value: '55-64' },
                    { label: '64+', value: '64+' },
                ]
            },
            {
                question_id: 'F1_ORIGIN_COUNTRY',
                question_text: 'Country of origin',
                question_type: 'dropdown',
                choices: EU_COUNTRIES,
            },
            {
                question_id: 'F1_GENDER_SELF',
                question_text: "If 'Other', describe your gender identity (optional)",
                question_type: 'short_text',
            },
        ],
    },
    {
        id: 'optional_profile_notice',
        title: '🟠 Additional information',
        questions: [
            {
                question_id: 'OPTIONAL_PROFILE_NOTICE',
                question_text: 'Skip it and you get a generic experience. Complete it and we match you with the right investors, mentors, and 100-day track — based on where you actually are, not where the average founder is.\n\nWhy this matters\n\n01 Investor & mentor matching — We rank investor and mentor profiles by fit with your stage, vertical, and geography — not alphabetically.\n\n02 Your 100-day route — Your answers personalise which challenges, sessions, and introductions you get access to first — and in what order.\n\n3× more relevant introductions on average for founders who complete this section vs. those who skip it.\n\nTakes approximately 3 minutes to complete.',
                question_type: 'statement',
                statementVariant: 'optional_profile_notice',
            },
        ],
    },
    {
        id: 'geography',
        title: 'Geography & Mobility',
        questions: [
            {
                question_id: 'F2_RESIDENCY_COUNTRY',
                question_text: 'Primary residency - country',
                question_type: 'dropdown',
                choices: EU_COUNTRIES,
                required: false,
            },
            {
                question_id: 'F2_RESIDENCY_CITY',
                question_text: 'Primary residency - city',
                question_type: 'short_text',
                required: false,
            },
            {
                question_id: 'F2_CURRENT_DIFF',
                question_text: 'Is your current location different from your residency?',
                question_type: 'yes_no',
                helperText: 'If you answer YES, fill in your current country and city below. Your current location should be different from your primary residency.',
            },
            {
                question_id: 'F2_CURRENT_COUNTRY',
                question_text: 'Current location - country',
                question_type: 'dropdown',
                choices: EU_COUNTRIES,
                helperText: 'Required only if your current location is different from your residency.',
            },
            {
                question_id: 'F2_CURRENT_CITY',
                question_text: 'Current location - city',
                question_type: 'short_text',
                helperText: 'Required only if your current location is different from your residency.',
            },
            {
                question_id: 'F2_RELOCATED_5Y',
                question_text: 'Have you relocated for work/startup reasons in the last 5 years?',
                question_type: 'yes_no',
                required: false,
                helperText: 'If you answer YES, fill in both the origin and destination below. "From" and "to" should not be the same place.',
            },
            {
                question_id: 'F2_RELOC_FROM_COUNTRY',
                question_text: 'Relocation: from country',
                question_type: 'dropdown',
                choices: EU_COUNTRIES,
                helperText: 'Required only if you relocated in the last 5 years.',
            },
            {
                question_id: 'F2_RELOC_FROM_CITY',
                question_text: 'Relocation: from city',
                question_type: 'short_text',
                helperText: 'Required only if you relocated in the last 5 years.',
            },
            {
                question_id: 'F2_RELOC_TO_COUNTRY',
                question_text: 'Relocation: to country',
                question_type: 'dropdown',
                choices: EU_COUNTRIES,
                helperText: 'Required only if you relocated in the last 5 years.',
            },
            {
                question_id: 'F2_RELOC_TO_CITY',
                question_text: 'Relocation: to city',
                question_type: 'short_text',
                helperText: 'Required only if you relocated in the last 5 years.',
            },
            {
                question_id: 'F2_STATUS',
                question_text: 'Native-born or immigrant/expatriate in current country?',
                question_type: 'multiple_choice_single',
                choices: [
                    { label: 'Native-born citizen', value: 'Native-born citizen' },
                    { label: 'Immigrant / expat', value: 'Immigrant / expat' },
                    { label: 'Prefer not to say', value: 'Prefer not to say' },
                ]
            }
        ]
    },
    {
        id: 'education',
        title: 'Education & Human Capital',
        questions: [
            {
                question_id: 'F3_EDU_LEVEL',
                question_text: 'Highest level of education',
                question_type: 'dropdown',
                required: false,
                choices: [
                    { label: 'High school / GED', value: 'High school / GED' },
                    { label: 'Associate degree', value: 'Associate degree' },
                    { label: 'Bachelor\'s degree', value: 'Bachelor\'s degree' },
                    { label: 'Master\'s degree', value: 'Master\'s degree' },
                    { label: 'Doctorate (PhD / MD)', value: 'Doctorate' },
                    { label: 'Other', value: 'Other' },
                ]
            },
            {
                question_id: 'F3_EDU_MAJOR',
                question_text: 'Educational major (broad field)',
                question_type: 'dropdown',
                required: false,
                choices: [
                    { label: '01 Education', value: '01 Education' },
                    { label: '02 Arts and humanities', value: '02 Arts and humanities' },
                    { label: '03 Social sciences', value: '03 Social sciences' },
                    { label: '04 Business, admin & law', value: '04 Business, admin & law' },
                    { label: '05 Natural sciences', value: '05 Natural sciences' },
                    { label: '06 Information & Comm. Tech', value: '06 Information & Comm. Tech' },
                    { label: '07 Engineering, manuf. & constr.', value: '07 Engineering, manuf. & constr.' },
                    { label: '08 Agriculture, forestry', value: '08 Agriculture, forestry' },
                    { label: '09 Health & welfare', value: '09 Health & welfare' },
                    { label: 'Other', value: 'Other' },
                ]
            },
            {
                question_id: 'F3_FIELD_NARROW',
                question_text: 'Narrow field (e.g., Sociology, Medicine, Law, Finance, etc.)',
                question_type: 'short_text',
                required: false,
            },
            {
                question_id: 'F3_FOUNDER_EXP',
                question_text: 'Founder experience',
                question_type: 'dropdown',
                required: false,
                choices: [
                    { label: 'I don\'t identify as founder', value: 'None' },
                    { label: 'First-time founder', value: 'First-time founder' },
                    { label: 'Second-time founder', value: 'Second-time founder' },
                    { label: 'Serial Founder (3+)', value: 'Serial Founder' },
                ]
            },
            {
                question_id: 'F3_PREV_STARTUP_OUTCOME',
                question_text: 'If second-time founder, previous startup outcome',
                question_type: 'multiple_choice_single',
                choices: [
                    { label: 'Active', value: 'Active' },
                    { label: 'Closed', value: 'Closed' },
                    { label: 'Exited', value: 'Exited' },
                ]
            },
            {
                question_id: 'F3_SME_TYPE',
                question_text: 'Subject matter expertise (in your startup domain)',
                question_type: 'dropdown',
                required: false,
                choices: [
                    { label: 'Tourist – new to this industry', value: 'Tourist' },
                    { label: 'Native – 5+ years industry experience', value: 'Native' },
                    { label: 'Researcher – startup based on academic / lab research', value: 'Researcher' },
                    { label: 'Practitioner – business / live experience in this domain', value: 'Practitioner' },
                ]
            },
            {
                question_id: 'F3_YEARS_INDUSTRY',
                question_text: 'Years of relevant industry experience',
                question_type: 'dropdown',
                required: false,
                choices: [
                    { label: '0-2', value: '0-2' },
                    { label: '3-5', value: '3-5' },
                    { label: '6-10', value: '6-10' },
                    { label: '11-15', value: '11-15' },
                    { label: '16+', value: '16+' },
                ]
            },
            {
                question_id: 'F3_FUNCTIONAL_STR',
                question_text: 'Primary functional strength (in startup)',
                question_type: 'dropdown',
                required: false,
                choices: [
                    { label: 'Engineering', value: 'Engineering' },
                    { label: 'Product', value: 'Product' },
                    { label: 'Sales / BizDev', value: 'Sales / BizDev' },
                    { label: 'Marketing / Growth', value: 'Marketing / Growth' },
                    { label: 'Ops', value: 'Ops' },
                    { label: 'Finance', value: 'Finance' },
                    { label: 'Research', value: 'Research' },
                    { label: 'Other', value: 'Other' },
                ]
            },
        ],
    },
    {
        id: 'work_activity',
        title: 'Current Work Activity',
        questions: [
            {
                question_id: 'F3B_WORK_STATUS',
                question_text: 'Current work / main activity',
                question_type: 'dropdown',
                required: false,
                choices: [
                    { label: 'Employed full-time', value: 'Employed full-time' },
                    { label: 'Employed part-time', value: 'Employed part-time' },
                    { label: 'Freelance / contract', value: 'Freelance / contract' },
                    { label: 'Self-employed / Founder', value: 'Self-employed / Founder' },
                    { label: 'Full-time student', value: 'Full-time student' },
                    { label: 'Not employed currently', value: 'Not employed currently' },
                    { label: 'Other', value: 'Other' },
                ]
            },
            {
                question_id: 'F3B_TIME_AVAILABLE',
                question_text: 'How much time can you realistically dedicate to the startup each week?',
                question_type: 'dropdown',
                required: false,
                choices: [
                    { label: '< 5 hours/week', value: '< 5 hours/week' },
                    { label: '5-10 hours/week', value: '5-10 hours/week' },
                    { label: '10-20 hours/week', value: '10-20 hours/week' },
                    { label: '20-30 hours/week', value: '20-30 hours/week' },
                    { label: '30-40 hours/week', value: '30-40 hours/week' },
                    { label: '40+ hours/week (full-time)', value: '40+ hours/week' },
                ]
            },
            {
                question_id: 'F3B_TIME_CHANGE_3MO',
                question_text: 'Do you expect your time availability to change in the next 3 months?',
                question_type: 'dropdown',
                choices: [
                    { label: 'Yes - increasing', value: 'Yes - increasing' },
                    { label: 'Yes - decreasing', value: 'Yes - decreasing' },
                    { label: 'Not sure', value: 'Not sure' },
                    { label: 'No', value: 'No' },
                ]
            },
            {
                question_id: 'F3B_INCOME_RUNWAY',
                question_text: 'If you stopped working today, what is your personal financial runway?',
                question_type: 'dropdown',
                choices: [
                    { label: '< 1 month', value: '< 1 month' },
                    { label: '1-3 months', value: '1-3 months' },
                    { label: '3-6 months', value: '3-6 months' },
                    { label: '6-12 months', value: '6-12 months' },
                    { label: '12+ months', value: '12+ months' },
                ]
            },
            {
                question_id: 'F3B_COMMITMENT_PLAN',
                question_text: 'What is your near-term plan for commitment to the startup?',
                question_type: 'dropdown',
                required: false,
                choices: [
                    { label: 'Already full-time', value: 'Already full-time' },
                    { label: 'Transitioning to full-time soon', value: 'Transitioning to full-time soon' },
                    { label: 'Transitioning to part-time', value: 'Transitioning to part-time' },
                    { label: 'Part-time for now', value: 'Part-time for now' },
                    { label: 'Part-time only (for foreseeable future)', value: 'Part-time only' },
                    { label: 'Not sure yet', value: 'Not sure yet' },
                ]
            },
        ]
    },
    {
        id: 'socioeconomic',
        title: 'SocioEconomic',
        questions: [
            {
                question_id: 'F4_FIRST_GEN_UNI',
                question_text: 'First-generation university student (optional)',
                question_type: 'multiple_choice_single',
                choices: [
                    { label: 'Yes (neither parent graduated)', value: 'Yes' },
                    { label: 'No', value: 'No' },
                    { label: 'Prefer not to say', value: 'Prefer not to say' },
                ]
            },
            {
                question_id: 'F4_FIRST_GEN_FOUNDER',
                question_text: 'First-generation founder (optional)',
                question_type: 'multiple_choice_single',
                choices: [
                    { label: 'Yes (no family history of entrepreneurship)', value: 'Yes' },
                    { label: 'No (at least one parent owned a business)', value: 'No' },
                ]
            },
        ]
    },
    {
        id: 'foaled',
        title: 'Leadership Archetype (FOALED)',
        description: 'FOALED is a framework for classifying founder leadership styles: Fighter, Operator, Accomplisher, Leader, Engineer/Developer. Pick the archetype that best describes how you naturally lead and execute — if you are not sure, choose "Not sure yet / TBD".',
        questions: [
            {
                question_id: 'F5_FOALED',
                question_text: 'Which archetype describes you best?',
                question_type: 'dropdown',
                required: false,
                choices: [
                    { label: 'Not sure yet / TBD', value: 'tbd' },
                    { label: 'Fighter — resilience under pressure, keeps going when others quit (e.g. bootstrapped founders pushing through a tough market)', value: 'Fighter' },
                    { label: 'Operator — obsessed with systems, process, repeatable execution (e.g. ops-first COO profile)', value: 'Operator' },
                    { label: 'Accomplisher — goal-oriented achiever who shipped things before (degrees, sports, past launches)', value: 'Accomplisher' },
                    { label: 'Leader — recruits great people, sets vision, sells the company to investors/employees', value: 'Leader' },
                    { label: 'Engineer/Developer — technical architect, builds the product yourself, code-first', value: 'Engineer/Developer' },
                ]
            },
        ]
    },
    // PERSONALITY TEST SECTIONS (per MESGA_Big5_Typeform_TEMPLATE_Likert_GoldStandard.xlsx)
    {
        id: 'quality_control',
        title: 'Quality Control',
        questions: [
            {
                question_id: 'S1_ATTN',
                question_text: 'Attention check: to confirm you\'re paying attention, please select "Agree".',
                question_type: 'range',
                required: true,
                choices: LIKERT_5,
            },
            {
                question_id: 'S2_HONESTY',
                question_text: 'I answered the questions honestly and thoughtfully.',
                question_type: 'range',
                required: true,
                choices: LIKERT_5,
            },
        ],
    },
    {
        id: 'big_five',
        title: 'Core Personality',
        description: 'Rate how well each statement describes you. Some statements are phrased in the negative — that\'s intentional.',
        questions: [
            { question_id: 'E1', question_text: 'Am the life of the party.', question_type: 'range', required: true, choices: LIKERT_5 },
            { question_id: 'A1', question_text: 'Sympathize with others\' feelings.', question_type: 'range', required: true, choices: LIKERT_5 },
            { question_id: 'C1', question_text: 'Get chores done right away.', question_type: 'range', required: true, choices: LIKERT_5 },
            { question_id: 'N1', question_text: 'Have frequent mood swings.', question_type: 'range', required: true, choices: LIKERT_5 },
            { question_id: 'O1', question_text: 'Have a vivid imagination.', question_type: 'range', required: true, choices: LIKERT_5 },
            { question_id: 'E2', question_text: 'Don\'t talk a lot.', question_type: 'range', required: true, choices: LIKERT_5 },
            { question_id: 'A2', question_text: 'Am not interested in other people\'s problems.', question_type: 'range', required: true, choices: LIKERT_5 },
            { question_id: 'C2', question_text: 'Often forget to put things back in their proper place.', question_type: 'range', required: true, choices: LIKERT_5 },
            { question_id: 'N2', question_text: 'Am relaxed most of the time.', question_type: 'range', required: true, choices: LIKERT_5 },
            { question_id: 'O2', question_text: 'Am not interested in abstract ideas.', question_type: 'range', required: true, choices: LIKERT_5 },
            { question_id: 'E3', question_text: 'Talk to a lot of different people at parties.', question_type: 'range', required: true, choices: LIKERT_5 },
            { question_id: 'A3', question_text: 'Feel others\' emotions.', question_type: 'range', required: true, choices: LIKERT_5 },
            { question_id: 'C3', question_text: 'Like order.', question_type: 'range', required: true, choices: LIKERT_5 },
            { question_id: 'N3', question_text: 'Get upset easily.', question_type: 'range', required: true, choices: LIKERT_5 },
            { question_id: 'O3', question_text: 'Have difficulty understanding abstract ideas.', question_type: 'range', required: true, choices: LIKERT_5 },
            { question_id: 'E4', question_text: 'Keep in the background.', question_type: 'range', required: true, choices: LIKERT_5 },
            { question_id: 'A4', question_text: 'Take time out for others.', question_type: 'range', required: true, choices: LIKERT_5 },
            { question_id: 'C4', question_text: 'Make a mess of things.', question_type: 'range', required: true, choices: LIKERT_5 },
            { question_id: 'N4', question_text: 'Seldom feel blue.', question_type: 'range', required: true, choices: LIKERT_5 },
            { question_id: 'O4', question_text: 'Am full of ideas.', question_type: 'range', required: true, choices: LIKERT_5 },
        ],
    },
    {
        id: 'self_efficacy',
        title: 'Self-Efficacy',
        questions: [
            { question_id: 'SE1', question_text: 'I can usually find a way to solve difficult problems if I try hard enough.', question_type: 'range', required: true, choices: LIKERT_5 },
            { question_id: 'SE2', question_text: 'When I face a challenge, I\'m confident I can handle it.', question_type: 'range', required: true, choices: LIKERT_5 },
            { question_id: 'SE3', question_text: 'If something looks complicated, I can break it down and make progress.', question_type: 'range', required: true, choices: LIKERT_5 },
            { question_id: 'SE4', question_text: 'I avoid taking on tasks that feel too hard.', question_type: 'range', required: true, choices: LIKERT_5 },
            { question_id: 'SE5', question_text: 'When plans fail, I can quickly adjust and try another approach.', question_type: 'range', required: true, choices: LIKERT_5 },
        ],
    },
    {
        id: 'risk_taking',
        title: 'Risk-Taking',
        questions: [
            { question_id: 'RT1', question_text: 'I am comfortable making decisions with incomplete information.', question_type: 'range', required: true, choices: LIKERT_5 },
            { question_id: 'RT2', question_text: 'I prefer safe, predictable options over uncertain ones.', question_type: 'range', required: true, choices: LIKERT_5 },
            { question_id: 'RT3', question_text: 'I will take calculated risks if the upside is meaningful.', question_type: 'range', required: true, choices: LIKERT_5 },
            { question_id: 'RT4', question_text: 'I often act on impulse rather than planning.', question_type: 'range', required: true, choices: LIKERT_5 },
            { question_id: 'RT5', question_text: 'I can balance speed and caution when stakes are high.', question_type: 'range', required: true, choices: LIKERT_5 },
        ],
    },
    {
        id: 'behavioral_anchors',
        title: 'Behavioral Evidence',
        description: 'These questions help us understand your day-to-day patterns. Be as concrete as possible.',
        questions: [
            {
                question_id: 'B1_OUTPUT',
                question_text: 'In the last 14 days, which best describes your output rhythm?',
                question_type: 'multiple_choice_single',
                required: true,
                choices: [
                    { label: 'I ship something measurable every day (or almost every day)', value: 'daily' },
                    { label: 'I ship weekly in batches', value: 'weekly' },
                    { label: 'I work a lot but ship irregularly', value: 'irregular' },
                    { label: 'I\'m currently blocked / stalled', value: 'blocked' },
                ],
            },
            {
                question_id: 'B1_EXAMPLE',
                question_text: 'Give 1 concrete example of what you shipped (link or description).',
                question_type: 'long_text',
                required: true,
            },
            {
                question_id: 'B2_STRESS',
                question_text: 'When you\'re under pressure, what usually happens?',
                question_type: 'multiple_choice_single',
                required: true,
                choices: [
                    { label: 'I get calmer and more focused', value: 'calmer' },
                    { label: 'I stay steady; performance is consistent', value: 'steady' },
                    { label: 'I become scattered; focus drops', value: 'scattered' },
                    { label: 'I freeze/avoid decisions', value: 'freeze' },
                ],
            },
            {
                question_id: 'B2_EXAMPLE',
                question_text: 'Give 1 concrete example from the last month.',
                question_type: 'long_text',
                required: true,
            },
            {
                question_id: 'B3_SALES',
                question_text: 'How comfortable are you with outbound (customers/investors/partners)?',
                question_type: 'multiple_choice_single',
                required: true,
                choices: [
                    { label: 'Very comfortable — I do it weekly', value: 'very_comfortable' },
                    { label: 'Comfortable if I have a script/structure', value: 'comfortable' },
                    { label: 'Somewhat uncomfortable — I avoid it unless forced', value: 'uncomfortable' },
                    { label: 'Very uncomfortable — I rarely do it', value: 'very_uncomfortable' },
                ],
            },
            {
                question_id: 'B3_EXAMPLE',
                question_text: 'Paste a recent outreach message (can be anonymized) OR describe your last outreach attempt.',
                question_type: 'long_text',
                required: true,
            },
        ],
    },
    {
        id: 'mesga_fit',
        title: 'MESGA Fit',
        questions: [
            {
                question_id: 'F_BOTTLENECK',
                question_text: 'What is your single biggest bottleneck right now?',
                question_type: 'multiple_choice_single',
                required: true,
                choices: [
                    { label: 'Not sure yet / TBD', value: 'tbd' },
                    { label: 'Finding a real problem / clarity', value: 'clarity' },
                    { label: 'Getting users / interviews / pilots', value: 'users' },
                    { label: 'Building MVP fast enough', value: 'mvp' },
                    { label: 'Distribution / sales / GTM', value: 'distribution' },
                    { label: 'Fundraising / investor access', value: 'fundraising' },
                ],
            },
            {
                question_id: 'F_SUPPORT_STYLE',
                question_text: 'What support style helps you most?',
                question_type: 'multiple_choice_single',
                required: true,
                choices: [
                    { label: 'Not sure yet / TBD', value: 'tbd' },
                    { label: 'Hard accountability + strict weekly goals', value: 'accountability' },
                    { label: 'Structured templates + checklists', value: 'templates' },
                    { label: 'Mentor feedback loops', value: 'mentor' },
                    { label: 'Intros + network access', value: 'intros' },
                    { label: 'Quiet async reviews (minimal meetings)', value: 'async' },
                ],
            },
            {
                question_id: 'F_CADENCE_COMMIT',
                question_text: 'I commit to the MESGA 100 Days cadence (daily submission + weekly retro).',
                question_type: 'multiple_choice_single',
                required: true,
                choices: [
                    { label: 'Yes', value: 'Yes' },
                    { label: 'No', value: 'No' },
                ],
            },
        ],
    },
    // IDEA PATH SECTIONS
    {
        id: 'idea_a',
        title: 'Your Idea',
        questions: [
            {
                question_id: 'F7A_WORKING_NAME',
                question_text: 'Working name (or "TBD")',
                question_type: 'short_text',
            },
            {
                question_id: 'F7A_ONELINER',
                question_text: 'One liner (what you want to build + for whom)',
                question_type: 'short_text',
                helperText: 'Example: "We help SME factories predict machine failures before downtime hits production."',
                required: true,
            },
            {
                question_id: 'F7A_INDUSTRY_GEN',
                question_text: 'Industry / vertical (general)',
                question_type: 'dropdown',
                required: true,
                choices: INDUSTRIES,
            },
            {
                question_id: 'F7A_DOMAIN',
                question_text: 'Industry / vertical (Detailed)',
                question_type: 'short_text',
                required: true,
            },
            {
                question_id: 'F7A_PROBLEM',
                question_text: 'Problem (2-4 sentences)',
                question_type: 'long_text',
                helperText: 'Be concrete: who has the problem, how often it happens, and what it costs today.',
                required: true,
            },
            {
                question_id: 'F7A_TARGET_USER',
                question_text: 'Target user/buyer (who pays vs who uses)',
                question_type: 'long_text',
                required: true,
            },
            {
                question_id: 'F7A_SOLUTION_MVP',
                question_text: 'Proposed solution (MVP) (2-4 sentences)',
                question_type: 'long_text',
                required: true,
            },
        ]
    },
    {
        id: 'idea_b',
        title: 'Idea Snapshot',
        questions: [
            {
                question_id: 'F7A_PLANNED_HQ_COUNTRY',
                question_text: 'Planned HQ - country (or TBD)',
                question_type: 'dropdown',
                choices: EU_COUNTRIES,
            },
            {
                question_id: 'F7A_PLANNED_HQ_CITY',
                question_text: 'Planned HQ - city (or TBD)',
                question_type: 'short_text',
            },
            {
                question_id: 'F7A_STAGE_3MO',
                question_text: 'Expected stage in 3 months',
                question_type: 'dropdown',
                required: true,
                choices: [
                    { label: 'Pre-MVP', value: 'Pre-MVP' },
                    { label: 'MVP', value: 'MVP' },
                    { label: 'Early revenue', value: 'Early revenue' },
                ]
            },
            {
                question_id: 'F7A_TEAM_SIZE',
                question_text: 'Planned founding team',
                question_type: 'dropdown',
                required: true,
                choices: [
                    { label: 'Solo', value: 'Solo' },
                    { label: '2 founders', value: '2 founders' },
                    { label: '3+ founders', value: '3+ founders' },
                ]
            },
            {
                question_id: 'F7A_TECH_COF_PLAN',
                question_text: 'Technical cofounder plan',
                question_type: 'dropdown',
                required: true,
                choices: [
                    { label: 'I am technical', value: 'I am technical' },
                    { label: 'I have CTO', value: 'I have CTO' },
                    { label: 'I\'m looking', value: 'I\'m looking' },
                    { label: 'Not needed', value: 'Not needed' },
                ]
            },
            {
                question_id: 'F7A_FUNDING_PLAN',
                question_text: 'Funding plan (next 12 months)',
                question_type: 'multiple_choice_multiple',
                required: true,
                choices: [
                    { label: 'Bootstrapped', value: 'Bootstrapped' },
                    { label: 'Grants', value: 'Grants' },
                    { label: 'Angels', value: 'Angels' },
                    { label: 'Pre-seed', value: 'Pre-seed' },
                    { label: 'VC / Fund', value: 'VC / Fund' },
                    { label: 'Client – Business', value: 'Client – Business' },
                    { label: 'Client – Government', value: 'Client – Government' },
                    { label: 'Client – Individuals', value: 'Client – Individuals' },
                    { label: 'Not sure', value: 'Not sure' },
                    { label: 'Other', value: 'Other' },
                ]
            },
        ]
    },
    // EXISTING PATH SECTIONS
    {
        id: 'existing_a',
        title: 'Startup Basics',
        questions: [
            {
                question_id: 'F7B_STARTUP_NAME',
                question_text: 'Startup name',
                question_type: 'short_text',
                required: true,
            },
            {
                question_id: 'F7B_WEBSITE',
                question_text: 'Website',
                question_type: 'url',
            },
            {
                question_id: 'F7B_HQ_COUNTRY',
                question_text: 'HQ - country',
                question_type: 'dropdown',
                choices: EU_COUNTRIES,
                required: true,
            },
            {
                question_id: 'F7B_HQ_CITY',
                question_text: 'HQ - city',
                question_type: 'short_text',
                required: true,
            },
            {
                question_id: 'F7B_INCORPORATED',
                question_text: 'Incorporated?',
                question_type: 'yes_no',
                required: true,
            },
            {
                question_id: 'F7B_INCORP_YEAR',
                question_text: 'If yes: incorporation year',
                question_type: 'number',
            },
        ]
    },
    {
        id: 'existing_b',
        title: 'What You Do',
        questions: [
            {
                question_id: 'F7B_ONELINER',
                question_text: 'One-liner (what you do + for whom)',
                question_type: 'short_text',
                helperText: 'Example: "We help logistics teams reduce route planning time with AI-assisted dispatch."',
                required: true,
            },
            {
                question_id: 'F7B_INDUSTRY_GEN',
                question_text: 'Industry / vertical (pick up to 2)',
                question_type: 'multiple_choice_multiple',
                required: true,
                choices: INDUSTRIES,
            },
            {
                question_id: 'F7B_INDUSTRY_OTHER',
                question_text: 'Industry / vertical (Detailed)',
                question_type: 'short_text',
                required: true,
            },
            {
                question_id: 'F7B_STAGE',
                question_text: 'Stage',
                question_type: 'dropdown',
                required: true,
                choices: [
                    { label: 'Pre-MVP', value: 'Pre-MVP' },
                    { label: 'MVP', value: 'MVP' },
                    { label: 'Early revenue', value: 'Early revenue' },
                    { label: 'Scaling', value: 'Scaling' },
                    { label: 'Series A+', value: 'Series A+' },
                ]
            },
        ]
    },
    {
        id: 'existing_c',
        title: 'Team',
        questions: [
            {
                question_id: 'F7B_NUM_FOUNDERS',
                question_text: 'Number of founders',
                question_type: 'number',
                required: true,
            },
            {
                question_id: 'F7B_TEAM_SIZE_FTE',
                question_text: 'Total team size (FTE)',
                question_type: 'number',
                required: true,
            },
            {
                question_id: 'F7B_TECH_COF',
                question_text: 'Technical cofounder / CTO equivalent?',
                question_type: 'yes_no',
                required: true,
            },
        ]
    },
    // JOIN PATH SECTIONS
    {
        id: 'join',
        title: 'Join Preferences',
        questions: [
            {
                question_id: 'F7C_ONELINER',
                question_text: 'One liner (what you want to build or join + for whom)',
                question_type: 'short_text',
                required: true,
            },
            {
                question_id: 'F7C_INDUSTRY_GEN',
                question_text: 'Industry / vertical (general)',
                question_type: 'dropdown',
                required: true,
                choices: INDUSTRIES,
            },
            {
                question_id: 'F7C_PREF_HQ_COUNTRY',
                question_text: 'Preferred workplace HQ - country (or TBD)',
                question_type: 'dropdown',
                choices: EU_COUNTRIES,
            },
            {
                question_id: 'F7C_PREF_HQ_CITY',
                question_text: 'Preferred workplace HQ - city (or TBD)',
                question_type: 'short_text',
            },
            {
                question_id: 'F7C_DESIRED_ROLE',
                question_text: 'Desired area of work',
                question_type: 'dropdown',
                required: true,
                choices: [
                    { label: 'Technical', value: 'Technical' },
                    { label: 'Marketing', value: 'Marketing' },
                    { label: 'Operations', value: 'Operations' },
                    { label: 'Finance', value: 'Finance' },
                    { label: 'Legal', value: 'Legal' },
                    { label: 'Product', value: 'Product' },
                    { label: 'Sales', value: 'Sales' },
                    { label: 'Other', value: 'Other' },
                ]
            },
        ]
    },
    // NEEDS & EXPECTATIONS
    {
        id: 'needs_expectations',
        title: 'Needs & Expectations',
        questions: [
            {
                question_id: 'F8_BIGGEST_PROBLEM',
                question_text: 'What is your biggest problem at the current stage?',
                question_type: 'long_text',
                helperText: 'Example: "Customer discovery is moving, but we still lack a repeatable acquisition channel."',
                required: true,
            },
            {
                question_id: 'F8_RESOURCES_NEEDED',
                question_text: 'What resources do you need to move forward?',
                question_type: 'long_text',
                required: true,
            },
            {
                question_id: 'F8_EXPECTATIONS',
                question_text: 'What are your expectations from applying to MESGA.ca / 100 Days?',
                question_type: 'long_text',
                required: true,
            },
            {
                question_id: 'F8_SUPPORT_TYPES',
                question_text: 'What kind of support do you need the most? (select all)',
                question_type: 'multiple_choice_multiple',
                required: true,
                choices: [
                    { label: 'Advice / Mentoring', value: 'Advice / Mentoring' },
                    { label: 'Business Network', value: 'Business Network' },
                    { label: 'Co-founder (Tech)', value: 'Co-founder (Tech)' },
                    { label: 'Co-founder (Sales)', value: 'Co-founder (Sales)' },
                    { label: 'Fundraising strategy', value: 'Fundraising strategy' },
                    { label: 'Investor intros', value: 'Investor intros' },
                    { label: 'Other', value: 'Other' },
                ]
            },
        ]
    },
    // IDEA EVIDENCE
    {
        id: 'idea_c',
        title: 'Evidence',
        questions: [
            {
                question_id: 'F7A_EVIDENCE',
                question_text: 'What evidence do you already have? (select all)',
                question_type: 'multiple_choice_multiple',
                required: true,
                choices: [
                    { label: 'Customer interviews', value: 'Customer interviews' },
                    { label: 'Waitlist', value: 'Waitlist' },
                    { label: 'LOIs', value: 'LOIs' },
                    { label: 'Prototype', value: 'Prototype' },
                    { label: 'Paying pilot', value: 'Paying pilot' },
                    { label: 'None yet', value: 'None yet' },
                    { label: 'Other', value: 'Other' },
                ]
            },
            {
                question_id: 'F7A_BLOCKER_1',
                question_text: '#1 blocker right now',
                question_type: 'long_text',
                required: true,
            },
            {
                question_id: 'F7A_LINKS',
                question_text: 'Links (optional): Notion/Doc/Figma/GitHub/landing page',
                question_type: 'url',
            },
        ]
    },
    // EXISTING FUNDING
    {
        id: 'existing_d',
        title: 'Funding',
        questions: [
            {
                question_id: 'F7B_FUNDING_TO_DATE',
                question_text: 'Funding to date (select all that apply) (optional)',
                question_type: 'multiple_choice_multiple',
                choices: [
                    { label: 'Bootstrapped', value: 'Bootstrapped' },
                    { label: 'Grants', value: 'Grants' },
                    { label: 'Angels', value: 'Angels' },
                    { label: 'Pre-seed', value: 'Pre-seed' },
                    { label: 'Seed', value: 'Seed' },
                    { label: 'Series A', value: 'Series A' },
                    { label: 'VC / Fund', value: 'VC / Fund' },
                    { label: 'Client – Business', value: 'Client – Business' },
                    { label: 'Client – Government', value: 'Client – Government' },
                    { label: 'Client – Individuals', value: 'Client – Individuals' },
                    { label: 'Other', value: 'Other' },
                ]
            },
            {
                question_id: 'F7B_AMOUNT_RAISED',
                question_text: 'Amount raised to date (number + currency) (optional)',
                question_type: 'short_text',
            },
            {
                question_id: 'F7B_CURRENTLY_RAISING',
                question_text: 'Currently raising? (optional)',
                question_type: 'multiple_choice_single',
                choices: [
                    { label: 'No', value: 'No' },
                    { label: 'Yes', value: 'Yes' },
                    { label: 'In 0-3 months', value: 'In 0-3 months' },
                    { label: 'In 3-6 months', value: 'In 3-6 months' },
                ]
            },
            {
                question_id: 'F7B_TARGET_ROUND',
                question_text: 'Target round size (number + currency) (optional)',
                question_type: 'short_text',
            },
        ]
    },
    // EXISTING TRACTION
    {
        id: 'existing_e',
        title: 'Traction',
        questions: [
            {
                question_id: 'F7B_TRACTION',
                question_text: 'Current traction (select all that apply)',
                question_type: 'multiple_choice_multiple',
                helperText: 'Select the clearest proof you already have: users, pilots, revenue, LOIs, or equivalent traction signals.',
                required: true,
                choices: [
                    { label: 'Waitlist', value: 'Waitlist' },
                    { label: 'LOIs', value: 'LOIs' },
                    { label: 'Pilots', value: 'Pilots' },
                    { label: 'Paying customers', value: 'Paying customers' },
                    { label: 'Recurring revenue', value: 'Recurring revenue' },
                    { label: 'Enterprise contracts', value: 'Enterprise contracts' },
                    { label: 'Other', value: 'Other' },
                ]
            },
            {
                question_id: 'F7B_MAIN_KPI_TREND',
                question_text: 'Main KPI + last 8 weeks trend (e.g., "MRR +12% WoW")',
                question_type: 'short_text',
                required: true,
            },
            {
                question_id: 'F7B_DECK_LINK',
                question_text: 'Pitch deck link (optional)',
                question_type: 'url',
            },
        ]
    },
    // CONTACT ROLE
    {
        id: 'contact_role',
        title: 'Contact & Role',
        questions: [
            {
                question_id: 'F6_FULL_NAME',
                question_text: 'Full name',
                question_type: 'short_text',
                required: true,
            },
            {
                question_id: 'F6_EMAIL_CONFIRM',
                question_text: 'Confirm email (should match registration)',
                question_type: 'email',
                required: true,
            },
            {
                question_id: 'F6_LINKEDIN_CONFIRM',
                question_text: 'LinkedIn (if different from registration)',
                question_type: 'url',
            },
            {
                question_id: 'F6_ROLE_EXPECTED',
                question_text: 'What role do you expect to play operationally in this venture/programme?',
                question_type: 'dropdown',
                required: true,
                helperText: 'This helps us understand your day-to-day contribution. It does not change the track you selected earlier.',
                choices: [
                    { label: 'CEO', value: 'CEO' },
                    { label: 'CTO', value: 'CTO' },
                    { label: 'Product', value: 'Product' },
                    { label: 'Commercial', value: 'Commercial' },
                    { label: 'Ops', value: 'Ops' },
                    { label: 'Other', value: 'Other' },
                ]
            },
            {
                question_id: 'F6_ROLE_OTHER',
                question_text: 'If other role, specify',
                question_type: 'short_text',
            },
        ]
    }
];
