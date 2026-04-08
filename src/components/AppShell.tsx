import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'

import { useAuth } from '../context/AuthContext'
import { trackEvent } from '../lib/telemetry'
import SiteAssistant from './SiteAssistant'

function NavItem({ to, children }: { to: string; children: string }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `nav-link px-lg-3 ${isActive ? 'active fw-semibold' : 'text-secondary-emphasis'}`
      }
    >
      {children}
    </NavLink>
  )
}

export default function AppShell() {
  const [searchText, setSearchText] = useState('')
  const [animatedPlaceholder, setAnimatedPlaceholder] = useState('')
  const { user, isLoading, logout, token } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const searchPlaceholder = useMemo(() => 'Search', [])

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    setSearchText(params.get('q') || '')
  }, [location.search])

  useEffect(() => {
    void trackEvent(
      {
        category: 'navigation',
        action: 'page_view',
        label: location.pathname,
        meta: { search: location.search, hash: location.hash }
      },
      token
    )
  }, [location.hash, location.pathname, location.search, token])

  useEffect(() => {
    if (!location.hash) {
      return undefined
    }

    const sectionId = location.hash.replace('#', '')
    const frameId = window.requestAnimationFrame(() => {
      const section = document.getElementById(sectionId)

      if (section) {
        section.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    })

    return () => window.cancelAnimationFrame(frameId)
  }, [location.hash, location.pathname])

  useEffect(() => {
    if (searchText.trim()) {
      return undefined
    }

    let currentIndex = 0
    let deleting = false
    let timeoutId = 0

    setAnimatedPlaceholder('')

    const animatePlaceholder = () => {
      currentIndex = deleting ? currentIndex - 1 : currentIndex + 1
      setAnimatedPlaceholder(searchPlaceholder.slice(0, currentIndex))

      if (!deleting && currentIndex === searchPlaceholder.length) {
        deleting = true
        timeoutId = window.setTimeout(animatePlaceholder, 650)
        return
      }

      if (deleting && currentIndex === 0) {
        deleting = false
        timeoutId = window.setTimeout(animatePlaceholder, 260)
        return
      }

      timeoutId = window.setTimeout(animatePlaceholder, deleting ? 95 : 120)
    }

    timeoutId = window.setTimeout(animatePlaceholder, 220)
    return () => window.clearTimeout(timeoutId)
  }, [searchPlaceholder, searchText])

  function updateHomeSearch(value: string, replace = true) {
    const params = new URLSearchParams()
    const trimmed = value.trim()

    if (trimmed) {
      params.set('q', trimmed)
    }

    navigate(
      {
        pathname: '/',
        search: params.toString() ? `?${params.toString()}` : '',
        hash: 'discover'
      },
      { replace }
    )
  }

  function handleSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    updateHomeSearch(searchText, false)
    if (searchText.trim()) {
      void trackEvent(
        {
          category: 'discovery',
          action: 'navbar_search_submit',
          label: searchText.trim()
        },
        token
      )
    }
  }

  function handleSearchChange(event: ChangeEvent<HTMLInputElement>) {
    const nextValue = event.target.value
    setSearchText(nextValue)

    if (location.pathname === '/') {
      updateHomeSearch(nextValue, true)
    }
  }

  function handleSectionJump(sectionId: string) {
    const section = document.getElementById(sectionId)

    if (location.pathname === '/' && section) {
      section.scrollIntoView({ behavior: 'smooth', block: 'start' })
      return
    }

    navigate({ pathname: '/', hash: sectionId })
  }

  return (
    <div className="app-shell min-h-screen bg-playwise-cream/30">
      <header className="site-header sticky-top">
        <nav className="navbar navbar-light">
          <div className="container py-3">
            <NavLink to="/" className="navbar-brand d-flex align-items-center gap-3">
              <span className="brand-mark">PW</span>
              <span>
                <span className="brand-title d-block">PlayWise</span>
                <small className="text-secondary-emphasis">Decide before you download</small>
              </span>
            </NavLink>

            <div className="top-nav-rail ms-auto">
              <ul className="navbar-nav flex-row flex-wrap align-items-center gap-1 gap-lg-2">
                <li className="nav-item">
                  <NavItem to="/">Discover</NavItem>
                </li>
                <li className="nav-item">
                  <NavItem to="/open-source">Open Source</NavItem>
                </li>
                {user?.role === 'admin' ? (
                  <li className="nav-item">
                    <NavItem to="/admin/hardware">Hardware Admin</NavItem>
                  </li>
                ) : null}
              </ul>

              <button
                type="button"
                className="btn btn-sm btn-outline-dark rounded-pill px-3 nav-jump-btn"
                onClick={() => handleSectionJump('contact')}
              >
                Contact
              </button>

              <form className="nav-search" onSubmit={handleSearchSubmit}>
                <span className="nav-search-icon" aria-hidden="true">
                  <svg viewBox="0 0 16 16" fill="none" focusable="false">
                    <circle cx="7" cy="7" r="4.25" stroke="currentColor" strokeWidth="1.5" />
                    <path d="M10.4 10.4 14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </span>
                <input
                  type="search"
                  className="form-control rounded-pill nav-search-input"
                  placeholder={animatedPlaceholder}
                  aria-label="Search"
                  value={searchText}
                  onChange={handleSearchChange}
                />
              </form>

              <div className="d-flex flex-row flex-wrap gap-2 top-auth-actions">
                {isLoading ? (
                  <span className="btn btn-sm btn-outline-secondary rounded-pill px-3 disabled">Restoring session</span>
                ) : user ? (
                  <>
                    <span className="btn btn-sm btn-light rounded-pill px-3 disabled">
                      {user.username} / {user.role}
                    </span>
                    <button
                      type="button"
                      className="btn btn-sm btn-dark rounded-pill px-3"
                      onClick={() => {
                        void trackEvent({ category: 'auth', action: 'logout', label: user.username }, token)
                        logout()
                      }}
                    >
                      Logout
                    </button>
                  </>
                ) : (
                  <>
                    <NavLink to="/login" className="btn btn-sm btn-outline-dark rounded-pill px-3">
                      Login
                    </NavLink>
                    <NavLink to="/register" className="btn btn-sm btn-brand rounded-pill px-3">
                      Register
                    </NavLink>
                  </>
                )}
              </div>
            </div>
          </div>
        </nav>
      </header>

      <main>
        <Outlet />
      </main>

      <SiteAssistant />

      <footer className="site-footer border-top">
        <div className="container py-5 d-flex flex-column flex-lg-row justify-content-between gap-4">
          <div>
            <p className="eyebrow text-uppercase mb-2">PlayWise</p>
            <h2 className="footer-title mb-2">A smarter gaming decision platform.</h2>
            <p className="text-secondary-emphasis mb-0">
              Built as a modern React experience for comparing games, checking hardware fit, and finding better-value picks.
            </p>
          </div>
          <div className="footer-meta text-secondary-emphasis">
            <p className="mb-2">Frontend: React + TypeScript + Tailwind foundation</p>
            <p className="mb-2">Backend: Express + PostgreSQL-ready architecture</p>
            <p className="mb-0">PlayWise 2026</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
