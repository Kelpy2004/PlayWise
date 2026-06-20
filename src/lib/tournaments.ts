import type { TournamentRecord } from '../types/api'

/* ── game label map ── */

const GAME_LABEL: Record<string, string> = {
  'counter-strike-2': 'CS2',
  valorant: 'Valorant',
  'dota-2': 'Dota 2',
  'league-of-legends': 'League of Legends',
  overwatch: 'Overwatch 2',
  fortnite: 'Fortnite',
  'apex-legends': 'Apex Legends',
  'rocket-league': 'Rocket League',
  'r6-siege': 'Rainbow Six Siege',
  'rainbow-six-siege': 'Rainbow Six Siege',
  'street-fighter-6': 'Street Fighter 6',
  'tekken-8': 'Tekken 8',
  'super-smash-bros-ultimate': 'Smash Bros',
  'super-smash-bros-melee': 'Melee',
  'starcraft-2': 'StarCraft 2',
  'call-of-duty': 'Call of Duty',
  'halo-infinite': 'Halo Infinite',
  hearthstone: 'Hearthstone',
  'ea-sports-fc': 'EA FC',
  pubg: 'PUBG',
  '2xko': '2XKO',
  mlbb: 'Mobile Legends',
  kog: 'King of Glory',
  'pok-mon-unite': 'Pokémon Unite',
  'guilty-gear-strive': 'Guilty Gear Strive',
  'mortal-kombat-1': 'Mortal Kombat 1',
  'rivals-of-aether-ii': 'Rivals of Aether II',
  'magic-the-gathering': 'Magic: The Gathering',
  'yu-gi-oh-duel-links': 'Yu-Gi-Oh! Duel Links',
  'under-night-in-birth-ii-sys-celes': 'Under Night 2',
  'assassins-creed': "Assassin's Creed",
  'mario-kart-world': 'Mario Kart World',
  brawlhalla: 'Brawlhalla',
}

export function formatGameLabel(slug: string): string {
  return GAME_LABEL[slug] || slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

/* ── providers ── */

export const PROVIDERS = [
  { key: 'startgg',    label: 'start.gg',  color: '#1a1a2e', accent: '#06b6d4', icon: 'trophy' },
  { key: 'faceit',     label: 'FACEIT',     color: '#ff5500', accent: '#ff5500', icon: 'military_tech' },
  { key: 'pandascore', label: 'PandaScore', color: '#e44d26', accent: '#e44d26', icon: 'monitoring' },
] as const

export type ProviderDef = (typeof PROVIDERS)[number]

export function providerMeta(key: string): ProviderDef | { key: string; label: string; color: string; accent: string; icon: string } {
  return PROVIDERS.find(p => p.key === key) || { key, label: key, color: '#333', accent: '#06b6d4', icon: 'sports_esports' }
}

/* ── external url resolution ── */

const ESPORTS_SEARCH_BASE: Record<string, string> = {
  'counter-strike-2': 'https://www.hltv.org/search?query=',
  valorant: 'https://www.vlr.gg/search?q=',
  'league-of-legends': 'https://lolesports.com/schedule?leagues=',
  'dota-2': 'https://liquipedia.net/dota2/index.php?search=',
  overwatch: 'https://liquipedia.net/overwatch/index.php?search=',
  'rocket-league': 'https://liquipedia.net/rocketleague/index.php?search=',
  'call-of-duty': 'https://liquipedia.net/callofduty/index.php?search=',
  'r6-siege': 'https://liquipedia.net/rainbowsix/index.php?search=',
  'street-fighter-6': 'https://liquipedia.net/fighters/index.php?search=',
  'tekken-8': 'https://liquipedia.net/fighters/index.php?search=',
  'super-smash-bros-ultimate': 'https://liquipedia.net/smash/index.php?search=',
  'super-smash-bros-melee': 'https://liquipedia.net/smash/index.php?search=',
  mlbb: 'https://liquipedia.net/mobilelegends/index.php?search=',
}

export function resolveExternalUrl(entry: TournamentRecord): string {
  const meta = entry.metadata as Record<string, unknown> | undefined
  if (typeof meta?.registrationUrl === 'string' && meta.registrationUrl) return meta.registrationUrl
  if (typeof meta?.url === 'string' && meta.url) return meta.url
  if (meta?.provider === 'startgg' && typeof meta?.providerSlug === 'string') {
    return `https://www.start.gg/${meta.providerSlug}`
  }
  const slug = entry.gameSlug || ''
  const league = typeof meta?.league === 'string' ? meta.league : ''
  const searchTerm = league || entry.title
  const base = ESPORTS_SEARCH_BASE[slug]
  if (base) return base + encodeURIComponent(searchTerm)
  return `https://liquipedia.net/index.php?search=${encodeURIComponent(searchTerm + ' esports')}`
}

/* ── metadata extractors ── */

export function extractPrize(metadata: TournamentRecord['metadata']): string | null {
  if (!metadata) return null
  const prize = metadata.prizePool ?? metadata.prize
  if (typeof prize === 'string' && prize.trim()) return prize.trim()
  if (typeof prize === 'number' && prize > 0) return `$${prize.toLocaleString()}`
  return null
}

export function extractParticipants(metadata: TournamentRecord['metadata']): number | null {
  if (!metadata) return null
  const count = metadata.maxTeams ?? metadata.slots ?? metadata.teamCount ?? metadata.currentSubscriptions
  if (typeof count === 'number' && count > 0) return count
  return null
}

export function extractRegion(metadata: TournamentRecord['metadata']): string | null {
  if (!metadata) return null
  const parts: string[] = []
  if (typeof metadata.city === 'string' && metadata.city.trim()) parts.push(metadata.city.trim())
  if (typeof metadata.countryCode === 'string' && metadata.countryCode.trim()) parts.push(metadata.countryCode.trim().toUpperCase())
  if (parts.length) return parts.join(', ')
  if (typeof metadata.region === 'string' && metadata.region.trim()) return metadata.region.trim()
  return null
}
