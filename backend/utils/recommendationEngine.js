const { estimatePerformance } = require('./hardware')

function computeAverageRating(game = {}) {
  const ratings = Object.values(game.structuredRatings || {})
  if (!ratings.length) return null
  return ratings.reduce((total, value) => total + Number(value || 0), 0) / ratings.length
}

function formatDecisionLabel(decision) {
  return String(decision || '')
    .replaceAll('_', ' ')
    .toLowerCase()
}

async function buildRecommendation(game, { hardware = null, priceSnapshot = null } = {}) {
  const averageRating = computeAverageRating(game) || 0
  const valueScore = Number(game.valueRating?.score || averageRating || 0)
  const compatibility = hardware ? await estimatePerformance(game, hardware) : null
  const timing = priceSnapshot?.timing || null

  const reasons = []
  let confidence = 0.68
  let decision = 'WAIT_FOR_SALE'
  let summary = 'This looks promising, but there is not enough signal yet for an aggressive recommendation.'
  let alternativeSlug = (game.similarGames || [])[0] || null

  if (compatibility?.canRun === 'Not supported') {
    decision = 'SKIP'
    confidence = 0.94
    reasons.push('Your current platform is not supported for this game.')
  } else if (compatibility?.recommendedPreset === 'Low' && compatibility?.canRun !== 'Yes') {
    decision = 'TRY_ALTERNATIVE'
    confidence = 0.84
    reasons.push('Your hardware is below or close to the minimum target.')
  } else if (valueScore >= 8.5 && averageRating >= 8) {
    decision = 'BUY_NOW'
    confidence = 0.84
    reasons.push('The game scores well on overall quality and value.')
  }

  if (timing?.decision === 'BUY_NOW') {
    decision = compatibility?.canRun === 'Not supported' ? 'SKIP' : 'BUY_NOW'
    confidence = Math.max(confidence, timing.confidence || 0.86)
    reasons.push(`Price timing model leans ${formatDecisionLabel(timing.decision)} right now.`)
  } else if (timing?.decision === 'WAIT_FOR_DROP') {
    if (decision !== 'SKIP' && decision !== 'TRY_ALTERNATIVE') {
      decision = 'WAIT_FOR_SALE'
    }
    confidence = Math.max(confidence, timing.confidence || 0.78)
    reasons.push(
      timing.forecastWindowDays
        ? `Price timing model sees a likely drop window within roughly ${timing.forecastWindowDays} days.`
        : 'Price timing model thinks a stronger discount is still more likely than not.'
    )
  } else if (timing?.decision === 'FAIR_PRICE' && decision === 'WAIT_FOR_SALE') {
    confidence = Math.max(confidence, 0.72)
    reasons.push('Current pricing sits close to the normal sale band, so buying now is not a bad value move.')
  }

  if (priceSnapshot?.bestDeal?.cut && priceSnapshot.bestDeal.cut >= 35 && decision !== 'WAIT_FOR_SALE') {
    decision = compatibility?.canRun === 'Not supported' ? 'SKIP' : 'BUY_NOW'
    confidence = Math.max(confidence, 0.88)
    reasons.push('There is a meaningful live discount right now.')
  } else if (priceSnapshot?.bestDeal && !priceSnapshot.live) {
    reasons.push('Price tracking is not fully live right now, so the value signal is softer.')
  }

  if (compatibility?.recommendedPreset === 'High') {
    reasons.push('Your hardware should support a comfortable high preset experience.')
  } else if (compatibility?.recommendedPreset === 'Medium') {
    reasons.push('Your hardware should be a solid medium-preset fit.')
  }

  if (game.bugStatus?.label?.toLowerCase().includes('minor')) {
    reasons.push('The game still carries some minor technical issues to consider.')
  } else if (game.bugStatus?.label?.toLowerCase().includes('stable')) {
    reasons.push('The technical stability signal is favorable.')
  }

  if (decision === 'BUY_NOW') {
    summary = timing?.summary
      ? `${timing.summary} Your quality and hardware signals support that call.`
      : 'PlayWise would lean toward buying or playing this now based on quality, value, and technical fit.'
  } else if (decision === 'TRY_ALTERNATIVE') {
    summary = 'PlayWise would lean toward a nearby alternative because the current hardware fit is weak.'
  } else if (decision === 'SKIP') {
    summary = 'PlayWise would currently recommend skipping this because the technical fit is not there.'
  } else if (decision === 'WAIT_FOR_SALE' && timing?.summary) {
    summary = timing.summary
  }

  if (!reasons.length) {
    reasons.push('More user preference and pricing history data would strengthen this recommendation.')
  }

  return {
    decision,
    confidence,
    summary,
    reasons: reasons.slice(0, 5),
    alternativeSlug
  }
}

module.exports = {
  buildRecommendation
}
