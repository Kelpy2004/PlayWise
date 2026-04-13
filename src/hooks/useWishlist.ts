import { useEffect, useMemo, useState } from 'react'

import { useAuth } from '../context/AuthContext'
import { api } from '../lib/api'
import type { FavoriteGame } from '../types/api'
import type { GameRecord } from '../types/catalog'

type WishlistTone = 'success' | 'danger' | 'warning' | 'info'

export function useWishlist(catalogGames: GameRecord[] = []) {
  const { token } = useAuth()
  const [favoriteGames, setFavoriteGames] = useState<FavoriteGame[]>([])
  const [busySlug, setBusySlug] = useState<string | null>(null)
  const [status, setStatus] = useState<{ tone: WishlistTone; message: string }>({
    tone: 'info',
    message: ''
  })

  useEffect(() => {
    if (!status.message) return undefined

    const timeoutId = window.setTimeout(() => {
      setStatus((current) => (current.message ? { ...current, message: '' } : current))
    }, 2600)

    return () => window.clearTimeout(timeoutId)
  }, [status.message])

  useEffect(() => {
    if (!token) {
      setFavoriteGames([])
      return undefined
    }

    const authToken: string = token

    let ignore = false

    async function loadFavorites() {
      try {
        const favorites = await api.fetchFavorites(authToken)
        if (!ignore) {
          setFavoriteGames(favorites)
        }
      } catch (error) {
        if (!ignore) {
          setStatus({
            tone: 'danger',
            message: error instanceof Error ? error.message : 'Could not load your wishlist.'
          })
        }
      }
    }

    void loadFavorites()

    return () => {
      ignore = true
    }
  }, [token])

  const favoriteSlugSet = useMemo(
    () => new Set(favoriteGames.map((favorite) => favorite.gameSlug)),
    [favoriteGames]
  )

  const wishlistGames = useMemo(
    () => catalogGames.filter((game) => favoriteSlugSet.has(game.slug)),
    [catalogGames, favoriteSlugSet]
  )

  async function toggleWishlist(game: GameRecord) {
    if (!token) {
      setStatus({ tone: 'warning', message: 'Log in to save games to your wishlist.' })
      return
    }

    setBusySlug(game.slug)

    try {
      if (favoriteSlugSet.has(game.slug)) {
        await api.removeFavorite(game.slug, token)
        setFavoriteGames((current) => current.filter((favorite) => favorite.gameSlug !== game.slug))
        setStatus({ tone: 'info', message: 'Removed from wishlist.' })
      } else {
        const favorite = await api.addFavorite(game.slug, token)
        setFavoriteGames((current) => [favorite, ...current.filter((entry) => entry.gameSlug !== game.slug)])
        setStatus({ tone: 'success', message: 'Added to wishlist.' })
      }
    } catch (error) {
      setStatus({
        tone: 'danger',
        message: error instanceof Error ? error.message : 'Could not update your wishlist.'
      })
    } finally {
      setBusySlug(null)
    }
  }

  return {
    busySlug,
    favoriteSlugSet,
    status,
    toggleWishlist,
    wishlistGames
  }
}
