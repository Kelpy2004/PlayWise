import { useEffect, useState, type CSSProperties, type FormEvent } from 'react'
import { useAuth } from '../context/AuthContext'
import { api } from '../lib/api'
import type { DealRecord, DealType } from '../types/api'
import Seo from '../components/Seo'

const STORES = ['Steam', 'Epic Games Store', 'Ubisoft Store', 'Xbox', 'NVIDIA', 'EA']
const TYPES: { value: DealType; label: string }[] = [
  { value: 'FREE_GAME', label: 'Free Game' },
  { value: 'DISCOUNT', label: 'Discount' },
  { value: 'MISSION_FREE', label: 'Mission Free' },
]

const STORE_COLORS: Record<string, string> = {
  'Epic Games Store': '#0078f2',
  Steam: '#66c0f4',
  'Ubisoft Store': '#4da6ff',
  Xbox: '#5dc21e',
  NVIDIA: '#76b900',
  EA: '#f5a623',
}

const EMPTY_FORM = {
  title: '',
  type: 'DISCOUNT' as DealType,
  store: 'Steam',
  originalPrice: '',
  dealPrice: '',
  discountPct: '',
  currency: 'USD',
  url: '',
  imageUrl: '',
  startsAt: '',
  endsAt: '',
  gameSlug: '',
}

