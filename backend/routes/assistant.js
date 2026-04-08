const express = require('express')
const { z } = require('zod')

const { env } = require('../lib/env')
const { ApiError, asyncHandler } = require('../lib/http')
const { optionalAuth } = require('../middleware/auth')
const { validateBody } = require('../middleware/validate')
const { loadGames } = require('../utils/gameCatalog')
const { resolveGameIdentity } = require('../utils/gameResolver')
const { getPriceSnapshot } = require('../utils/priceTracker')
const { buildRecommendation } = require('../utils/recommendationEngine')

const router = express.Router()

const assistantSchema = z.object({
  messages: z.array(
    z.object({
      role: z.enum(['user', 'assistant']),
      content: z.string().trim().min(1).max(4000)
    })
  ).min(1).max(16),
  pagePath: z.string().trim().max(300).optional(),
  gameSlug: z.string().trim().max(200).optional()
})

function extractOutputText(payload) {
  if (typeof payload?.output_text === 'string' && payload.output_text.trim()) {
    return payload.output_text.trim()
  }

  if (!Array.isArray(payload?.output)) return ''

  return payload.output
    .flatMap((item) => Array.isArray(item?.content) ? item.content : [])
    .map((content) => {
      if (content?.type === 'output_text' && typeof content.text === 'string') {
        return content.text
      }

      return ''
    })
    .join('\n')
    .trim()
}

function summarizeSite(games) {
  const openSourceCount = games.filter((game) => game.openSource).length
  const externalCount = games.filter((game) => game.catalogSource === 'igdb').length

  return {
    catalogSize: games.length,
    openSourceCount,
    externalCount,
    coreFeatures: [
      'Game discovery',
      'PC compatibility checks',
      'Price timing insights',
      'Shared comments and reactions',
      'Favorites and saved hardware profiles',
      'AI-assisted recommendations'
    ]
  }
}

function buildFallbackReply({ latestMessage, context, reason }) {
  const question = String(latestMessage || '').toLowerCase()

  if (context.activeGame && (question.includes('buy') || question.includes('price') || question.includes('wait'))) {
    const timing = context.priceSnapshot?.timing
    const bestDeal = context.priceSnapshot?.bestDeal
    const recommendation = context.recommendation

    if (timing || bestDeal || recommendation) {
      const lines = []

      if (context.activeGame?.title) {
        lines.push(`${context.activeGame.title} is currently being evaluated with PlayWise's live pricing signals.`)
      }

      if (bestDeal?.currentPrice && bestDeal?.store) {
        lines.push(`The best live deal PlayWise sees right now is ${bestDeal.currentPrice} on ${bestDeal.store}.`)
      }

      if (timing?.summary) {
        lines.push(timing.summary)
      } else if (recommendation?.summary) {
        lines.push(recommendation.summary)
      }

      if (reason) {
        lines.push(reason)
      }

      return lines.join(' ')
    }
  }

  if (question.includes('what can playwise do') || question.includes('what can this site do') || question.includes('site')) {
    return `PlayWise helps you discover games, check hardware compatibility, read price timing signals, post shared comments, save favorites and hardware profiles, and generate recommendation previews. The live AI layer is temporarily unavailable, so this answer is coming from the built-in site assistant instead.`
  }

  if (context.activeGame) {
    return `You are on ${context.activeGame.title}. PlayWise can explain price timing, hardware fit, and recommendation logic for this page. The live AI response is temporarily unavailable, so this is the fallback assistant talking.${reason ? ` ${reason}` : ''}`
  }

  return `The live AI response is temporarily unavailable, so PlayWise is answering with its built-in fallback assistant instead. You can still ask about site features, pricing, compatibility, comments, and recommendations.${reason ? ` ${reason}` : ''}`
}

async function callOpenAI({ messages, context }) {
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: env.OPENAI_MODEL,
      max_output_tokens: 450,
      instructions: [
        'You are the PlayWise assistant inside a gaming decision platform.',
        'Answer site questions, price questions, recommendation questions, and game detail questions using the provided live context first.',
        'If the user asks something broader, you may answer briefly, but keep it useful and avoid pretending to know live PlayWise data that is not in context.',
        'Do not invent prices, discounts, hardware results, or site features.',
        'When price timing data exists, explain the verdict in plain language.',
        'Keep answers concise, clear, and helpful.',
        `Live context: ${JSON.stringify(context)}`
      ].join(' '),
      input: messages.map((message) => ({
        role: message.role,
        content: [
          {
            type: 'input_text',
            text: message.content
          }
        ]
      }))
    })
  })

  if (!response.ok) {
    const message = await response.text().catch(() => response.statusText)
    throw new Error(message || `OpenAI request failed with status ${response.status}`)
  }

  const payload = await response.json()
  const reply = extractOutputText(payload)

  if (!reply) {
    throw new Error('The assistant did not return any text.')
  }

  return {
    reply,
    model: payload.model || env.OPENAI_MODEL
  }
}

router.post(
  '/chat',
  optionalAuth,
  validateBody(assistantSchema),
  asyncHandler(async (req, res) => {
    if (!env.OPENAI_API_KEY) {
      throw new ApiError(503, 'The PlayWise assistant is offline until OPENAI_API_KEY is configured.')
    }

    const games = await loadGames()
    const identity = req.validatedBody.gameSlug
      ? await resolveGameIdentity(req.validatedBody.gameSlug)
      : { game: null }
    const game = identity.game || null

    const priceSnapshot = game?.slug
      ? await getPriceSnapshot(game.slug, { title: game.title }).catch(() => null)
      : null
    const recommendation = game
      ? await buildRecommendation(game, { priceSnapshot }).catch(() => null)
      : null

    const context = {
      pagePath: req.validatedBody.pagePath || '/',
      site: summarizeSite(games),
      activeGame: game
        ? {
            slug: game.slug,
            title: game.title,
            year: game.year || null,
            genres: game.genre || [],
            heroTag: game.heroTag || null,
            description: game.description || null,
            averageRating: game.averageRating || null,
            source: game.catalogSource || 'playwise'
          }
        : null,
      priceSnapshot: priceSnapshot
        ? {
            message: priceSnapshot.message,
            bestDeal: priceSnapshot.bestDeal,
            historicalLow: priceSnapshot.historicalLow,
            timing: priceSnapshot.timing
          }
        : null,
      recommendation
    }

    let result

    try {
      result = await callOpenAI({
        messages: req.validatedBody.messages,
        context
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'The AI response failed.'
      const lowered = message.toLowerCase()

      if (lowered.includes('insufficient_quota') || lowered.includes('"code":"insufficient_quota"') || lowered.includes('quota')) {
        return res.json({
          reply: buildFallbackReply({
            latestMessage: req.validatedBody.messages[req.validatedBody.messages.length - 1]?.content,
            context,
            reason: 'The connected OpenAI project has no remaining API quota at the moment.'
          }),
          model: 'playwise-fallback'
        })
      }

      if (lowered.includes('429') || lowered.includes('rate limit')) {
        return res.json({
          reply: buildFallbackReply({
            latestMessage: req.validatedBody.messages[req.validatedBody.messages.length - 1]?.content,
            context,
            reason: 'The live AI service is rate-limited right now.'
          }),
          model: 'playwise-fallback'
        })
      }

      throw error
    }

    res.json({
      reply: result.reply,
      model: result.model
    })
  })
)

module.exports = router
