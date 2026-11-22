import * as XLSX from 'xlsx'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const type = req.nextUrl.searchParams.get('type') || 'investor'

  const headers = [
    'section',
    'question_id',
    'question_type',
    'required',
    'question_text',
    'choice_1',
    'choice_2',
    'choice_3',
    'choice_4',
    'choice_5',
    'choice_6',
    'choice_7',
    'choice_8',
    'choice_9',
    'choice_10',
    'choice_11',
    'choice_12',
    'notes',
  ]

  const exampleRows =
    type === 'founder'
      ? [
          [
            '0_Registration',
            'F0_EMAIL',
            'email',
            'Y',
            'Email (used for registration + contact)',
            '',
            '',
            '',
            '',
            '',
            '',
            '',
            '',
            '',
            '',
            '',
            '',
            '',
          ],
          [
            '0_Registration',
            'F0_CONSENT',
            'multiple_choice_single',
            'Y',
            'Consent: I agree that MESGA / Bakery Ventures may process my answers.',
            'Yes, I consent',
            'No',
            '',
            '',
            '',
            '',
            '',
            '',
            '',
            '',
            '',
            '',
            'Gate: if No → end form.',
          ],
          [
            '1_Company',
            'F1_NAME',
            'short_text',
            'Y',
            'Company / project name',
            '',
            '',
            '',
            '',
            '',
            '',
            '',
            '',
            '',
            '',
            '',
            '',
            '',
          ],
        ]
      : [
          [
            '0_Consent_Basics',
            'I0_CONSENT',
            'multiple_choice_single',
            'Y',
            'Consent: I agree that MESGA / Bakery Ventures may use my answers for matchmaking.',
            'Yes, I consent',
            'No',
            '',
            '',
            '',
            '',
            '',
            '',
            '',
            '',
            '',
            '',
            'Gate: if No, end form.',
          ],
          [
            '0_Consent_Basics',
            'I0_NAME',
            'short_text',
            'Y',
            'Full name',
            '',
            '',
            '',
            '',
            '',
            '',
            '',
            '',
            '',
            '',
            '',
            '',
            '',
          ],
          [
            '1_Identity',
            'I1_COUNTRY',
            'dropdown',
            'Y',
            'Country of residence',
            '',
            '',
            '',
            '',
            '',
            '',
            '',
            '',
            '',
            '',
            '',
            '',
            'Use dropdown.',
          ],
        ]

  const instructionsData = [
    ['MESGA Form Import Template'],
    [''],
    ['Required columns:'],
    ['  section        — Section name (e.g. "0_Registration"). Questions with the same section name are grouped together.'],
    ['  question_id    — Unique ID per question (e.g. "F0_EMAIL", "I1_COUNTRY")'],
    ['  question_type  — One of: short_text, long_text, email, url, number, dropdown, multiple_choice_single, multiple_choice_multiple, yes_no, opinion_scale_1_5'],
    ['  required       — "Y" or "N" (or "yes"/"no", or "true"/"false")'],
    ['  question_text  — The question shown to the user'],
    [''],
    ['Optional columns:'],
    ['  choice_1 … choice_12 — Answer options for dropdown / multiple choice questions. Leave blank for text/email/url/number types.'],
    ['  notes          — Internal notes (ignored during import)'],
    [''],
    ['Tips:'],
    ['  • The "section" column determines grouping. All rows with the same section value become one section.'],
    ['  • Section titles are auto-generated from the section value: "0_Registration" → "Registration".'],
    ['  • Choices are read left-to-right; stop at first empty cell.'],
    ['  • "opinion_scale_1_5" is auto-mapped to "range" with 5 choices (Strongly disagree → Strongly agree).'],
    ['  • Empty rows are skipped.'],
    ['  • CSV files are also supported (same column structure).'],
  ]

  const wb = XLSX.utils.book_new()

  const wsInstructions = XLSX.utils.aoa_to_sheet(instructionsData)
  wsInstructions['!cols'] = [{ wch: 120 }]
  XLSX.utils.book_append_sheet(wb, wsInstructions, 'Instructions')

  const wsForm = XLSX.utils.aoa_to_sheet([headers, ...exampleRows])
  wsForm['!cols'] = headers.map((h) =>
    h === 'question_text' ? { wch: 50 } : h === 'notes' ? { wch: 30 } : { wch: 18 },
  )
  XLSX.utils.book_append_sheet(wb, wsForm, 'Form')

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

  const filename = type === 'founder' ? 'MESGA_Founder_Form_Template.xlsx' : 'MESGA_Investor_Form_Template.xlsx'

  return new NextResponse(buf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
