import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'

import type { GameRecord } from '../types/catalog'

const RECENT_KEY = 'playwise.recentSearches'
const MAX_RECENT = 5

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function HighlightMatch({ text, query }: { text: string; query: string }) {
  if (!query) return <>{text}</>
  const escaped = escapeRegex(query)
  const parts = text.split(new RegExp(`(${escaped})`, 'i'))
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase() ? (
          <mark key={i} className="bg-cyan/20 text-inherit rounded-[1px]">
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  )
}

type SearchItem =
  | { kind: 'recent'; text: string }
  | { kind: 'game'; game: GameRecord }
  | { kind: 'viewAll' }

export default function GlobalSearch({ games, theme }: { games: GameRecord[]; theme: string }) {
  const [query, setQuery] = useState('')
  const [debounced, setDebounced] = useState('')
  const [open, setOpen] = useState(false)
  const [idx, setIdx] = useState(-1)
  const [recents, setRecents] = useState<string[]>([])
  const boxRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()
  const location = useLocation()

  const [phaseIdx, setPhaseIdx] = useState(0)
  const phrases = useMemo(() => ['Search games...', 'Search deals...'], [])

  useEffect(() => {
    const id = setInterval(() => setPhaseIdx((i) => (i + 1) % phrases.length), 2500)
    return () => clearInterval(id)
  }, [phrases])

  useEffect(() => {
    try {
      const raw = localStorage.getItem(RECENT_KEY)
      if (raw) setRecents(JSON.parse(raw))
    } catch {}
  }, [])

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 200)
    return () => clearTimeout(t)
  }, [query])

  useEffect(() => {
    setIdx(-1)
  }, [debounced])

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    setOpen(false)
    setQuery('')
  }, [location.pathname, location.search])

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        inputRef.current?.focus()
        setOpen(true)
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  const gameHits = useMemo(() => {
    if (!debounced) return []
    const q = debounced.toLowerCase()
    const scored: Array<{ g: GameRecord; s: number }> = []
    for (const g of games) {
      const t = g.title.toLowerCase()
      const slug = (g.slug || '').toLowerCase().replace(/-/g, ' ')
      const sc = (g.shortCode || '').toLowerCase()
      if (t === q || sc === q) {
        scored.push({ g, s: 100 })
        continue
      }
      if (t.startsWith(q) || sc.startsWith(q)) {
        scored.push({ g, s: 80 })
        continue
      }
      if (t.includes(q) || slug.includes(q) || sc.includes(q)) {
        scored.push({ g, s: 60 })
        continue
      }
      const tags = [...(g.genres || g.genre || []), g.heroTag || ''].join(' ').toLowerCase()
      if (tags.includes(q)) {
        scored.push({ g, s: 30 })
        continue
      }
    }
    return scored
      .sort((a, b) => b.s - a.s || a.g.title.localeCompare(b.g.title))
      .slice(0, 5)
      .map((x) => x.g)
  }, [games, debounced])

  const items = useMemo<SearchItem[]>(() => {
    if (!debounced) return recents.map((text) => ({ kind: 'recent' as const, text }))
    const list: SearchItem[] = []
    for (const g of gameHits) list.push({ kind: 'game', game: g })
    if (list.length > 0) list.push({ kind: 'viewAll' })
    return list
  }, [debounced, gameHits, recents])

  function saveRecent(term: string) {
    const trimmed = term.trim()
    if (!trimmed) return
    const next = [trimmed, ...recents.filter((s) => s.toLowerCase() !== trimmed.toLowerCase())].slice(0, MAX_RECENT)
    setRecents(next)
    try {
      localStorage.setItem(RECENT_KEY, JSON.stringify(next))
    } catch {}
  }

  function removeRecent(term: string) {
    const next = recents.filter((s) => s !== term)
    setRecents(next)
    try {
      localStorage.setItem(RECENT_KEY, JSON.stringify(next))
    } catch {}
  }

  function go(path: string, term: string) {
    saveRecent(term)
    navigate(path)
    setOpen(false)
    setQuery('')
  }

  function handleSelect(item: SearchItem) {
    switch (item.kind) {
      case 'recent':
        setQuery(item.text)
        setDebounced(item.text)
        break
      case 'game':
        go(`/games/${item.game.slug}`, item.game.title)
        break
      case 'viewAll':
        go(`/games?q=${encodeURIComponent(debounced)}`, debounced)
        break
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      setOpen(true)
      e.preventDefault()
      return
    }
    if (!open) {
      if (e.key === 'Enter' && query.trim()) {
        e.preventDefault()
        go(`/games?q=${encodeURIComponent(query.trim())}`, query.trim())
      }
      return
    }
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setIdx((i) => Math.min(i + 1, items.length - 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        setIdx((i) => Math.max(i - 1, -1))
        break
      case 'Enter':
        e.preventDefault()
        if (idx >= 0 && idx < items.length) {
          handleSelect(items[idx])
        } else if (query.trim()) {
          go(`/games?q=${encodeURIComponent(query.trim())}`, query.trim())
        }
        break
      case 'Escape':
        setOpen(false)
        inputRef.current?.blur()
        break
    }
  }

  const showDrop = open && (debounced ? true : recents.length > 0)

  return (
    <div ref={boxRef} className="relative hidden xl:block">
      <div className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--panel)] px-3 py-2 text-[var(--muted)] transition-all duration-300 hover:border-cyan/25 focus-within:border-cyan/40 focus-within:shadow-[0_0_20px_rgba(0,212,255,0.1)]">
        <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4 shrink-0">
          <circle cx="7" cy="7" r="4.25" stroke="currentColor" strokeWidth="1.5" />
          <path d="M10.4 10.4 14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={phrases[phaseIdx]}
          className="w-40 border-none bg-transparent p-0 text-xs text-[var(--text)] outline-none placeholder:text-[var(--muted)] focus:ring-0"
          role="combobox"
          aria-expanded={showDrop}
          aria-autocomplete="list"
          autoComplete="off"
        />
        {query ? (
          <button
            type="button"
            onClick={() => {
              setQuery('')
              setDebounced('')
              inputRef.current?.focus()
            }}
            className="shrink-0 text-[var(--muted)] hover:text-[var(--text)] transition-colors"
            aria-label="Clear"
          >
            <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5">
              <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        ) : (
          <kbd className="shrink-0 rounded border border-[var(--border)] bg-[var(--deep)] px-1.5 py-0.5 text-[9px] font-mono text-[var(--muted)]">
            Ctrl K
          </kbd>
        )}
      </div>

      <AnimatePresence>
        {showDrop && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.12 }}
            className="absolute right-0 top-full z-[200] mt-2 w-[380px] max-h-[440px] overflow-y-auto overflow-x-hidden rounded-xl border"
            style={{
              borderColor: theme === 'dark' ? 'rgba(0,212,255,0.12)' : 'rgba(0,136,187,0.1)',
              background: theme === 'dark' ? 'rgba(14,14,14,0.96)' : 'rgba(250,247,242,0.97)',
              boxShadow:
                theme === 'dark'
                  ? '0 20px 60px rgba(0,0,0,0.5), 0 0 30px rgba(0,212,255,0.04)'
                  : '0 20px 60px rgba(0,0,0,0.12)',
            }}
            role="listbox"
          >
            {/* Recent searches (empty query) */}
            {!debounced && recents.length > 0 && (
              <div className="p-2">
                <p className="px-2 pb-1 text-[10px] font-black uppercase tracking-[0.15em] text-[var(--muted)]">Recent</p>
                {recents.map((term, i) => (
                  <div
                    key={term}
                    className={`flex items-center gap-2 rounded-lg px-2 py-1.5 cursor-pointer transition-colors ${idx === i ? 'bg-cyan/10' : 'hover:bg-white/[0.04]'}`}
                    onClick={() => handleSelect({ kind: 'recent', text: term })}
                    role="option"
                    aria-selected={idx === i}
                  >
                    <span className="material-symbols-outlined text-[14px] text-[var(--muted)]">history</span>
                    <span className="flex-1 text-xs text-[var(--text)] truncate">{term}</span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        removeRecent(term)
                      }}
                      className="shrink-0 text-[var(--muted)] hover:text-[var(--text)]"
                    >
                      <svg viewBox="0 0 16 16" fill="none" className="h-3 w-3">
                        <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Search results */}
            {debounced && (
              <>
                {/* Games */}
                {gameHits.length > 0 && (
                  <div className="p-2">
                    <p className="px-2 pb-1 text-[10px] font-black uppercase tracking-[0.15em] text-[var(--muted)]">Games</p>
                    {gameHits.map((g, i) => (
                      <div
                        key={g.slug}
                        className={`flex items-center gap-3 rounded-lg px-2 py-2 cursor-pointer transition-colors ${idx === i ? 'bg-cyan/10' : 'hover:bg-white/[0.04]'}`}
                        onClick={() => handleSelect({ kind: 'game', game: g })}
                        role="option"
                        aria-selected={idx === i}
                      >
                        {g.image ? (
                          <img src={g.image} alt="" className="h-9 w-7 rounded object-cover shrink-0" loading="lazy" />
                        ) : (
                          <div className="h-9 w-7 rounded bg-[var(--panel)] flex items-center justify-center shrink-0">
                            <span className="text-[10px] font-black text-[var(--muted)]">{g.title.charAt(0)}</span>
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold text-[var(--text)] truncate">
                            <HighlightMatch text={g.title} query={debounced} />
                          </p>
                          {(g.genres || g.genre || []).length > 0 && (
                            <p className="text-[10px] text-[var(--muted)] truncate">
                              {(g.genres || g.genre || []).slice(0, 3).join(' · ')}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* No results */}
                {gameHits.length === 0 && (
                  <div className="p-6 text-center">
                    <p className="text-xs font-semibold text-[var(--muted)]">No results for &ldquo;{debounced}&rdquo;</p>
                    <p className="mt-1 text-[10px] text-[var(--muted)] opacity-60">Try a different search term</p>
                  </div>
                )}

                {/* View all */}
                {gameHits.length > 0 && (
                  <div className="border-t border-[var(--border)] p-2">
                    <div
                      className={`flex items-center gap-2 rounded-lg px-2 py-2 cursor-pointer transition-colors ${
                        idx === gameHits.length ? 'bg-cyan/10' : 'hover:bg-white/[0.04]'
                      }`}
                      onClick={() => go(`/games?q=${encodeURIComponent(debounced)}`, debounced)}
                      role="option"
                      aria-selected={idx === gameHits.length}
                    >
                      <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4 shrink-0 text-cyan">
                        <circle cx="7" cy="7" r="4.25" stroke="currentColor" strokeWidth="1.5" />
                        <path d="M10.4 10.4 14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                      </svg>
                      <span className="text-xs font-semibold text-cyan">View all results for &ldquo;{debounced}&rdquo;</span>
                    </div>
                  </div>
                )}
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
