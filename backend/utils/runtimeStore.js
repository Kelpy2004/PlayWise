const fs = require('fs')
const path = require('path')

const RUNTIME_STORE_PATH = path.resolve(__dirname, '../data/runtime-store.json')

const store = {
  users: [],
  comments: new Map(),
  gameReactions: new Map(),
  commentReactions: new Map(),
  contacts: [],
  favorites: new Map(),
  savedHardwareProfiles: new Map(),
  priceAlerts: new Map(),
  newsletterSubscribers: [],
  tournamentSubscriptions: new Map(),
  notificationDeliveries: [],
  tournaments: [],
  telemetryEvents: [],
  recommendationSnapshots: [],
  runtimeErrors: []
}

let demoUserCounter = 1
let demoCommentCounter = 1

function ensureDirectory(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
}

function serializeMapOfArrays(map) {
  return Object.fromEntries(Array.from(map.entries()))
}

function deserializeMapOfArrays(value) {
  return new Map(Object.entries(value || {}).map(([key, entry]) => [key, Array.isArray(entry) ? entry : []]))
}

function serializeMapOfMaps(map) {
  return Object.fromEntries(
    Array.from(map.entries()).map(([key, nestedMap]) => [key, Object.fromEntries(Array.from(nestedMap.entries()))])
  )
}

function deserializeMapOfMaps(value) {
  return new Map(
    Object.entries(value || {}).map(([key, entry]) => [
      key,
      new Map(Object.entries(entry && typeof entry === 'object' ? entry : {}))
    ])
  )
}

function syncCountersFromStore() {
  const highestUserId = store.users.reduce((highest, user) => {
    const match = String(user?.id || '').match(/^demo-user-(\d+)$/)
    return match ? Math.max(highest, Number(match[1])) : highest
  }, 0)

  const highestCommentId = Array.from(store.comments.values())
    .flat()
    .reduce((highest, comment) => {
      const match = String(comment?.id || '').match(/^demo-comment-(\d+)$/)
      return match ? Math.max(highest, Number(match[1])) : highest
    }, 0)

  demoUserCounter = highestUserId + 1
  demoCommentCounter = highestCommentId + 1
}

function saveRuntimeStore() {
  try {
    ensureDirectory(RUNTIME_STORE_PATH)
    fs.writeFileSync(
      RUNTIME_STORE_PATH,
      JSON.stringify(
        {
          users: store.users,
          comments: serializeMapOfArrays(store.comments),
          gameReactions: serializeMapOfMaps(store.gameReactions),
          commentReactions: serializeMapOfMaps(store.commentReactions),
          contacts: store.contacts,
          favorites: serializeMapOfArrays(store.favorites),
          savedHardwareProfiles: serializeMapOfArrays(store.savedHardwareProfiles),
          priceAlerts: serializeMapOfArrays(store.priceAlerts),
          newsletterSubscribers: store.newsletterSubscribers,
          tournamentSubscriptions: serializeMapOfArrays(store.tournamentSubscriptions),
          notificationDeliveries: store.notificationDeliveries,
          tournaments: store.tournaments,
          telemetryEvents: store.telemetryEvents,
          recommendationSnapshots: store.recommendationSnapshots,
          runtimeErrors: store.runtimeErrors
        },
        null,
        2
      )
    )
  } catch (_) {
    // Keep demo mode usable even if local persistence fails.
  }
}

