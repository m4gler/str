import path from 'path'
import { Resend } from 'resend'
import React from 'react'
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
  renderToBuffer,
} from '@react-pdf/renderer'

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


export interface InvoiceData {
  wantInvoice: boolean
  companyName?: string | null
  nip?: string | null
  address?: string | null
  city?: string | null
  postalCode?: string | null
  country?: string | null
  invoiceEmail?: string | null
}

export interface InvoiceSettings {
  sellerName?: string | null
  sellerNip?: string | null
  sellerAddress?: string | null
  sellerCity?: string | null
  sellerPostalCode?: string | null
  sellerCountry?: string | null
  sellerEmail?: string | null
  vatRate?: number | null
  adminInvoiceEmail?: string | null
  invoiceServiceName?: string | null
}

function formatAmount(grosz: number): string {
  return (grosz / 100).toFixed(2)
}

function generateInvoiceNumber(userId: string | number): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  return `FV/${year}/${month}/${userId}`
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

// ─── PDF styles ──────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  page: {
    backgroundColor: '#ffffff',
    padding: 48,
    fontFamily: 'Roboto',
    fontSize: 10,
    color: '#111111',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 32,
    paddingBottom: 20,
    borderBottomColor: '#e5e5e5',
    borderBottomWidth: 1,
  },
  headerLeft: { flexDirection: 'column' },
  companyBadge: { fontSize: 9, fontWeight: 700, color: '#555555', marginBottom: 4 },
  invoiceTitle: { fontSize: 22, fontWeight: 700, color: '#111111' },
  headerRight: { flexDirection: 'column', alignItems: 'flex-end' },
  invoiceNumber: { fontSize: 14, fontWeight: 700, color: '#111111', marginBottom: 4 },
  headerMeta: { fontSize: 9, color: '#777777', marginTop: 2 },
  partiesRow: { flexDirection: 'row', marginBottom: 28 },
  partyBox: { flex: 1, padding: 14, borderWidth: 1, borderColor: '#e5e5e5' },
  partyBoxLeft: { marginRight: 8 },
  partyBoxRight: { marginLeft: 8 },
  partyLabel: { fontSize: 8, fontWeight: 700, color: '#999999', textTransform: 'uppercase', marginBottom: 8 },
  partyRow: { flexDirection: 'row', marginBottom: 3 },
  partyKey: { fontSize: 9, color: '#777777', width: 72 },
  partyValue: { fontSize: 9, color: '#111111', flex: 1 },
  tableContainer: { borderWidth: 1, borderColor: '#e5e5e5', marginBottom: 20 },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f5f5f5',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e5',
  },
  tableHeaderCell: { fontSize: 8, fontWeight: 700, color: '#777777', textTransform: 'uppercase' },
  tableRow: { flexDirection: 'row', paddingVertical: 12, paddingHorizontal: 12 },
  cellService: { flex: 1, fontSize: 10, color: '#111111' },
  cellRight: { width: 90, fontSize: 10, color: '#111111', textAlign: 'right' },
  cellRightBold: { width: 90, fontSize: 10, fontWeight: 700, color: '#111111', textAlign: 'right' },
  totalsContainer: { alignItems: 'flex-end', marginBottom: 28 },
  totalsBox: { width: 240, borderWidth: 1, borderColor: '#e5e5e5', padding: 14 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  totalLabel: { fontSize: 9, color: '#777777' },
  totalValue: { fontSize: 9, color: '#111111' },
  totalDivider: { height: 1, backgroundColor: '#e5e5e5', marginVertical: 8 },
  totalFinalLabel: { fontSize: 11, fontWeight: 700, color: '#111111' },
  totalFinalValue: { fontSize: 11, fontWeight: 700, color: '#111111' },
  paymentBox: { borderWidth: 1, borderColor: '#e5e5e5', padding: 14, marginBottom: 28 },
  paymentLabel: { fontSize: 8, fontWeight: 700, color: '#999999', textTransform: 'uppercase', marginBottom: 5 },
  paymentValue: { fontSize: 9, color: '#555555' },
  footer: { borderTopWidth: 1, borderTopColor: '#e5e5e5', paddingTop: 14, alignItems: 'center' },
  footerText: { fontSize: 8, color: '#aaaaaa', textAlign: 'center' },
})

// ─── PDF Document component ──────────────────────────────────────────────────