// ---- shared .pw styles ------------------------------------------------------
const card: CSSProperties = { background: 'var(--card,#1a1630)', border: '2.5px solid var(--bd,#f6f4ff)' }
const field: CSSProperties = { width: '100%', background: 'var(--bg,#0b0a12)', border: '2px solid var(--line2,#3a3460)', borderRadius: 10, padding: '9px 12px', color: 'var(--tx,#f6f4ff)', font: 'inherit', fontSize: 14, outline: 'none' }
const labelStyle: CSSProperties = { display: 'block', fontFamily: 'var(--fm)', fontSize: 10.5, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--tx3,#736c92)', marginBottom: 6 }
const th: CSSProperties = { fontFamily: 'var(--fm)', fontSize: 10.5, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--tx3,#736c92)', padding: '13px 16px', textAlign: 'left', whiteSpace: 'nowrap' }
const td: CSSProperties = { padding: '12px 16px', fontSize: 13.5, color: 'var(--tx,#f6f4ff)', borderTop: '2px solid var(--line)' }
const btnPrimary: CSSProperties = { fontFamily: 'var(--fd)', fontSize: 13.5, fontWeight: 700, color: '#0b0a12', background: 'var(--cyan)', border: '2px solid var(--bd,#f6f4ff)', borderRadius: 11, padding: '9px 17px', cursor: 'pointer', boxShadow: '3px 3px 0 var(--hard)', transition: 'transform .1s,box-shadow .1s' }
const btnSecondary: CSSProperties = { fontFamily: 'var(--ff)', fontSize: 13.5, fontWeight: 700, color: 'var(--tx,#f6f4ff)', background: 'var(--card,#1a1630)', border: '2px solid var(--bd,#f6f4ff)', borderRadius: 11, padding: '9px 15px', cursor: 'pointer', boxShadow: '2px 2px 0 var(--hard)', transition: 'transform .1s,box-shadow .1s' }
const btnDanger: CSSProperties = { fontFamily: 'var(--ff)', fontSize: 13.5, fontWeight: 700, color: 'var(--pink)', background: 'transparent', border: '2px solid var(--pink)', borderRadius: 11, padding: '9px 15px', cursor: 'pointer', transition: 'transform .1s,box-shadow .1s' }

function formatPrice(amount?: number | null) {
  if (amount == null) return '—'
  if (amount === 0) return 'FREE'
  return `$${amount.toFixed(2)}`
}

export default function AdminDealsPage() {
  const { token } = useAuth()
  const [deals, setDeals] = useState<DealRecord[]>([])
  const [pagination, setPagination] = useState({ page: 1, limit: 25, total: 0, totalPages: 1 })
  const [filterStore, setFilterStore] = useState('')
  const [filterType, setFilterType] = useState('')
  const [filterSource, setFilterSource] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [purging, setPurging] = useState(false)
  const [feedback, setFeedback] = useState({ tone: '', message: '' })
  const [showForm, setShowForm] = useState(false)
  const [editingDeal, setEditingDeal] = useState<DealRecord | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    void loadDeals(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterStore, filterType, filterSource])

  async function loadDeals(page: number) {
    if (!token) return
    setLoading(true)
    try {
      const result = await api.fetchAdminDeals({
        page,
        limit: 25,
        store: filterStore || undefined,
        type: filterType || undefined,
        source: filterSource || undefined,
        q: searchQuery || undefined,
      }, token)
      setDeals(result.deals)
      setPagination(result.pagination)
    } catch (error) {
      setFeedback({ tone: 'danger', message: error instanceof Error ? error.message : 'Failed to load deals' })
    } finally {
      setLoading(false)
    }
  }

  async function handleRefresh() {
    if (!token) return
    setRefreshing(true)
    setFeedback({ tone: '', message: '' })
    try {
      const result = await api.refreshDeals(token)
      setFeedback({ tone: 'success', message: `${result.message} — ${result.count} total deals` })
      void loadDeals(1)
    } catch (error) {
      setFeedback({ tone: 'danger', message: error instanceof Error ? error.message : 'Refresh failed' })
    } finally {
      setRefreshing(false)
    }
  }

  async function handlePurgeOldSources() {
    if (!token) return
    if (!window.confirm('Delete all deals from retired sources (CheapShark, ITAD, GamerPower, Reddit)? This cannot be undone.')) return
    setPurging(true)
    setFeedback({ tone: '', message: '' })
    try {
      const result = await api.purgeOldSourceDeals(token)
      setFeedback({ tone: 'success', message: `Purged ${result.deleted} deals from old sources (${result.sources.join(', ')})` })
      void loadDeals(1)
    } catch (error) {
      setFeedback({ tone: 'danger', message: error instanceof Error ? error.message : 'Purge failed' })
    } finally {
      setPurging(false)
    }
  }

  function handleSearch(e: FormEvent) {
    e.preventDefault()
    void loadDeals(1)
  }

  function openCreateForm() {
    setEditingDeal(null)
    setForm(EMPTY_FORM)
    setShowForm(true)
  }

  function openEditForm(deal: DealRecord) {
    setEditingDeal(deal)
    setForm({
      title: deal.title || '',
      type: deal.type,
      store: deal.store || 'Steam',
      originalPrice: deal.originalPrice != null ? String(deal.originalPrice) : '',
      dealPrice: deal.dealPrice != null ? String(deal.dealPrice) : '',
      discountPct: deal.discountPct != null ? String(deal.discountPct) : '',
      currency: deal.currency || 'USD',
      url: deal.url || '',
      imageUrl: deal.imageUrl || '',
      startsAt: deal.startsAt ? deal.startsAt.slice(0, 16) : '',
      endsAt: deal.endsAt ? deal.endsAt.slice(0, 16) : '',
      gameSlug: deal.gameSlug || '',
    })
    setShowForm(true)
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault()
    if (!token) return
    setSaving(true)
    setFeedback({ tone: '', message: '' })

    const body: Record<string, unknown> = {
      title: form.title,
      type: form.type,
      store: form.store,
      originalPrice: form.originalPrice ? parseFloat(form.originalPrice) : null,
      dealPrice: form.dealPrice ? parseFloat(form.dealPrice) : 0,
      discountPct: form.discountPct ? parseInt(form.discountPct) : (form.type === 'FREE_GAME' ? 100 : 0),
      currency: form.currency || 'USD',
      url: form.url,
      imageUrl: form.imageUrl || null,
      startsAt: form.startsAt || null,
      endsAt: form.endsAt || null,
      gameSlug: form.gameSlug || undefined,
    }

    try {
      if (editingDeal) {
        await api.updateAdminDeal(editingDeal.id, body, token)
        setFeedback({ tone: 'success', message: `Updated "${form.title}"` })
      } else {
        await api.createAdminDeal(body, token)
        setFeedback({ tone: 'success', message: `Created "${form.title}"` })
      }
      setShowForm(false)
      setEditingDeal(null)
      setForm(EMPTY_FORM)
      void loadDeals(pagination.page)
    } catch (error) {
      setFeedback({ tone: 'danger', message: error instanceof Error ? error.message : 'Save failed' })
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(deal: DealRecord) {
    if (!token) return
    if (!window.confirm(`Delete "${deal.title}"? This cannot be undone.`)) return
    try {
      await api.deleteAdminDeal(deal.id, token)
      setFeedback({ tone: 'success', message: `Deleted "${deal.title}"` })
      void loadDeals(pagination.page)
    } catch (error) {
      setFeedback({ tone: 'danger', message: error instanceof Error ? error.message : 'Delete failed' })
    }
  }

  async function handleToggleActive(deal: DealRecord) {
    if (!token) return
    try {
      await api.updateAdminDeal(deal.id, { isActive: !deal.isActive } as unknown as Partial<DealRecord>, token)
      void loadDeals(pagination.page)
    } catch (error) {
      setFeedback({ tone: 'danger', message: error instanceof Error ? error.message : 'Toggle failed' })
    }
  }

  const feedbackColor = feedback.tone === 'success' ? 'var(--lime)' : 'var(--pink)'

  return (
    <div style={{ maxWidth: 1320, margin: '0 auto', padding: '40px 26px 20px' }}>
      <Seo title="Admin — Deal Management" />

      {/* Header */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: 18, marginBottom: 22 }}>
        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontFamily: 'var(--fm)', fontSize: 12, fontWeight: 700, letterSpacing: '.14em', color: 'var(--cyan)' }}>
            <span style={{ width: 18, height: 2, background: 'var(--cyan)' }} />ADMIN PANEL
          </div>
          <h1 style={{ fontFamily: 'var(--fd)', fontSize: 'clamp(28px,4vw,44px)', fontWeight: 800, letterSpacing: '-.03em', margin: '12px 0 0', lineHeight: 1 }}>Deal Management</h1>
          <p style={{ fontSize: 14.5, color: 'var(--tx2,#aaa3c6)', marginTop: 10, maxWidth: '58ch', lineHeight: 1.5 }}>
            Add, edit, and delete deals across all stores. Auto-fetch live prices from Steam, Epic, and Xbox.
          </p>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          <button className="press" onClick={handlePurgeOldSources} disabled={purging} style={{ ...btnDanger, opacity: purging ? 0.6 : 1 }}>{purging ? 'Purging…' : 'Purge Old Sources'}</button>
          <button className="press" onClick={handleRefresh} disabled={refreshing} style={{ ...btnSecondary, opacity: refreshing ? 0.6 : 1 }}>{refreshing ? 'Fetching…' : 'Refresh from APIs'}</button>
          <button className="press" onClick={openCreateForm} style={btnPrimary}>+ Add Deal</button>
        </div>
      </div>

      {/* Feedback */}
      {feedback.message && (
        <div style={{ marginBottom: 18, background: 'var(--bg,#0b0a12)', border: `2px solid ${feedbackColor}`, borderRadius: 12, padding: '11px 15px', fontSize: 13.5, fontWeight: 600, color: feedbackColor }}>{feedback.message}</div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10, marginBottom: 18 }}>
        <form onSubmit={handleSearch} style={{ display: 'flex', gap: 8 }}>
          <input type="text" placeholder="Search deals…" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} style={{ ...field, width: 220 }} />
          <button type="submit" className="press" style={btnSecondary}>Search</button>
        </form>
        <select value={filterStore} onChange={(e) => setFilterStore(e.target.value)} style={{ ...field, width: 'auto', cursor: 'pointer' }}>
          <option value="">All Stores</option>
          {STORES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={filterType} onChange={(e) => setFilterType(e.target.value)} style={{ ...field, width: 'auto', cursor: 'pointer' }}>
          <option value="">All Types</option>
          {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <select value={filterSource} onChange={(e) => setFilterSource(e.target.value)} style={{ ...field, width: 'auto', cursor: 'pointer' }}>
          <option value="">All Sources</option>
          <option value="admin">Admin (manual)</option>
          <option value="steam">Steam API</option>
          <option value="epic">Epic API</option>
          <option value="xbox">Xbox API</option>
        </select>
        <span style={{ marginLeft: 'auto', fontFamily: 'var(--fm)', fontSize: 12.5, fontWeight: 600, color: 'var(--tx2,#aaa3c6)' }}><span style={{ color: 'var(--lime)', fontWeight: 700 }}>{pagination.total}</span> deals</span>
      </div>

      {/* Create/Edit Form */}
      {showForm && (
        <div style={{ marginBottom: 24, ...card, borderRadius: 18, boxShadow: '7px 7px 0 var(--hard)', padding: '20px 22px 22px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
            <h2 style={{ fontFamily: 'var(--fd)', fontSize: 19, fontWeight: 800, letterSpacing: '-.02em', margin: 0 }}>{editingDeal ? 'Edit Deal' : 'Add New Deal'}</h2>
            <button onClick={() => setShowForm(false)} className="press" aria-label="Close" style={{ width: 36, height: 36, display: 'grid', placeItems: 'center', background: 'var(--bg,#0b0a12)', border: '2px solid var(--bd,#f6f4ff)', borderRadius: 10, cursor: 'pointer', color: 'var(--tx,#f6f4ff)', boxShadow: '2px 2px 0 var(--hard)' }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>
            </button>
          </div>
          <form onSubmit={handleSave} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 16 }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Title *</label>
              <input required value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} style={field} />
            </div>
            <div>
              <label style={labelStyle}>Store *</label>
              <select value={form.store} onChange={(e) => setForm((f) => ({ ...f, store: e.target.value }))} style={{ ...field, cursor: 'pointer' }}>
                {STORES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Type *</label>
              <select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as DealType }))} style={{ ...field, cursor: 'pointer' }}>
                {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Original Price</label>
              <input type="number" step="0.01" value={form.originalPrice} onChange={(e) => setForm((f) => ({ ...f, originalPrice: e.target.value }))} style={field} placeholder="59.99" />
            </div>
            <div>
              <label style={labelStyle}>Deal Price</label>
              <input type="number" step="0.01" value={form.dealPrice} onChange={(e) => setForm((f) => ({ ...f, dealPrice: e.target.value }))} style={field} placeholder="0.00" />
            </div>
            <div>
              <label style={labelStyle}>Discount %</label>
              <input type="number" value={form.discountPct} onChange={(e) => setForm((f) => ({ ...f, discountPct: e.target.value }))} style={field} placeholder="100" />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Store URL</label>
              <input value={form.url} onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))} style={field} placeholder="https://store.steampowered.com/app/..." />
            </div>
            <div>
              <label style={labelStyle}>Image URL</label>
              <input value={form.imageUrl} onChange={(e) => setForm((f) => ({ ...f, imageUrl: e.target.value }))} style={field} placeholder="https://..." />
            </div>
            <div>
              <label style={labelStyle}>Starts At</label>
              <input type="datetime-local" value={form.startsAt} onChange={(e) => setForm((f) => ({ ...f, startsAt: e.target.value }))} style={field} />
            </div>
            <div>
              <label style={labelStyle}>Ends At</label>
              <input type="datetime-local" value={form.endsAt} onChange={(e) => setForm((f) => ({ ...f, endsAt: e.target.value }))} style={field} />
            </div>
            <div>
              <label style={labelStyle}>Game Slug</label>
              <input value={form.gameSlug} onChange={(e) => setForm((f) => ({ ...f, gameSlug: e.target.value }))} style={field} placeholder="auto-generated from title" />
            </div>
            <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 12, marginTop: 4 }}>
              <button type="submit" disabled={saving} className="press" style={{ ...btnPrimary, padding: '10px 22px', opacity: saving ? 0.6 : 1 }}>{saving ? 'Saving…' : (editingDeal ? 'Update Deal' : 'Create Deal')}</button>
              <button type="button" onClick={() => setShowForm(false)} className="press" style={btnSecondary}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* Deals Table */}
      <div style={{ ...card, borderRadius: 18, boxShadow: '6px 6px 0 var(--hard)', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ display: 'grid', placeItems: 'center', padding: '64px 20px', color: 'var(--tx2,#aaa3c6)', fontFamily: 'var(--fm)', fontSize: 13.5 }}>Loading deals…</div>
        ) : deals.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '64px 20px', color: 'var(--tx2,#aaa3c6)', fontSize: 14 }}>
            <p style={{ margin: 0 }}>No deals found.</p>
            <button onClick={openCreateForm} style={{ fontFamily: 'var(--ff)', fontSize: 13.5, fontWeight: 700, color: 'var(--cyan)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 3 }}>Add your first deal</button>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--panel,#120f1f)' }}>
                  <th style={th}>Game</th>
                  <th style={th}>Store</th>
                  <th style={th}>Type</th>
                  <th style={{ ...th, textAlign: 'right' }}>Price</th>
                  <th style={{ ...th, textAlign: 'right' }}>Discount</th>
                  <th style={th}>Source</th>
                  <th style={th}>Status</th>
                  <th style={{ ...th, textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {deals.map((deal) => (
                  <tr key={deal.id} className="adminrow">
                    <td style={td}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                        {deal.imageUrl ? (
                          <img src={deal.imageUrl} alt="" style={{ width: 54, height: 32, borderRadius: 7, objectFit: 'cover', border: '2px solid var(--line2,#3a3460)', flexShrink: 0 }} />
                        ) : (
                          <div style={{ width: 54, height: 32, borderRadius: 7, display: 'grid', placeItems: 'center', background: 'var(--bg,#0b0a12)', border: '2px solid var(--line2,#3a3460)', fontFamily: 'var(--fd)', fontWeight: 800, fontSize: 14, color: 'var(--tx3,#736c92)', flexShrink: 0 }}>{deal.title.charAt(0)}</div>
                        )}
                        <span style={{ fontWeight: 700, maxWidth: 210, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={deal.title}>{deal.title}</span>
                      </div>
                    </td>
                    <td style={td}>
                      <span style={{ display: 'inline-block', fontFamily: 'var(--fm)', fontSize: 11, fontWeight: 700, color: '#0b0a12', background: STORE_COLORS[deal.store] || 'var(--tx3,#736c92)', border: '2px solid var(--bd,#f6f4ff)', borderRadius: 7, padding: '2px 8px' }}>{deal.store}</span>
                    </td>
                    <td style={{ ...td, color: 'var(--tx2,#aaa3c6)' }}>{deal.type === 'FREE_GAME' ? 'Free' : deal.type === 'DISCOUNT' ? 'Discount' : 'Mission'}</td>
                    <td style={{ ...td, textAlign: 'right' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                        {deal.originalPrice != null && deal.originalPrice !== deal.dealPrice && (
                          <span style={{ fontFamily: 'var(--fm)', fontSize: 11, color: 'var(--tx3,#736c92)', textDecoration: 'line-through' }}>{formatPrice(deal.originalPrice)}</span>
                        )}
                        <span style={{ fontFamily: 'var(--fm)', fontWeight: 700, color: deal.dealPrice === 0 ? 'var(--cyan)' : 'var(--tx,#f6f4ff)' }}>{formatPrice(deal.dealPrice)}</span>
                      </div>
                    </td>
                    <td style={{ ...td, textAlign: 'right' }}>
                      {deal.discountPct != null && deal.discountPct > 0 ? (
                        <span style={{ fontFamily: 'var(--fm)', fontWeight: 700, color: 'var(--lime)' }}>−{deal.discountPct}%</span>
                      ) : <span style={{ color: 'var(--tx3,#736c92)' }}>—</span>}
                    </td>
                    <td style={td}>
                      <span style={{ fontFamily: 'var(--fm)', fontSize: 12, color: deal.source === 'admin' ? 'var(--cyan)' : 'var(--tx3,#736c92)' }}>{deal.source}</span>
                    </td>
                    <td style={td}>
                      <button onClick={() => handleToggleActive(deal)} className="press" style={{ fontFamily: 'var(--fm)', fontSize: 11, fontWeight: 700, borderRadius: 100, padding: '4px 11px', cursor: 'pointer', border: `2px solid ${deal.isActive ? 'var(--lime)' : 'var(--pink)'}`, background: 'transparent', color: deal.isActive ? 'var(--lime)' : 'var(--pink)' }}>{deal.isActive ? 'Active' : 'Inactive'}</button>
                    </td>
                    <td style={td}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 12 }}>
                        <button onClick={() => openEditForm(deal)} className="adminlink" style={{ fontFamily: 'var(--ff)', fontSize: 12.5, fontWeight: 700, color: 'var(--tx2,#aaa3c6)', background: 'none', border: 'none', cursor: 'pointer', transition: 'color .15s' }}>Edit</button>
                        <button onClick={() => handleDelete(deal)} className="admindanger" style={{ fontFamily: 'var(--ff)', fontSize: 12.5, fontWeight: 700, color: 'var(--tx2,#aaa3c6)', background: 'none', border: 'none', cursor: 'pointer', transition: 'color .15s' }}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div style={{ marginTop: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <button disabled={pagination.page <= 1} onClick={() => loadDeals(pagination.page - 1)} className="press" style={{ ...btnSecondary, opacity: pagination.page <= 1 ? 0.35 : 1, cursor: pagination.page <= 1 ? 'default' : 'pointer' }}>Prev</button>
          <span style={{ fontFamily: 'var(--fm)', fontSize: 12.5, color: 'var(--tx2,#aaa3c6)' }}>Page {pagination.page} of {pagination.totalPages}</span>
          <button disabled={pagination.page >= pagination.totalPages} onClick={() => loadDeals(pagination.page + 1)} className="press" style={{ ...btnSecondary, opacity: pagination.page >= pagination.totalPages ? 0.35 : 1, cursor: pagination.page >= pagination.totalPages ? 'default' : 'pointer' }}>Next</button>
        </div>
      )}
    </div>
  )
}
