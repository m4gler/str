'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { createEcosystemItem, createIntroRequest, updateEcosystemItem } from '@/app/actions'

// --- Types ---

interface EcosystemItem {
    id: number
    itemType: string
    name: string
    description?: string | null
    url?: string | null
    notes?: string | null
    status: string
    priority: string
    eventDate?: string | null
    location?: { city?: string; country?: string; lat?: number; lng?: number } | null
}

interface IntroRequest {
    id: number
    targetName: string
    targetRole?: string | null
    targetOrganization?: string | null
    targetUrl?: string | null
    reason: string
    status: string
    assignedTo?: { email?: string } | null
    completedAt?: string | null
    declineReason?: string | null
    createdAt: string
}

interface EcosystemMapClientProps {
    user: any
    ecosystemItems: EcosystemItem[]
    introRequests: IntroRequest[]
}

// --- Config ---

const ITEM_TYPE_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string; bgClass: string }> = {
    online_group: {
        label: 'Online Groups',
        icon: <GlobeIcon />,
        color: '#ffcc00',
        bgClass: 'bg-[#ffcc00]/10 border-[#ffcc00]/30',
    },
    physical_place: {
        label: 'Physical Places',
        icon: <MapPinIcon />,
        color: '#2CB1A1',
        bgClass: 'bg-[#2CB1A1]/10 border-[#2CB1A1]/30',
    },
    event: {
        label: 'Events',
        icon: <CalendarIcon />,
        color: '#ffcc00',
        bgClass: 'bg-[#ffcc00]/10 border-[#ffcc00]/30',
    },
    angel_vc: {
        label: 'Angels / VCs',
        icon: <BanknotesIcon />,
        color: '#a855f7',
        bgClass: 'bg-[#a855f7]/10 border-[#a855f7]/30',
    },
    operator: {
        label: 'Operators',
        icon: <UserIcon />,
        color: '#ec4899',
        bgClass: 'bg-[#ec4899]/10 border-[#ec4899]/30',
    },
    signal_account: {
        label: 'Signal Accounts',
        icon: <SignalIcon />,
        color: '#C96A4A',
        bgClass: 'bg-[#C96A4A]/10 border-[#C96A4A]/30',
    },
}

const PRD_MINIMUMS: Record<string, number> = {
    physical_place: 10,
    event: 10,
    online_group: 3,
    signal_account: 20,
}

const STATUS_COLORS: Record<string, string> = {
    identified: 'bg-gray-500/20 text-gray-300',
    contacted: 'bg-blue-500/20 text-blue-300',
    engaged: 'bg-yellow-500/20 text-yellow-300',
    active: 'bg-green-500/20 text-green-300',
    archived: 'bg-gray-700/20 text-gray-500',
}

const INTRO_STATUS_COLORS: Record<string, string> = {
    requested: 'bg-blue-500/20 text-blue-300',
    in_progress: 'bg-yellow-500/20 text-yellow-300',
    completed: 'bg-green-500/20 text-green-300',
    declined: 'bg-red-500/20 text-red-300',
}

const PRIORITY_INDICATOR: Record<string, string> = {
    high: 'text-red-400',
    medium: 'text-yellow-400',
    low: 'text-gray-500',
}

// --- Icons ---

function GlobeIcon() {
    return (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 0 0 8.716-6.747M12 21a9.004 9.004 0 0 1-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 0 1 7.843 4.582M12 3a8.997 8.997 0 0 0-7.843 4.582m15.686 0A11.953 11.953 0 0 1 12 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0 1 21 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0 1 12 16.5a17.92 17.92 0 0 1-8.716-2.247m0 0A9 9 0 0 1 3 12c0-1.605.42-3.113 1.157-4.418" />
        </svg>
    )
}

function MapPinIcon() {
    return (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
        </svg>
    )
}

function CalendarIcon() {
    return (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
        </svg>
    )
}

function BanknotesIcon() {
    return (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm3 0h.008v.008H18V10.5Zm-12 0h.008v.008H6V10.5Z" />
        </svg>
    )
}

function UserIcon() {
    return (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
        </svg>
    )
}

function SignalIcon() {
    return (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="m3.75 13.5 10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75Z" />
        </svg>
    )
}

function PlusIcon() {
    return (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
    )
}

function XMarkIcon() {
    return (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
        </svg>
    )
}

function ArrowLeftIcon() {
    return (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
        </svg>
    )
}

// --- Component ---