function PartyRow({ label, value }: { label: string; value: string }) {
  if (!value) return null
  return React.createElement(
    View,
    { style: styles.partyRow },
    React.createElement(Text, { style: styles.partyKey }, label),
    React.createElement(Text, { style: styles.partyValue }, value),
  )
}

function InvoicePDF(props: {
  invoiceNumber: string
  issueDate: string
  saleDate: string
  seller: InvoiceSettings
  buyer: InvoiceData & { email: string }
  amountGroszy: number
  serviceName: string
  companyName: string
  paynowPaymentId?: string | null
}) {
  const { invoiceNumber, issueDate, saleDate, seller, buyer, amountGroszy, serviceName, companyName, paynowPaymentId } = props
  const vatRate = seller.vatRate ?? 23
  const grossAmount = amountGroszy / 100
  const netAmount = grossAmount / (1 + vatRate / 100)
  const vatAmount = grossAmount - netAmount
  const buyerName = buyer.companyName || buyer.email

  return React.createElement(
    Document,
    { title: `Faktura VAT ${invoiceNumber}`, author: companyName },
    React.createElement(
      Page,
      { size: 'A4', style: styles.page },

      // ── Header ──
      React.createElement(
        View,
        { style: styles.header },
        React.createElement(
          View,
          { style: styles.headerLeft },
          React.createElement(Text, { style: styles.companyBadge }, companyName),
          React.createElement(Text, { style: styles.invoiceTitle }, 'Faktura VAT'),
        ),
        React.createElement(
          View,
          { style: styles.headerRight },
          React.createElement(Text, { style: styles.invoiceNumber }, invoiceNumber),
          React.createElement(Text, { style: styles.headerMeta }, `Data wystawienia: ${issueDate}`),
          React.createElement(Text, { style: styles.headerMeta }, `Data sprzedaży: ${saleDate}`),
        ),
      ),

      // ── Parties ──
      React.createElement(
        View,
        { style: styles.partiesRow },
        React.createElement(
          View,
          { style: [styles.partyBox, styles.partyBoxLeft] },
          React.createElement(Text, { style: styles.partyLabel }, 'Sprzedawca'),
          React.createElement(PartyRow, { label: 'Firma:', value: seller.sellerName || '' }),
          React.createElement(PartyRow, { label: 'NIP:', value: seller.sellerNip || '' }),
          React.createElement(PartyRow, { label: 'Adres:', value: seller.sellerAddress || '' }),
          React.createElement(PartyRow, { label: '', value: [seller.sellerPostalCode, seller.sellerCity].filter(Boolean).join(' ') }),
          React.createElement(PartyRow, { label: 'Kraj:', value: seller.sellerCountry || 'PL' }),
          React.createElement(PartyRow, { label: 'E-mail:', value: seller.sellerEmail || '' }),
        ),
        React.createElement(
          View,
          { style: [styles.partyBox, styles.partyBoxRight] },
          React.createElement(Text, { style: styles.partyLabel }, 'Nabywca'),
          React.createElement(PartyRow, { label: 'Firma / Imię:', value: buyerName }),
          buyer.nip ? React.createElement(PartyRow, { label: 'NIP:', value: buyer.nip }) : null,
          React.createElement(PartyRow, { label: 'Adres:', value: buyer.address || '' }),
          React.createElement(PartyRow, { label: '', value: [buyer.postalCode, buyer.city].filter(Boolean).join(' ') }),
          React.createElement(PartyRow, { label: 'Kraj:', value: buyer.country || 'PL' }),
          React.createElement(PartyRow, { label: 'E-mail:', value: buyer.invoiceEmail || buyer.email }),
        ),
      ),

      // ── Items table ──
      React.createElement(
        View,
        { style: styles.tableContainer },
        React.createElement(
          View,
          { style: styles.tableHeader },
          React.createElement(Text, { style: [styles.tableHeaderCell, { flex: 1 }] }, 'Usługa'),
          React.createElement(Text, { style: [styles.tableHeaderCell, { width: 90, textAlign: 'right' }] }, 'Netto'),
          React.createElement(Text, { style: [styles.tableHeaderCell, { width: 90, textAlign: 'right' }] }, `VAT ${vatRate}%`),
          React.createElement(Text, { style: [styles.tableHeaderCell, { width: 90, textAlign: 'right' }] }, 'Brutto'),
        ),
        React.createElement(
          View,
          { style: styles.tableRow },
          React.createElement(Text, { style: styles.cellService }, serviceName),
          React.createElement(Text, { style: styles.cellRight }, `${formatAmount(netAmount * 100)} PLN`),
          React.createElement(Text, { style: styles.cellRight }, `${formatAmount(vatAmount * 100)} PLN`),
          React.createElement(Text, { style: styles.cellRightBold }, `${formatAmount(amountGroszy)} PLN`),
        ),
      ),

      // ── Totals ──
      React.createElement(
        View,
        { style: styles.totalsContainer },
        React.createElement(
          View,
          { style: styles.totalsBox },
          React.createElement(
            View,
            { style: styles.totalRow },
            React.createElement(Text, { style: styles.totalLabel }, 'Wartość netto:'),
            React.createElement(Text, { style: styles.totalValue }, `${formatAmount(netAmount * 100)} PLN`),
          ),
          React.createElement(
            View,
            { style: styles.totalRow },
            React.createElement(Text, { style: styles.totalLabel }, `VAT (${vatRate}%):`),
            React.createElement(Text, { style: styles.totalValue }, `${formatAmount(vatAmount * 100)} PLN`),
          ),
          React.createElement(View, { style: styles.totalDivider }),
          React.createElement(
            View,
            { style: styles.totalRow },
            React.createElement(Text, { style: styles.totalFinalLabel }, 'Do zapłaty:'),
            React.createElement(Text, { style: styles.totalFinalValue }, `${formatAmount(amountGroszy)} PLN`),
          ),
        ),
      ),

      // ── Payment info ──
      React.createElement(
        View,
        { style: styles.paymentBox },
        React.createElement(Text, { style: styles.paymentLabel }, 'Forma płatności'),
        React.createElement(Text, { style: styles.paymentValue }, `Płatność elektroniczna — opłacono w dniu ${issueDate}`),
        paynowPaymentId
          ? React.createElement(Text, { style: [styles.paymentValue, { marginTop: 4 }] }, `Nr transakcji PayNow: ${paynowPaymentId}`)
          : null,
      ),

      // ── Footer ──
      React.createElement(
        View,
        { style: styles.footer },
        React.createElement(
          Text,
          { style: styles.footerText },
          `Faktura wygenerowana automatycznie przez ${companyName}${seller.sellerEmail ? ` · ${seller.sellerEmail}` : ''}`,
        ),
      ),
    ),
  )
}

