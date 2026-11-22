'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import SiteFooter from '@/components/SiteFooter'
import LanguageSwitcher from '@/components/LanguageSwitcher'
import { useLanguage, createT } from '@/lib/i18n'

interface CartClientProps {
  companyName: string
  logoUrl?: string | null
  settings: any
  checkoutUrl: string
  product: {
    sku: string
    name: string
    namePl?: string
    description: string
    descriptionPl?: string
    priceDisplay: string
    priceDisplayEur?: string
    vatInfo: string
    vatInfoPl?: string
    paymentMethods: string
    paymentMethodsPl?: string
    activationInfo: string
    activationInfoPl?: string
    returnPolicy: string
    returnPolicyPl?: string
    complaintProcedure: string
    complaintProcedurePl?: string
  }
}

interface CartItem {
  sku: string
  name: string
  description: string
  priceDisplay: string
  priceDisplayEur?: string
  quantity: number
  addedAt: string
}

const CART_STORAGE_KEY = 'mesga-cart-v1'

export default function CartClient({
  companyName,
  logoUrl,
  settings,
  checkoutUrl,
  product,
}: CartClientProps) {
  const { lang } = useLanguage()
  const t = createT(settings, lang)
  const isPl = lang === 'pl'
  const [cartItem, setCartItem] = useState<CartItem | null>(null)
  const [loaded, setLoaded] = useState(false)

  // Pick language-specific product field: PL variant when lang=pl, EN otherwise
  const p = {
    name: isPl ? (product.namePl || product.name) : product.name,
    description: isPl ? (product.descriptionPl || product.description) : product.description,
    priceDisplay: isPl ? product.priceDisplay : (product.priceDisplayEur || product.priceDisplay),
    vatInfo: isPl ? (product.vatInfoPl || product.vatInfo) : product.vatInfo,
    paymentMethods: isPl ? (product.paymentMethodsPl || product.paymentMethods) : product.paymentMethods,
    activationInfo: isPl ? (product.activationInfoPl || product.activationInfo) : product.activationInfo,
    returnPolicy: isPl ? (product.returnPolicyPl || product.returnPolicy) : product.returnPolicy,
    complaintProcedure: isPl ? (product.complaintProcedurePl || product.complaintProcedure) : product.complaintProcedure,
  }

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(CART_STORAGE_KEY)
      if (!raw) {
        setCartItem(null)
        return
      }

      const parsed = JSON.parse(raw) as CartItem
      if (parsed?.sku === product.sku) {
        setCartItem(parsed)
      } else {
        setCartItem(null)
      }
    } catch {
      setCartItem(null)
    } finally {
      setLoaded(true)
    }
  }, [product.sku])

  const effectiveCartPriceDisplay = cartItem
    ? (isPl ? cartItem.priceDisplay : (cartItem.priceDisplayEur || cartItem.priceDisplay))
    : p.priceDisplay

  const hasItem = !!cartItem
  const requiresLogin = checkoutUrl.startsWith('/login')

  const clearCart = () => {
    window.localStorage.removeItem(CART_STORAGE_KEY)
    setCartItem(null)
  }

  const seller = settings?.invoicing
  const orderStages = [t('cart.stage.cart', 'Cart'), t('cart.stage.checkout', 'Checkout'), t('cart.stage.activation', 'Activation')]
  const includedHighlights = useMemo(() => ([
    {
      label: t('cart.highlight.executionSystem', 'Execution system'),
      value: t('cart.highlight.executionSystemValue', '100-day operating rhythm'),
      description: t('cart.highlight.executionSystemDesc', 'Daily missions, proof capture, and clear unlock logic instead of passive content.'),
      accent: '#ffcc00',
    },
    {
      label: t('cart.highlight.humanReview', 'Human review'),
      value: t('cart.highlight.humanReviewValue', 'Mentor feedback built in'),
      description: t('cart.highlight.humanReviewDesc', 'Structured review loops designed to keep founders moving instead of drifting.'),
      accent: '#ffcc00',
    },
    {
      label: t('cart.highlight.activation', 'Activation'),
      value: t('cart.highlight.activationValue', 'Digital access after payment'),
      description: t('cart.highlight.activationDesc', 'Checkout activates the program flow and opens the next MESGA step immediately.'),
      accent: '#2CB1A1',
    },
  ]), [lang])
  const summaryLines = useMemo(() => ([
    { label: t('cart.label.payment', 'Payment'), value: p.paymentMethods, accent: '#ffcc00' },
    { label: t('cart.label.delivery', 'Delivery'), value: p.activationInfo, accent: '#2CB1A1' },
    { label: t('cart.label.returns', 'Returns'), value: p.returnPolicy, accent: '#ffcc00' },
    { label: t('cart.label.complaints', 'Complaints'), value: p.complaintProcedure, accent: '#C96A4A' },
  ]), [p, lang])
  const primaryCtaLabel = requiresLogin ? t('cart.loginToContinue', 'Log in to continue') : t('cart.proceedToCheckout', 'Proceed to checkout')
  const helperNote = requiresLogin
    ? t('cart.loginHelper', 'Sign in first so the order can be attached to your MESGA founder account before payment.')
    : t('cart.checkoutHelper', 'You will continue into the secure MESGA payment flow powered by PayNow.')
  const sellerAddress = [seller?.sellerAddress, [seller?.sellerPostalCode, seller?.sellerCity].filter(Boolean).join(' ')].filter(Boolean).join(', ')

  return (
    <div className="min-h-screen bg-[#1a2634] text-white font-sans">
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-[#ffcc00]/10 blur-[130px] rounded-full" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-[#ffcc00]/10 blur-[130px] rounded-full" />
          <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.12) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.12) 1px, transparent 1px)', backgroundSize: '48px 48px' }} />
        </div>

        <main className="relative z-10 max-w-7xl mx-auto px-6 py-16">
          <div className="mb-12 grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-end">
            <div className="space-y-5">
              <div className="flex items-center gap-3">
                <p className="text-[11px] font-bold uppercase tracking-[3px] text-[#ffcc00]">{t('cart.breadcrumb', 'Cart')}</p>
                <LanguageSwitcher />
              </div>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-[1.02]">
                {t('cart.heading', 'Your order,')}
                <br />
                <span className="bg-clip-text text-transparent bg-linear-to-r from-[#ffcc00] via-[#F0C86A] to-[#C96A4A]">
                  {t('cart.headingHighlight', 'ready for checkout.')}
                </span>
              </h1>
              <p className="text-white/50 max-w-2xl text-base leading-relaxed">
                {t('cart.intro', 'Review the MESGA service, payment conditions, and activation details before you move into the checkout flow. One order, one payment, full access to the acceleration system.')}
              </p>
            </div>

            <div className="rounded-3xl border border-white/10 bg-[#203e5f]/60 backdrop-blur-sm p-5">
              <p className="text-[11px] font-bold uppercase tracking-[2px] text-white/35 mb-4">{t('cart.orderPath', 'Order path')}</p>
              <div className="flex items-center gap-2">
                {orderStages.map((stage, index) => (
                  <div key={stage} className="flex items-center gap-2 flex-1 min-w-0">
                    <div
                      className="flex h-10 min-w-0 flex-1 items-center justify-center rounded-2xl border px-3 text-[11px] font-bold uppercase tracking-[2px]"
                      style={{
                        borderColor: index === 0 ? '#ffcc0055' : 'rgba(255,255,255,0.08)',
                        background: index === 0 ? '#ffcc0014' : 'rgba(255,255,255,0.03)',
                        color: index === 0 ? '#ffcc00' : 'rgba(255,255,255,0.32)',
                      }}
                    >
                      {stage}
                    </div>
                    {index < orderStages.length - 1 && (
                      <div className="h-px flex-1 bg-white/10" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {!loaded ? (
            <div className="rounded-[32px] border border-white/10 bg-[#203e5f]/55 p-8 text-white/50 backdrop-blur-sm">
              {t('cart.loading', 'Loading cart…')}
            </div>
          ) : !hasItem ? (
            <section className="max-w-3xl rounded-[32px] border border-white/10 bg-[#203e5f]/55 p-8 md:p-10 backdrop-blur-sm">
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#ffcc00]/25 bg-[#ffcc00]/10 px-4 py-2">
                <div className="h-2 w-2 rounded-full bg-[#ffcc00]" />
                <span className="text-[11px] font-bold uppercase tracking-[2px] text-[#ffcc00]">{t('cart.emptyBadge', 'Cart empty')}</span>
              </div>
              <h2 className="text-3xl font-black tracking-tight mb-3">{t('cart.emptyTitle', 'Nothing is queued for checkout yet.')}</h2>
              <p className="text-white/50 max-w-xl leading-relaxed mb-8">
                {t('cart.emptyDescription', 'Add the 100-Day Program from the MESGA landing page to load the order summary, legal details, and secure payment flow.')}
              </p>
              <div className="flex flex-wrap gap-3 mb-8">
                {[t('cart.chip.executionOs', '100-day execution OS'), t('cart.chip.mentorReview', 'mentor review'), t('cart.chip.digitalActivation', 'digital activation')].map((chip) => (
                  <span key={chip} className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-white/60">
                    {chip}
                  </span>
                ))}
              </div>
              <Link
                href="/"
                className="inline-flex items-center justify-center rounded-full px-6 py-3 font-bold text-[#1a2634]"
                style={{ background: 'linear-gradient(135deg, #ffcc00 0%, #C96A4A 100%)' }}
              >
                {t('cart.backToOffer', 'Back to offer')}
              </Link>
            </section>
          ) : (
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_380px]">
              <div className="space-y-6">
                <section className="overflow-hidden rounded-[32px] border border-white/10 bg-[#203e5f]/60 backdrop-blur-sm">
                  <div className="h-px w-full bg-linear-to-r from-[#ffcc00] via-[#ffcc00] to-[#C96A4A]" />
                  <div className="grid lg:grid-cols-[320px_1fr]">
                    <div className="relative overflow-hidden border-b border-white/8 bg-linear-to-br from-[#ffcc00]/18 via-[#111827] to-[#ffcc00]/12 p-8 lg:border-b-0 lg:border-r">
                      <div className="absolute inset-0 pointer-events-none">
                        <div className="absolute top-8 left-6 h-24 w-24 rounded-full bg-[#ffcc00]/20 blur-3xl" />
                        <div className="absolute bottom-8 right-6 h-24 w-24 rounded-full bg-[#ffcc00]/20 blur-3xl" />
                      </div>
                      <div className="relative flex min-h-full flex-col justify-between gap-8">
                        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 self-start">
                          <div className="h-2 w-2 rounded-full bg-[#ffcc00]" />
                          <span className="text-[11px] font-bold uppercase tracking-[2px] text-[#ffcc00]">{t('cart.digitalService', 'MESGA digital service')}</span>
                        </div>

                        <div className="mx-auto flex h-44 w-44 items-center justify-center rounded-[2rem] border border-white/10 bg-[#0d0f12]/80 shadow-[0_32px_80px_rgba(0,0,0,0.35)]">
                          {logoUrl ? (
                            <img src={logoUrl} alt={companyName} className="h-28 w-28 object-contain" />
                          ) : (
                            <div className="flex h-28 w-28 items-center justify-center rounded-[1.75rem] bg-linear-to-br from-[#ffcc00] to-[#203e5f] text-5xl font-black text-white shadow-2xl shadow-blue-500/20">
                              M
                            </div>
                          )}
                        </div>

                        <div className="grid gap-3">
                          {[t('cart.singlePurchase', 'Single purchase'), t('cart.secureCheckout', 'Secure PayNow checkout'), t('cart.activationAfterPayment', 'Activation after payment')].map((pill) => (
                            <div key={pill} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-white/75">
                              {pill}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="p-8 lg:p-10">
                      <div className="mb-8 flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                        <div className="max-w-2xl">
                          <p className="mb-2 text-[11px] font-bold uppercase tracking-[2px] text-[#ffcc00]">{t('cart.currentProduct', 'Current product')}</p>
                          <h2 className="text-3xl font-black tracking-tight text-white leading-tight">{p.name}</h2>
                          <p className="mt-4 text-sm leading-7 text-white/55">{p.description}</p>
                        </div>
                        <div className="rounded-3xl border border-[#ffcc00]/20 bg-[#ffcc00]/8 px-5 py-4 xl:min-w-[210px]">
                          <p className="text-[11px] font-bold uppercase tracking-[2px] text-[#ffcc00]/70">{t('cart.totalDue', 'Total due')}</p>
                          <div className="mt-2 text-3xl font-black text-[#ffcc00]">{effectiveCartPriceDisplay}</div>
                          <p className="mt-1 text-xs text-white/35">{p.vatInfo}</p>
                        </div>
                      </div>

                      <div className="mb-8 grid gap-4 md:grid-cols-3">
                        {includedHighlights.map((item) => (
                          <div key={item.label} className="rounded-2xl border border-white/8 bg-black/20 p-4">
                            <div className="mb-3 flex items-center gap-2">
                              <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.accent }} />
                              <p className="text-[11px] font-bold uppercase tracking-[2px] text-white/40">{item.label}</p>
                            </div>
                            <p className="text-sm font-semibold text-white mb-2">{item.value}</p>
                            <p className="text-xs leading-6 text-white/45">{item.description}</p>
                          </div>
                        ))}
                      </div>

                      <div className="rounded-[28px] border border-white/8 bg-black/20 p-5">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <p className="mb-1 text-[11px] font-bold uppercase tracking-[2px] text-white/35">{t('cart.cartItem', 'Cart item')}</p>
                            <p className="text-lg font-semibold text-white/90">{cartItem.name}</p>
                            <p className="mt-1 text-sm text-white/35">{t('cart.quantity', 'Quantity')}: {cartItem.quantity} · {t('cart.singleDigitalOrder', 'Single digital order')}</p>
                          </div>
                          <button
                            type="button"
                            onClick={clearCart}
                            className="inline-flex items-center justify-center rounded-full border border-white/10 px-4 py-2 text-xs font-bold text-white/55 transition-colors hover:border-white/20 hover:text-white/80"
                          >
                            {t('cart.removeFromCart', 'Remove from cart')}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </section>

                <section className="rounded-[32px] border border-white/10 bg-[#203e5f]/60 p-8 backdrop-blur-sm">
                  <div className="mb-6 flex items-center justify-between gap-4">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-[2px] text-white/35 mb-2">{t('cart.purchaseConditions', 'Purchase conditions')}</p>
                      <h3 className="text-2xl font-bold text-white">{t('cart.whatYouAgree', "What you\u2019re agreeing to")}</h3>
                    </div>
                    <div className="hidden md:flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-[11px] font-bold uppercase tracking-[2px] text-white/40">
                      {t('cart.beforeCheckout', 'Before checkout')}
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    {summaryLines.map((line) => (
                      <div key={line.label} className="rounded-2xl border border-white/8 bg-black/20 p-5">
                        <div className="mb-3 flex items-center gap-2">
                          <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: line.accent }} />
                          <p className="text-[11px] font-bold uppercase tracking-[2px] text-white/35">{line.label}</p>
                        </div>
                        <p className="text-sm leading-7 text-white/60">{line.value}</p>
                      </div>
                    ))}
                  </div>

                  <div className="mt-6 rounded-2xl border border-white/8 bg-black/20 p-5">
                    <p className="text-[11px] font-bold uppercase tracking-[2px] text-white/35 mb-3">
                      {isPl ? 'Operator płatności kartowych' : 'Card payment operator'}
                    </p>
                    <p className="text-xs text-white/50 leading-relaxed mb-3">
                      {isPl
                        ? 'Podmiotem świadczącym obsługę płatności online w zakresie płatności kartami jest Autopay S.A.'
                        : 'Card payments are handled online by Autopay S.A.'}
                    </p>
                    <div className="flex items-center gap-4">
                      <img
                        src="/paynow/banner-autopay-cards.png"
                        alt="Visa, Mastercard"
                        className="h-10 w-auto object-contain"
                      />
                      <img
                        src="/paynow/logo-autopay.webp"
                        alt="Autopay"
                        className="h-6 w-auto object-contain"
                      />
                    </div>
                  </div>
                </section>
              </div>

              <aside className="space-y-6">
                <div className="lg:sticky lg:top-24 space-y-6">
                  <div className="overflow-hidden rounded-[32px] border border-white/10 bg-[#203e5f]/70 backdrop-blur-sm">
                    <div className="h-px w-full bg-linear-to-r from-[#ffcc00] via-[#C96A4A] to-[#ffcc00]" />
                    <div className="p-6">
                      <div className="mb-6">
                        <p className="text-[11px] font-bold uppercase tracking-[2px] text-[#ffcc00] mb-2">{t('cart.orderSummary', 'Order summary')}</p>
                        <h3 className="text-2xl font-black text-white tracking-tight">{t('cart.readyToContinue', 'Ready to continue.')}</h3>
                        <p className="mt-2 text-sm leading-relaxed text-white/45">{helperNote}</p>
                      </div>

                      <div className="rounded-2xl border border-white/8 bg-black/20 p-5 mb-5 space-y-4">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="text-[11px] font-bold uppercase tracking-[2px] text-white/35 mb-1">{t('cart.product', 'Product')}</p>
                            <p className="text-sm font-medium text-white/85 leading-6">{cartItem.name}</p>
                          </div>
                          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-bold text-white/60">
                            x{cartItem.quantity}
                          </span>
                        </div>
                        <div className="flex items-center justify-between border-t border-white/8 pt-4">
                          <span className="text-sm text-white/50">{t('cart.total', 'Total')}</span>
                          <span className="text-2xl font-black text-[#ffcc00]">{effectiveCartPriceDisplay}</span>
                        </div>
                        <p className="text-[11px] text-white/35">{p.vatInfo}</p>
                      </div>

                      <img
                        src="/paynow/banner-payment-methods.png"
                        alt="Paynow, BLIK, Visa, Mastercard and Google Pay payment methods"
                        className="w-full h-auto rounded-xl border border-white/8 mb-3"
                      />
                      <div className="flex items-center gap-3 mb-1">
                        <img
                          src="/paynow/banner-autopay-cards.png"
                          alt="Visa, Mastercard"
                          className="h-8 w-auto object-contain"
                        />
                        <img
                          src="/paynow/logo-autopay.webp"
                          alt="Autopay"
                          className="h-5 w-auto object-contain"
                        />
                      </div>
                      <p className="text-[10px] text-white/30 mb-3">
                        {isPl
                          ? 'Płatności kartowe obsługuje Autopay S.A.'
                          : 'Card payments by Autopay S.A.'}
                      </p>
                      <Link
                        href={checkoutUrl}
                        className="mt-5 inline-flex w-full items-center justify-center rounded-2xl px-5 py-4 font-bold text-[#1a2634] transition-transform hover:scale-[1.01]"
                        style={{ background: 'linear-gradient(135deg, #ffcc00 0%, #C96A4A 100%)' }}
                      >
                        {primaryCtaLabel} →
                      </Link>

                      <button
                        type="button"
                        onClick={clearCart}
                        className="mt-3 inline-flex w-full items-center justify-center rounded-2xl border border-white/10 px-5 py-3 text-sm font-bold text-white/55 transition-colors hover:border-white/20 hover:text-white/80"
                      >
                        {t('cart.removeItem', 'Remove item')}
                      </button>
                    </div>
                  </div>

                  <div className="rounded-[32px] border border-white/10 bg-[#203e5f]/60 p-6 text-sm text-white/60 leading-7 backdrop-blur-sm">
                    <p className="mb-3 text-[11px] font-bold uppercase tracking-[2px] text-white/35">{t('cart.seller', 'Seller')}</p>
                    <p className="font-semibold text-white/85">{seller?.sellerName || companyName}</p>
                    {sellerAddress && <p>{sellerAddress}</p>}
                    <p>NIP: {seller?.sellerNip || '—'}{seller?.sellerRegon ? ` · REGON: ${seller.sellerRegon}` : ''}</p>
                    <p className="pt-2">{seller?.contactEmail || seller?.sellerEmail || 'support@bakery.vc'}</p>
                    {seller?.sellerPhone && <p>{seller.sellerPhone}</p>}
                  </div>
                </div>
              </aside>
            </div>
          )}
        </main>
      </div>

      <SiteFooter settings={settings} companyName={companyName} variant="full" />
    </div>
  )
}
