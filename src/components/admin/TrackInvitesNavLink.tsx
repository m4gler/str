'use client'

import React from 'react'
import Link from 'next/link'

export const TrackInvitesNavLink: React.FC = () => {
  return (
    <Link
      href="/admin/track-invites"
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
      onMouseEnter={(event) => {
        event.currentTarget.style.backgroundColor = 'var(--theme-elevation-100)'
        event.currentTarget.style.color = 'var(--theme-text)'
      }}
      onMouseLeave={(event) => {
        event.currentTarget.style.backgroundColor = 'transparent'
        event.currentTarget.style.color = 'var(--theme-elevation-800)'
      }}
    >
      <span style={{ fontSize: '13px', fontWeight: 800 }}>T</span>
      <span>Track Invites</span>
    </Link>
  )
}

export default TrackInvitesNavLink
