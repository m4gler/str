'use client'

import React from 'react'
import Link from 'next/link'

export const CertificatesNavLink: React.FC = () => {
  return (
    <Link
      href="/admin/certificates"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '10px 16px',
        color: 'var(--theme-elevation-800)',
        textDecoration: 'none',
        fontSize: '13px',
        fontWeight: 500,
        borderRadius: '4px',
        transition: 'all 0.15s ease',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = 'var(--theme-elevation-100)'
        e.currentTarget.style.color = 'var(--theme-text)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = 'transparent'
        e.currentTarget.style.color = 'var(--theme-elevation-800)'
      }}
    >
      <span style={{ fontSize: '13px', fontWeight: 800 }}>C</span>
      <span>Certificates</span>
    </Link>
  )
}

export default CertificatesNavLink
