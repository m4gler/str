'use client'

import { DefaultEditView, useDocumentInfo } from '@payloadcms/ui'
import type { DocumentViewClientProps } from 'payload'
import React, { useEffect, useMemo, useState } from 'react'

type MentorDoc = {
  id: number | string
  title?: string | null
  linkUrl?: string | null
  isActive?: boolean | null
  profileImage?: {
    url?: string | null
    alt?: string | null
  } | number | string | null
  user?: {
    id?: number | string
    email?: string | null
  } | number | string | null
  partner?: {
    id?: number | string
    name?: string | null
  } | number | string | null
}

function initialsFor(name: string): string {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'M'
}

function getProfileImageUrl(mentor: MentorDoc | null): string | null {
  const image = mentor?.profileImage && typeof mentor.profileImage === 'object' ? mentor.profileImage : null
  return image?.url || null
}

function getPartnerName(mentor: MentorDoc | null): string | null {
  const partner = mentor?.partner && typeof mentor.partner === 'object' ? mentor.partner : null
  return partner?.name || null
}

function MentorLandingPreview({ mentor }: { mentor: MentorDoc | null }) {
  const name = mentor?.title?.trim() || 'Mentor name'
  const avatarUrl = getProfileImageUrl(mentor)
  const partnerName = getPartnerName(mentor)
  const linkUrl = mentor?.linkUrl?.trim() || ''

  return (
    <div style={{
      marginBottom: 20,
      border: '1px solid var(--theme-border-color)',
      borderRadius: 12,
      background: 'var(--theme-bg)',
      overflow: 'hidden',
    }}>
      <div style={{
        padding: '16px 20px',
        borderBottom: '1px solid var(--theme-border-color)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
      }}>
        <div>
          <h2 style={{ margin: 0, color: 'var(--theme-text)', fontSize: 18, fontWeight: 800 }}>Landing mentor preview</h2>
          <p style={{ margin: '4px 0 0', color: 'var(--theme-elevation-650)', fontSize: 13 }}>
            Uses this mentor profile image, name, and optional click URL.
          </p>
        </div>
        <span style={{
          border: `1px solid ${mentor?.isActive === false ? 'var(--theme-border-color)' : '#10b98166'}`,
          borderRadius: 999,
          color: mentor?.isActive === false ? 'var(--theme-elevation-550)' : '#10b981',
          background: mentor?.isActive === false ? 'var(--theme-elevation-50)' : '#10b98118',
          fontSize: 11,
          fontWeight: 800,
          padding: '6px 10px',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
        }}>
          {mentor?.isActive === false ? 'Hidden' : 'Visible'}
        </span>
      </div>

      <div style={{
        padding: 20,
        display: 'grid',
        gridTemplateColumns: 'minmax(260px, 360px) minmax(0, 1fr)',
        gap: 18,
        alignItems: 'stretch',
      }}>
        <div style={{
          border: '1px solid rgba(255,255,255,0.10)',
          borderRadius: 16,
          background: 'linear-gradient(180deg, #1a1a1c, #121214)',
          color: 'white',
          padding: '34px 28px',
          textAlign: 'center',
          boxShadow: '0 24px 60px -48px rgba(0,0,0,0.9)',
        }}>
          <div style={{
            width: 88,
            height: 88,
            margin: '0 auto 18px',
            borderRadius: '50%',
            overflow: 'hidden',
            border: '1px solid rgba(255,255,255,0.12)',
            background: '#1a1a1c',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 18px 50px -28px rgba(0,0,0,0.95)',
          }}>
            {avatarUrl ? (
              <img src={avatarUrl} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            ) : (
              <span style={{ color: '#ffcc00', fontSize: 22, fontWeight: 800 }}>{initialsFor(name)}</span>
            )}
          </div>
          <div style={{ color: 'white', fontSize: 17, fontWeight: 800, lineHeight: 1.25 }}>{name}</div>
          {linkUrl && (
            <div style={{ marginTop: 10, color: '#ffcc00', fontSize: 11, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
              Clickable card
            </div>
          )}
        </div>

        <div style={{
          border: '1px solid var(--theme-border-color)',
          borderRadius: 12,
          background: 'var(--theme-elevation-50)',
          padding: 16,
          color: 'var(--theme-elevation-700)',
          fontSize: 13,
          lineHeight: 1.6,
        }}>
          <strong style={{ display: 'block', color: 'var(--theme-text)', marginBottom: 8 }}>Photo source</strong>
          <p style={{ margin: 0 }}>
            Set the photo directly on this mentor in <strong>Profile Image</strong>. Set <strong>Link URL</strong> if the landing card should open a profile page or external page.
          </p>
          <p style={{ margin: '10px 0 0' }}>
            {linkUrl ? `Click URL: ${linkUrl}` : 'No link set. The landing card will not navigate.'}
          </p>
          <p style={{ margin: '10px 0 0' }}>
            {partnerName ? `Partner: ${partnerName}` : 'No partner assigned. This mentor can be used as a global mentor profile.'}
          </p>
        </div>
      </div>
    </div>
  )
}

export default function MentorEditor(props: DocumentViewClientProps) {
  const { id } = useDocumentInfo()
  const [mentor, setMentor] = useState<MentorDoc | null>(null)

  useEffect(() => {
    if (!id) {
      return
    }

    let cancelled = false
    fetch(`/api/mentors/${id}?depth=2`, { credentials: 'include' })
      .then((res) => res.ok ? res.json() : null)
      .then((doc) => {
        if (!cancelled) setMentor(doc)
      })
      .catch(() => {
        if (!cancelled) setMentor(null)
      })

    return () => {
      cancelled = true
    }
  }, [id])

  const preview = useMemo(() => <MentorLandingPreview mentor={mentor} />, [mentor])

  return (
    <>
      {preview}
      <DefaultEditView {...props} />
    </>
  )
}
