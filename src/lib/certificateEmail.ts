import path from 'path'
import React from 'react'
import { Resend } from 'resend'
import {
  Document,
  Font,
  Page,
  StyleSheet,
  Text,
  View,
  renderToBuffer,
} from '@react-pdf/renderer'
import type { CertificateKind, CertificateProfile } from '@/lib/certificates'

function ensureFont() {
  const fontsDir = path.join(process.cwd(), 'src', 'fonts')
  Font.register({
    family: 'Roboto',
    fonts: [
      { src: path.join(fontsDir, 'Roboto-Regular.ttf') },
      { src: path.join(fontsDir, 'Roboto-Bold.ttf'), fontWeight: 700 },
    ],
  })
}

const styles = StyleSheet.create({
  page: {
    padding: 56,
    fontFamily: 'Roboto',
    backgroundColor: '#ffffff',
    color: '#111111',
  },
  frame: {
    borderColor: '#0b9df7',
    borderWidth: 2,
    padding: 36,
    minHeight: 460,
    justifyContent: 'center',
    alignItems: 'center',
  },
  brand: {
    fontSize: 12,
    color: '#0b9df7',
    fontWeight: 700,
    textTransform: 'uppercase',
    marginBottom: 28,
  },
  title: {
    fontSize: 30,
    fontWeight: 700,
    marginBottom: 18,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    color: '#555555',
    marginBottom: 28,
    textAlign: 'center',
  },
  name: {
    fontSize: 26,
    fontWeight: 700,
    marginBottom: 12,
    textAlign: 'center',
  },
  meta: {
    fontSize: 12,
    color: '#333333',
    marginTop: 4,
    textAlign: 'center',
  },
  footer: {
    fontSize: 10,
    color: '#777777',
    marginTop: 36,
    textAlign: 'center',
  },
})

function certificateKindLabel(kind: CertificateKind): string {
  return kind === 'completion' ? 'Completion Certificate' : 'Participation Certificate'
}

async function generateCertificatePdf(params: {
  companyName: string
  profile: CertificateProfile
  kind: Exclude<CertificateKind, 'none'>
}): Promise<Buffer> {
  ensureFont()
  const issuedAt = new Date().toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })

  return renderToBuffer(
    React.createElement(
      Document,
      { title: `${certificateKindLabel(params.kind)} - ${params.profile.fullName}`, author: params.companyName },
      React.createElement(
        Page,
        { size: 'A4', orientation: 'landscape', style: styles.page },
        React.createElement(
          View,
          { style: styles.frame },
          React.createElement(Text, { style: styles.brand }, params.companyName),
          React.createElement(Text, { style: styles.title }, certificateKindLabel(params.kind)),
          React.createElement(Text, { style: styles.subtitle }, '100-Day Founder Program'),
          React.createElement(Text, { style: styles.name }, params.profile.fullName),
          React.createElement(Text, { style: styles.meta }, params.profile.roleTitle),
          React.createElement(Text, { style: styles.meta }, params.profile.companyName),
          React.createElement(
            Text,
            { style: styles.footer },
            `Issued ${issuedAt}${params.profile.city || params.profile.country ? ` - ${[params.profile.city, params.profile.country].filter(Boolean).join(', ')}` : ''}`,
          ),
        ),
      ),
    ),
  )
}

function buildCertificateEmailHtml(params: {
  companyName: string
  profile: CertificateProfile
  kind: Exclude<CertificateKind, 'none'>
}): string {
  return `<!doctype html>
<html><body style="margin:0;background:#f6f7f9;font-family:Arial,sans-serif;color:#141416;">
  <div style="max-width:620px;margin:0 auto;padding:32px;">
    <div style="background:#ffffff;border:1px solid #e7e9ee;border-radius:16px;padding:28px;">
      <p style="margin:0 0 12px;font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#0b9df7;">${params.companyName}</p>
      <h1 style="margin:0 0 16px;font-size:24px;line-height:1.25;">Your ${certificateKindLabel(params.kind).toLowerCase()}</h1>
      <p style="margin:0 0 18px;font-size:15px;line-height:1.6;color:#525866;">Hi ${params.profile.fullName}, your certificate PDF is attached.</p>
      <p style="margin:0;font-size:13px;line-height:1.5;color:#747b88;">Your certificate details are prepared automatically after program completion.</p>
    </div>
  </div>
</body></html>`
}

export async function sendCertificatePdfEmail(params: {
  recipientEmail: string
  companyName: string
  profile: CertificateProfile
  kind: Exclude<CertificateKind, 'none'>
}): Promise<boolean> {
  if (process.env.DISABLE_EMAIL_DELIVERY === 'true' || process.env.NODE_ENV === 'test') {
    console.log('[Certificate] Email delivery disabled - skipping certificate send')
    return false
  }

  const resendApiKey = process.env.RESEND_API_KEY
  if (!resendApiKey) {
    console.error('[Certificate] RESEND_API_KEY not set - cannot send certificate')
    return false
  }

  const pdfBuffer = await generateCertificatePdf(params)
  const safeName = params.profile.fullName.replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '') || 'certificate'
  const resend = new Resend(resendApiKey)

  await resend.emails.send({
    from: `${params.companyName} <notifications@email.bakery.vc>`,
    to: params.recipientEmail,
    subject: `${certificateKindLabel(params.kind)} - ${params.companyName}`,
    html: buildCertificateEmailHtml(params),
    attachments: [
      {
        filename: `${safeName}_certificate.pdf`,
        content: pdfBuffer.toString('base64'),
      },
    ],
  })

  return true
}
