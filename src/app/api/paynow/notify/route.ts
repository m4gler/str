import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { verifyWebhookSignature, getPaymentAmount } from '@/lib/paynow'
import { activateProgramInternal as activateProgram } from '@/lib/activateProgram'
import { sendInvoiceEmail } from '@/lib/invoice'
import {
    finalizePendingDiscountCode,
    releasePendingDiscountCode,
} from '@/lib/paymentFlow'

// PayNow sends POST notifications to this endpoint when payment status changes.
// Must return 200/202 to acknowledge. PayNow will retry up to 15 times over 48h otherwise.
export async function POST(request: NextRequest): Promise<NextResponse> {
    let rawBody: string
    try {
        rawBody = await request.text()
    } catch {
        return NextResponse.json({ error: 'Cannot read body' }, { status: 400 })
    }

    // If payment is disabled globally, acknowledge without processing
    {
        const pl = await getPayload({ config })
        const s: any = await pl.findGlobal({ slug: 'platform-settings' }).catch(() => ({}))
        if (s?.paymentEnabled === false) {
            return NextResponse.json({ received: true }, { status: 200 })
        }
    }

    // Verify HMAC-SHA256 signature
    const signatureHeader = request.headers.get('Signature') || ''
    if (!signatureHeader) {
        console.error('[PayNow] Missing Signature header')
        return NextResponse.json({ error: 'Missing signature' }, { status: 401 })
    }

    if (!verifyWebhookSignature(rawBody, signatureHeader)) {
        console.error('[PayNow] Signature verification failed')
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    let body: { paymentId?: string; externalId?: string; status?: string; modifiedAt?: string; amount?: number }
    try {
        body = JSON.parse(rawBody)
    } catch {
        return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }

    const { paymentId, externalId, status } = body

    console.log(`[PayNow] Notification: paymentId=${paymentId} externalId=${externalId} status=${status}`)

    if (externalId && (status === 'ERROR' || status === 'REJECTED' || status === 'ABANDONED' || status === 'EXPIRED')) {
        try {
            const payload = await getPayload({ config })
            const user = await payload.findByID({
                collection: 'users',
                id: externalId as string | number,
                overrideAccess: true,
            }).catch(() => null) as any

            if (user) {
                await releasePendingDiscountCode(payload, user)
            }
        } catch (err) {
            console.error('[PayNow] Failed to release reserved discount code:', err)
        }

        return NextResponse.json({ received: true }, { status: 200 })
    }

    if (status === 'CONFIRMED' && externalId) {
        try {
            const payload = await getPayload({ config })

            // Verify the user exists
            const user = await payload.findByID({
                collection: 'users',
                id: externalId as string | number,
                overrideAccess: true,
            }).catch(() => null) as any

            if (!user) {
                console.error(`[PayNow] User not found: externalId=${externalId}`)
                // Still return 200 to avoid retries for unknown users
                return NextResponse.json({ received: true }, { status: 200 })
            }

            // Verify the confirmed amount matches what we expected
            const expectedAmount = user?.invoiceData?.paidAmountGroszy ?? getPaymentAmount()
            if (body.amount != null && body.amount < expectedAmount) {
                console.error(`[PayNow] Amount mismatch: expected=${expectedAmount}, received=${body.amount}, user=${externalId}`)
                return NextResponse.json({ error: 'Amount mismatch' }, { status: 400 })
            }

            if (!(user as any).hasPaid100Days) {
                await activateProgram(externalId)
                console.log(`[PayNow] Program activated for user ${externalId}`)
            } else {
                console.log(`[PayNow] User ${externalId} already activated, skipping activation`)
            }

            await finalizePendingDiscountCode(payload, user)

            const latestUser = await payload.findByID({
                collection: 'users',
                id: externalId as string | number,
                overrideAccess: true,
            }).catch(() => user) as any

            const invoiceData = latestUser?.invoiceData
            if (invoiceData?.wantInvoice && !invoiceData?.invoiceSent) {
                try {
                    const settings: any = await payload.findGlobal({ slug: 'platform-settings' }).catch(() => ({}))
                    const invoiceSettings = settings?.invoicing || {}
                    const companyName = settings?.companyName || 'MESGA'

                    await sendInvoiceEmail({
                        userId: externalId,
                        userEmail: latestUser.email,
                        invoiceData,
                        invoiceSettings,
                        companyName,
                        amountGroszy: invoiceData.paidAmountGroszy ?? undefined,
                        paynowPaymentId: paymentId ?? null,
                    })

                    // Mark invoice as sent so we don't resend on retries
                    await payload.update({
                        collection: 'users',
                        id: externalId as string | number,
                        data: { 'invoiceData.invoiceSent': true } as any,
                        overrideAccess: true,
                    })
                    console.log(`[PayNow] Invoice sent for user ${externalId}`)
                } catch (invoiceErr) {
                    // Don't fail the webhook over invoice errors — payment is already confirmed
                    console.error('[PayNow] Invoice sending failed (non-fatal):', invoiceErr)
                }
            }
        } catch (err) {
            console.error('[PayNow] Failed to activate program:', err)
            // Return 500 so PayNow retries — the webhook is critical
            return NextResponse.json({ error: 'Activation failed' }, { status: 500 })
        }
    }

    return NextResponse.json({ received: true }, { status: 200 })
}