async function generateInvoicePdf(params: Parameters<typeof InvoicePDF>[0]): Promise<Buffer> {
  ensureFont()
  const element = InvoicePDF(params)
  return renderToBuffer(element as any)
}

// ─── HTML email (kept as readable fallback body) ─────────────────────────────

function buildInvoiceHtml(params: {
  invoiceNumber: string
  issueDate: string
  saleDate: string
  seller: InvoiceSettings
  buyer: InvoiceData & { email: string }
  amountGroszy: number
  serviceName: string
  companyName: string
  paynowPaymentId?: string | null
}): string {
  const { invoiceNumber, issueDate, saleDate, seller, buyer, amountGroszy, serviceName, companyName, paynowPaymentId } = params
  const vatRate = seller.vatRate ?? 23
  const grossAmount = amountGroszy / 100
  const netAmount = grossAmount / (1 + vatRate / 100)
  const vatAmount = grossAmount - netAmount

  const row = (label: string, value: string) =>
    value ? `<tr><td style="padding:4px 0;color:#71717a;font-size:13px;width:140px;">${label}</td><td style="padding:4px 0;color:#e4e4e7;font-size:13px;">${value}</td></tr>` : ''

  const buyerName = buyer.companyName || buyer.email

  return `<!DOCTYPE html>
<html lang="pl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Faktura VAT ${invoiceNumber}</title>
</head>
<body style="margin:0;padding:0;background:#0a0a0b;font-family:'Segoe UI',Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0b;padding:40px 20px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background:#141416;border-radius:16px;overflow:hidden;border:1px solid rgba(255,255,255,0.08);">

        <tr>
          <td style="padding:32px 40px 24px;border-bottom:1px solid rgba(255,255,255,0.06);">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td>
                  <p style="margin:0;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#E4B94D;">${companyName}</p>
                  <h1 style="margin:4px 0 0;font-size:22px;font-weight:900;color:#ffffff;">Faktura VAT</h1>
                </td>
                <td align="right">
                  <p style="margin:0;font-size:20px;font-weight:800;color:#E4B94D;">${invoiceNumber}</p>
                  <p style="margin:4px 0 0;font-size:12px;color:#52525b;">Data wystawienia: ${issueDate}</p>
                  <p style="margin:2px 0 0;font-size:12px;color:#52525b;">Data sprzedaży: ${saleDate}</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <tr>
          <td style="padding:28px 40px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="width:50%;vertical-align:top;padding-right:20px;">
                  <p style="margin:0 0 10px;font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#52525b;">Sprzedawca</p>
                  <table cellpadding="0" cellspacing="0">
                    ${row('Firma:', seller.sellerName || '')}
                    ${row('NIP:', seller.sellerNip || '')}
                    ${row('Adres:', seller.sellerAddress || '')}
                    ${row('', [seller.sellerPostalCode, seller.sellerCity].filter(Boolean).join(' '))}
                    ${row('Kraj:', seller.sellerCountry || 'PL')}
                    ${row('E-mail:', seller.sellerEmail || '')}
                  </table>
                </td>
                <td style="width:50%;vertical-align:top;padding-left:20px;border-left:1px solid rgba(255,255,255,0.06);">
                  <p style="margin:0 0 10px;font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#52525b;">Nabywca</p>
                  <table cellpadding="0" cellspacing="0">
                    ${row('Firma / Imię:', buyerName)}
                    ${buyer.nip ? row('NIP:', buyer.nip) : ''}
                    ${row('Adres:', buyer.address || '')}
                    ${row('', [buyer.postalCode, buyer.city].filter(Boolean).join(' '))}
                    ${row('Kraj:', buyer.country || 'PL')}
                    ${row('E-mail:', buyer.invoiceEmail || buyer.email)}
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <tr>
          <td style="padding:0 40px 28px;">
            <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid rgba(255,255,255,0.08);border-radius:10px;overflow:hidden;">
              <thead>
                <tr style="background:rgba(255,255,255,0.04);">
                  <th style="padding:10px 16px;text-align:left;font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#71717a;">Usługa</th>
                  <th style="padding:10px 16px;text-align:right;font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#71717a;">Netto</th>
                  <th style="padding:10px 16px;text-align:right;font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#71717a;">VAT ${vatRate}%</th>
                  <th style="padding:10px 16px;text-align:right;font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#71717a;">Brutto</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style="padding:14px 16px;font-size:13px;color:#e4e4e7;border-top:1px solid rgba(255,255,255,0.06);">${serviceName}</td>
                  <td style="padding:14px 16px;text-align:right;font-size:13px;color:#e4e4e7;border-top:1px solid rgba(255,255,255,0.06);">${formatAmount(netAmount * 100)} PLN</td>
                  <td style="padding:14px 16px;text-align:right;font-size:13px;color:#e4e4e7;border-top:1px solid rgba(255,255,255,0.06);">${formatAmount(vatAmount * 100)} PLN</td>
                  <td style="padding:14px 16px;text-align:right;font-size:13px;font-weight:700;color:#E4B94D;border-top:1px solid rgba(255,255,255,0.06);">${formatAmount(amountGroszy)} PLN</td>
                </tr>
              </tbody>
            </table>
          </td>
        </tr>

        <tr>
          <td style="padding:0 40px 32px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td align="right">
                  <table cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="padding:4px 0;color:#71717a;font-size:12px;padding-right:20px;">Wartość netto:</td>
                      <td style="padding:4px 0;color:#a1a1aa;font-size:12px;text-align:right;min-width:100px;">${formatAmount(netAmount * 100)} PLN</td>
                    </tr>
                    <tr>
                      <td style="padding:4px 0;color:#71717a;font-size:12px;padding-right:20px;">VAT (${vatRate}%):</td>
                      <td style="padding:4px 0;color:#a1a1aa;font-size:12px;text-align:right;">${formatAmount(vatAmount * 100)} PLN</td>
                    </tr>
                    <tr>
                      <td style="padding:10px 0 4px;color:#ffffff;font-size:15px;font-weight:700;padding-right:20px;border-top:1px solid rgba(255,255,255,0.08);">Do zapłaty:</td>
                      <td style="padding:10px 0 4px;color:#E4B94D;font-size:15px;font-weight:900;text-align:right;border-top:1px solid rgba(255,255,255,0.08);">${formatAmount(amountGroszy)} PLN</td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <tr>
          <td style="padding:20px 40px 32px;border-top:1px solid rgba(255,255,255,0.06);">
            <p style="margin:0 0 4px;font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#52525b;">Forma płatności</p>
            <p style="margin:0;font-size:13px;color:#71717a;">Płatność elektroniczna — opłacono w dniu ${issueDate}</p>
            ${paynowPaymentId ? `<p style="margin:4px 0 0;font-size:12px;color:#71717a;">Nr transakcji PayNow: <span style="color:#a1a1aa;">${paynowPaymentId}</span></p>` : ''}
          </td>
        </tr>

        <tr>
          <td style="padding:20px 40px;background:rgba(255,255,255,0.02);border-top:1px solid rgba(255,255,255,0.04);">
            <p style="margin:0;font-size:11px;color:#3f3f46;text-align:center;">
              Faktura wygenerowana automatycznie przez ${companyName}${seller.sellerEmail ? ` · ${seller.sellerEmail}` : ''}
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`
}

