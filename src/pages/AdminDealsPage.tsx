import { useEffect, useState, type FormEvent } from 'react'
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
  Steam: '#1b2838',
  'Ubisoft Store': '#0070ff',
  Xbox: '#107c10',
  NVIDIA: '#76b900',
  EA: '#ff4747',
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

  return (
    <section className="min-h-screen bg-[#0a0a0a] py-8 px-4">
      <Seo title="Admin — Deal Management" />
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan mb-1">Admin Panel</p>
            <h1 className="text-2xl font-bold text-white">Deal Management</h1>
            <p className="text-sm text-white/50 mt-1">
              Add, edit, delete deals from all stores. Auto-fetch from Steam, Epic, Xbox.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handlePurgeOldSources}
              disabled={purging}
              className="rounded-lg bg-red-500/15 px-4 py-2 text-sm font-medium text-red-400 border border-red-500/30 transition hover:bg-red-500/25 disabled:opacity-50"
            >
              {purging ? 'Purging…' : 'Purge Old Sources'}
            </button>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="rounded-lg bg-white/10 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/20 disabled:opacity-50"
            >
              {refreshing ? 'Fetching…' : 'Refresh from APIs'}
            </button>
            <button
              onClick={openCreateForm}
              className="rounded-lg bg-cyan px-4 py-2 text-sm font-bold text-black transition hover:bg-cyan/80"
            >
              + Add Deal
            </button>
          </div>
        </div>

        {/* Feedback */}
        {feedback.message && (
          <div className={`mb-4 rounded-lg px-4 py-3 text-sm font-medium ${
            feedback.tone === 'success'
              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
              : 'bg-red-500/15 text-red-400 border border-red-500/30'
          }`}>
            {feedback.message}
          </div>
        )}

        {/* Filters */}
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <form onSubmit={handleSearch} className="flex gap-2">
            <input
              type="text"
              placeholder="Search deals…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-cyan/50 focus:outline-none"
            />
            <button type="submit" className="rounded-lg bg-white/10 px-3 py-2 text-sm text-white hover:bg-white/20">Search</button>
          </form>

          <select
            value={filterStore}
            onChange={(e) => setFilterStore(e.target.value)}
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-cyan/50 focus:outline-none"
          >
            <option value="">All Stores</option>
            {STORES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>

          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-cyan/50 focus:outline-none"
          >
            <option value="">All Types</option>
            {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>

          <select
            value={filterSource}
            onChange={(e) => setFilterSource(e.target.value)}
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-cyan/50 focus:outline-none"
          >
            <option value="">All Sources</option>
            <option value="admin">Admin (manual)</option>
            <option value="steam">Steam API</option>
            <option value="epic">Epic API</option>
            <option value="xbox">Xbox API</option>
          </select>

          <span className="ml-auto text-sm text-white/40">{pagination.total} deals</span>
        </div>

        {/* Create/Edit Form */}
        {showForm && (
          <div className="mb-6 rounded-xl border border-white/10 bg-[#121212] p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">{editingDeal ? 'Edit Deal' : 'Add New Deal'}</h2>
              <button onClick={() => setShowForm(false)} className="text-white/40 hover:text-white text-xl leading-none">&times;</button>
            </div>
            <form onSubmit={handleSave} className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              <div className="lg:col-span-2">
                <label className="mb-1 block text-xs font-medium uppercase text-white/50">Title *</label>
                <input required value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-cyan/50 focus:outline-none" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium uppercase text-white/50">Store *</label>
                <select value={form.store} onChange={(e) => setForm((f) => ({ ...f, store: e.target.value }))}
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-cyan/50 focus:outline-none">
                  {STORES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium uppercase text-white/50">Type *</label>
                <select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as DealType }))}
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-cyan/50 focus:outline-none">
                  {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium uppercase text-white/50">Original Price</label>
                <input type="number" step="0.01" value={form.originalPrice} onChange={(e) => setForm((f) => ({ ...f, originalPrice: e.target.value }))}
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-cyan/50 focus:outline-none" placeholder="59.99" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium uppercase text-white/50">Deal Price</label>
                <input type="number" step="0.01" value={form.dealPrice} onChange={(e) => setForm((f) => ({ ...f, dealPrice: e.target.value }))}
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-cyan/50 focus:outline-none" placeholder="0.00" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium uppercase text-white/50">Discount %</label>
                <input type="number" value={form.discountPct} onChange={(e) => setForm((f) => ({ ...f, discountPct: e.target.value }))}
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-cyan/50 focus:outline-none" placeholder="100" />
              </div>
              <div className="lg:col-span-2">
                <label className="mb-1 block text-xs font-medium uppercase text-white/50">Store URL</label>
                <input value={form.url} onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-cyan/50 focus:outline-none" placeholder="https://store.steampowered.com/app/..." />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium uppercase text-white/50">Image URL</label>
                <input value={form.imageUrl} onChange={(e) => setForm((f) => ({ ...f, imageUrl: e.target.value }))}
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-cyan/50 focus:outline-none" placeholder="https://..." />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium uppercase text-white/50">Starts At</label>
                <input type="datetime-local" value={form.startsAt} onChange={(e) => setForm((f) => ({ ...f, startsAt: e.target.value }))}
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-cyan/50 focus:outline-none" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium uppercase text-white/50">Ends At</label>
                <input type="datetime-local" value={form.endsAt} onChange={(e) => setForm((f) => ({ ...f, endsAt: e.target.value }))}
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-cyan/50 focus:outline-none" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium uppercase text-white/50">Game Slug</label>
                <input value={form.gameSlug} onChange={(e) => setForm((f) => ({ ...f, gameSlug: e.target.value }))}
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-cyan/50 focus:outline-none" placeholder="auto-generated from title" />
              </div>
              <div className="flex items-end gap-3 lg:col-span-3">
                <button type="submit" disabled={saving}
                  className="rounded-lg bg-cyan px-6 py-2 text-sm font-bold text-black transition hover:bg-cyan/80 disabled:opacity-50">
                  {saving ? 'Saving…' : (editingDeal ? 'Update Deal' : 'Create Deal')}
                </button>
                <button type="button" onClick={() => setShowForm(false)}
                  className="rounded-lg bg-white/10 px-4 py-2 text-sm text-white hover:bg-white/20">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Deals Table */}
        <div className="overflow-x-auto rounded-xl border border-white/10 bg-[#121212]">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-white/40 text-sm">Loading deals…</div>
          ) : deals.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-white/40 text-sm">
              <p>No deals found.</p>
              <button onClick={openCreateForm} className="mt-2 text-cyan hover:underline text-sm">Add your first deal</button>
            </div>
          ) : (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 text-xs uppercase text-white/40">
                  <th className="px-4 py-3">Game</th>
                  <th className="px-4 py-3">Store</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3 text-right">Price</th>
                  <th className="px-4 py-3 text-right">Discount</th>
                  <th className="px-4 py-3">Source</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {deals.map((deal) => (
                  <tr key={deal.id} className="border-b border-white/5 transition hover:bg-white/5">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {deal.imageUrl ? (
                          <img src={deal.imageUrl} alt="" className="h-8 w-14 rounded object-cover bg-white/5" />
                        ) : (
                          <div className="flex h-8 w-14 items-center justify-center rounded bg-white/5 text-xs text-white/20 font-bold">
                            {deal.title.charAt(0)}
                          </div>
                        )}
                        <span className="font-medium text-white max-w-[200px] truncate" title={deal.title}>{deal.title}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="inline-block rounded px-2 py-0.5 text-xs font-bold text-white"
                        style={{ backgroundColor: STORE_COLORS[deal.store] || '#333' }}
                      >
                        {deal.store}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-white/60">
                      {deal.type === 'FREE_GAME' ? 'Free' : deal.type === 'DISCOUNT' ? 'Discount' : 'Mission'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex flex-col items-end">
                        {deal.originalPrice != null && deal.originalPrice !== deal.dealPrice && (
                          <span className="text-xs text-white/30 line-through">{formatPrice(deal.originalPrice)}</span>
                        )}
                        <span className={`font-bold ${deal.dealPrice === 0 ? 'text-emerald-400' : 'text-white'}`}>
                          {formatPrice(deal.dealPrice)}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {deal.discountPct != null && deal.discountPct > 0 ? (
                        <span className="text-emerald-400 font-bold">-{deal.discountPct}%</span>
                      ) : <span className="text-white/20">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs ${deal.source === 'admin' ? 'text-cyan' : 'text-white/40'}`}>
                        {deal.source}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleToggleActive(deal)}
                        className={`rounded-full px-2 py-0.5 text-xs font-medium transition ${
                          deal.isActive
                            ? 'bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25'
                            : 'bg-red-500/15 text-red-400 hover:bg-red-500/25'
                        }`}
                      >
                        {deal.isActive ? 'Active' : 'Inactive'}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => openEditForm(deal)} className="text-white/40 hover:text-cyan text-xs">Edit</button>
                        <button onClick={() => handleDelete(deal)} className="text-white/40 hover:text-red-400 text-xs">Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="mt-4 flex items-center justify-center gap-2">
            <button
              disabled={pagination.page <= 1}
              onClick={() => loadDeals(pagination.page - 1)}
              className="rounded-lg bg-white/10 px-3 py-1.5 text-sm text-white disabled:opacity-30 hover:bg-white/20"
            >
              Prev
            </button>
            <span className="text-sm text-white/50">
              Page {pagination.page} of {pagination.totalPages}
            </span>
            <button
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => loadDeals(pagination.page + 1)}
              className="rounded-lg bg-white/10 px-3 py-1.5 text-sm text-white disabled:opacity-30 hover:bg-white/20"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </section>
  )
}