export default function EcosystemMapClient({ user, ecosystemItems, introRequests }: EcosystemMapClientProps) {
    const [activeTab, setActiveTab] = useState<'map' | 'intros'>('map')
    const [showAddItemModal, setShowAddItemModal] = useState(false)
    const [showAddIntroModal, setShowAddIntroModal] = useState(false)
    const [editingItem, setEditingItem] = useState<EcosystemItem | null>(null)
    const [filterType, setFilterType] = useState<string | null>(null)

    // Group items by type
    const grouped = ecosystemItems.reduce<Record<string, EcosystemItem[]>>((acc, item) => {
        if (!acc[item.itemType]) acc[item.itemType] = []
        acc[item.itemType].push(item)
        return acc
    }, {})

    const typeCounts: Record<string, number> = {}
    for (const type of Object.keys(ITEM_TYPE_CONFIG)) {
        typeCounts[type] = grouped[type]?.length ?? 0
    }

    const filteredItems = filterType
        ? ecosystemItems.filter(i => i.itemType === filterType)
        : ecosystemItems

    return (
        <div className="min-h-screen bg-[#1a2634] text-white">
            {/* Header */}
            <div className="border-b border-white/10 bg-[#111]">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <Link href="/" className="text-white/60 hover:text-white transition-colors">
                                <ArrowLeftIcon />
                            </Link>
                            <div>
                                <h1 className="text-2xl font-bold">Ecosystem Map</h1>
                                <p className="text-sm text-white/50 mt-1">Build and track your local startup ecosystem</p>
                            </div>
                        </div>
                    </div>

                    {/* Tabs */}
                    <div className="flex gap-1 mt-6">
                        <button
                            onClick={() => setActiveTab('map')}
                            className={`px-4 py-2 rounded-t-lg text-sm font-medium transition-colors ${activeTab === 'map' ? 'bg-white/10 text-white' : 'text-white/50 hover:text-white/70'}`}
                        >
                            Ecosystem Map ({ecosystemItems.length})
                        </button>
                        <button
                            onClick={() => setActiveTab('intros')}
                            className={`px-4 py-2 rounded-t-lg text-sm font-medium transition-colors ${activeTab === 'intros' ? 'bg-white/10 text-white' : 'text-white/50 hover:text-white/70'}`}
                        >
                            Intro Requests ({introRequests.length})
                        </button>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {activeTab === 'map' ? (
                    <>
                        {/* Summary Bar */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
                            {Object.entries(ITEM_TYPE_CONFIG).map(([type, cfg]) => {
                                const count = typeCounts[type]
                                const min = PRD_MINIMUMS[type]
                                const met = min ? count >= min : true
                                return (
                                    <button
                                        key={type}
                                        onClick={() => setFilterType(filterType === type ? null : type)}
                                        className={`rounded-xl border p-3 transition-all ${filterType === type ? 'ring-2 ring-white/30' : ''} ${cfg.bgClass}`}
                                    >
                                        <div className="flex items-center gap-2 mb-1" style={{ color: cfg.color }}>
                                            {cfg.icon}
                                            <span className="text-xs font-medium truncate">{cfg.label}</span>
                                        </div>
                                        <div className="flex items-baseline gap-1">
                                            <span className="text-xl font-bold" style={{ color: cfg.color }}>{count}</span>
                                            {min != null && (
                                                <span className={`text-xs ${met ? 'text-green-400' : 'text-red-400'}`}>
                                                    / {min}
                                                </span>
                                            )}
                                        </div>
                                    </button>
                                )
                            })}
                        </div>

                        {/* Add Button */}
                        <div className="flex items-center justify-between gap-4 mb-6">
                            <p className="text-xs text-white/35">
                                Use <span className="text-white/60">Edit</span> on any card to update status, notes, or links.
                            </p>
                            <button
                                onClick={() => setShowAddItemModal(true)}
                                className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg text-sm font-medium transition-colors"
                            >
                                <PlusIcon />
                                Add Item
                            </button>
                        </div>

                        {/* Items Grid */}
                        {filteredItems.length === 0 ? (
                            <div className="text-center py-16 text-white/40">
                                <p className="text-lg">No ecosystem items yet</p>
                                <p className="text-sm mt-2">Start building your map by adding groups, places, events, and contacts.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {filteredItems.map(item => {
                                    const cfg = ITEM_TYPE_CONFIG[item.itemType]
                                    return (
                                        <div key={item.id} className={`rounded-xl border p-4 ${cfg?.bgClass ?? 'bg-white/5 border-white/10'}`}>
                                            <div className="flex items-start justify-between gap-2 mb-2">
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <span style={{ color: cfg?.color }}>{cfg?.icon}</span>
                                                    <h3 className="font-semibold text-sm truncate">{item.name}</h3>
                                                </div>
                                                <span className={`shrink-0 text-[10px] font-medium px-2 py-0.5 rounded-full ${PRIORITY_INDICATOR[item.priority] ?? ''} bg-white/5`}>
                                                    {item.priority}
                                                </span>
                                            </div>

                                            {item.description && (
                                                <p className="text-xs text-white/50 mb-3 line-clamp-2">{item.description}</p>
                                            )}

                                            <div className="flex items-center justify-between">
                                                <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[item.status] ?? 'bg-white/10 text-white/50'}`}>
                                                    {item.status.replace('_', ' ')}
                                                </span>
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => setEditingItem(item)}
                                                        className="rounded-md border border-white/10 px-2 py-1 text-[10px] font-medium text-white/55 hover:text-white hover:border-white/20 transition-colors"
                                                    >
                                                        Edit
                                                    </button>
                                                    {item.location?.city && (
                                                        <span className="text-[10px] text-white/30">{item.location.city}{item.location.country ? `, ${item.location.country}` : ''}</span>
                                                    )}
                                                    {item.url && (
                                                        <a
                                                            href={item.url}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="text-white/30 hover:text-white/60 transition-colors"
                                                            onClick={e => e.stopPropagation()}
                                                        >
                                                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                                                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                                                            </svg>
                                                        </a>
                                                    )}
                                                </div>
                                            </div>

                                            {item.itemType === 'event' && item.eventDate && (
                                                <div className="mt-2 text-[10px] text-white/30">
                                                    Event: {new Date(item.eventDate).toLocaleDateString()}
                                                </div>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </>
                ) : (
                    <>
                        {/* Intro Requests */}
                        <div className="flex justify-end mb-6">
                            <button
                                onClick={() => setShowAddIntroModal(true)}
                                className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg text-sm font-medium transition-colors"
                            >
                                <PlusIcon />
                                New Intro Request
                            </button>
                        </div>

                        {introRequests.length === 0 ? (
                            <div className="text-center py-16 text-white/40">
                                <p className="text-lg">No intro requests yet</p>
                                <p className="text-sm mt-2">Request introductions to people in the ecosystem through MESGA.</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {introRequests.map(req => (
                                    <div key={req.id} className="rounded-xl border border-white/10 bg-white/5 p-4">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <h3 className="font-semibold text-sm">{req.targetName}</h3>
                                                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${INTRO_STATUS_COLORS[req.status] ?? 'bg-white/10 text-white/50'}`}>
                                                        {req.status.replace('_', ' ')}
                                                    </span>
                                                </div>
                                                {(req.targetRole || req.targetOrganization) && (
                                                    <p className="text-xs text-white/40 mb-2">
                                                        {[req.targetRole, req.targetOrganization].filter(Boolean).join(' at ')}
                                                    </p>
                                                )}
                                                <p className="text-xs text-white/50 line-clamp-2">{req.reason}</p>
                                            </div>
                                            <div className="shrink-0 text-right">
                                                <span className="text-[10px] text-white/30">
                                                    {new Date(req.createdAt).toLocaleDateString()}
                                                </span>
                                                {req.targetUrl && (
                                                    <a
                                                        href={req.targetUrl}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="block mt-1 text-white/30 hover:text-white/60 transition-colors"
                                                    >
                                                        <svg className="w-3.5 h-3.5 ml-auto" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                                                        </svg>
                                                    </a>
                                                )}
                                            </div>
                                        </div>

                                        {req.status === 'completed' && req.completedAt && (
                                            <div className="mt-3 pt-2 border-t border-white/10 text-[10px] text-green-400/70">
                                                Completed on {new Date(req.completedAt).toLocaleDateString()}
                                            </div>
                                        )}
                                        {req.status === 'declined' && req.declineReason && (
                                            <div className="mt-3 pt-2 border-t border-white/10 text-[10px] text-red-400/70">
                                                Declined: {req.declineReason}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Add Ecosystem Item Modal */}
            {showAddItemModal && (
                <AddEcosystemItemModal onClose={() => setShowAddItemModal(false)} />
            )}

            {editingItem && (
                <AddEcosystemItemModal item={editingItem} onClose={() => setEditingItem(null)} />
            )}

            {/* Add Intro Request Modal */}
            {showAddIntroModal && (
                <AddIntroRequestModal onClose={() => setShowAddIntroModal(false)} />
            )}
        </div>
    )
}

// --- Add Ecosystem Item Modal ---

function AddEcosystemItemModal({ onClose, item }: { onClose: () => void; item?: EcosystemItem | null }) {
    const [isPending, startTransition] = useTransition()
    const [error, setError] = useState<string | null>(null)
    const [itemType, setItemType] = useState(item?.itemType ?? 'online_group')
    const isEditing = Boolean(item)

    function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault()
        setError(null)
        const form = e.currentTarget
        const fd = new FormData(form)

        const data = {
            itemType: fd.get('itemType') as string,
            name: fd.get('name') as string,
            description: (fd.get('description') as string) || undefined,
            url: (fd.get('url') as string) || undefined,
            notes: (fd.get('notes') as string) || undefined,
            status: fd.get('status') as string,
            priority: fd.get('priority') as string,
            eventDate: (fd.get('eventDate') as string) || undefined,
            city: (fd.get('city') as string) || undefined,
            country: (fd.get('country') as string) || undefined,
        }

        if (!data.name.trim()) {
            setError('Name is required.')
            return
        }

        startTransition(async () => {
            const result = item
                ? await updateEcosystemItem(item.id, data)
                : await createEcosystemItem(data)
            if (result?.error) {
                const prefix = isEditing ? 'Failed to update' : 'Failed to create'
                setError(`${prefix}: ${result.error}`)
            } else {
                onClose()
            }
        })
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="fixed inset-0 bg-black/70" />
            <div
                className="relative bg-[#203e5f] border border-white/10 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
                onClick={e => e.stopPropagation()}
            >
                <div className="flex items-center justify-between p-5 border-b border-white/10">
                    <h2 className="text-lg font-semibold">{isEditing ? 'Edit Ecosystem Item' : 'Add Ecosystem Item'}</h2>
                    <button onClick={onClose} className="text-white/40 hover:text-white transition-colors">
                        <XMarkIcon />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-5 space-y-4">
                    {error && (
                        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-sm">
                            {error}
                        </div>
                    )}

                    <div>
                        <label className="block text-xs text-white/50 mb-1.5">Type *</label>
                        <select
                            name="itemType"
                            value={itemType}
                            onChange={e => setItemType(e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-white/30"
                        >
                            <option value="online_group">Online Group</option>
                            <option value="physical_place">Physical Place / Coworking</option>
                            <option value="event">Upcoming Event</option>
                            <option value="angel_vc">Angel / VC / Fund</option>
                            <option value="operator">Operator / Mentor</option>
                            <option value="signal_account">Signal Account (Twitter/LinkedIn)</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-xs text-white/50 mb-1.5">Name *</label>
                        <input
                            name="name"
                            type="text"
                            required
                            defaultValue={item?.name || ''}
                            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 focus:outline-none focus:ring-1 focus:ring-white/30"
                            placeholder="e.g. TechCrunch Disrupt"
                        />
                    </div>

                    <div>
                        <label className="block text-xs text-white/50 mb-1.5">Description</label>
                        <textarea
                            name="description"
                            rows={2}
                            defaultValue={item?.description || ''}
                            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 focus:outline-none focus:ring-1 focus:ring-white/30 resize-none"
                            placeholder="Brief description or relevance..."
                        />
                    </div>

                    <div>
                        <label className="block text-xs text-white/50 mb-1.5">URL</label>
                        <input
                            name="url"
                            type="text"
                            defaultValue={item?.url || ''}
                            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 focus:outline-none focus:ring-1 focus:ring-white/30"
                            placeholder="https://..."
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs text-white/50 mb-1.5">Status</label>
                            <select
                                name="status"
                                defaultValue={item?.status || 'identified'}
                                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-white/30"
                            >
                                <option value="identified">Identified</option>
                                <option value="contacted">Contacted</option>
                                <option value="engaged">Engaged</option>
                                <option value="active">Active</option>
                                <option value="archived">Archived</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs text-white/50 mb-1.5">Priority</label>
                            <select
                                name="priority"
                                defaultValue={item?.priority || 'medium'}
                                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-white/30"
                            >
                                <option value="high">High</option>
                                <option value="medium">Medium</option>
                                <option value="low">Low</option>
                            </select>
                        </div>
                    </div>

                    {itemType === 'event' && (
                        <div>
                            <label className="block text-xs text-white/50 mb-1.5">Event Date</label>
                            <input
                                name="eventDate"
                                type="date"
                                defaultValue={item?.eventDate ? item.eventDate.slice(0, 10) : ''}
                                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-white/30"
                            />
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs text-white/50 mb-1.5">City</label>
                            <input
                                name="city"
                                type="text"
                                defaultValue={item?.location?.city || ''}
                                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 focus:outline-none focus:ring-1 focus:ring-white/30"
                                placeholder="e.g. Warsaw"
                            />
                        </div>
                        <div>
                            <label className="block text-xs text-white/50 mb-1.5">Country</label>
                            <input
                                name="country"
                                type="text"
                                defaultValue={item?.location?.country || ''}
                                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 focus:outline-none focus:ring-1 focus:ring-white/30"
                                placeholder="e.g. Poland"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs text-white/50 mb-1.5">Notes</label>
                        <textarea
                            name="notes"
                            rows={2}
                            defaultValue={item?.notes || ''}
                            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 focus:outline-none focus:ring-1 focus:ring-white/30 resize-none"
                            placeholder="Follow-up notes, contact info..."
                        />
                    </div>

                    <div className="flex justify-end gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-sm text-white/50 hover:text-white transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isPending}
                            className="px-5 py-2 bg-white text-black rounded-lg text-sm font-medium hover:bg-white/90 disabled:opacity-50 transition-colors"
                        >
                            {isPending ? (isEditing ? 'Saving...' : 'Adding...') : (isEditing ? 'Save Changes' : 'Add Item')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}

// --- Add Intro Request Modal ---

function AddIntroRequestModal({ onClose }: { onClose: () => void }) {
    const [isPending, startTransition] = useTransition()
    const [error, setError] = useState<string | null>(null)

    function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault()
        setError(null)
        const form = e.currentTarget
        const fd = new FormData(form)

        const data = {
            targetName: fd.get('targetName') as string,
            targetRole: (fd.get('targetRole') as string) || undefined,
            targetOrganization: (fd.get('targetOrganization') as string) || undefined,
            targetUrl: (fd.get('targetUrl') as string) || undefined,
            reason: fd.get('reason') as string,
        }

        if (!data.targetName.trim() || !data.reason.trim()) {
            setError('Name and reason are required.')
            return
        }

        startTransition(async () => {
            const result = await createIntroRequest(data)
            if (result?.error) {
                setError(result.error)
            } else {
                onClose()
            }
        })
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="fixed inset-0 bg-black/70" />
            <div
                className="relative bg-[#203e5f] border border-white/10 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
                onClick={e => e.stopPropagation()}
            >
                <div className="flex items-center justify-between p-5 border-b border-white/10">
                    <h2 className="text-lg font-semibold">New Intro Request</h2>
                    <button onClick={onClose} className="text-white/40 hover:text-white transition-colors">
                        <XMarkIcon />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-5 space-y-4">
                    {error && (
                        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-sm">
                            {error}
                        </div>
                    )}

                    <div>
                        <label className="block text-xs text-white/50 mb-1.5">Who do you want an intro to? *</label>
                        <input
                            name="targetName"
                            type="text"
                            required
                            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 focus:outline-none focus:ring-1 focus:ring-white/30"
                            placeholder="Full name"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs text-white/50 mb-1.5">Their Role</label>
                            <input
                                name="targetRole"
                                type="text"
                                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 focus:outline-none focus:ring-1 focus:ring-white/30"
                                placeholder="e.g. Partner"
                            />
                        </div>
                        <div>
                            <label className="block text-xs text-white/50 mb-1.5">Organization</label>
                            <input
                                name="targetOrganization"
                                type="text"
                                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 focus:outline-none focus:ring-1 focus:ring-white/30"
                                placeholder="e.g. Sequoia Capital"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs text-white/50 mb-1.5">Profile URL</label>
                        <input
                            name="targetUrl"
                            type="text"
                            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 focus:outline-none focus:ring-1 focus:ring-white/30"
                            placeholder="https://linkedin.com/in/..."
                        />
                    </div>

                    <div>
                        <label className="block text-xs text-white/50 mb-1.5">Why do you want this intro? *</label>
                        <textarea
                            name="reason"
                            rows={3}
                            required
                            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 focus:outline-none focus:ring-1 focus:ring-white/30 resize-none"
                            placeholder="What do you hope to achieve from this introduction?"
                        />
                    </div>

                    <div className="flex justify-end gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-sm text-white/50 hover:text-white transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isPending}
                            className="px-5 py-2 bg-white text-black rounded-lg text-sm font-medium hover:bg-white/90 disabled:opacity-50 transition-colors"
                        >
                            {isPending ? 'Requesting...' : 'Request Intro'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
