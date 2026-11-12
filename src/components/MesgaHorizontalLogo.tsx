import clsx from 'clsx'

type MesgaHorizontalLogoProps = {
  companyName?: string | null
  logoUrl?: string | null
  className?: string
  size?: 'header' | 'auth' | 'compact'
  showTagline?: boolean
}

const SIZE_CLASSES = {
  compact: {
    root: 'h-11 w-[220px]',
  },
  header: {
    root: 'h-16 w-[320px]',
  },
  auth: {
    root: 'h-20 w-[400px] max-w-full',
  },
} as const

export default function MesgaHorizontalLogo({
  companyName = 'MESGA',
  logoUrl,
  className,
  size = 'header',
  showTagline = true,
}: MesgaHorizontalLogoProps) {
  const label = companyName?.trim() || 'MESGA'
  const classes = SIZE_CLASSES[size]
  const imageUrl = logoUrl || '/assets/mesga-horizontal-logo.png'

  return (
    <span
      className={clsx('inline-flex min-w-0 shrink-0 items-center select-none', classes.root, className)}
      aria-label={`${label} logo`}
    >
      <img
        src={imageUrl}
        alt={showTagline ? `${label} - Make European Startups Great Again` : `${label} logo`}
        className="h-full w-full object-contain drop-shadow-[0_0_8px_rgba(36,148,187,0.25)]"
      />
    </span>
  )
}