// ─── Main export ──────────────────────────────────────────────────────────────

export async function sendInvoiceEmail(params: {
  userId: string | number
  userEmail: string
  invoiceData: InvoiceData
  invoiceSettings: InvoiceSettings
  companyName: string
  /** Actual amount paid in grosz — pass this to get correct invoice amount */
  amountGroszy?: number
  /** PayNow transaction ID to include on the invoice */
  paynowPaymentId?: string | null
}): Promise<void> {
  const { userId, userEmail, invoiceData, invoiceSettings, companyName } = params

  if (!invoiceData.wantInvoice) return
  if (process.env.DISABLE_EMAIL_DELIVERY === 'true' || process.env.NODE_ENV === 'test') {
    console.log('[Invoice] Email delivery disabled — skipping invoice send')
    return
  }

  const resendApiKey = process.env.RESEND_API_KEY
  if (!resendApiKey) {
    console.error('[Invoice] RESEND_API_KEY not set — cannot send invoice')
    return
  }

  const amountGroszy = params.amountGroszy ?? 199900

  const resend = new Resend(resendApiKey)
  const now = new Date()
  const invoiceNumber = generateInvoiceNumber(userId)
  const issueDate = formatDate(now)
  const serviceName = invoiceSettings.invoiceServiceName || `Program 100 Dni — ${companyName}`

  const pdfParams = {
    invoiceNumber,
    issueDate,
    saleDate: issueDate,
    seller: invoiceSettings,
    buyer: { ...invoiceData, email: userEmail },
    amountGroszy,
    serviceName,
    companyName,
    paynowPaymentId: params.paynowPaymentId ?? null,
  }

  // Generate PDF and HTML in parallel
  const [pdfBuffer, html] = await Promise.all([
    generateInvoicePdf(pdfParams).catch((err) => {
      console.error('[Invoice] PDF generation failed:', err)
      return null
    }),
    Promise.resolve(buildInvoiceHtml(pdfParams)),
  ])

  const recipientEmail = invoiceData.invoiceEmail || userEmail

  const attachments = pdfBuffer
    ? [{ filename: `Faktura_${invoiceNumber.replace(/\//g, '_')}.pdf`, content: pdfBuffer.toString('base64') }]
    : []

  try {
    await resend.emails.send({
      from: `${companyName} <notifications@email.bakery.vc>`,
      to: recipientEmail,
      subject: `Faktura VAT ${invoiceNumber} — ${companyName}`,
      html,
      attachments,
    })
    console.log(`[Invoice] Sent to ${recipientEmail} (invoice ${invoiceNumber})`)

    const adminEmail = invoiceSettings.adminInvoiceEmail
    if (adminEmail && adminEmail !== recipientEmail) {
      await resend.emails.send({
        from: `${companyName} <notifications@email.bakery.vc>`,
        to: adminEmail,
        subject: `[KOPIA] Faktura VAT ${invoiceNumber} — ${recipientEmail}`,
        html,
        attachments,
      })
      console.log(`[Invoice] Admin copy sent to ${adminEmail}`)
    }
  } catch (err) {
    console.error('[Invoice] Failed to send invoice email:', err)
    throw err
  }
}