function loadRuntimeStore() {
  try {
    if (!fs.existsSync(RUNTIME_STORE_PATH)) return

    const payload = JSON.parse(fs.readFileSync(RUNTIME_STORE_PATH, 'utf8'))
    store.users = Array.isArray(payload.users) ? payload.users : []
    store.comments = deserializeMapOfArrays(payload.comments)
    store.gameReactions = deserializeMapOfMaps(payload.gameReactions)
    store.commentReactions = deserializeMapOfMaps(payload.commentReactions)
    store.contacts = Array.isArray(payload.contacts) ? payload.contacts : []
    store.favorites = deserializeMapOfArrays(payload.favorites)
    store.savedHardwareProfiles = deserializeMapOfArrays(payload.savedHardwareProfiles)
    store.priceAlerts = deserializeMapOfArrays(payload.priceAlerts)
    store.newsletterSubscribers = Array.isArray(payload.newsletterSubscribers) ? payload.newsletterSubscribers : []
    store.tournamentSubscriptions = deserializeMapOfArrays(payload.tournamentSubscriptions)
    store.notificationDeliveries = Array.isArray(payload.notificationDeliveries) ? payload.notificationDeliveries : []
    store.tournaments = Array.isArray(payload.tournaments) ? payload.tournaments : []
    store.telemetryEvents = Array.isArray(payload.telemetryEvents) ? payload.telemetryEvents : []
    store.recommendationSnapshots = Array.isArray(payload.recommendationSnapshots) ? payload.recommendationSnapshots : []
    store.runtimeErrors = Array.isArray(payload.runtimeErrors) ? payload.runtimeErrors : []
    syncCountersFromStore()
  } catch (_) {
    // Ignore malformed persistence files and continue with an empty demo store.
  }
}

loadRuntimeStore()

function getDemoUsers() {
  return store.users
}

function nextDemoUserId() {
  return `demo-user-${demoUserCounter++}`
}

function addDemoUser(user) {
  store.users.push(user)
  saveRuntimeStore()
  return user
}

function countDemoAdmins() {
  return store.users.filter((user) => String(user.role || '').toLowerCase() === 'admin').length
}

function findDemoUserByUsernameOrEmail(usernameOrEmail) {
  const needle = String(usernameOrEmail || '').trim().toLowerCase()
  return (
    store.users.find(
      (user) => user.username.toLowerCase() === needle || user.email.toLowerCase() === needle
    ) || null
  )
}

function nextDemoCommentId() {
  return `demo-comment-${demoCommentCounter++}`
}

function addRuntimeComment(gameSlug, comment) {
  const comments = store.comments.get(gameSlug) || []
  const nextComment = {
    id: comment.id || nextDemoCommentId(),
    likeCount: Number(comment.likeCount) || 0,
    dislikeCount: Number(comment.dislikeCount) || 0,
    ...comment
  }
  comments.unshift(nextComment)
  store.comments.set(gameSlug, comments.slice(0, 50))
  saveRuntimeStore()
  return nextComment
}

function getRuntimeComments(gameSlug, userId) {
  const comments = store.comments.get(gameSlug) || []
  return comments.map((comment) => ({
    ...comment,
    userReaction: userId ? getRuntimeCommentReaction(comment.id, userId) : null
  }))
}

function findRuntimeCommentById(commentId) {
  for (const comments of store.comments.values()) {
    const found = comments.find((comment) => comment.id === commentId)
    if (found) return found
  }

  return null
}

function getGameReactionBucket(gameSlug) {
  if (!store.gameReactions.has(gameSlug)) {
    store.gameReactions.set(gameSlug, new Map())
  }

  return store.gameReactions.get(gameSlug)
}

function getCommentReactionBucket(commentId) {
  if (!store.commentReactions.has(commentId)) {
    store.commentReactions.set(commentId, new Map())
  }

  return store.commentReactions.get(commentId)
}

function summarizeReactionBucket(bucket, userId) {
  let likeCount = 0
  let dislikeCount = 0

  for (const reaction of bucket.values()) {
    if (reaction === 'LIKE') likeCount += 1
    if (reaction === 'DISLIKE') dislikeCount += 1
  }

  return {
    likeCount,
    dislikeCount,
    userReaction: userId ? bucket.get(userId) || null : null
  }
}

function getRuntimeGameReactionSummary(gameSlug, userId) {
  return summarizeReactionBucket(getGameReactionBucket(gameSlug), userId)
}

function setRuntimeGameReaction(userId, gameSlug, reaction) {
  const bucket = getGameReactionBucket(gameSlug)

  if (!reaction) {
    bucket.delete(userId)
  } else {
    bucket.set(userId, reaction)
  }

  saveRuntimeStore()
  return summarizeReactionBucket(bucket, userId)
}

function getRuntimeCommentReaction(commentId, userId) {
  return getCommentReactionBucket(commentId).get(userId) || null
}

