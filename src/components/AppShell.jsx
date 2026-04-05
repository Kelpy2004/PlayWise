import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'

import { useAuth } from '../context/AuthContext'

function NavItem({ to, children }) {
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
  const [menuOpen, setMenuOpen] = useState(false)
  const [searchText, setSearchText] = useState('')
  const [animatedPlaceholder, setAnimatedPlaceholder] = useState('')
  const { user, isLoading, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const searchPlaceholder = 'Search'

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    setSearchText(params.get('q') || '')
  }, [location.search])

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
    let timeoutId

    setAnimatedPlaceholder('')

    const animatePlaceholder = () => {
      if (deleting) {
        currentIndex -= 1
      } else {
        currentIndex += 1
      }

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

  function updateHomeSearch(value, replace = true) {
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

  function handleSearchSubmit(event) {
    event.preventDefault()
    updateHomeSearch(searchText, false)
    setMenuOpen(false)
  }

  function handleSearchChange(event) {
    const nextValue = event.target.value
    setSearchText(nextValue)

    if (location.pathname === '/') {
      updateHomeSearch(nextValue, true)
    }
  }

  function handleSectionJump(sectionId) {
    const section = document.getElementById(sectionId)

    if (location.pathname === '/' && section) {
      section.scrollIntoView({ behavior: 'smooth', block: 'start' })
      setMenuOpen(false)
      return
    }

    navigate({ pathname: '/', hash: sectionId })
    setMenuOpen(false)
  }

  return (
    <div className="app-shell">
      <header className="site-header sticky-top">
        <nav className="navbar navbar-expand-lg navbar-light">
          <div className="container py-3">
            <NavLink to="/" className="navbar-brand d-flex align-items-center gap-3" onClick={() => setMenuOpen(false)}>
              <span className="brand-mark">PW</span>
              <span>
                <span className="brand-title d-block">PlayWise</span>
                <small className="text-secondary-emphasis">Decide before you download</small>
              </span>
            </NavLink>

            <button
              className="navbar-toggler border-0 shadow-none"
              type="button"
              aria-expanded={menuOpen}
              aria-label="Toggle navigation"
              onClick={() => setMenuOpen((current) => !current)}
            >
              <span className="navbar-toggler-icon" />
            </button>

            <div className={`collapse navbar-collapse ${menuOpen ? 'show' : ''}`}>
              <ul className="navbar-nav ms-auto align-items-lg-center gap-lg-1">
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
                className="btn btn-sm btn-outline-dark rounded-pill px-3 ms-lg-3 mt-3 mt-lg-0 nav-jump-btn"
                onClick={() => handleSectionJump('contact')}
              >
                Contact
              </button>

              <form className="nav-search ms-lg-3 mt-3 mt-lg-0" onSubmit={handleSearchSubmit}>
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

              <div className="d-flex flex-column flex-lg-row gap-2 ms-lg-3 mt-3 mt-lg-0">
                {isLoading ? (
                  <span className="btn btn-sm btn-outline-secondary rounded-pill px-3 disabled">Restoring session</span>
                ) : user ? (
                  <>
                    <span className="btn btn-sm btn-light rounded-pill px-3 disabled">
                      {user.username} / {user.role}
                    </span>
                    <button type="button" className="btn btn-sm btn-dark rounded-pill px-3" onClick={logout}>
                      Logout
                    </button>
                  </>
                ) : (
                  <>
                    <NavLink to="/login" className="btn btn-sm btn-outline-dark rounded-pill px-3" onClick={() => setMenuOpen(false)}>
                      Login
                    </NavLink>
                    <NavLink to="/register" className="btn btn-sm btn-brand rounded-pill px-3" onClick={() => setMenuOpen(false)}>
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
            <p className="mb-2">Frontend: React + Bootstrap</p>
            <p className="mb-2">Backend: Express + MongoDB fallback support</p>
            <p className="mb-0">PlayWise 2026</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
