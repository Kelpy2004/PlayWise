const seedTournaments = [
  {
    slug: 'nexus-pro-league',
    title: 'Nexus Pro League',
    gameSlug: 'assassins-creed',
    status: 'UPCOMING',
    startsAt: new Date(Date.now() + (2 * 60 * 60 * 1000)).toISOString(),
    endsAt: new Date(Date.now() + (6 * 60 * 60 * 1000)).toISOString(),
    metadata: {
      prizePool: '$250K',
      mode: 'Cross-platform'
    }
  },
  {
    slug: 'signal-arena-open',
    title: 'Signal Arena Open',
    gameSlug: 'watch-dogs-2',
    status: 'UPCOMING',
    startsAt: new Date(Date.now() + (26 * 60 * 60 * 1000)).toISOString(),
    endsAt: new Date(Date.now() + (32 * 60 * 60 * 1000)).toISOString(),
    metadata: {
      prizePool: '$50K',
      mode: 'Open bracket'
    }
  }
]

module.exports = seedTournaments