function setRuntimeCommentReaction(userId, commentId, reaction) {
  const comment = findRuntimeCommentById(commentId)
  if (!comment) {
    return null
  }

  const bucket = getCommentReactionBucket(commentId)
  const previous = bucket.get(userId) || null

  if (reaction === previous) {
    return {
      likeCount: comment.likeCount || 0,
      dislikeCount: comment.dislikeCount || 0,
      userReaction: previous
    }
  }

  if (previous === 'LIKE') comment.likeCount = Math.max(0, (comment.likeCount || 0) - 1)
  if (previous === 'DISLIKE') comment.dislikeCount = Math.max(0, (comment.dislikeCount || 0) - 1)

  if (!reaction) {
    bucket.delete(userId)
  } else {
    bucket.set(userId, reaction)
  }

  if (reaction === 'LIKE') comment.likeCount = (comment.likeCount || 0) + 1
  if (reaction === 'DISLIKE') comment.dislikeCount = (comment.dislikeCount || 0) + 1

  saveRuntimeStore()
  return {
    likeCount: comment.likeCount || 0,
    dislikeCount: comment.dislikeCount || 0,
    userReaction: reaction || null
  }
}

function addRuntimeContact(contact) {
  store.contacts.unshift(contact)
  saveRuntimeStore()
  return contact
}

function getRuntimeFavorites(userId) {
  return store.favorites.get(userId) || []
}

function addRuntimeFavorite(userId, gameSlug) {
  const current = getRuntimeFavorites(userId)
  if (!current.some((entry) => entry.gameSlug === gameSlug)) {
    current.unshift({
      id: `favorite-${userId}-${gameSlug}`,
      gameSlug,
      createdAt: new Date().toISOString()
    })
  }
  store.favorites.set(userId, current)
  saveRuntimeStore()
  return current[0]
}

function removeRuntimeFavorite(userId, gameSlug) {
  const next = getRuntimeFavorites(userId).filter((entry) => entry.gameSlug !== gameSlug)
  store.favorites.set(userId, next)
  saveRuntimeStore()
}

function getRuntimeHardwareProfiles(userId) {
  return store.savedHardwareProfiles.get(userId) || []
}

function addRuntimeHardwareProfile(userId, profile) {
  const current = getRuntimeHardwareProfiles(userId)
  const nextProfile = {
    ...profile,
    id: `hardware-profile-${userId}-${current.length + 1}`
  }
  current.unshift(nextProfile)
  store.savedHardwareProfiles.set(userId, current.slice(0, 20))
  saveRuntimeStore()
  return nextProfile
}

function addTelemetryEvent(event) {
  store.telemetryEvents.unshift({ ...event, id: `telemetry-${store.telemetryEvents.length + 1}` })
  store.telemetryEvents = store.telemetryEvents.slice(0, 2000)
  saveRuntimeStore()
}

function addRecommendationSnapshot(snapshot) {
  store.recommendationSnapshots.unshift({
    ...snapshot,
    id: `recommendation-${store.recommendationSnapshots.length + 1}`
  })
  store.recommendationSnapshots = store.recommendationSnapshots.slice(0, 200)
  saveRuntimeStore()
}

function recordRuntimeError(entry) {
  store.runtimeErrors.unshift(entry)
  store.runtimeErrors = store.runtimeErrors.slice(0, 200)
  saveRuntimeStore()
}

function getRuntimePriceAlerts(userId) {
  return store.priceAlerts.get(userId) || []
}

function getAllRuntimePriceAlerts() {
  return Array.from(store.priceAlerts.values()).flat()
}

function upsertRuntimePriceAlert(userId, alert) {
  const current = getRuntimePriceAlerts(userId)
  const existingIndex = current.findIndex((entry) => entry.id === alert.id)
  const next = {
    id: alert.id || `price-alert-${userId}-${Date.now()}`,
    ...alert
  }

  if (existingIndex >= 0) {
    current[existingIndex] = { ...current[existingIndex], ...next }
  } else {
    current.unshift(next)
  }

  store.priceAlerts.set(userId, current.slice(0, 200))
  saveRuntimeStore()
  return next
}

function removeRuntimePriceAlert(userId, alertId) {
  const next = getRuntimePriceAlerts(userId).filter((entry) => entry.id !== alertId)
  store.priceAlerts.set(userId, next)
  saveRuntimeStore()
}

function getRuntimeTournamentSubscriptions(userId) {
  return store.tournamentSubscriptions.get(userId) || []
}

function getAllRuntimeTournamentSubscriptions() {
  return Array.from(store.tournamentSubscriptions.values()).flat()
}

function upsertRuntimeTournamentSubscription(userId, subscription) {
  const current = getRuntimeTournamentSubscriptions(userId)
  const existingIndex = current.findIndex((entry) => entry.id === subscription.id)
  const next = {
    id: subscription.id || `tournament-sub-${userId}-${Date.now()}`,
    ...subscription
  }

  if (existingIndex >= 0) {
    current[existingIndex] = { ...current[existingIndex], ...next }
  } else {
    current.unshift(next)
  }

  store.tournamentSubscriptions.set(userId, current.slice(0, 200))
  saveRuntimeStore()
  return next
}

function removeRuntimeTournamentSubscription(userId, subscriptionId) {
  const next = getRuntimeTournamentSubscriptions(userId).filter((entry) => entry.id !== subscriptionId)
  store.tournamentSubscriptions.set(userId, next)
  saveRuntimeStore()
}

function upsertRuntimeNewsletterSubscriber(subscriber) {
  const normalizedEmail = String(subscriber.email || '').trim().toLowerCase()
  if (!normalizedEmail) return null

  const index = store.newsletterSubscribers.findIndex((entry) => String(entry.email || '').toLowerCase() === normalizedEmail)
  const next = {
    id: subscriber.id || `newsletter-${Date.now()}`,
    ...subscriber,
    email: normalizedEmail
  }

  if (index >= 0) {
    store.newsletterSubscribers[index] = { ...store.newsletterSubscribers[index], ...next }
  } else {
    store.newsletterSubscribers.unshift(next)
  }

  store.newsletterSubscribers = store.newsletterSubscribers.slice(0, 2000)
  saveRuntimeStore()
  return next
}

function findRuntimeNewsletterSubscriberByEmail(email) {
  const normalizedEmail = String(email || '').trim().toLowerCase()
  return store.newsletterSubscribers.find((entry) => String(entry.email || '').toLowerCase() === normalizedEmail) || null
}

function getRuntimeNewsletterSubscribers() {
  return store.newsletterSubscribers
}

function addRuntimeNotificationDelivery(delivery) {
  store.notificationDeliveries.unshift({
    id: delivery.id || `notification-${Date.now()}`,
    createdAt: new Date().toISOString(),
    ...delivery
  })
  store.notificationDeliveries = store.notificationDeliveries.slice(0, 2000)
  saveRuntimeStore()
  return store.notificationDeliveries[0]
}

function getRuntimeNotificationDeliveries() {
  return store.notificationDeliveries
}

function getRuntimeTournaments() {
  return store.tournaments
}

function setRuntimeTournaments(tournaments) {
  store.tournaments = Array.isArray(tournaments) ? tournaments : []
  saveRuntimeStore()
}

module.exports = {
  addDemoUser,
  addRuntimeComment,
  addRuntimeContact,
  addRuntimeFavorite,
  addRuntimeHardwareProfile,
  addTelemetryEvent,
  addRecommendationSnapshot,
  countDemoAdmins,
  findDemoUserByUsernameOrEmail,
  getDemoUsers,
  getRuntimeComments,
  getRuntimeGameReactionSummary,
  getRuntimeFavorites,
  getRuntimeHardwareProfiles,
  getRuntimeNotificationDeliveries,
  getRuntimeNewsletterSubscribers,
  getRuntimePriceAlerts,
  getAllRuntimePriceAlerts,
  getAllRuntimeTournamentSubscriptions,
  getRuntimeTournamentSubscriptions,
  getRuntimeTournaments,
  findRuntimeNewsletterSubscriberByEmail,
  nextDemoUserId,
  addRuntimeNotificationDelivery,
  recordRuntimeError,
  removeRuntimeFavorite,
  removeRuntimePriceAlert,
  removeRuntimeTournamentSubscription,
  setRuntimeTournaments,
  setRuntimeCommentReaction,
  setRuntimeGameReaction,
  upsertRuntimeNewsletterSubscriber,
  upsertRuntimePriceAlert,
  upsertRuntimeTournamentSubscription
}
